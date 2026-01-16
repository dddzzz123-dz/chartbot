import { z } from 'zod';

const ALLOWED_TYPES = [
  'grouped_bar',
  'stacked_bar',
  'grouped_horizontal_bar',
  'stacked_horizontal_bar',
  'multi_line',
  'stacked_area',
  'heatmap',
  'polar_stacked_bar',
  'polar_stacked_ring',
  'multi_radar'
];

const ArkResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string()
        })
      })
    )
    .min(1)
});

let runtimeArkApiKey = '';
let runtimeArkModel = '';

export function hasArkKey() {
  return Boolean(runtimeArkApiKey || process.env.ARK_API_KEY);
}

export function getArkModel() {
  return runtimeArkModel || process.env.ARK_MODEL || 'doubao-seed-1-8-251228';
}

export function setArkRuntimeConfig({ apiKey, model } = {}) {
  if (typeof apiKey === 'string') runtimeArkApiKey = apiKey.trim();
  if (typeof model === 'string') runtimeArkModel = model.trim();
}

export function clearArkRuntimeApiKey() {
  runtimeArkApiKey = '';
}

export function getArkConfigStatus() {
  const runtime = Boolean(runtimeArkApiKey);
  const env = Boolean(process.env.ARK_API_KEY);
  return {
    configured: runtime || env,
    source: runtime ? 'runtime' : env ? 'env' : null,
    model: getArkModel()
  };
}

export async function arkChat(messages, { model = getArkModel(), temperature = 0 } = {}) {
  const apiKey = runtimeArkApiKey || process.env.ARK_API_KEY;
  if (!apiKey) {
    throw new Error('ARK_API_KEY is not set');
  }
  const resp = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature,
      messages
    })
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`ArkError ${resp.status}: ${text}`);
  }
  const json = ArkResponseSchema.parse(await resp.json());
  return json.choices[0].message.content;
}

export function extractJson(text) {
  const s = String(text ?? '').trim();
  if (!s) throw new Error('Empty LLM response');

  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = s.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }
  return JSON.parse(s);
}

export const IntentSchema = z.enum(['GENERATE', 'CONVERT', 'MODIFY', 'CLEAR', 'UNSUPPORTED', 'CHITCHAT']);

export const ConvertPlanSchema = z.object({
  targetType: z
    .enum(ALLOWED_TYPES)
    .nullable()
});

export const ModifyPlanSchema = z.object({
  modifyType: z.enum([
    'value',
    'label',
    'add_label',
    'remove_label',
    'category',
    'unit',
    'title',
    'transpose',
    'scale'
  ]),
  payload: z.record(z.any()).default({})
});

export const ConvertCapabilitiesSchema = z.object({
  mode: z.literal('convert'),
  types: z
    .array(
      z.object({
        type: z.enum(ALLOWED_TYPES),
        label: z.string().min(1),
        exampleUtterance: z.string().min(1)
      })
    )
    .min(1)
});

export const ModifyCapabilitiesSchema = z.object({
  mode: z.literal('modify'),
  types: z
    .array(
      z.object({
        modifyType: ModifyPlanSchema.shape.modifyType,
        label: z.string().min(1),
        exampleUtterance: z.string().min(1)
      })
    )
    .min(1)
});

export function buildConvertTypePromptPayload(message) {
  return {
    task: 'convert_type',
    instruction: message,
    allowedTypes: ALLOWED_TYPES
  };
}

export function buildModifyPlanPromptPayload(message, currentSpec) {
  return {
    task: 'modify_spec',
    instruction: message,
    currentSpec: {
      theme: currentSpec?.theme,
      title: currentSpec?.title,
      type: currentSpec?.type,
      x_category: currentSpec?.x_category,
      y_category: currentSpec?.y_category,
      x_labels: currentSpec?.x_labels,
      y_labels: currentSpec?.y_labels,
      unit: currentSpec?.unit,
      shape: [currentSpec?.y_labels?.length ?? 0, currentSpec?.x_labels?.length ?? 0]
    },
    allowedModifyTypes: ModifyPlanSchema.shape.modifyType.options
  };
}

export function buildGenerateSpecPromptPayload(message) {
  return {
    task: 'generate_spec',
    instruction: message,
    allowedTypes: ALLOWED_TYPES,
    defaultType: 'grouped_bar'
  };
}

export function buildCapabilitiesPromptPayload({ mode, currentSpec }) {
  return {
    task: 'capabilities',
    mode,
    allowedChartTypes: ALLOWED_TYPES,
    allowedModifyTypes: ModifyPlanSchema.shape.modifyType.options,
    currentSpec: currentSpec
      ? {
          type: currentSpec.type,
          title: currentSpec.title,
          x_category: currentSpec.x_category,
          y_category: currentSpec.y_category,
          x_labels: currentSpec.x_labels,
          y_labels: currentSpec.y_labels,
          unit: currentSpec.unit,
          shape: [currentSpec.y_labels?.length ?? 0, currentSpec.x_labels?.length ?? 0]
        }
      : null
  };
}

export async function planConvertByLLM(message) {
  const system = `你是一个图表Bot的控制器。请只输出JSON，不要输出多余文字。`;
  const user = JSON.stringify(buildConvertTypePromptPayload(message), null, 2);
  const content = await arkChat([
    { role: 'system', content: system },
    {
      role: 'user',
      content:
        `${user}\n\n` +
        `输出格式：{"targetType": "<allowedTypes之一或null>"}`
    }
  ]);
  return ConvertPlanSchema.parse(extractJson(content));
}

export async function planModifyByLLM(message, currentSpec) {
  const system = `你是一个图表Bot的控制器。请只输出JSON，不要输出多余文字。`;
  const user = JSON.stringify(buildModifyPlanPromptPayload(message, currentSpec), null, 2);
  const content = await arkChat([
    { role: 'system', content: system },
    {
      role: 'user',
      content:
        `${user}\n\n` +
        `输出格式：{"modifyType":"<allowedModifyTypes之一>","payload":{...}}\n` +
        `其中：\n` +
        `- value: payload 需要包含 xLabel 或 xIndex；yLabel 或 yIndex；newValue\n` +
        `- label: payload 需要包含 axis('x'|'y')、from、to\n` +
        `- add_label/remove_label: payload 需要包含 axis('x'|'y')、label；add_label 可包含 values(number[]) 或 value(number)\n` +
        `- category: payload 包含 axis('x'|'y')、to\n` +
        `- unit: payload 包含 to，可选 factor\n` +
        `- title: payload 包含 to\n` +
        `- transpose: payload 为空对象\n` +
        `- scale: payload 包含 factor`
    }
  ]);
  return ModifyPlanSchema.parse(extractJson(content));
}

export async function generateSpecByLLM(message) {
  const system =
    `你是一个图表Bot的生成器。请只输出JSON，不要输出多余文字。\n` +
    `目标：根据用户自然语言，生成一份“语义贴合、结构合理、可视化友好”的3D-1 BotSpec。\n` +
    `你输出的JSON必须是一个完整的3D-1 BotSpec，字段如下：\n` +
    `theme,title,type,dimension,x_category,y_category,x_labels,y_labels,data,unit。\n` +
    `硬性约束（遵循3D-1统一Spec规则）：\n` +
    `- dimension 固定为 2\n` +
    `- type 必须在 allowedTypes 中\n` +
    `- x_labels 与 y_labels：每个数组 3~6 个标签；每个标签 ≤6 字符；不使用“类别1/产品A/系列1/A/B/C”等占位符\n` +
    `- data 为二维数组：行数=y_labels.length，列数=x_labels.length，元素为数字（不要字符串）\n` +
    `- 不要输出 NaN/Infinity/null\n` +
    `- unit 格式必须为 “指标名称(单位符号)” 例如：销售额(万元)、转化率(%)、客流量(人次/小时)\n` +
    `theme/title 规则：\n` +
    `- theme：抽象主题，必须包含 2个维度 + 1个指标；但不能体现图表类型特征，禁止包含“对比/比较/趋势/分布/热力图/柱状图/折线图/雷达图/堆叠/分组”等词\n` +
    `- title：图表特化标题，必须根据 type 套用模板生成（同type要自然流畅，可加“各/不同”等修饰）\n` +
    `  grouped_bar: {x}的{y}{指标}对比\n` +
    `  stacked_bar: {x}的{y}{指标}累计\n` +
    `  grouped_horizontal_bar: 各{x}的{y}{指标}横向比较\n` +
    `  stacked_horizontal_bar: {x}的{y}{指标}横向堆叠\n` +
    `  multi_line: {y}在{x}的{指标}趋势\n` +
    `  stacked_area: {y}在{x}的{指标}累积趋势\n` +
    `  heatmap: {x}与{y}的{指标}分布\n` +
    `  polar_stacked_bar: {x}的{y}{指标}极坐标堆叠\n` +
    `  polar_stacked_ring: {x}的{y}{指标}环形堆叠\n` +
    `  multi_radar: {y}在{x}的{指标}雷达对比\n` +
    `语义与可读性要求：\n` +
    `- 如果用户提到时间（月份/季度/周/日/时段），优先用作 x_labels\n` +
    `- 如果用户提到地区/门店/渠道/产品/部门，优先用作 y_labels（系列）或 x_labels（类别），保持一致\n` +
    `- x_category/y_category 要简洁明确（≤6字符）且有意义\n` +
    `- 数据范围要合理：不要全部相同；允许少量波动；不要极端大数\n` +
    `- type 选择要与语义匹配：比较系列用柱状/折线，趋势用折线/面积，强对比或矩阵用热力图，雷达用于多指标对比`;

  const user = JSON.stringify(buildGenerateSpecPromptPayload(message), null, 2);

  const content = await arkChat(
    [
    { role: 'system', content: system },
    {
      role: 'user',
      content:
        `${user}\n\n` +
        `输出示例（注意theme不含对比/趋势等，title按type模板）：\n` +
        `{"theme":"2024年各区域不同产品的销售额","title":"各区域不同产品的销售额对比","type":"grouped_bar","dimension":2,"x_category":"区域","y_category":"产品","x_labels":["华东","华南","华北"],"y_labels":["手机","耳机","平板"],"data":[[3200,2800,4100],[2900,3100,3800],[3400,2600,3900]],"unit":"销售额(万元)"}`
    }
    ],
    { temperature: 0.2 }
  );
  return extractJson(content);
}

export async function generateCapabilitiesByLLM({ mode, currentSpec }) {
  const system =
    `你是一个图表Bot的能力提示生成器。请只输出JSON，不要输出多余文字。\n` +
    `你需要给出用户可点击的能力选项列表，并且每个选项要附带一条可直接发送的示例口令。\n` +
    `要求：如果是 modify 模式，示例口令中“需要用户替换的部分”必须用中括号包起来，例如：把[1F][早高峰]改成[35.0]。`;

  const common = buildCapabilitiesPromptPayload({ mode, currentSpec });

  const schemaHint =
    mode === 'convert'
      ? `输出格式：{"mode":"convert","types":[{"type":"<allowedChartTypes之一>","label":"中文名","exampleUtterance":"可直接发送的口令"}]}`
      : `输出格式：{"mode":"modify","types":[{"modifyType":"<allowedModifyTypes之一>","label":"中文名","exampleUtterance":"可直接发送的口令"}]}`;

  const content = await arkChat([
    { role: 'system', content: system },
    { role: 'user', content: `${JSON.stringify(common, null, 2)}\n\n${schemaHint}` }
  ]);

  const json = extractJson(content);
  return mode === 'convert' ? ConvertCapabilitiesSchema.parse(json) : ModifyCapabilitiesSchema.parse(json);
}
