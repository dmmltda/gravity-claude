// Utilitários de SLA do helpdesk — extraídos para testes unitários

/**
 * Calcula o status de SLA de um ticket dado o deadline e o flag de breach.
 * - 'breached': SLA já violado (flag ou deadline no passado)
 * - 'warning': menos de 2h restantes
 * - 'ok': dentro do prazo
 */
export function calcSlaStatus(
  deadline: Date | null,
  breached: boolean
): 'ok' | 'warning' | 'breached' {
  if (breached) return 'breached'
  if (!deadline) return 'ok'

  const msUntil = deadline.getTime() - Date.now()
  const twoHoursMs = 2 * 60 * 60 * 1000

  if (msUntil < 0) return 'breached'
  if (msUntil < twoHoursMs) return 'warning'
  return 'ok'
}
