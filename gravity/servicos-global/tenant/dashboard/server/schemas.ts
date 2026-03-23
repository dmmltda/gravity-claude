import { z } from 'zod'

export const widgetSizeEnum = z.enum(['sm', 'md', 'lg', 'full'])

export const registerWidgetSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  component: z.string().min(1).max(100),
  dataSource: z.string().min(1).max(500),
  permissions: z.array(z.string()).default([]),
  size: widgetSizeEnum,
  productId: z.string().optional(),
})

export const updateWidgetSchema = z.object({
  position: z.number().int().min(0).optional(),
  config: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
})
