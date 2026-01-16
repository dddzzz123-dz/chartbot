import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConvertCapabilities, buildModifyCapabilities } from '../src/capabilities.js';

test('buildConvertCapabilities excludes current type', () => {
  const spec = {
    type: 'heatmap',
    x_labels: ['A'],
    y_labels: ['S1'],
    data: [[1]],
    theme: 't',
    title: 't',
    dimension: 2,
    x_category: 'x',
    y_category: 'y',
    unit: ''
  };
  const r = buildConvertCapabilities(spec);
  assert.equal(r.mode, 'convert');
  assert.ok(r.types.every(t => t.type !== 'heatmap'));
});

test('buildModifyCapabilities includes value and transpose', () => {
  const spec = {
    type: 'grouped_bar',
    x_labels: ['早高峰', '午间'],
    y_labels: ['1F', '2F'],
    data: [
      [1, 2],
      [3, 4]
    ],
    theme: 't',
    title: 't',
    dimension: 2,
    x_category: '时段',
    y_category: '楼层',
    unit: '客流密度(人/㎡)'
  };
  const r = buildModifyCapabilities(spec);
  assert.equal(r.mode, 'modify');
  const types = new Set(r.types.map(t => t.modifyType));
  assert.ok(types.has('value'));
  assert.ok(types.has('transpose'));
});

