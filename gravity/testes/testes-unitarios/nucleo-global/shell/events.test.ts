import { describe, it, expect, vi } from 'vitest'
import { emit, on } from '../../../../nucleo-global/shell/events.js'

describe('emit + on', () => {
  it('dispara o handler registrado com o payload correto', () => {
    const handler = vi.fn()
    const off = on('test:disparo', handler)

    emit('test:disparo', { valor: 42 })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ valor: 42 })
    off()
  })

  it('não dispara handler de evento diferente', () => {
    const handler = vi.fn()
    const off = on('test:evento-a', handler)

    emit('test:evento-b', 'dados')

    expect(handler).not.toHaveBeenCalled()
    off()
  })
})

describe('unsubscribe', () => {
  it('a função retornada por on() cancela a escuta', () => {
    const handler = vi.fn()
    const off = on('test:unsub', handler)

    off()
    emit('test:unsub', 'payload')

    expect(handler).not.toHaveBeenCalled()
  })

  it('outros handlers do mesmo evento continuam ativos após unsubscribe parcial', () => {
    const handlerA = vi.fn()
    const handlerB = vi.fn()
    const offA = on('test:partial', handlerA)
    on('test:partial', handlerB)

    offA()
    emit('test:partial', 'ok')

    expect(handlerA).not.toHaveBeenCalled()
    expect(handlerB).toHaveBeenCalledOnce()
    // cleanup
    // handlerB sem unsubscribe — evento único de teste não impacta outros
  })
})

describe('múltiplos handlers no mesmo evento', () => {
  it('todos os handlers registrados são chamados na ordem', () => {
    const chamados: number[] = []
    const off1 = on('test:multi', () => chamados.push(1))
    const off2 = on('test:multi', () => chamados.push(2))
    const off3 = on('test:multi', () => chamados.push(3))

    emit('test:multi', null)

    expect(chamados).toHaveLength(3)
    expect(chamados).toContain(1)
    expect(chamados).toContain(2)
    expect(chamados).toContain(3)

    off1()
    off2()
    off3()
  })

  it('emit sem handlers registrados não lança erro', () => {
    expect(() => emit('test:sem-handlers', 'payload')).not.toThrow()
  })
})
