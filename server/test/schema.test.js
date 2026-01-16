import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBotSpec } from '../src/schema.js';

test('normalizeBotSpec rejects invalid type', () => {
  assert.throws(() => {
    normalizeBotSpec({
      theme: 't',
      title: 't',
      type: 'not_supported',
      dimension: 2,
      x_category: 'x',
      y_category: 'y',
      x_labels: ['A'],
      y_labels: ['S1'],
      data: [[1]],
      unit: ''
    });
  });
});

test('normalizeBotSpec rejects wrong shape', () => {
  assert.throws(() => {
    normalizeBotSpec({
      theme: 't',
      title: 't',
      type: 'grouped_bar',
      dimension: 2,
      x_category: 'x',
      y_category: 'y',
      x_labels: ['A', 'B'],
      y_labels: ['S1'],
      data: [[1]],
      unit: ''
    });
  });
});

test('normalizeBotSpec coerces numbers and fills NaN to 0', () => {
  const spec = normalizeBotSpec({
    theme: 't',
    title: 't',
    type: 'grouped_bar',
    dimension: 2,
    x_category: 'x',
    y_category: 'y',
    x_labels: ['A'],
    y_labels: ['S1'],
    data: [['not-a-number']],
    unit: undefined
  });
  assert.equal(spec.unit, '');
  assert.equal(spec.data[0][0], 0);
});

