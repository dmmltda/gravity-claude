import type { Prisma } from '@prisma/client'
import { AppError } from '../errors/AppError.js'
import { prisma } from './prisma.js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TenantAction {
  service: string
  action: string
  payload: unknown
  tenantId: string
  userId: string
  idempotencyKey: string
  retries?: number
}

// ─── Helpers puros (exportados para testabilidade) ────────────────────────────

/**
 * Calcula o delay em ms para a tentativa `retryIndex` (0-based).
 *   retryIndex 0 → 1 000 ms
 *   retryIndex 1 → 2 000 ms
 *   retryIndex 2 → 4 000 ms
 */
export function computeBackoffMs(retryIndex: number): number {
  return 1000 * Math.pow(2, retryIndex)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── getServiceToken ──────────────────────────────────────────────────────────

/**
 * Obtém um machine token via Configurador.
 * Usado para ações assíncronas onde o JWT do usuário pode ter expirado.
 */
export async function getServiceToken(tenantId: string, userId: string): Promise<string> {
  const configuratorUrl = process.env.CONFIGURATOR_URL
  if (!configuratorUrl) {
    throw new AppError(500, 'CONFIG_ERROR', 'CONFIGURATOR_URL não configurado')
  }

  let response: globalThis.Response
  try {
    response = await fetch(`${configuratorUrl}/api/internal/service-token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-key': process.env.INTERNAL_SERVICE_KEY ?? '',
      },
      body: JSON.stringify({ tenantId, userId }),
    })
  } catch {
    throw new AppError(502, 'TOKEN_FETCH_ERROR', 'Falha ao obter service token do Configurador')
  }

  if (!response.ok) {
    throw new AppError(502, 'TOKEN_FETCH_ERROR', 'Falha ao obter service token do Configurador')
  }

  const data = await response.json() as { token: string }
  return data.token
}

// ─── enqueueTenantAction ──────────────────────────────────────────────────────

/**
 * Envia uma ação para um serviço de tenant com retry exponencial.
 *
 * Fluxo:
 *   1. Gera machine token via getServiceToken
 *   2. Tenta até `retries` (default 3) vezes com backoff 1s / 2s / 4s
 *   3. Se todas falharem: persiste em FailedTenantAction (dead-letter) e retorna { success: false }
 *   4. Em sucesso: retorna { success: true }
 *
 * Idempotência garantida via `idempotencyKey` (@unique no banco).
 * Chamadas repetidas com a mesma key fazem upsert, evitando duplicatas.
 */
export async function enqueueTenantAction(
  action: TenantAction
): Promise<{ success: boolean }> {
  const tenantServiceUrl = process.env.TENANT_SERVICE_URL
  if (!tenantServiceUrl) {
    throw new AppError(500, 'CONFIG_ERROR', 'TENANT_SERVICE_URL não configurado')
  }

  const maxRetries = action.retries ?? 3
  const token = await getServiceToken(action.tenantId, action.userId)

  for (let attempt = 0; attempt < maxRetries + 1; attempt++) {
    if (attempt > 0) {
      // backoff exponencial: 1s antes da 1ª retry, 2s antes da 2ª, 4s antes da 3ª
      await sleep(computeBackoffMs(attempt - 1))
    }

    try {
      const response = await fetch(
        `${tenantServiceUrl}/api/v1/${action.service}/${action.action}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
            'x-internal-key': process.env.INTERNAL_SERVICE_KEY ?? '',
            'x-tenant-id': action.tenantId,
            'x-idempotency-key': action.idempotencyKey,
          },
          body: JSON.stringify(action.payload),
        }
      )

      if (response.ok) {
        return { success: true }
      }
    } catch {
      // Rede indisponível — continua para a próxima tentativa
    }
  }

  // Todas as tentativas falharam — persiste na dead-letter queue.
  // Usa upsert para evitar violação de unique constraint se o registro já existir
  // (ex.: chamado a partir do retry-worker com um item já persistido).
  await prisma.failedTenantAction.upsert({
    where: { idempotency_key: action.idempotencyKey },
    update: {
      status: 'PENDING',
      error_log: `Falha após ${maxRetries + 1} tentativa(s)`,
      updated_at: new Date(),
    },
    create: {
      service: action.service,
      action: action.action,
      payload: action.payload as Prisma.InputJsonValue,
      tenant_id: action.tenantId,
      user_id: action.userId,
      idempotency_key: action.idempotencyKey,
      status: 'PENDING',
      error_log: `Falha após ${maxRetries + 1} tentativa(s)`,
    },
  })

  return { success: false }
}
