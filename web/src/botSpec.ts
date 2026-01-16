export type BotChartType =
  | 'grouped_bar'
  | 'stacked_bar'
  | 'grouped_horizontal_bar'
  | 'stacked_horizontal_bar'
  | 'multi_line'
  | 'stacked_area'
  | 'heatmap'
  | 'polar_stacked_bar'
  | 'polar_stacked_ring'
  | 'multi_radar';

export type BotSpec = {
  theme: string;
  title: string;
  type: BotChartType;
  dimension: 2;
  x_category: string;
  y_category: string;
  x_labels: string[];
  y_labels: string[];
  data: number[][];
  unit?: string;
};

