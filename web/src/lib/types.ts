export type ChartMeta<TChartType extends string> = {
  chartType: TChartType;
};

export type Series1D = {
  seriesName: string;
  data: number[];
};

export type SourceData3D1 = {
  categories: string[];
  series: Series1D[];
};

export type Spec3D1ChartType =
  | 'groupBar'
  | 'groupHorizontalBar'
  | 'stackBar'
  | 'stackHorizontalBar'
  | 'stackArea'
  | 'multiLine'
  | 'heatmap'
  | 'polarStackBar'
  | 'polarStackRing'
  | 'radar-multi';

export type Spec3D1 = {
  chartMeta: ChartMeta<Spec3D1ChartType>;
  dataConfig: {
    mainCategoryName: string;
    groupCategoryName: string;
    valueName: string;
  };
  sourceData: SourceData3D1;
};

