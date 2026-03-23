/**
 * Lógica pura de avaliação de permissão — sem dependência de banco de dados.
 * Extraída da rota para permitir testes unitários.
 */

export type ActionType = 'read' | 'write' | 'delete' | 'admin'

/**
 * Avalia se um mapa de permissões (JSON do ProductPermission) concede
 * acesso a um resource/action específico.
 *
 * Estrutura esperada do permissions JSON:
 * { "relatorios": { "read": true, "write": false }, "dashboard": { "read": true } }
 */
export function evaluatePermission(
  permissions: unknown,
  resource: string,
  action: ActionType
): boolean {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return false
  }

  const perms = permissions as Record<string, unknown>
  const resourcePerms = perms[resource]

  if (!resourcePerms || typeof resourcePerms !== 'object' || Array.isArray(resourcePerms)) {
    return false
  }

  return !!(resourcePerms as Record<string, unknown>)[action]
}

/**
 * Status de subscription considerados ativos.
 */
const ACTIVE_STATUSES = new Set(['trial', 'active'])

export function isSubscriptionActive(status: string): boolean {
  return ACTIVE_STATUSES.has(status)
}
