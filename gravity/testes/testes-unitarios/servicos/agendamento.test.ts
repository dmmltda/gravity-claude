import { describe, it, expect } from 'vitest'
import {
  computeFreeSlots,
  buildStartOfDay,
  buildEndOfDay,
} from '../../../servicos-global/tenant/agendamento/server/agenda-utils.js'

// ─── buildStartOfDay / buildEndOfDay ─────────────────────────────────────────

describe('buildStartOfDay', () => {
  it('retorna meia-noite UTC para a data informada', () => {
    const d = buildStartOfDay('2026-03-23')
    expect(d.toISOString()).toBe('2026-03-23T00:00:00.000Z')
  })
})

describe('buildEndOfDay', () => {
  it('retorna 23:59:59.999 UTC para a data informada', () => {
    const d = buildEndOfDay('2026-03-23')
    expect(d.toISOString()).toBe('2026-03-23T23:59:59.999Z')
  })
})

// ─── computeFreeSlots ─────────────────────────────────────────────────────────

function makeDate(timeStr: string, date = '2026-03-23'): Date {
  return new Date(`${date}T${timeStr}Z`)
}

describe('computeFreeSlots', () => {
  const workStart = makeDate('08:00:00.000')
  const workEnd = makeDate('18:00:00.000')

  it('retorna todos os slots quando não há eventos ocupados', () => {
    const slots = computeFreeSlots([], workStart, workEnd, 60)
    // 08:00 até 18:00 = 10 slots de 60 min
    expect(slots).toHaveLength(10)
    expect(slots[0].start).toBe('2026-03-23T08:00:00.000Z')
    expect(slots[0].end).toBe('2026-03-23T09:00:00.000Z')
    expect(slots[9].start).toBe('2026-03-23T17:00:00.000Z')
    expect(slots[9].end).toBe('2026-03-23T18:00:00.000Z')
  })

  it('exclui slot que se sobrepõe com evento ocupado', () => {
    const busy = [{ starts_at: makeDate('09:00:00.000'), ends_at: makeDate('10:00:00.000') }]
    const slots = computeFreeSlots(busy, workStart, workEnd, 60)
    // 9h bloqueado → 9 slots livres
    expect(slots).toHaveLength(9)
    const startTimes = slots.map((s) => s.start)
    expect(startTimes).not.toContain('2026-03-23T09:00:00.000Z')
  })

  it('exclui slot que se sobrepõe parcialmente com evento (início durante slot)', () => {
    // Evento 09:30–10:30 deve bloquear o slot 09:00–10:00
    const busy = [{ starts_at: makeDate('09:30:00.000'), ends_at: makeDate('10:30:00.000') }]
    const slots = computeFreeSlots(busy, workStart, workEnd, 60)
    const startTimes = slots.map((s) => s.start)
    expect(startTimes).not.toContain('2026-03-23T09:00:00.000Z')
  })

  it('retorna lista vazia quando dia está completamente ocupado', () => {
    const busy = [{ starts_at: workStart, ends_at: workEnd }]
    const slots = computeFreeSlots(busy, workStart, workEnd, 60)
    expect(slots).toHaveLength(0)
  })

  it('funciona com slots de 30 minutos — 20 slots de 08:00 a 18:00', () => {
    const slots = computeFreeSlots([], workStart, workEnd, 30)
    expect(slots).toHaveLength(20)
  })

  it('retorna lista vazia quando slot não cabe no horário de trabalho', () => {
    // workStart = workEnd → nenhum slot possível
    const slots = computeFreeSlots([], workEnd, workEnd, 60)
    expect(slots).toHaveLength(0)
  })
})
