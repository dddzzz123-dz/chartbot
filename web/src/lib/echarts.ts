import type * as echarts from 'echarts';

export type ChartInitOptions = {
  renderer?: 'canvas' | 'svg';
  devicePixelRatio?: number;
};

const charts = new WeakMap<HTMLElement, echarts.ECharts>();

export function getOrCreateChart(dom: HTMLElement, echartsInstance: typeof echarts, init?: ChartInitOptions) {
  const existing = charts.get(dom);
  if (existing) return existing;
  const created = echartsInstance.init(dom, undefined, init);
  charts.set(dom, created);
  return created;
}

export function setChartOption(chart: echarts.ECharts, option: echarts.EChartsCoreOption) {
  chart.setOption(option, { notMerge: true, lazyUpdate: false });
}

export function resizeChart(dom: HTMLElement) {
  const chart = charts.get(dom);
  if (chart) chart.resize();
}
