import type { BotSpec, BotChartType } from './botSpec';
import type { Spec3D1, Spec3D1ChartType } from './lib/types';

const typeMap: Record<BotChartType, Spec3D1ChartType> = {
  grouped_bar: 'groupBar',
  stacked_bar: 'stackBar',
  grouped_horizontal_bar: 'groupHorizontalBar',
  stacked_horizontal_bar: 'stackHorizontalBar',
  multi_line: 'multiLine',
  stacked_area: 'stackArea',
  heatmap: 'heatmap',
  polar_stacked_bar: 'polarStackBar',
  polar_stacked_ring: 'polarStackRing',
  multi_radar: 'radar-multi'
};

export function botSpecTo3D1(spec: BotSpec): Spec3D1 {
  return {
    chartMeta: { chartType: typeMap[spec.type] },
    dataConfig: {
      mainCategoryName: spec.x_category,
      groupCategoryName: spec.y_category,
      valueName: spec.unit ?? ''
    },
    sourceData: {
      categories: spec.x_labels,
      series: spec.y_labels.map((seriesName, y) => ({ seriesName, data: spec.data[y] ?? [] }))
    }
  };
}

