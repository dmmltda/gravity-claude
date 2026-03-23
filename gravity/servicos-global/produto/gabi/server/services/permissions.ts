import { AppError } from '@tenant/errors/AppError.js'

// Verifica permissão do usuário chamando o Configurador via API REST.
// NUNCA importar código do configurador diretamente.
async function checkUserPermission(
  userId: string,
  action: string,
  resource: string
): Promise<boolean> {
  const configuradorUrl = process.env.CONFIGURADOR_URL
  const internalKey = process.env.INTERNAL_KEY

  if (!configuradorUrl || !internalKey) {
    throw new AppError(500, 'CONFIGURATION_ERROR', 'CONFIGURADOR_URL ou INTERNAL_KEY não configurados')
  }

  const response = await fetch(`${configuradorUrl}/api/v1/access/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': internalKey,
    },
    body: JSON.stringify({ userId, action, resource }),
  })

  if (!response.ok) return false

  const data = (await response.json()) as { allowed: boolean }
  return data.allowed === true
}

// assertGabiPermission() deve ser a PRIMEIRA linha de toda função de ação da Gabi.
// Lança AppError 403 se o usuário não tiver permissão.
// Informa no throw qual ação/recurso foi bloqueado para auditoria.
export async function assertGabiPermission(
  userId: string,
  action: string,
  resource: string
): Promise<void> {
  const hasPermission = await checkUserPermission(userId, action, resource)
  if (!hasPermission) {
    throw new AppError(
      403,
      'GABI_PERMISSION_DENIED',
      `Gabi: usuário não tem permissão para "${action}" em "${resource}"`
    )
  }
}
