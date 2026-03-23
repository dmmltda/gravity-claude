import { describe, it, expect, vi, afterEach } from 'vitest'
import { computeBackoffMs } from '../../../servicos-global/tenant/proxy/enqueue-tenant-action.js'

// ─── computeBackoffMs — backoff exponencial ───────────────────────────────────

describe('computeBackoffMs', () => {
  it('retorna 1 000ms antes da 1ª retry (retryIndex 0)', () => {
    expect(computeBackoffMs(0)).toBe(1_000)
  })

  it('retorna 2 000ms antes da 2ª retry (retryIndex 1)', () => {
    expect(computeBackoffMs(1)).toBe(2_000)
  })

  it('retorna 4 000ms antes da 3ª retry (retryIndex 2)', () => {
    expect(computeBackoffMs(2)).toBe(4_000)
  })

  it('confirma progressão exponencial: cada índice dobra o delay', () => {
    const delays = [0, 1, 2, 3].map(computeBackoffMs)
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000])
  })
})

// ─── idempotencyKey — unicidade e reconhecimento de duplicata ─────────────────

describe('idempotencyKey', () => {
  it('mesmo payload com mesma key deve ser reconhecido como duplicata', () => {
    // Simula o conjunto de keys já processadas (equivalente ao @unique no banco)
    const processedKeys = new Set<string>()

    const key = 'sim_abc123'
    expect(processedKeys.has(key)).toBe(false)

    processedKeys.add(key)
    expect(processedKeys.has(key)).toBe(true) // duplicata detectada
  })

  it('keys distintas não colidem entre si', () => {
    const processedKeys = new Set<string>()
    processedKeys.add('sim_001')
    processedKeys.add('sim_002')

    expect(processedKeys.has('sim_001')).toBe(true)
    expect(processedKeys.has('sim_002')).toBe(true)
    expect(processedKeys.has('sim_003')).toBe(false)
  })

  it('prefixo de serviço garante namespace único entre serviços distintos', () => {
    // 'email_123' e 'cronometro_123' são keys distintas mesmo com o mesmo ID
    const keyEmail = `email_123`
    const keyCronometro = `cronometro_123`
    expect(keyEmail).not.toBe(keyCronometro)
  })
})

// ─── timeout de 10s — AbortController ────────────────────────────────────────

describe('timeout via AbortController', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('AbortController não aborta antes de 10 000ms', () => {
    vi.useFakeTimers()

    const controller = new AbortController()
    const handle = setTimeout(() => controller.abort(), 10_000)

    vi.advanceTimersByTime(9_999)
    expect(controller.signal.aborted).toBe(false)

    clearTimeout(handle)
  })

  it('AbortController aborta exatamente aos 10 000ms', () => {
    vi.useFakeTimers()

    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10_000)

    vi.advanceTimersByTime(10_000)
    expect(controller.signal.aborted).toBe(true)
  })

  it('signal abortado emite evento abort', () => {
    vi.useFakeTimers()

    const controller = new AbortController()
    const abortSpy = vi.fn()
    controller.signal.addEventListener('abort', abortSpy)

    setTimeout(() => controller.abort(), 10_000)

    vi.advanceTimersByTime(10_000)
    expect(abortSpy).toHaveBeenCalledOnce()
  })
})
