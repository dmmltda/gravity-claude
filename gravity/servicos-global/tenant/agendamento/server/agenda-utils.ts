// Lógica pura de agendamento — extraída para permitir testes unitários

/**
 * Constrói o início do dia (00:00:00 UTC) para uma data no formato YYYY-MM-DD
 */
export function buildStartOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/**
 * Constrói o fim do dia (23:59:59 UTC) para uma data no formato YYYY-MM-DD
 */
export function buildEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`)
}

/**
 * Calcula os slots livres de uma agenda dado os períodos ocupados,
 * o início e fim do horário de trabalho e a duração de cada slot em minutos.
 */
export function computeFreeSlots(
  busyPeriods: Array<{ starts_at: Date; ends_at: Date }>,
  workStart: Date,
  workEnd: Date,
  slotMinutes: number
): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = []
  const slotMs = slotMinutes * 60_000
  let cursor = workStart.getTime()

  while (cursor + slotMs <= workEnd.getTime()) {
    const slotEnd = cursor + slotMs
    const overlaps = busyPeriods.some(
      (p) => p.starts_at.getTime() < slotEnd && p.ends_at.getTime() > cursor
    )
    if (!overlaps) {
      slots.push({ start: new Date(cursor).toISOString(), end: new Date(slotEnd).toISOString() })
    }
    cursor += slotMs
  }

  return slots
}
