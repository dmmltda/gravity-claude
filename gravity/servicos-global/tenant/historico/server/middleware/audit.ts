// servicos-global/tenant/historico/server/middleware/audit.ts
import { createHash } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import * as Sentry from '@sentry/node'
import { AppError } from '../../errors/AppError.js'

// ─── Tipos de Contexto de Ator ──────────────────────────────────────────────

export interface UserContext {
  actorType: 'user'
  actorId: string       // ID real do usuário autenticado
  actorName: string     // nome do usuário
  sessionId: string     // ID da sessão Clerk
}

export interface SystemContext {
  actorType: 'system'
  actorId: null         // NUNCA um ID de usuário
  actorName: string     // nome do serviço (ex: 'Cron: Receita Federal')
  serviceId: string     // ID do serviço que executou
}

export interface GabiContext {
  actorType: 'gabi'
  actorId: null
  actorName: 'Gabi AI'
  modelUsed: string     // ex: 'gemini-2.5-flash'
}

export type ActorContext = UserContext | SystemContext | GabiContext

// ─── Estrutura de um item de diff ───────────────────────────────────────────

export interface DiffItem {
  field: string
  label: string
  before: string | null
  after: string | null
}

// ─── Dados para gravação do log ──────────────────────────────────────────────

interface AuditLogData {
  tenant_id: string
  product_id?: string
  actor_id: string | null
  actor_type: string
  actor_name: string
  action: string
  entity: string
  entity_label: string
  entity_id?: string
  description: string
  diff?: DiffItem[]
  source_service?: string
  triggered_by?: string
  related_log_id?: string
  ip_address?: string
  user_agent?: string
  created_at: Date
}

// ─── Limite de anomalia ──────────────────────────────────────────────────────

const ANOMALY_THRESHOLD = { count: 50, windowSeconds: 10 }

// ─── Funções de suporte ──────────────────────────────────────────────────────

export function computeLogHash(log: AuditLogData): string {
  const payload = JSON.stringify({
    tenant_id:   log.tenant_id,
    actor_id:    log.actor_id,
    actor_type:  log.actor_type,
    action:      log.action,
    entity_id:   log.entity_id ?? null,
    description: log.description,
    diff:        log.diff ?? null,
    created_at:  log.created_at.toISOString(),
  })
  return createHash('sha256').update(payload).digest('hex')
}

async function checkAnomalyAfterLog(
  prisma: PrismaClient,
  tenantId: string,
  actorId: string | null
): Promise<void> {
  const windowStart = new Date(Date.now() - ANOMALY_THRESHOLD.windowSeconds * 1000)
  const recent = await prisma.auditLog.count({
    where: {
      tenant_id:  tenantId,
      actor_id:   actorId,
      created_at: { gte: windowStart },
    },
  })
  if (recent > ANOMALY_THRESHOLD.count) {
    Sentry.captureMessage(
      `Anomalia no histórico: ${recent} logs em ${ANOMALY_THRESHOLD.windowSeconds}s` +
      ` para o ator ${actorId ?? 'sistema'} no tenant ${tenantId}`
    )
  }
}

// ─── Middleware de auditoria ─────────────────────────────────────────────────

/**
 * Middleware que captura o estado antes da requisição, intercepta o res.json,
 * e grava o log de auditoria de forma assíncrona (setImmediate).
 *
 * O ator DEVE ser declarado explicitamente via `actor` — o middleware rejeita
 * chamadas sem ator declarado (Barreira 1).
 */
export function auditMiddleware(
  action: string,
  entity: string,
  entityLabel: string,
  actor: ActorContext
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Barreira 1 — ator explícito obrigatório
    if (!actor) {
      next(new AppError(500, 'AUDIT_ACTOR_MISSING', 'Ator de auditoria não declarado'))
      return
    }

    const tenantReq = req as Request & { tenantId: string; userId: string }

    const originalJson = res.json.bind(res) as (body: unknown) => Response

    res.json = (body: unknown): Response => {
      const responseBody = body as Record<string, unknown> | null

      const now = new Date()
      const logData: AuditLogData = {
        tenant_id:    tenantReq.tenantId,
        product_id:   (req.headers['x-product-id'] as string | undefined),
        actor_id:     actor.actorType === 'user' ? actor.actorId : null,
        actor_type:   actor.actorType,
        actor_name:   actor.actorName,
        action,
        entity,
        entity_label: entityLabel,
        entity_id:    (responseBody?.id as string | undefined) ?? req.params['id'],
        description:  buildDescription(action, entityLabel, actor.actorName),
        ip_address:   req.ip,
        user_agent:   req.headers['user-agent'],
        created_at:   now,
      }

      const hash = computeLogHash(logData)

      const prisma = (req as Request & { prisma?: PrismaClient }).prisma
      if (prisma) {
        // Não bloqueia a resposta — log gravado em background
        setImmediate(() => {
          prisma.auditLog.create({
            data: {
              ...logData,
              integrity_hash: hash,
            },
          })
          .then(() => checkAnomalyAfterLog(prisma, logData.tenant_id, logData.actor_id))
          .catch((err: unknown) => {
            console.error('[AUDIT_LOG_ERROR]', err instanceof Error ? err.message : err)
          })
        })
      }

      return originalJson(body)
    }

    next()
  }
}

function buildDescription(
  action: string,
  entityLabel: string,
  actorName: string
): string {
  return `${actorName} executou ${action.toLowerCase()} em ${entityLabel}`
}

// ─── Validação de integridade (job semanal) ───────────────────────────────────

/**
 * Recalcula o hash de todos os logs do tenant e retorna IDs com discrepância.
 * Chamado pelo job semanal — não faz parte das rotas HTTP.
 */
export async function validateLogIntegrity(
  prisma: PrismaClient,
  tenantId: string
): Promise<string[]> {
  const logs = await prisma.auditLog.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'asc' },
  })

  const tampered: string[] = []

  for (const log of logs) {
    if (!log.integrity_hash) continue

    const recomputed = computeLogHash({
      tenant_id:    log.tenant_id,
      actor_id:     log.actor_id,
      actor_type:   log.actor_type,
      actor_name:   log.actor_name,
      action:       log.action,
      entity:       log.entity,
      entity_label: log.entity_label,
      entity_id:    log.entity_id ?? undefined,
      description:  log.description,
      diff:         log.diff as DiffItem[] | undefined,
      created_at:   log.created_at,
    })

    if (recomputed !== log.integrity_hash) {
      tampered.push(log.id)
      Sentry.captureMessage(
        `Integridade violada: AuditLog ${log.id} no tenant ${tenantId}`
      )
    }
  }

  return tampered
}
