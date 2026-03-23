import cron from 'node-cron'
import { prisma } from './prisma.js'
import { enqueueNotification } from './job-queue.js'

// ─── Tipos dos registros de Activity (requer schema composto) ─────────────────

interface ActivityWithReminder {
  id: string
  tenant_id: string
  assigned_to: string | null
}

interface ActivityWithNextStep {
  id: string
  tenant_id: string
  assigned_to: string | null
}

interface ActivityWithRecording {
  id: string
  tenant_id: string
  assigned_to: string | null
}

// ─── Funções de varredura ─────────────────────────────────────────────────────

// Prisma extendido com modelos do schema composto
const prismaExt = prisma as unknown as {
  activity: {
    findMany: (args: {
      where: Record<string, unknown>
      select: Record<string, boolean>
    }) => Promise<ActivityWithReminder[]>
    updateMany: (args: {
      where: Record<string, unknown>
      data: Record<string, unknown>
    }) => Promise<{ count: number }>
  }
}

// A — Lembretes vencidos (reminder_at <= agora, reminder_sent: false)
async function scanReminders(): Promise<void> {
  const activities = await prismaExt.activity.findMany({
    where: {
      reminder_at: { lte: new Date() },
      reminder_sent: false,
    },
    select: { id: true, tenant_id: true, assigned_to: true },
  })

  for (const act of activities) {
    const userId = act.assigned_to
    if (!userId) continue

    await enqueueNotification(
      { type: 'reminder', activityId: act.id, userId, tenantId: act.tenant_id },
      `reminder-${act.id}-${userId}`,
    )
  }

  if (activities.length > 0) {
    const ids = activities.map((a) => a.id)
    await prismaExt.activity.updateMany({
      where: { id: { in: ids } },
      data: { reminder_sent: true },
    })
  }
}

// B — Próximos passos chegando amanhã (next_step_date <= amanhã, next_step_reminder_sent: false)
async function scanNextSteps(): Promise<void> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(23, 59, 59, 999)

  const activities = await (prismaExt.activity.findMany as (args: {
    where: Record<string, unknown>
    select: Record<string, boolean>
  }) => Promise<ActivityWithNextStep[]>)({
    where: {
      next_step_date: { lte: tomorrow },
      next_step_reminder_sent: false,
    },
    select: { id: true, tenant_id: true, assigned_to: true },
  })

  for (const act of activities) {
    const userId = act.assigned_to
    if (!userId) continue

    await enqueueNotification(
      { type: 'next-step', activityId: act.id, userId, tenantId: act.tenant_id },
      `next-step-${act.id}-${userId}`,
    )
  }

  if (activities.length > 0) {
    const ids = activities.map((a) => a.id)
    await prismaExt.activity.updateMany({
      where: { id: { in: ids } },
      data: { next_step_reminder_sent: true },
    })
  }
}

// C — Gravações disponíveis (recording_url != null, recording_sent: false)
async function scanRecordings(): Promise<void> {
  const activities = await (prismaExt.activity.findMany as (args: {
    where: Record<string, unknown>
    select: Record<string, boolean>
  }) => Promise<ActivityWithRecording[]>)({
    where: {
      recording_url: { not: null },
      recording_sent: false,
    },
    select: { id: true, tenant_id: true, assigned_to: true },
  })

  for (const act of activities) {
    const userId = act.assigned_to
    if (!userId) continue

    await enqueueNotification(
      { type: 'recording', activityId: act.id, userId, tenantId: act.tenant_id },
      `recording-${act.id}-${userId}`,
    )
  }

  if (activities.length > 0) {
    const ids = activities.map((a) => a.id)
    await prismaExt.activity.updateMany({
      where: { id: { in: ids } },
      data: { recording_sent: true },
    })
  }
}

// ─── Inicialização do cron ────────────────────────────────────────────────────

export function startCron(): void {
  // Varredura a cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    try {
      await scanReminders()
      await scanNextSteps()
      await scanRecordings()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[notification-cron] Erro na varredura:', msg)
    }
  })

  console.info('[notification-cron] Cron iniciado — varredura a cada 5 minutos')
}
