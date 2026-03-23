import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calcElapsedSeconds, type ActiveTimer } from '../../../servicos-global/tenant/cronometro/server/calc-elapsed.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTimer(overrides: Partial<ActiveTimer> = {}): ActiveTimer {
  return {
    id: 'timer_1',
    started_at: new Date(Date.now() - 90_000), // 90s atrás por padrão
    paused_at: null,
    accumulated_seconds: 0,
    activity_id: 'act_1',
    tenant_id: 'tenant_1',
    user_id: 'user_1',
    ...overrides,
  }
}

// ─── calcElapsedSeconds ───────────────────────────────────────────────────────

describe('calcElapsedSeconds', () => {
  it('retorna accumulated_seconds quando o timer está pausado', () => {
    const timer = makeTimer({
      accumulated_seconds: 120,
      paused_at: new Date(),
    })
    expect(calcElapsedSeconds(timer)).toBe(120)
  })

  it('retorna accumulated_seconds sem adicionar tempo quando pausado há algum tempo', () => {
    // Mesmo que paused_at seja antiga, o que importa é que paused_at !== null
    const timer = makeTimer({
      accumulated_seconds: 300,
      paused_at: new Date(Date.now() - 60_000),
    })
    expect(calcElapsedSeconds(timer)).toBe(300)
  })

  it('soma accumulated_seconds com tempo decorrido desde started_at quando rodando', () => {
    const startedAt = new Date(Date.now() - 60_000) // 60s atrás
    const timer = makeTimer({
      started_at: startedAt,
      accumulated_seconds: 30,
      paused_at: null,
    })
    // Deve ser ~90s (30 acumulado + 60 decorrido), com margem de 2s para execução
    const result = calcElapsedSeconds(timer)
    expect(result).toBeGreaterThanOrEqual(88)
    expect(result).toBeLessThanOrEqual(92)
  })

  it('retorna 0 para timer recem iniciado sem acumulado', () => {
    const timer = makeTimer({
      started_at: new Date(), // agora
      accumulated_seconds: 0,
      paused_at: null,
    })
    expect(calcElapsedSeconds(timer)).toBeLessThanOrEqual(1)
  })

  it('sessões com menos de 60s ainda retornam o valor correto (quem descarta é o caller)', () => {
    const timer = makeTimer({
      started_at: new Date(Date.now() - 30_000), // 30s
      accumulated_seconds: 0,
      paused_at: null,
    })
    const result = calcElapsedSeconds(timer)
    expect(result).toBeGreaterThanOrEqual(28)
    expect(result).toBeLessThan(60)
  })

  it('timer pausado após retomada preserva accumulated_seconds correto', () => {
    // Simula: acumulou 200s de sessões anteriores, pausado agora
    const timer = makeTimer({
      started_at: new Date(Date.now() - 45_000),
      accumulated_seconds: 200,
      paused_at: new Date(), // pausado agora → usa só accumulated
    })
    expect(calcElapsedSeconds(timer)).toBe(200)
  })
})
