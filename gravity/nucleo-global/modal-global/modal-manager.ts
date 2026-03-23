import type { ModalState, ModalAction, ModalConfig } from './types.js'

export function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'PUSH':
      return { pilha: [...state.pilha, action.payload] }

    case 'POP':
      return { pilha: state.pilha.slice(0, -1) }

    case 'FECHAR_POR_ID':
      return { pilha: state.pilha.filter((m) => m.id !== action.payload) }

    case 'FECHAR_TODOS':
      return { pilha: [] }

    default:
      return state
  }
}

export const estadoInicial: ModalState = { pilha: [] }

export function criarModalConfig(parcial: Omit<ModalConfig, 'id'> & { id?: string }): ModalConfig {
  return {
    fecharComEsc: true,
    fecharComBackdrop: true,
    largura: '32rem',
    ...parcial,
    id: parcial.id ?? `modal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }
}
