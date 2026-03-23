// Lógica pura de cálculo de tempo — extraída para permitir testes unitários

export interface ActiveTimer {
  id: string
  started_at: Date
  paused_at: Date | null
  accumulated_seconds: number
  activity_id: string
  tenant_id: string
  user_id: string
}

/**
 * Calcula o total de segundos decorridos de um timer ativo.
 * - Se pausado: retorna apenas accumulated_seconds
 * - Se rodando: soma accumulated_seconds com o tempo desde started_at
 */
export function calcElapsedSeconds(active: ActiveTimer): number {
  if (active.paused_at) return active.accumulated_seconds
  return (
    active.accumulated_seconds +
    Math.floor((Date.now() - active.started_at.getTime()) / 1000)
  )
}
