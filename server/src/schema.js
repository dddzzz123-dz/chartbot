import { z } from 'zod';

export const ChartType3D1 = z.enum([
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
]);

export const BotSpecSchema = z
  .object({
    theme: z.string().min(1),
    title: z.string().min(1),
    type: ChartType3D1,
    dimension: z.number().int().refine(v => v === 2),
    x_category: z.string().min(1),
    y_category: z.string().min(1),
    x_labels: z.array(z.string().min(1)).min(1),
    y_labels: z.array(z.string().min(1)).min(1),
    data: z.array(z.array(z.union([z.number(), z.string()]))).min(1),
    unit: z.string().optional().default('')
  })
  .superRefine((spec, ctx) => {
    if (spec.data.length !== spec.y_labels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'data 行数必须等于 y_labels.length',
        path: ['data']
      });
      return;
    }
    for (let y = 0; y < spec.data.length; y++) {
      if (spec.data[y].length !== spec.x_labels.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `data[${y}] 列数必须等于 x_labels.length`,
          path: ['data', y]
        });
        return;
      }
    }
  });

export function normalizeBotSpec(raw) {
  const parsed = BotSpecSchema.parse(raw);
  return {
    ...parsed,
    unit: parsed.unit ?? '',
    data: parsed.data.map(row =>
      row.map(v => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
      })
    )
  };
}
