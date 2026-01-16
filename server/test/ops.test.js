import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addLabel,
  buildTitleForType,
  generateDummySpec,
  inferTargetType,
  inferModifyPlan,
  removeLabel,
  renameLabel,
  sanitizeTheme,
  scaleSpec,
  transposeSpec,
  updateValue
} from '../src/ops.js';

test('generateDummySpec shape', () => {
  const spec = generateDummySpec('test');
  assert.equal(spec.dimension, 2);
  assert.equal(spec.data.length, spec.y_labels.length);
  assert.equal(spec.data[0].length, spec.x_labels.length);
});

test('transposeSpec swaps axes', () => {
  const base = generateDummySpec('test');
  const t = transposeSpec(base);
  assert.deepEqual(t.x_labels, base.y_labels);
  assert.deepEqual(t.y_labels, base.x_labels);
  assert.equal(t.data.length, t.y_labels.length);
  assert.equal(t.data[0].length, t.x_labels.length);
});

test('scaleSpec multiplies', () => {
  const base = generateDummySpec('test');
  const s = scaleSpec(base, 2);
  assert.equal(s.data[0][0], base.data[0][0] * 2);
});

test('updateValue by labels', () => {
  const base = generateDummySpec('test');
  const x0 = base.x_labels[0];
  const y0 = base.y_labels[0];
  const s = updateValue(base, { xLabel: x0, yLabel: y0, newValue: 999 });
  assert.equal(s.data[0][0], 999);
});

test('renameLabel axis x', () => {
  const base = generateDummySpec('test');
  const from = base.x_labels[1];
  const s = renameLabel(base, { axis: 'x', from, to: 'X_NEW' });
  assert.equal(s.x_labels[1], 'X_NEW');
});

test('addLabel axis x appends column', () => {
  const base = generateDummySpec('test');
  const s = addLabel(base, { axis: 'x', label: 'X_ADD', value: 1 });
  assert.equal(s.x_labels[s.x_labels.length - 1], 'X_ADD');
  assert.equal(s.data[0][s.data[0].length - 1], 1);
});

test('removeLabel axis y removes row', () => {
  const base = generateDummySpec('test');
  const label = base.y_labels[0];
  const s = removeLabel(base, { axis: 'y', label });
  assert.equal(s.y_labels.length, base.y_labels.length - 1);
  assert.equal(s.data.length, s.y_labels.length);
});

test('inferModifyPlan supports bracket value edit', () => {
  const base = generateDummySpec('test');
  base.x_labels = ['早高峰', '午间', '晚高峰'];
  base.y_labels = ['1F', '2F', '3F'];
  base.data = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
  ];
  const plan = inferModifyPlan('把[1F][早高峰]改成[35.0]', base);
  assert.equal(plan.modifyType, 'value');
  assert.equal(plan.payload.xLabel, '早高峰');
  assert.equal(plan.payload.yLabel, '1F');
  assert.equal(plan.payload.newValue, 35);
});

test('inferModifyPlan supports title edit', () => {
  const base = generateDummySpec('test');
  const plan = inferModifyPlan('标题改成：[新的标题]', base);
  assert.equal(plan.modifyType, 'title');
  assert.equal(plan.payload.to, '新的标题');
});

test('sanitizeTheme removes chart-ish words', () => {
  const t = sanitizeTheme('2024年各区域不同产品的销售额对比');
  assert.equal(t.includes('对比'), false);
  assert.ok(t.includes('销售额'));
});

test('buildTitleForType uses templates', () => {
  const spec = generateDummySpec('生成一个销售数据的图');
  const title = buildTitleForType(spec, 'heatmap');
  assert.ok(title.includes('分布'));
  assert.ok(title.includes('销售额'));
});

test('inferTargetType prefers polar variants', () => {
  assert.equal(inferTargetType('换成极坐标堆叠条形图'), 'polar_stacked_bar');
  assert.equal(inferTargetType('切换为极坐标堆叠环形图'), 'polar_stacked_ring');
});
