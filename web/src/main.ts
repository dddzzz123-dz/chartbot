import * as echarts from 'echarts';
import './style.css';
import type { BotSpec } from './botSpec';
import { botSpecTo3D1 } from './adapter';
import { render3D1 } from './lib/render3d1';
import { resizeChart } from './lib/echarts';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type ChatResponse = {
  session_id: string;
  reply: string;
  spec: BotSpec | null;
  action: string;
  meta?: any;
  ui?: { buttons?: Array<{ id: string; label: string; kind: string; payload?: any }> };
};

type SettingsResponse = {
  ark?: { configured: boolean; source: 'runtime' | 'env' | null; model: string };
};

const app = document.getElementById('app') as HTMLDivElement;

let sessionId = localStorage.getItem('chart_bot_session_id') || '';
let currentSpec: BotSpec | null = null;
let messages: ChatMessage[] = [
  { role: 'assistant', content: '我可以帮你生成或修改 3D-1 图表。直接用自然语言描述，例如“帮我生成一个销售数据的图”“换成热力图”“转置一下”。' }
];
let apiOk: boolean | null = false;
let busy = false;
let zoom = Number(localStorage.getItem('chart_bot_zoom') || '1');
if (!Number.isFinite(zoom) || zoom <= 0) zoom = 1;
const API_BASE = (import.meta as any).env?.VITE_API_BASE ? String((import.meta as any).env.VITE_API_BASE) : '';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function setSpec(spec: BotSpec | null) {
  currentSpec = spec;
  updateQuickSelect();
  renderRight();
}

function appendMessage(msg: ChatMessage) {
  messages = [...messages, msg];
  renderLeft();
}

function setBusy(v: boolean) {
  busy = v;
  progressWrap.style.display = busy ? 'block' : 'none';
  input.disabled = busy;
  sendBtn.disabled = busy;
  quickSelect.disabled = busy;
  llmBtn.disabled = busy;
  renderLeft();
}

async function postChat(message: string) {
  const body = {
    session_id: sessionId || undefined,
    message,
    client_spec: currentSpec ?? undefined
  };
  try {
    setBusy(true);
    const resp = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} ${text}`);
    }
    const json = (await resp.json()) as ChatResponse;
    sessionId = json.session_id;
    localStorage.setItem('chart_bot_session_id', sessionId);
    const metaLabel =
      json.action === 'GENERATE' && json.meta && typeof json.meta.llm_used === 'boolean'
        ? ` llm=${json.meta.llm_used ? 'on' : 'off'}`
        : '';
    appendMessage({ role: 'assistant', content: `[${json.action}${metaLabel}] ${json.reply}` });
    if (json.spec) setSpec(json.spec);
    apiOk = true;
  } catch (e) {
    apiOk = false;
    appendMessage({ role: 'assistant', content: `请求失败：${String(e)}` });
  } finally {
    setBusy(false);
    updateApiStatus();
  }
}

async function pingHealth() {
  let healthOk = false;
  let llmConfigured = false;
  try {
    const resp = await fetch(`${API_BASE}/api/health`);
    healthOk = resp.ok;
  } catch (_e) {
    healthOk = false;
  }
  try {
    const s = await getSettings();
    llmConfigured = Boolean(s?.ark?.configured);
  } catch (_e) {
    llmConfigured = false;
  }
  apiOk = healthOk && llmConfigured;
  updateApiStatus();
}

async function getSettings(): Promise<SettingsResponse> {
  const resp = await fetch(`${API_BASE}/api/settings`);
  return (await resp.json()) as any;
}

async function postSettings(body: { ark_api_key?: string; ark_model?: string }) {
  const resp = await fetch(`${API_BASE}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return (await resp.json()) as any;
}

function renderLeft() {
  leftMessages.innerHTML = '';
  for (const m of messages) {
    const row = el('div', 'msg');
    const role = el('div', 'msgRole');
    role.textContent = m.role;
    const bubble = el('div', `msgBubble ${m.role === 'assistant' ? 'msgBubbleAssistant' : ''}`);
    bubble.textContent = m.content;
    row.append(role, bubble);
    leftMessages.appendChild(row);
  }
  leftMessages.scrollTop = leftMessages.scrollHeight;
}

function renderRight() {
  if (currentSpec) {
    specPre.textContent = showSpec ? JSON.stringify(currentSpec, null, 2) : '';
    try {
      render3D1(chartInner, echarts, botSpecTo3D1(currentSpec));
      applyZoom();
      chartViewport.scrollLeft = Math.max(0, (chartViewport.scrollWidth - chartViewport.clientWidth) / 2);
      chartViewport.scrollTop = Math.max(0, (chartViewport.scrollHeight - chartViewport.clientHeight) / 2);
    } catch (e) {
      specPre.textContent = `${specPre.textContent}\n\nRenderError: ${String(e)}`;
    }
  } else {
    specPre.textContent = '';
    chartInner.innerHTML = '';
  }
}

const leftPanel = el('div', 'panel');
const leftHeader = el('div', 'panelHeader');
const leftTitle = el('div', 'panelTitle');
leftTitle.textContent = '对话';
const headerRight = el('div', 'headerRight');
const apiStatus = el('div', 'apiStatus');
const apiDot = el('div', 'dot');
const apiText = el('div');
apiText.textContent = 'API: unknown';
apiStatus.append(apiDot, apiText);
const leftToolbar = el('div', 'toolbar');
const llmBtn = el('button', 'smallBtn') as HTMLButtonElement;
llmBtn.textContent = 'LLM设置';
leftToolbar.append(llmBtn);
headerRight.append(apiStatus, leftToolbar);
leftHeader.append(leftTitle, headerRight);
const progressWrap = el('div', 'progressWrap');
const progressBar = el('div', 'progressBar');
progressWrap.appendChild(progressBar);
const settingsPanel = el('div', 'settingsPanel');
const settingsRow1 = el('div', 'settingsRow');
const keyLabel = el('div', 'settingsLabel');
keyLabel.textContent = 'ARK Key';
const keyInput = el('input', 'settingsInput') as HTMLInputElement;
keyInput.type = 'password';
keyInput.placeholder = '仅本地调试：在浏览器输入会有泄露风险';
settingsRow1.append(keyLabel, keyInput);
const settingsRow2 = el('div', 'settingsRow');
const modelLabel = el('div', 'settingsLabel');
modelLabel.textContent = 'Model';
const modelInput = el('input', 'settingsInput') as HTMLInputElement;
modelInput.type = 'text';
modelInput.placeholder = 'doubao-seed-1-8-251228（可选）';
settingsRow2.append(modelLabel, modelInput);
const settingsRow3 = el('div', 'settingsRow');
const rememberLabel = el('div', 'settingsLabel');
rememberLabel.textContent = '记住';
const rememberInput = el('input') as HTMLInputElement;
rememberInput.type = 'checkbox';
const saveBtn = el('button', 'smallBtn') as HTMLButtonElement;
saveBtn.textContent = '保存';
const clearBtn = el('button', 'smallBtn') as HTMLButtonElement;
clearBtn.textContent = '清除';
settingsRow3.append(rememberLabel, rememberInput, saveBtn, clearBtn);
const settingsStatus = el('div', 'settingsStatus');
settingsPanel.append(settingsRow1, settingsRow2, settingsRow3, settingsStatus);
const leftMessages = el('div', 'messages');
const composer = el('div', 'composer');
const quickSelect = el('select', 'quickSelect') as HTMLSelectElement;
quickSelect.disabled = false;
const input = el('input', 'input') as HTMLInputElement;
input.placeholder = '输入：例如“换成热力图”“转置一下”“所有数据乘以2”';
const sendBtn = el('button', 'btn') as HTMLButtonElement;
sendBtn.textContent = '发送';
composer.append(quickSelect, input, sendBtn);
leftPanel.append(leftHeader, progressWrap, settingsPanel, leftMessages, composer);

const rightPanel = el('div', 'panel');
const rightHeader = el('div', 'panelHeader');
const rightTitle = el('div', 'panelTitle');
rightTitle.textContent = '画布';
const toggleSpecBtn = el('button', 'smallBtn') as HTMLButtonElement;
rightHeader.append(rightTitle, toggleSpecBtn);
const rightTop = el('div', 'rightTop');
const rightBody = el('div', 'rightBody');
const zoomRow = el('div', 'zoomRow');
const zoomLabel = el('div', 'zoomLabel');
zoomLabel.textContent = '缩放';
const zoomRange = el('input', 'zoomRange') as HTMLInputElement;
zoomRange.type = 'range';
zoomRange.min = '50';
zoomRange.max = '200';
zoomRange.step = '5';
zoomRange.value = String(Math.round(zoom * 100));
const zoomValue = el('div', 'zoomValue');
zoomValue.textContent = `${Math.round(zoom * 100)}%`;
zoomRow.append(zoomLabel, zoomRange, zoomValue);
rightTop.append(zoomRow);

const chartViewport = el('div', 'chartArea') as HTMLDivElement;
const chartInner = el('div', 'chartInner') as HTMLDivElement;
chartViewport.appendChild(chartInner);
const specPanel = el('div', 'specPanel') as HTMLDivElement;
const specHeader = el('div', 'specHeader') as HTMLDivElement;
const specTitle = el('div', 'specTitle') as HTMLDivElement;
specTitle.textContent = 'Spec';
const clearSpecBtn = el('button', 'smallBtn') as HTMLButtonElement;
clearSpecBtn.textContent = '清空Spec';
specHeader.append(specTitle, clearSpecBtn);
const specPre = el('pre', 'specArea') as HTMLPreElement;
specPanel.append(specHeader, specPre);
rightBody.append(chartViewport, specPanel);
rightPanel.append(rightHeader, rightTop, rightBody);

app.append(leftPanel, rightPanel);
renderLeft();
renderRight();
updateApiStatus();

function updateApiStatus() {
  apiDot.className = 'dot';
  if (apiOk === true) {
    apiDot.className = 'dot dotOk';
    apiText.textContent = 'API: connected';
  } else if (apiOk === false) {
    apiDot.className = 'dot dotBad';
    apiText.textContent = 'API: disconnected';
  } else {
    apiText.textContent = 'API: unknown';
  }
}

void pingHealth();

function updateQuickSelect() {
  quickSelect.innerHTML = '';
  const placeholder = el('option') as HTMLOptionElement;
  placeholder.value = '';
  placeholder.textContent = '快捷指令（选择后自动填入输入框）';
  quickSelect.appendChild(placeholder);

  const addGroup = (label: string, items: Array<{ label: string; utterance: string }>) => {
    const g = document.createElement('optgroup');
    g.label = label;
    for (const it of items) {
      const opt = el('option') as HTMLOptionElement;
      opt.value = it.utterance;
      opt.textContent = it.label;
      g.appendChild(opt);
    }
    quickSelect.appendChild(g);
  };

  const typeLabel: Record<string, string> = {
    grouped_bar: '分组柱状图',
    stacked_bar: '堆叠柱状图',
    grouped_horizontal_bar: '分组条形图',
    stacked_horizontal_bar: '堆叠条形图',
    multi_line: '多折线图',
    stacked_area: '堆叠面积图',
    heatmap: '热力图',
    polar_stacked_bar: '极坐标堆叠柱图',
    polar_stacked_ring: '极坐标堆叠环图',
    multi_radar: '多对象雷达图'
  };

  const common = [
    { label: '重新生成数据', utterance: '重新生成数据' },
    { label: '转置（交换X/Y）', utterance: '转置一下' },
    { label: '整体缩放', utterance: '所有数据乘以[倍数]' },
    { label: '改标题', utterance: '标题改成：[新的标题]' },
    { label: '改单位', utterance: '单位改成[新的单位]' }
  ];

  const convert = [
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
  ].map(t => ({ label: `换成${typeLabel[t] ?? t}`, utterance: `换成${typeLabel[t] ?? t}` }));

  const x0 = currentSpec?.x_labels?.[0] ?? '列标签';
  const y0 = currentSpec?.y_labels?.[0] ?? '行标签';
  const x1 = currentSpec?.x_labels?.[1] ?? x0;
  const y1 = currentSpec?.y_labels?.[1] ?? y0;

  const modify = [
    { label: '改单元格数值', utterance: `把[${y0}][${x0}]改成[新的数值]` },
    { label: '改标签名称', utterance: '把[原标签名]改成[新标签名]' },
    { label: '增加标签', utterance: `在[${currentSpec?.x_category ?? '类别'}]中增加[新标签名]` },
    { label: '删除标签', utterance: `删除[${x1}]或删除[${y1}]` },
    { label: '改维度名', utterance: `把维度名[${currentSpec?.x_category ?? 'X轴'}]改成[新的维度名]` }
  ];

  addGroup('常用', common);
  addGroup('转换', convert);
  addGroup('修改', modify);
}

quickSelect.addEventListener('change', () => {
  const v = quickSelect.value;
  if (!v) return;
  input.value = v;
  input.focus();
  quickSelect.value = '';
});

function applyZoom() {
  if (!currentSpec) return;
  const vw = chartViewport.clientWidth || 1;
  const vh = chartViewport.clientHeight || 1;
  const prevW = chartInner.offsetWidth || 1;
  const prevH = chartInner.offsetHeight || 1;
  const centerX = chartViewport.scrollLeft + chartViewport.clientWidth / 2;
  const centerY = chartViewport.scrollTop + chartViewport.clientHeight / 2;
  const fx = prevW ? centerX / prevW : 0.5;
  const fy = prevH ? centerY / prevH : 0.5;

  const w = Math.max(320, Math.floor(vw * zoom));
  const h = Math.max(240, Math.floor(vh * zoom));
  chartInner.style.width = `${w}px`;
  chartInner.style.height = `${h}px`;
  resizeChart(chartInner);

  const nextCenterX = fx * w;
  const nextCenterY = fy * h;
  chartViewport.scrollLeft = Math.max(0, nextCenterX - chartViewport.clientWidth / 2);
  chartViewport.scrollTop = Math.max(0, nextCenterY - chartViewport.clientHeight / 2);
}

zoomRange.addEventListener('input', () => {
  const v = Number(zoomRange.value);
  if (!Number.isFinite(v)) return;
  zoom = v / 100;
  localStorage.setItem('chart_bot_zoom', String(zoom));
  zoomValue.textContent = `${Math.round(zoom * 100)}%`;
  applyZoom();
});

window.addEventListener('resize', () => {
  applyZoom();
});

let settingsOpen = false;
function updateSettingsVisibility() {
  settingsPanel.style.display = settingsOpen ? 'flex' : 'none';
}

function setStatusText(s: SettingsResponse | null) {
  if (!s?.ark) {
    settingsStatus.textContent = 'LLM：未知';
    return;
  }
  if (!s.ark.configured) {
    settingsStatus.textContent = `LLM：未配置（model=${s.ark.model}）`;
    return;
  }
  settingsStatus.textContent = `LLM：已配置（${s.ark.source}，model=${s.ark.model}）`;
}

llmBtn.addEventListener('click', async () => {
  settingsOpen = !settingsOpen;
  updateSettingsVisibility();
  if (settingsOpen) {
    const s = await getSettings().catch(() => null);
    setStatusText(s);
  }
});

const rememberFlag = localStorage.getItem('chart_bot_remember_key') === '1';
rememberInput.checked = rememberFlag;
if (rememberFlag) {
  const savedKey = localStorage.getItem('chart_bot_ark_api_key') || '';
  const savedModel = localStorage.getItem('chart_bot_ark_model') || '';
  keyInput.value = savedKey;
  modelInput.value = savedModel;
  if (savedKey || savedModel) {
    void postSettings({ ark_api_key: savedKey, ark_model: savedModel }).catch(() => null);
  }
}

rememberInput.addEventListener('change', () => {
  localStorage.setItem('chart_bot_remember_key', rememberInput.checked ? '1' : '0');
  if (!rememberInput.checked) {
    localStorage.removeItem('chart_bot_ark_api_key');
    localStorage.removeItem('chart_bot_ark_model');
  }
});

saveBtn.addEventListener('click', async () => {
  const k = keyInput.value;
  const m = modelInput.value;
  if (rememberInput.checked) {
    localStorage.setItem('chart_bot_ark_api_key', k);
    localStorage.setItem('chart_bot_ark_model', m);
  }
  const s = await postSettings({ ark_api_key: k, ark_model: m }).catch(() => null);
  setStatusText(s);
  appendMessage({ role: 'assistant', content: '已更新 LLM 设置。' });
  void pingHealth();
});

clearBtn.addEventListener('click', async () => {
  keyInput.value = '';
  if (rememberInput.checked) localStorage.setItem('chart_bot_ark_api_key', '');
  const s = await postSettings({ ark_api_key: '' }).catch(() => null);
  setStatusText(s);
  appendMessage({ role: 'assistant', content: '已清除 LLM Key。' });
  void pingHealth();
});

let showSpec = localStorage.getItem('chart_bot_show_spec') !== '0';
function updateSpecVisibility() {
  specPanel.style.display = showSpec ? 'flex' : 'none';
  toggleSpecBtn.textContent = showSpec ? '隐藏Spec' : '显示Spec';
  localStorage.setItem('chart_bot_show_spec', showSpec ? '1' : '0');
  renderRight();
}
toggleSpecBtn.addEventListener('click', () => {
  showSpec = !showSpec;
  updateSpecVisibility();
});
clearSpecBtn.addEventListener('click', () => {
  setSpec(null);
  appendMessage({ role: 'assistant', content: '已清空当前 spec。' });
});
updateSpecVisibility();
updateQuickSelect();

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  appendMessage({ role: 'user', content: text });
  await postChat(text);
}

sendBtn.addEventListener('click', () => void send());
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') void send();
});
