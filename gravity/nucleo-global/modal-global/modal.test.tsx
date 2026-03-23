import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ModalProvider } from './modal-provider.js'
import { useModal } from './use-modal.js'
import { modalReducer, estadoInicial, criarModalConfig } from './modal-manager.js'

// Componente auxiliar para testes
function BotaoModal({ titulo, conteudo }: { titulo: string; conteudo: string }): React.ReactElement {
  const { abrirModal } = useModal()
  return (
    <button
      onClick={() => abrirModal({ titulo, conteudo: <span>{conteudo}</span> })}
    >
      Abrir
    </button>
  )
}

describe('modalReducer', () => {
  it('inicia com pilha vazia', () => {
    expect(estadoInicial.pilha).toHaveLength(0)
  })

  it('PUSH adiciona modal à pilha', () => {
    const modal = criarModalConfig({ conteudo: 'teste' })
    const estado = modalReducer(estadoInicial, { type: 'PUSH', payload: modal })
    expect(estado.pilha).toHaveLength(1)
    expect(estado.pilha[0].id).toBe(modal.id)
  })

  it('POP remove o último modal', () => {
    const m1 = criarModalConfig({ conteudo: 'um' })
    const m2 = criarModalConfig({ conteudo: 'dois' })
    let estado = modalReducer(estadoInicial, { type: 'PUSH', payload: m1 })
    estado = modalReducer(estado, { type: 'PUSH', payload: m2 })
    estado = modalReducer(estado, { type: 'POP' })
    expect(estado.pilha).toHaveLength(1)
    expect(estado.pilha[0].id).toBe(m1.id)
  })

  it('FECHAR_POR_ID remove modal específico', () => {
    const m1 = criarModalConfig({ conteudo: 'um' })
    const m2 = criarModalConfig({ conteudo: 'dois' })
    let estado = modalReducer(estadoInicial, { type: 'PUSH', payload: m1 })
    estado = modalReducer(estado, { type: 'PUSH', payload: m2 })
    estado = modalReducer(estado, { type: 'FECHAR_POR_ID', payload: m1.id })
    expect(estado.pilha).toHaveLength(1)
    expect(estado.pilha[0].id).toBe(m2.id)
  })

  it('FECHAR_TODOS esvazia a pilha', () => {
    const m1 = criarModalConfig({ conteudo: 'um' })
    const m2 = criarModalConfig({ conteudo: 'dois' })
    let estado = modalReducer(estadoInicial, { type: 'PUSH', payload: m1 })
    estado = modalReducer(estado, { type: 'PUSH', payload: m2 })
    estado = modalReducer(estado, { type: 'FECHAR_TODOS' })
    expect(estado.pilha).toHaveLength(0)
  })
})

describe('ModalProvider + useModal', () => {
  it('abre modal ao chamar abrirModal', () => {
    render(
      <ModalProvider>
        <BotaoModal titulo="Confirmação" conteudo="Deseja continuar?" />
      </ModalProvider>
    )
    fireEvent.click(screen.getByText('Abrir'))
    expect(screen.getByText('Confirmação')).toBeDefined()
    expect(screen.getByText('Deseja continuar?')).toBeDefined()
  })

  it('fecha modal ao clicar no botão ✕', () => {
    render(
      <ModalProvider>
        <BotaoModal titulo="Teste" conteudo="Conteúdo" />
      </ModalProvider>
    )
    fireEvent.click(screen.getByText('Abrir'))
    expect(screen.getByText('Teste')).toBeDefined()
    fireEvent.click(screen.getByLabelText('Fechar modal'))
    expect(screen.queryByText('Teste')).toBeNull()
  })

  it('fecha modal ao pressionar ESC', () => {
    render(
      <ModalProvider>
        <BotaoModal titulo="ESC Test" conteudo="Conteúdo ESC" />
      </ModalProvider>
    )
    fireEvent.click(screen.getByText('Abrir'))
    expect(screen.getByText('ESC Test')).toBeDefined()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('ESC Test')).toBeNull()
  })

  it('empilha dois modais simultaneamente', () => {
    function DoisModais(): React.ReactElement {
      const { abrirModal } = useModal()
      return (
        <>
          <button onClick={() => abrirModal({ titulo: 'Modal 1', conteudo: <span>Conteúdo 1</span> })}>
            Abrir 1
          </button>
          <button onClick={() => abrirModal({ titulo: 'Modal 2', conteudo: <span>Conteúdo 2</span> })}>
            Abrir 2
          </button>
        </>
      )
    }

    render(
      <ModalProvider>
        <DoisModais />
      </ModalProvider>
    )
    fireEvent.click(screen.getByText('Abrir 1'))
    fireEvent.click(screen.getByText('Abrir 2'))
    expect(screen.getByText('Modal 1')).toBeDefined()
    expect(screen.getByText('Modal 2')).toBeDefined()
  })
})
