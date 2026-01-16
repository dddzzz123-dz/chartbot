import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { detectIntent } from './intent.js';
import {
  applyModifyPlan,
  convertType,
  generateDummySpec,
  getTypeLabel,
  inferModifyPlan,
  inferTargetType,
  inferValueEdit,
  finalizeGeneratedSpec,
  scaleSpec,
  transposeSpec
} from './ops.js';
import { normalizeBotSpec } from './schema.js';
import { replyCleared, replyConverted, replyGenerated, replyModified, replyNeedSpecFirst, replyUnsupported } from './reply.js';
import { buildConvertCapabilities, buildModifyCapabilities } from './capabilities.js';
import {
  clearArkRuntimeApiKey,
  buildCapabilitiesPromptPayload,
  buildConvertTypePromptPayload,
  buildGenerateSpecPromptPayload,
  buildModifyPlanPromptPayload,
  generateCapabilitiesByLLM,
  generateSpecByLLM,
  getArkConfigStatus,
  hasArkKey,
  planConvertByLLM,
  planModifyByLLM,
  setArkRuntimeConfig
} from './llm.js';

const app = express();
const allowAll = process.env.ALLOW_ALL_ORIGINS === '1';
const corsOptions = allowAll
  ? { origin: true }
  : { origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/] };
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

const sessions = new Map();

function getOrCreateSession(sessionId) {
  const sid = sessionId || `s_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const existing = sessions.get(sid);
  if (existing) return { sid, session: existing };
  const created = { current_spec: null, chat_history: [] };
  sessions.set(sid, created);
  return { sid, session: created };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/settings', (_req, res) => {
  res.json({ ark: getArkConfigStatus() });
});

const SettingsReqSchema = z.object({
  ark_api_key: z.string().optional(),
  ark_model: z.string().optional()
});

app.post('/api/settings', (req, res) => {
  const parsed = SettingsReqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { ark_api_key, ark_model } = parsed.data;
  if (typeof ark_api_key === 'string') {
    if (ark_api_key.trim()) setArkRuntimeConfig({ apiKey: ark_api_key, model: ark_model });
    else clearArkRuntimeApiKey();
  } else if (typeof ark_model === 'string') {
    setArkRuntimeConfig({ model: ark_model });
  }
  res.json({ ok: true, ark: getArkConfigStatus() });
});

const CapabilitiesReqSchema = z.object({
  session_id: z.string().optional(),
  mode: z.enum(['convert', 'modify']),
  client_spec: z.any().optional()
});

app.post('/api/capabilities', async (req, res) => {
  const parsed = CapabilitiesReqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { sid, session } = getOrCreateSession(parsed.data.session_id);
  const { mode, client_spec } = parsed.data;

  let spec = session.current_spec;
  if (!spec && client_spec) {
    try {
      spec = normalizeBotSpec(client_spec);
    } catch (_e) {
      spec = null;
    }
  }

  let result = mode === 'convert' ? buildConvertCapabilities(spec) : buildModifyCapabilities(spec);
  let llmUsed = false;
  let agent = {
    step: 'capabilities',
    mode,
    path: 'fallback',
    prompt: null,
    plan: null
  };

  if (hasArkKey()) {
    try {
      agent.prompt = buildCapabilitiesPromptPayload({ mode, currentSpec: spec });
      const planned = await generateCapabilitiesByLLM({ mode, currentSpec: spec });
      llmUsed = true;
      agent.path = 'llm';
      agent.plan = planned;
      if (mode === 'convert') {
        const currentType = spec?.type ?? null;
        const types = planned.types.filter(t => t.type !== currentType);
        if (types.length) result = { mode: 'convert', types };
      } else {
        if (planned.types.length) result = { mode: 'modify', types: planned.types };
      }
    } catch (_e) {}
  }

  res.json({ session_id: sid, ...result, meta: { llm_used: llmUsed, agent } });
});

const ChatReqSchema = z.object({
  session_id: z.string().optional(),
  message: z.string().min(1),
  client_spec: z.any().optional()
});

app.post('/api/chat', async (req, res) => {
  const parsed = ChatReqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { sid, session } = getOrCreateSession(parsed.data.session_id);
  const { message, client_spec } = parsed.data;

  if (client_spec) {
    try {
      session.current_spec = normalizeBotSpec(client_spec);
    } catch (_e) {}
  }

  session.chat_history.push({ role: 'user', content: message });
  const intentResult = detectIntent(message);

  if (intentResult.intent === 'CLEAR') {
    session.current_spec = null;
    const reply = replyCleared();
    session.chat_history.push({ role: 'assistant', content: reply });
    res.json({ session_id: sid, reply, spec: null, action: 'CLEAR' });
    return;
  }

  if (intentResult.intent === 'UNSUPPORTED') {
    const reply = replyUnsupported(intentResult.feature);
    session.chat_history.push({ role: 'assistant', content: reply });
    res.json({ session_id: sid, reply, spec: null, action: 'UNSUPPORTED' });
    return;
  }

  if (intentResult.intent === 'CHITCHAT') {
    const reply = '我可以帮你生成或修改 3D-1 图表。直接用自然语言描述，例如“帮我生成一个销售数据的图”“换成热力图”“转置一下”。';
    session.chat_history.push({ role: 'assistant', content: reply });
    res.json({ session_id: sid, reply, spec: session.current_spec, action: 'CHITCHAT' });
    return;
  }

  if (intentResult.intent === 'GENERATE') {
    let spec = null;
    let llmUsed = false;
    let agent = { step: 'generate', path: 'dummy', prompt: null };
    if (hasArkKey()) {
      try {
        agent.prompt = buildGenerateSpecPromptPayload(message);
        const raw = await generateSpecByLLM(message);
        spec = finalizeGeneratedSpec(raw);
        llmUsed = true;
        agent.path = 'llm';
      } catch (_e) {}
    }
    if (!spec) {
      spec = generateDummySpec(message);
    }
    session.current_spec = spec;
    const reply = replyGenerated(getTypeLabel(spec.type));
    session.chat_history.push({ role: 'assistant', content: reply });
    res.json({
      session_id: sid,
      reply,
      spec,
      action: 'GENERATE',
      meta: { llm_used: llmUsed, agent },
      ui: {
        buttons: [
          { id: 'choose_convert', label: '转换图表', kind: 'action', payload: { mode: 'convert' } },
          { id: 'choose_modify', label: '修改图表', kind: 'action', payload: { mode: 'modify' } }
        ]
      }
    });
    return;
  }

  if (!session.current_spec) {
    const reply = replyNeedSpecFirst();
    session.chat_history.push({ role: 'assistant', content: reply });
    res.json({ session_id: sid, reply, spec: null, action: intentResult.intent });
    return;
  }

  if (intentResult.intent === 'CONVERT') {
    let targetType = inferTargetType(message);
    let agent = { step: 'convert', path: targetType ? 'rule' : 'none', prompt: null, plan: null };
    if (!targetType) {
      if (hasArkKey()) {
        try {
          agent.prompt = buildConvertTypePromptPayload(message);
          const plan = await planConvertByLLM(message);
          targetType = plan.targetType ?? null;
          agent.plan = plan;
          agent.path = targetType ? 'llm' : 'none';
        } catch (_e) {}
      }
    }
    if (!targetType) {
      const reply = '你想转换成哪种图表？比如“换成热力图/多折线图/堆叠柱状图”。';
      session.chat_history.push({ role: 'assistant', content: reply });
      res.json({ session_id: sid, reply, spec: session.current_spec, action: 'CONVERT', meta: { agent } });
      return;
    }
    const spec = convertType(session.current_spec, targetType);
    session.current_spec = spec;
    const reply = replyConverted(getTypeLabel(spec.type));
    session.chat_history.push({ role: 'assistant', content: reply });
    res.json({ session_id: sid, reply, spec, action: 'CONVERT', meta: { agent } });
    return;
  }

  if (intentResult.intent === 'MODIFY') {
    const text = String(message ?? '');
    let agent = { step: 'modify', path: 'rule', inferred: null, prompt: null, plan: null };
    if (/(转置)/.test(text)) {
      const spec = transposeSpec(session.current_spec);
      session.current_spec = spec;
      const reply = replyModified('完成转置');
      session.chat_history.push({ role: 'assistant', content: reply });
      res.json({ session_id: sid, reply, spec, action: 'MODIFY', meta: { modify_type: 'transpose', agent } });
      return;
    }
    const scaleMatch = text.match(/(乘以|x|\\*)\\s*([0-9]+(\\.[0-9]+)?)/);
    if (scaleMatch) {
      const factor = Number(scaleMatch[2]);
      const spec = scaleSpec(session.current_spec, factor);
      session.current_spec = spec;
      const reply = replyModified(`将所有数据乘以 ${factor}`);
      session.chat_history.push({ role: 'assistant', content: reply });
      res.json({ session_id: sid, reply, spec, action: 'MODIFY', meta: { modify_type: 'scale', agent } });
      return;
    }
    const inferredPlan = inferModifyPlan(message, session.current_spec);
    if (inferredPlan) {
      try {
        agent.inferred = inferredPlan;
        const { spec, desc } = applyModifyPlan(session.current_spec, inferredPlan);
        session.current_spec = spec;
        const reply = replyModified(desc);
        session.chat_history.push({ role: 'assistant', content: reply });
        res.json({ session_id: sid, reply, spec, action: 'MODIFY', meta: { modify_type: inferredPlan.modifyType, agent } });
        return;
      } catch (_e) {}
    }
    const inferredValue = inferValueEdit(message, session.current_spec);
    if (inferredValue) {
      try {
        const { spec, desc } = applyModifyPlan(session.current_spec, { modifyType: 'value', payload: inferredValue });
        session.current_spec = spec;
        const reply = replyModified(desc);
        session.chat_history.push({ role: 'assistant', content: reply });
        res.json({ session_id: sid, reply, spec, action: 'MODIFY', meta: { modify_type: 'value' } });
        return;
      } catch (_e) {}
    }
    if (hasArkKey()) {
      try {
        agent.prompt = buildModifyPlanPromptPayload(message, session.current_spec);
        const plan = await planModifyByLLM(message, session.current_spec);
        agent.plan = plan;
        agent.path = 'llm';
        const { spec, desc } = applyModifyPlan(session.current_spec, plan);
        session.current_spec = spec;
        const reply = replyModified(desc);
        session.chat_history.push({ role: 'assistant', content: reply });
        res.json({ session_id: sid, reply, spec, action: 'MODIFY', meta: { modify_type: plan.modifyType, agent } });
        return;
      } catch (_e) {}
    }
    const reply = '我能做的修改包括：改某个数值、改标签、添加/删除一行或一列、改标题、改单位、转置、整体缩放。你可以说得更具体一点。';
    session.chat_history.push({ role: 'assistant', content: reply });
    res.json({ session_id: sid, reply, spec: session.current_spec, action: 'MODIFY', meta: { agent } });
    return;
  }

  res.json({ session_id: sid, reply: '未处理的意图', spec: session.current_spec, action: intentResult.intent });
});

const port = Number(process.env.PORT || 3301);
const host = String(process.env.HOST || '127.0.0.1');
app.listen(port, host, () => {
  process.stdout.write(`chart-bot server listening on http://${host}:${port}\n`);
});
