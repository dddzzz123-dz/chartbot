import { getTypeLabel } from './ops.js';

const MODIFY_TYPES = [
  'value',
  'label',
  'add_label',
  'remove_label',
  'category',
  'unit',
  'title',
  'transpose',
  'scale'
];

const MODIFY_LABEL = {
  value: '修改数值',
  label: '修改标签',
  add_label: '增加标签/行列',
  remove_label: '删除标签/行列',
  category: '修改维度名称',
  unit: '修改单位（可换算）',
  title: '修改标题',
  transpose: '转置（交换X/Y）',
  scale: '整体缩放'
};

export const CHART_TYPES = [
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

export function buildConvertCapabilities(currentSpec) {
  const currentType = currentSpec?.type ?? null;
  const types = CHART_TYPES.filter(t => t !== currentType).map(type => ({
    type,
    label: getTypeLabel(type),
    exampleUtterance: `换成${getTypeLabel(type)}`
  }));
  return { mode: 'convert', types };
}

function pickDefaultLabels(spec) {
  const x0 = spec?.x_labels?.[0] ?? 'A';
  const y0 = spec?.y_labels?.[0] ?? '系列1';
  const x1 = spec?.x_labels?.[1] ?? x0;
  const y1 = spec?.y_labels?.[1] ?? y0;
  return { x0, y0, x1, y1 };
}

export function buildModifyCapabilities(currentSpec) {
  const { x0, y0, x1, y1 } = pickDefaultLabels(currentSpec);
  const unit = currentSpec?.unit ? String(currentSpec.unit) : '';
  const unitTail = unit ? unit.replace(/^\s+|\s+$/g, '') : '';
  const types = MODIFY_TYPES.map(modifyType => {
    const label = MODIFY_LABEL[modifyType] ?? modifyType;
    let exampleUtterance = '请修改一下';
    if (modifyType === 'value')
      exampleUtterance = `把[${y0}][${x0}]改成[新的数值]${unitTail ? unitTail.replace(/.*\\((.*)\\).*/, '$1') : ''}`.trim();
    if (modifyType === 'label') exampleUtterance = `把[原标签名]改成[新标签名]`;
    if (modifyType === 'add_label') exampleUtterance = `在[${currentSpec?.x_category ?? '类别'}]中增加[新标签名]`;
    if (modifyType === 'remove_label') exampleUtterance = `删除[${x1}]或删除[${y1}]`;
    if (modifyType === 'category') exampleUtterance = `把维度名[${currentSpec?.x_category ?? 'X轴'}]改成[新的维度名]`;
    if (modifyType === 'unit') exampleUtterance = `单位改成[新的单位]`;
    if (modifyType === 'title') exampleUtterance = `标题改成：[新的标题]`;
    if (modifyType === 'transpose') exampleUtterance = '转置一下';
    if (modifyType === 'scale') exampleUtterance = '所有数据乘以[倍数]';
    return { modifyType, label, exampleUtterance };
  });
  return { mode: 'modify', types };
}
