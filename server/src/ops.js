import { normalizeBotSpec } from './schema.js';

const typeAlias = new Map([
  ['分组柱状图', 'grouped_bar'],
  ['堆叠柱状图', 'stacked_bar'],
  ['分组条形图', 'grouped_horizontal_bar'],
  ['堆叠条形图', 'stacked_horizontal_bar'],
  ['多折线图', 'multi_line'],
  ['堆叠面积图', 'stacked_area'],
  ['热力图', 'heatmap'],
  ['极坐标堆叠柱图', 'polar_stacked_bar'],
  ['极坐标堆叠柱状图', 'polar_stacked_bar'],
  ['极坐标堆叠条形图', 'polar_stacked_bar'],
  ['极坐标堆叠环图', 'polar_stacked_ring'],
  ['极坐标堆叠环形图', 'polar_stacked_ring'],
  ['极坐标堆叠圆环图', 'polar_stacked_ring'],
  ['多对象雷达图', 'multi_radar']
]);

export function getTypeLabel(type) {
  for (const [label, t] of typeAlias.entries()) {
    if (t === type) return label;
  }
  return type;
}

const titleTemplates = {
  grouped_bar: '{x}的{y}{指标}对比',
  stacked_bar: '{x}的{y}{指标}累计',
  grouped_horizontal_bar: '各{x}的{y}{指标}横向比较',
  stacked_horizontal_bar: '{x}的{y}{指标}横向堆叠',
  multi_line: '{y}在{x}的{指标}趋势',
  stacked_area: '{y}在{x}的{指标}累积趋势',
  heatmap: '{x}与{y}的{指标}分布',
  polar_stacked_bar: '{x}的{y}{指标}极坐标堆叠',
  polar_stacked_ring: '{x}的{y}{指标}环形堆叠',
  multi_radar: '{y}在{x}的{指标}雷达对比'
};

function extractMetricName(spec) {
  const unit = String(spec?.unit ?? '').trim();
  const m = unit.match(/^(.+?)\s*\(/);
  if (m && m[1]) return m[1].trim();
  return '指标';
}

function decorateX(x, type) {
  const s = String(x ?? '').trim();
  if (!s) return s;
  if (s.startsWith('各') || s.startsWith('不同')) return s;
  if (['grouped_bar', 'stacked_bar', 'polar_stacked_bar', 'polar_stacked_ring'].includes(type)) return `各${s}`;
  return s;
}

export function buildTitleForType(spec, type = spec.type) {
  const tpl = titleTemplates[type] ?? '{x}与{y}的{指标}';
  const metric = extractMetricName(spec);
  const x = decorateX(spec.x_category, type);
  const y = String(spec.y_category ?? '').trim();
  return tpl.replaceAll('{x}', x).replaceAll('{y}', y).replaceAll('{指标}', metric);
}

const bannedInTheme = /(对比|比较|趋势|分布|热力图|柱状图|条形图|折线图|面积图|雷达图|堆叠|分组)/g;
export function sanitizeTheme(theme) {
  const s = String(theme ?? '').trim().replace(bannedInTheme, '');
  return s.replace(/\s+/g, '').replace(/[：:，,。.]$/g, '') || '示例主题';
}

function simplifyLabel(label) {
  let s = String(label ?? '').trim();
  if (!s) return s;
  const rules = [
    [/地区$/, ''],
    [/一线城市/g, '一线'],
    [/新一线城市/g, '新一线'],
    [/二三线城市/g, '二线'],
    [/华东地区/g, '华东'],
    [/华南地区/g, '华南'],
    [/华北地区/g, '华北'],
    [/华中地区/g, '华中'],
    [/西南地区/g, '西南'],
    [/西北地区/g, '西北'],
    [/东北地区/g, '东北'],
    [/长三角地区/g, '长三角'],
    [/珠三角地区/g, '珠三角'],
    [/京津冀地区/g, '京津冀'],
    [/笔记本电脑/g, '笔记本'],
    [/智能手机/g, '手机'],
    [/平板电脑/g, '平板'],
    [/智能手表/g, '手表'],
    [/无线耳机/g, '耳机'],
    [/日用百货/g, '日用品'],
    [/电子产品/g, '电子品'],
    [/服装服饰/g, '服装'],
    [/早中晚高峰/g, '早高峰']
  ];
  for (const [re, to] of rules) s = s.replace(re, to);
  if (s.length > 6) s = s.slice(0, 6);
  return s;
}

function isPlaceholderLabel(label) {
  const s = String(label ?? '').trim();
  if (!s) return true;
  if (/^[A-Z]$/.test(s)) return true;
  if (/^(系列|类别|产品)\d+$/.test(s)) return true;
  if (/^(系列|类别|产品)[A-Z]$/.test(s)) return true;
  return false;
}

function defaultLabelsByCategory(category, count) {
  const c = String(category ?? '').trim();
  const pool =
    /月/.test(c)
      ? ['1月', '2月', '3月', '4月', '5月', '6月']
      : /季/.test(c)
        ? ['Q1', 'Q2', 'Q3', 'Q4']
        : /(时段|时).*/.test(c)
          ? ['早高峰', '午间', '晚高峰', '凌晨', '下午', '晚上']
          : /(区域|地域)/.test(c)
            ? ['华东', '华南', '华北', '华中', '西南', '东北']
            : /(楼层)/.test(c)
              ? ['1F', '2F', '3F', '4F']
              : /(渠道)/.test(c)
                ? ['线上', '线下', '代理', '直营']
                : /(产品)/.test(c)
                  ? ['手机', '耳机', '平板', '手表', '音箱', '笔记本']
                  : ['选项一', '选项二', '选项三', '选项四', '选项五', '选项六'];
  return pool.slice(0, Math.max(3, Math.min(6, count)));
}

function resizeMatrix(data, newRows, newCols) {
  const out = Array.from({ length: newRows }, (_, y) =>
    Array.from({ length: newCols }, (_, x) => {
      const v = data?.[y]?.[x];
      if (Number.isFinite(Number(v))) return Number(v);
      const fallback = data?.[Math.min(y, (data?.length ?? 1) - 1)]?.[Math.min(x, (data?.[0]?.length ?? 1) - 1)];
      return Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
    })
  );
  return out;
}

export function finalizeGeneratedSpec(spec) {
  const next = { ...spec };
  next.theme = sanitizeTheme(next.theme);

  const x = Array.isArray(next.x_labels) ? next.x_labels.map(simplifyLabel) : [];
  const y = Array.isArray(next.y_labels) ? next.y_labels.map(simplifyLabel) : [];

  const xAllPlaceholder = x.length && x.every(isPlaceholderLabel);
  const yAllPlaceholder = y.length && y.every(isPlaceholderLabel);

  const targetXLen = Math.max(3, Math.min(6, x.length || 3));
  const targetYLen = Math.max(3, Math.min(6, y.length || 3));

  next.x_labels = (xAllPlaceholder ? defaultLabelsByCategory(next.x_category, targetXLen) : x.slice(0, targetXLen)).map(simplifyLabel);
  next.y_labels = (yAllPlaceholder ? defaultLabelsByCategory(next.y_category, targetYLen) : y.slice(0, targetYLen)).map(simplifyLabel);

  next.data = resizeMatrix(next.data, next.y_labels.length, next.x_labels.length);
  next.title = buildTitleForType(next, next.type);
  return normalizeBotSpec(next);
}

export function inferTargetType(message) {
  const text = String(message ?? '');
  if (/(极坐标).*(环|圆环)/.test(text)) return 'polar_stacked_ring';
  if (/(极坐标).*(柱|条)/.test(text)) return 'polar_stacked_bar';
  for (const [label, t] of typeAlias.entries()) {
    if (text.includes(label)) return t;
  }
  if (/(热力)/.test(text)) return 'heatmap';
  if (/(折线)/.test(text)) return 'multi_line';
  if (/(面积)/.test(text)) return 'stacked_area';
  if (/(雷达)/.test(text)) return 'multi_radar';
  if (/(堆叠).*(条形)/.test(text)) return 'stacked_horizontal_bar';
  if (/(条形)/.test(text)) return 'grouped_horizontal_bar';
  if (/(堆叠).*(柱状)/.test(text)) return 'stacked_bar';
  if (/(柱状)/.test(text)) return 'grouped_bar';
  return null;
}

export function generateDummySpec(message) {
  const text = String(message ?? '').trim();
  const heat = /(热力|密度|矩阵)/.test(text);
  const traffic = /(客流|人流)/.test(text);
  const sales = /(销售|营收|收入|订单|GMV)/i.test(text);
  const rate = /(率|转化|渗透|留存|增长)/.test(text);
  const time = /(月|季度|周|时段|日)/.test(text);

  const type = heat ? 'heatmap' : time ? 'multi_line' : 'grouped_bar';

  const x_category = traffic ? '时段' : sales || time ? '月份' : '区域';
  const y_category = traffic ? '楼层' : sales ? '产品' : rate ? '渠道' : '产品';
  const unit = traffic ? '客流密度(人/㎡)' : rate ? '转化率(%)' : sales ? '销售额(万元)' : '数量(件)';

  const x_labels = defaultLabelsByCategory(x_category, 3);
  const y_labels = defaultLabelsByCategory(y_category, 3);

  const base = sales ? 3000 : traffic ? 30 : rate ? 20 : 120;
  const data = y_labels.map((_, yi) => x_labels.map((__, xi) => Number((base * (0.7 + 0.15 * yi + 0.1 * xi)).toFixed(1))));

  const metricName = unit.match(/^(.+?)\(/)?.[1] ?? '指标';
  const themeBase = traffic
    ? `零售门店${x_category}与${y_category}的${metricName}`
    : sales
      ? `2024年各${x_category}不同${y_category}的${metricName}`
      : `不同${x_category}与${y_category}的${metricName}`;

  const spec = {
    theme: sanitizeTheme(themeBase || text || '示例主题'),
    title: '',
    type,
    dimension: 2,
    x_category,
    y_category,
    x_labels,
    y_labels,
    data,
    unit
  };
  return finalizeGeneratedSpec(spec);
}

export function convertType(currentSpec, targetType) {
  const next = { ...currentSpec, type: targetType };
  next.title = buildTitleForType(next, targetType);
  return normalizeBotSpec(next);
}

export function transposeSpec(currentSpec) {
  const nextXLabels = [...currentSpec.y_labels];
  const nextYLabels = [...currentSpec.x_labels];
  const nextData = nextXLabels.map((_, y) => nextYLabels.map((__, x) => currentSpec.data[x][y]));
  return normalizeBotSpec({
    ...currentSpec,
    x_category: currentSpec.y_category,
    y_category: currentSpec.x_category,
    x_labels: nextXLabels,
    y_labels: nextYLabels,
    data: nextData
  });
}

export function scaleSpec(currentSpec, factor) {
  const f = Number(factor);
  const next = {
    ...currentSpec,
    data: currentSpec.data.map(row => row.map(v => Number(v) * f))
  };
  return normalizeBotSpec(next);
}

export function updateValue(currentSpec, { xLabel, xIndex, yLabel, yIndex, newValue }) {
  const xi = typeof xIndex === 'number' ? xIndex : currentSpec.x_labels.indexOf(String(xLabel));
  const yi = typeof yIndex === 'number' ? yIndex : currentSpec.y_labels.indexOf(String(yLabel));
  if (xi < 0 || yi < 0) {
    throw new Error('无法定位要修改的单元格（x/y 标签或索引不存在）');
  }
  const nv = Number(newValue);
  if (!Number.isFinite(nv)) throw new Error('newValue 不是有效数字');
  const data = currentSpec.data.map(row => [...row]);
  data[yi][xi] = nv;
  return normalizeBotSpec({ ...currentSpec, data });
}

export function renameLabel(currentSpec, { axis, from, to }) {
  const next = { ...currentSpec };
  const f = String(from);
  const t = String(to);
  if (axis === 'x') {
    const idx = currentSpec.x_labels.indexOf(f);
    if (idx < 0) throw new Error('x_labels 中找不到要修改的标签');
    next.x_labels = currentSpec.x_labels.map((v, i) => (i === idx ? t : v));
    return normalizeBotSpec(next);
  }
  if (axis === 'y') {
    const idx = currentSpec.y_labels.indexOf(f);
    if (idx < 0) throw new Error('y_labels 中找不到要修改的标签');
    next.y_labels = currentSpec.y_labels.map((v, i) => (i === idx ? t : v));
    return normalizeBotSpec(next);
  }
  throw new Error('axis 必须为 x 或 y');
}

export function addLabel(currentSpec, { axis, label, values, value }) {
  const lab = String(label);
  if (axis === 'x') {
    const nextX = [...currentSpec.x_labels, lab];
    const data = currentSpec.data.map((row, y) => {
      const v =
        Array.isArray(values) && Number.isFinite(Number(values[y])) ? Number(values[y]) : Number.isFinite(Number(value)) ? Number(value) : 0;
      return [...row, v];
    });
    return normalizeBotSpec({ ...currentSpec, x_labels: nextX, data });
  }
  if (axis === 'y') {
    const row =
      Array.isArray(values) && values.length === currentSpec.x_labels.length
        ? values.map(v => (Number.isFinite(Number(v)) ? Number(v) : 0))
        : currentSpec.x_labels.map(() => (Number.isFinite(Number(value)) ? Number(value) : 0));
    const nextY = [...currentSpec.y_labels, lab];
    const data = [...currentSpec.data.map(r => [...r]), row];
    return normalizeBotSpec({ ...currentSpec, y_labels: nextY, data });
  }
  throw new Error('axis 必须为 x 或 y');
}

export function removeLabel(currentSpec, { axis, label }) {
  const lab = String(label);
  if (axis === 'x') {
    const idx = currentSpec.x_labels.indexOf(lab);
    if (idx < 0) throw new Error('x_labels 中找不到要删除的标签');
    const nextX = currentSpec.x_labels.filter((_, i) => i !== idx);
    const data = currentSpec.data.map(row => row.filter((_, i) => i !== idx));
    return normalizeBotSpec({ ...currentSpec, x_labels: nextX, data });
  }
  if (axis === 'y') {
    const idx = currentSpec.y_labels.indexOf(lab);
    if (idx < 0) throw new Error('y_labels 中找不到要删除的标签');
    const nextY = currentSpec.y_labels.filter((_, i) => i !== idx);
    const data = currentSpec.data.filter((_, i) => i !== idx).map(r => [...r]);
    return normalizeBotSpec({ ...currentSpec, y_labels: nextY, data });
  }
  throw new Error('axis 必须为 x 或 y');
}

export function updateCategory(currentSpec, { axis, to }) {
  if (axis === 'x') return normalizeBotSpec({ ...currentSpec, x_category: String(to) });
  if (axis === 'y') return normalizeBotSpec({ ...currentSpec, y_category: String(to) });
  throw new Error('axis 必须为 x 或 y');
}

export function updateUnit(currentSpec, { to, factor }) {
  const f = factor === undefined ? null : Number(factor);
  const next = {
    ...currentSpec,
    unit: String(to),
    data: f === null || !Number.isFinite(f) ? currentSpec.data : currentSpec.data.map(row => row.map(v => Number(v) * f))
  };
  return normalizeBotSpec(next);
}

export function updateTitle(currentSpec, { to }) {
  return normalizeBotSpec({ ...currentSpec, title: String(to) });
}

export function applyModifyPlan(currentSpec, plan) {
  const { modifyType, payload } = plan;
  if (modifyType === 'transpose') return { spec: transposeSpec(currentSpec), desc: '完成转置' };
  if (modifyType === 'scale') return { spec: scaleSpec(currentSpec, payload.factor), desc: `将所有数据乘以 ${payload.factor}` };
  if (modifyType === 'value') {
    const spec = updateValue(currentSpec, payload);
    return { spec, desc: '修改了一个数值' };
  }
  if (modifyType === 'label') {
    const spec = renameLabel(currentSpec, payload);
    return { spec, desc: '修改了一个标签' };
  }
  if (modifyType === 'add_label') {
    const spec = addLabel(currentSpec, payload);
    return { spec, desc: '添加了一个标签' };
  }
  if (modifyType === 'remove_label') {
    const spec = removeLabel(currentSpec, payload);
    return { spec, desc: '删除了一个标签' };
  }
  if (modifyType === 'category') {
    const spec = updateCategory(currentSpec, payload);
    return { spec, desc: '修改了维度名称' };
  }
  if (modifyType === 'unit') {
    const spec = updateUnit(currentSpec, payload);
    return { spec, desc: '修改了单位' };
  }
  if (modifyType === 'title') {
    const spec = updateTitle(currentSpec, payload);
    return { spec, desc: '修改了标题' };
  }
  throw new Error(`未知 modifyType: ${modifyType}`);
}

export function inferValueEdit(message, currentSpec) {
  const text = String(message ?? '');
  const indexMatch = text.match(/data\[(\d+)\]\[(\d+)\]/i);
  const numMatches = [...text.matchAll(/-?\d+(\.\d+)?/g)].map(m => Number(m[0])).filter(n => Number.isFinite(n));
  const newValue = numMatches.length ? numMatches[numMatches.length - 1] : null;
  if (newValue === null) return null;
  if (indexMatch) {
    const yIndex = Number(indexMatch[1]);
    const xIndex = Number(indexMatch[2]);
    if (Number.isInteger(xIndex) && Number.isInteger(yIndex)) return { xIndex, yIndex, newValue };
  }

  const bracketTokens = [...text.matchAll(/\[([^\]]+)\]/g)].map(m => String(m[1]).trim()).filter(Boolean);
  const foundXFromBracket = bracketTokens.find(t => currentSpec.x_labels.includes(t));
  const foundYFromBracket = bracketTokens.find(t => currentSpec.y_labels.includes(t));
  if (foundXFromBracket && foundYFromBracket) return { xLabel: foundXFromBracket, yLabel: foundYFromBracket, newValue };

  const foundX = currentSpec.x_labels.find(x => text.includes(x));
  const foundY = currentSpec.y_labels.find(y => text.includes(y));
  if (!foundX || !foundY) return null;
  return { xLabel: foundX, yLabel: foundY, newValue };
}

export function inferModifyPlan(message, currentSpec) {
  const text = String(message ?? '').trim();
  if (!text) return null;

  const normalizeTo = raw => {
    const s = String(raw ?? '').trim().replace(/^[：:\s]+/, '').trim();
    if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1).trim();
    return s;
  };

  const titleMatch = text.match(/标题\s*(改成|改为|设置为|设为|=|:)\s*(.+)$/);
  if (titleMatch) {
    const to = normalizeTo(titleMatch[2]);
    if (to) return { modifyType: 'title', payload: { to } };
  }

  const unitMatch = text.match(/单位\s*(改成|改为|设置为|设为|=|:)\s*(.+)$/);
  if (unitMatch) {
    const to = normalizeTo(unitMatch[2]);
    if (to) return { modifyType: 'unit', payload: { to } };
  }

  const deleteMatch = text.match(/(删除|移除)\s*\[([^\]]+)\]/);
  if (deleteMatch) {
    const label = deleteMatch[2].trim();
    if (currentSpec.x_labels.includes(label)) return { modifyType: 'remove_label', payload: { axis: 'x', label } };
    if (currentSpec.y_labels.includes(label)) return { modifyType: 'remove_label', payload: { axis: 'y', label } };
  }

  const renameBracketMatch = text.match(/把\s*\[([^\]]+)\]\s*改成\s*\[([^\]]+)\]/);
  if (renameBracketMatch) {
    const from = renameBracketMatch[1].trim();
    const to = renameBracketMatch[2].trim();
    if (currentSpec.x_labels.includes(from)) return { modifyType: 'label', payload: { axis: 'x', from, to } };
    if (currentSpec.y_labels.includes(from)) return { modifyType: 'label', payload: { axis: 'y', from, to } };
  }

  const renameInline = text.match(/把\s*([^ \[\]]+)\s*改成\s*([^ \[\]]+)/);
  if (renameInline) {
    const from = renameInline[1].trim();
    const to = renameInline[2].trim();
    if (currentSpec.x_labels.includes(from)) return { modifyType: 'label', payload: { axis: 'x', from, to } };
    if (currentSpec.y_labels.includes(from)) return { modifyType: 'label', payload: { axis: 'y', from, to } };
  }

  const value = inferValueEdit(text, currentSpec);
  if (value) return { modifyType: 'value', payload: value };

  return null;
}
