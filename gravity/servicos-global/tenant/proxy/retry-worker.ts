import { prisma } from './prisma.js'
import { enqueueTenantAction } from './enqueue-tenant-action.js'

const CRON_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos
const MAX_BATCH = 10
const MAX_ATTEMPTS = 10

/**
 * Inicia o worker de retry da dead-letter queue.
 *
 * A cada 5 minutos:
 *   1. Busca até 10 registros com status PENDING ou FAILED e attempts < 10
 *   2. Marca todos como PROCESSING
 *   3. Processa em paralelo via Promise.allSettled
 *   4. Atualiza cada registro: COMPLETED em sucesso, FAILED + increment attempts em falha
 *
 * @returns O timer NodeJS (pode ser usado para interromper o worker com clearInterval)
 */
export function startRetryWorker(): NodeJS.Timer {
  return setInterval(() => {
    void runRetryBatch()
  }, CRON_INTERVAL_MS)
}

async function runRetryBatch(): Promise<void> {
  const pending = await prisma.failedTenantAction.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: MAX_BATCH,
    orderBy: { created_at: 'asc' },
  })

  if (pending.length === 0) return

  // Marca todos como PROCESSING antes de processar para evitar reprocessamento concorrente
  await prisma.failedTenantAction.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data: { status: 'PROCESSING' },
  })

  const results = await Promise.allSettled(
    pending.map(async (record) => {
      const result = await enqueueTenantAction({
        service: record.service,
        action: record.action,
        payload: record.payload,
        tenantId: record.tenant_id,
        userId: record.user_id,
        idempotencyKey: record.idempotency_key,
        retries: 1, // única tentativa no retry worker; o backoff principal já ocorreu
      })

      if (result.success) {
        await prisma.failedTenantAction.update({
          where: { id: record.id },
          data: { status: 'COMPLETED' },
        })
      } else {
        await prisma.failedTenantAction.update({
          where: { id: record.id },
          data: {
            status: 'FAILED',
            attempts: { increment: 1 },
          },
        })
      }
    })
  )

  // Log de erros inesperados (falha no próprio pipeline, não no serviço upstream)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[retry-worker] Erro inesperado ao processar registro:', result.reason)
    }
  }
}
