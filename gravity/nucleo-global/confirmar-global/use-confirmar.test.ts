import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConfirmarInterno } from './use-confirmar.js'

describe('useConfirmarInterno', () => {
  it('inicia com estado invisível', () => {
    const { result } = renderHook(() => useConfirmarInterno())
    expect(result.current.estado.visivel).toBe(false)
    expect(result.current.estado.resolver).toBeNull()
  })

  it('confirmar() exibe o diálogo e retorna Promise', async () => {
    const { result } = renderHook(() => useConfirmarInterno())

    let promise: Promise<boolean>
    act(() => {
      promise = result.current.confirmar('Deseja excluir?')
    })

    expect(result.current.estado.visivel).toBe(true)
    expect(result.current.estado.config.mensagem).toBe('Deseja excluir?')
  })

  it('responder(true) resolve a Promise com true', async () => {
    const { result } = renderHook(() => useConfirmarInterno())

    let promise: Promise<boolean>
    act(() => {
      promise = result.current.confirmar('Deseja prosseguir?')
    })

    act(() => {
      result.current.responder(true)
    })

    const valor = await promise!
    expect(valor).toBe(true)
    expect(result.current.estado.visivel).toBe(false)
  })

  it('responder(false) resolve a Promise com false', async () => {
    const { result } = renderHook(() => useConfirmarInterno())

    let promise: Promise<boolean>
    act(() => {
      promise = result.current.confirmar('Tem certeza?')
    })

    act(() => {
      result.current.responder(false)
    })

    const valor = await promise!
    expect(valor).toBe(false)
    expect(result.current.estado.visivel).toBe(false)
  })

  it('confirmar() aceita ConfirmarConfig completa', async () => {
    const { result } = renderHook(() => useConfirmarInterno())

    act(() => {
      result.current.confirmar({
        titulo: 'Atenção',
        mensagem: 'Esta ação é irreversível.',
        variante: 'perigo',
        textoBotaoConfirmar: 'Sim, excluir',
        textoBotaoCancelar: 'Não',
      })
    })

    expect(result.current.estado.config.titulo).toBe('Atenção')
    expect(result.current.estado.config.variante).toBe('perigo')
    expect(result.current.estado.config.textoBotaoConfirmar).toBe('Sim, excluir')
  })

  it('após responder, estado volta a invisível', async () => {
    const { result } = renderHook(() => useConfirmarInterno())

    act(() => {
      result.current.confirmar('Confirmar?')
    })
    expect(result.current.estado.visivel).toBe(true)

    act(() => {
      result.current.responder(true)
    })
    expect(result.current.estado.visivel).toBe(false)
    expect(result.current.estado.resolver).toBeNull()
  })
})
