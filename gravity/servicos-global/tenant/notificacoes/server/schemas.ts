import { z } from 'zod'

export const notificationTypeEnum = z.enum([
  'mentioned',
  'task-assigned',
  'reminder',
  'next-step',
  'meeting-invite',
  'meeting-summary',
  'recording',
  'gabi-summary',
])

export const testQuerySchema = z.object({
  type: notificationTypeEnum.default('mentioned'),
})
