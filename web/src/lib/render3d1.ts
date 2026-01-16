import type * as echarts from 'echarts';
import { assert } from './assert';
import { getOrCreateChart, setChartOption, type ChartInitOptions } from './echarts';
import type { Spec3D1 } from './types';

function maxOr1(values: number[]): number {
  const m = values.reduce((acc, v) => (Number.isFinite(v) ? Math.max(acc, v) : acc), 0);
  return Math.max(1, m);
}

function assert3D1Shape(spec: Spec3D1): void {
  const categories = spec.sourceData.categories;
  const series = spec.sourceData.series;

  assert(categories.length > 0, '3D-1: sourceData.categories 不能为空');
  assert(series.length > 0, '3D-1: sourceData.series 不能为空');

  for (const s of series) {
    assert(s.data.length === categories.length, '3D-1: 每个 series.data 的长度必须与 categories 一致');
  }
}

function buildCartesianGroupedBar(spec: Spec3D1, horizontal: boolean): echarts.EChartsCoreOption {
  assert3D1Shape(spec);
  const categories = spec.sourceData.categories;
  const series = spec.sourceData.series;

  const grid = { left: 132, right: 24, top: 24, bottom: 92, containLabel: true };
  const base: echarts.EChartsCoreOption = {
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', left: grid.left, right: grid.right, bottom: 8 },
    grid
  };

  const builtSeries = series.map(s => ({ type: 'bar', name: s.seriesName, data: s.data }));

  if (horizontal) {
    return {
      ...base,
      xAxis: { type: 'value', name: spec.dataConfig.valueName },
      yAxis: {
        type: 'category',
        name: spec.dataConfig.mainCategoryName,
        data: categories,
        axisLabel: { interval: 0, hideOverlap: false }
      },
      series: builtSeries
    };
  }

  return {
    ...base,
    xAxis: {
      type: 'category',
      name: spec.dataConfig.mainCategoryName,
      data: categories,
      axisLabel: { interval: 0, rotate: 0, hideOverlap: false },
      nameGap: 44,
      nameTextStyle: { width: 260, overflow: 'breakAll', lineHeight: 14 }
    },
    yAxis: { type: 'value', name: spec.dataConfig.valueName, nameGap: 58, nameTextStyle: { width: 120, overflow: 'breakAll' } },
    series: builtSeries
  };
}

function buildCartesianStackedBar(spec: Spec3D1, horizontal: boolean): echarts.EChartsCoreOption {
  assert3D1Shape(spec);
  const categories = spec.sourceData.categories;
  const series = spec.sourceData.series;

  const grid = { left: 132, right: 24, top: 24, bottom: 92, containLabel: true };
  const base: echarts.EChartsCoreOption = {
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', left: grid.left, right: grid.right, bottom: 8 },
    grid
  };

  const builtSeries = series.map(s => ({
    type: 'bar',
    name: s.seriesName,
    stack: 'total',
    emphasis: { focus: 'series' },
    data: s.data
  }));

  if (horizontal) {
    return {
      ...base,
      xAxis: { type: 'value', name: spec.dataConfig.valueName },
      yAxis: {
        type: 'category',
        name: spec.dataConfig.mainCategoryName,
        data: categories,
        axisLabel: { interval: 0, hideOverlap: false }
      },
      series: builtSeries
    };
  }

  return {
    ...base,
    xAxis: {
      type: 'category',
      name: spec.dataConfig.mainCategoryName,
      data: categories,
      axisLabel: { interval: 0, rotate: 0, hideOverlap: false },
      nameGap: 44,
      nameTextStyle: { width: 260, overflow: 'breakAll', lineHeight: 14 }
    },
    yAxis: { type: 'value', name: spec.dataConfig.valueName, nameGap: 58, nameTextStyle: { width: 120, overflow: 'breakAll' } },
    series: builtSeries
  };
}

function buildStackArea(spec: Spec3D1): echarts.EChartsCoreOption {
  assert3D1Shape(spec);
  const categories = spec.sourceData.categories;
  const series = spec.sourceData.series;

  const grid = { left: 132, right: 24, top: 24, bottom: 92, containLabel: true };
  return {
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', left: grid.left, right: grid.right, bottom: 8 },
    grid,
    xAxis: {
      type: 'category',
      name: spec.dataConfig.mainCategoryName,
      data: categories,
      axisLabel: { interval: 0, rotate: 0, hideOverlap: false },
      nameGap: 44,
      nameTextStyle: { width: 260, overflow: 'breakAll', lineHeight: 14 }
    },
    yAxis: { type: 'value', name: spec.dataConfig.valueName, nameGap: 58, nameTextStyle: { width: 120, overflow: 'breakAll' } },
    series: series.map(s => ({
      type: 'line',
      smooth: true,
      stack: 'total',
      name: s.seriesName,
      data: s.data,
      areaStyle: {}
    }))
  };
}

function buildMultiLine(spec: Spec3D1): echarts.EChartsCoreOption {
  assert3D1Shape(spec);
  const categories = spec.sourceData.categories;
  const series = spec.sourceData.series;

  const grid = { left: 132, right: 24, top: 24, bottom: 92, containLabel: true };
  return {
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', left: grid.left, right: grid.right, bottom: 8 },
    grid,
    xAxis: {
      type: 'category',
      name: spec.dataConfig.mainCategoryName,
      data: categories,
      axisLabel: { interval: 0, rotate: 0, hideOverlap: false },
      nameGap: 44,
      nameTextStyle: { width: 260, overflow: 'breakAll', lineHeight: 14 }
    },
    yAxis: { type: 'value', name: spec.dataConfig.valueName, nameGap: 58, nameTextStyle: { width: 120, overflow: 'breakAll' } },
    series: series.map(s => ({ type: 'line', smooth: true, name: s.seriesName, data: s.data }))
  };
}

function buildHeatmap(spec: Spec3D1): echarts.EChartsCoreOption {
  assert3D1Shape(spec);
  const xCats = spec.sourceData.categories;
  const yCats = spec.sourceData.series.map(s => s.seriesName);
  const allValues = spec.sourceData.series.flatMap(s => s.data);
  const max = maxOr1(allValues);

  const data: Array<[number, number, number]> = [];
  for (let y = 0; y < spec.sourceData.series.length; y++) {
    for (let x = 0; x < xCats.length; x++) {
      data.push([x, y, spec.sourceData.series[y].data[x] ?? 0]);
    }
  }

  return {
    tooltip: { position: 'top' },
    grid: { left: 132, right: 24, top: 24, bottom: 92, containLabel: true },
    xAxis: {
      type: 'category',
      name: spec.dataConfig.mainCategoryName,
      data: xCats,
      splitArea: { show: true },
      axisLabel: { interval: 0, rotate: 0, hideOverlap: false },
      nameGap: 44,
      nameTextStyle: { width: 260, overflow: 'breakAll', lineHeight: 14 }
    },
    yAxis: {
      type: 'category',
      name: spec.dataConfig.groupCategoryName,
      data: yCats,
      splitArea: { show: true },
      axisLabel: { interval: 0, hideOverlap: false },
      nameGap: 58,
      nameTextStyle: { width: 160, overflow: 'breakAll' }
    },
    visualMap: {
      min: 0,
      max,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 8
    },
    series: [
      {
        type: 'heatmap',
        data,
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.25)' } }
      }
    ]
  };
}

function buildPolarStack(spec: Spec3D1, ring: boolean): echarts.EChartsCoreOption {
  assert3D1Shape(spec);
  const categories = spec.sourceData.categories;
  const series = spec.sourceData.series;

  if (!ring) {
    return {
      tooltip: { trigger: 'item' },
      legend: { type: 'scroll', bottom: 8 },
      polar: { radius: ['16%', '70%'] },
      angleAxis: {
        type: 'category',
        name: spec.dataConfig.mainCategoryName,
        nameGap: 26,
        nameTextStyle: { width: 200, overflow: 'breakAll' },
        data: categories,
        axisLabel: { interval: 0, rotate: 0, hideOverlap: false }
      },
      radiusAxis: { type: 'value', name: spec.dataConfig.valueName, nameGap: 18, nameTextStyle: { width: 120, overflow: 'breakAll' } },
      series: series.map(s => ({
        type: 'bar',
        coordinateSystem: 'polar',
        stack: 'total',
        name: s.seriesName,
        data: s.data
      }))
    };
  }

  return {
    tooltip: { trigger: 'item' },
    legend: { type: 'scroll', bottom: 8 },
    polar: { radius: ['18%', '72%'] },
    radiusAxis: {
      type: 'category',
      name: spec.dataConfig.mainCategoryName,
      nameGap: 26,
      nameTextStyle: { width: 200, overflow: 'breakAll' },
      data: categories,
      axisLabel: { interval: 0, hideOverlap: false }
    },
    angleAxis: { type: 'value', name: spec.dataConfig.valueName, nameGap: 18, nameTextStyle: { width: 120, overflow: 'breakAll' } },
    series: series.map(s => ({
      type: 'bar',
      coordinateSystem: 'polar',
      stack: 'total',
      name: s.seriesName,
      data: s.data
    }))
  };
}

function buildRadarMulti(spec: Spec3D1): echarts.EChartsCoreOption {
  assert3D1Shape(spec);
  const categories = spec.sourceData.categories;
  const series = spec.sourceData.series;
  const max = Math.ceil(maxOr1(series.flatMap(s => s.data)) * 1.15);

  return {
    tooltip: { trigger: 'item' },
    legend: { type: 'scroll', bottom: 8 },
    radar: { indicator: categories.map(name => ({ name, max })) },
    series: [
      {
        type: 'radar',
        data: series.map(s => ({ name: s.seriesName, value: s.data }))
      }
    ]
  };
}

export function build3D1Option(spec: Spec3D1): echarts.EChartsCoreOption {
  const ct = spec.chartMeta.chartType;

  if (ct === 'groupBar') return buildCartesianGroupedBar(spec, false);
  if (ct === 'groupHorizontalBar') return buildCartesianGroupedBar(spec, true);
  if (ct === 'stackBar') return buildCartesianStackedBar(spec, false);
  if (ct === 'stackHorizontalBar') return buildCartesianStackedBar(spec, true);
  if (ct === 'stackArea') return buildStackArea(spec);
  if (ct === 'multiLine') return buildMultiLine(spec);
  if (ct === 'heatmap') return buildHeatmap(spec);
  if (ct === 'polarStackBar') return buildPolarStack(spec, false);
  if (ct === 'polarStackRing') return buildPolarStack(spec, true);
  if (ct === 'radar-multi') return buildRadarMulti(spec);

  throw new Error(`3D-1: 不支持的 chartType: ${ct}`);
}

export function render3D1(dom: HTMLElement, echartsInstance: typeof echarts, spec: Spec3D1, init?: ChartInitOptions) {
  const chart = getOrCreateChart(dom, echartsInstance, init);
  const option = build3D1Option(spec);
  setChartOption(chart, option);
  return chart;
}
