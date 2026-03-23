import PgBoss from 'pg-boss'
import { processNotificationJob } from './notification-worker.js'

export interface NotificationJobData {
  type: string
  activityId: string | null
  userId: string       // Clerk ID ou email direto
  tenantId: string
  extra?: Record<string, string | number | boolean | null>
}

let boss: PgBoss | null = null

export function getBoss(): PgBoss {
  if (!boss) throw new Error('pg-boss não iniciado — chame startQueue() primeiro')
  return boss
}

export async function startQueue(): Promise<void> {
  boss = new PgBoss(process.env.TENANT_DATABASE_URL!)

  boss.on('error', (err) => {
    console.error('[notification-queue] pg-boss error:', err.message)
  })

  await boss.start()

  // 20 workers paralelos — throw relança automaticamente para pg-boss retentar
  await boss.work<NotificationJobData>(
    'send-notification',
    { teamSize: 20 },
    async (job) => {
      await processNotificationJob(job.data)
    },
  )

  console.info('[notification-queue] pg-boss iniciado com 20 workers')
}

export async function enqueueNotification(
  data: NotificationJobData,
  singletonKey: string,
): Promise<void> {
  const b = getBoss()
  await b.send('send-notification', data, { singletonKey })
}
