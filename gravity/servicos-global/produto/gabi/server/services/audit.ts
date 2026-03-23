import type { PrismaClient } from '@prisma/client'
import { AppError } from '@tenant/errors/AppError.js'
import { assertGabiPermission } from './permissions.js'

export interface GabiAction {
  type: string
  resource: string
  // Snapshot da conversa no momento da ação — obrigatório para auditoria
  context: {
    last_user_query: string
    gabi_plan: string
    reasoning: string
  }
  payload: unknown
}

export interface GabiActionResult {
  logId: string
  result: unknown
}

type GabiActionExecutor = (payload: unknown) => Promise<unknown>

// executeGabiAction — fluxo das 6 barreiras de segurança da Gabi
//
// Barreira 1: assertGabiPermission (primeira linha)
// Barreira 2: log gravado ANTES de executar, com conversation_snapshot
// Barreira 3: se log falhar → cancela ação (rollback)
// Barreira 5: actor_type = 'gabi', user_id = quem disparou
export async function executeGabiAction(
  prisma: PrismaClient,
  userId: string,
  tenantId: string,
  productId: string,
  action: GabiAction,
  executor: GabiActionExecutor
): Promise<GabiActionResult> {
  // Barreira 1 — permissão é a primeira verificação
  await assertGabiPermission(userId, action.type, action.resource)

  // Barreira 2 — grava log ANTES de executar
  let log: { id: string } | null = null
  try {
    log = await (prisma as PrismaClient & {
      gabiUsageLog: {
        create: (args: {
          data: {
            tenant_id: string
            product_id: string
            user_id: string
            actor_type: string
            action_taken: string
            conversation_snapshot: string
          }
        }) => Promise<{ id: string }>
      }
    }).gabiUsageLog.create({
      data: {
        tenant_id: tenantId,
        product_id: productId,
        user_id: userId,
        actor_type: 'gabi',
        action_taken: action.type,
        conversation_snapshot: JSON.stringify(action.context),
      },
    })
  } catch (err) {
    // Barreira 3 — falha no log cancela a ação
    console.error('[GABI_AUDIT_FAIL] Falha ao gravar log de auditoria, ação cancelada', err)
    throw new AppError(
      500,
      'GABI_AUDIT_FAIL',
      'Falha ao registrar auditoria da Gabi. Ação cancelada por segurança.'
    )
  }

  // Barreira 3 — se create retornou null (não deveria, mas garante)
  if (!log) {
    throw new AppError(
      500,
      'GABI_AUDIT_FAIL',
      'Falha ao registrar auditoria da Gabi. Ação cancelada por segurança.'
    )
  }

  // Executa a ação real somente após o log estar garantido
  const result = await executor(action.payload)

  return { logId: log.id, result }
}

// buildActionContext — monta o snapshot da conversa para o audit log
export function buildActionContext(
  lastUserQuery: string,
  gabiPlan: string,
  reasoning: string
): GabiAction['context'] {
  return {
    last_user_query: lastUserQuery,
    gabi_plan: gabiPlan,
    reasoning,
  }
}
