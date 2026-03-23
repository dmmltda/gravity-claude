import {
  useReducer,
  useCallback,
  createContext,
  useContext,
  type Dispatch,
} from 'react'
import { modalReducer, estadoInicial, criarModalConfig } from './modal-manager.js'
import type { ModalState, ModalAction, ModalConfig } from './types.js'

export interface UseModalReturn {
  pilha: ModalConfig[]
  abrirModal: (config: Omit<ModalConfig, 'id'> & { id?: string }) => string
  fecharModal: (id?: string) => void
  fecharTodos: () => void
}

export function useModalReducer(): [ModalState, Dispatch<ModalAction>] {
  return useReducer(modalReducer, estadoInicial)
}

export function criarUseModal(dispatch: Dispatch<ModalAction>, pilha: ModalConfig[]): UseModalReturn {
  const abrirModal = (config: Omit<ModalConfig, 'id'> & { id?: string }): string => {
    const modal = criarModalConfig(config)
    dispatch({ type: 'PUSH', payload: modal })
    return modal.id
  }

  const fecharModal = (id?: string): void => {
    if (id) {
      dispatch({ type: 'FECHAR_POR_ID', payload: id })
    } else {
      dispatch({ type: 'POP' })
    }
  }

  const fecharTodos = (): void => {
    dispatch({ type: 'FECHAR_TODOS' })
  }

  return { pilha, abrirModal, fecharModal, fecharTodos }
}

// Context para uso em árvore React sem prop drilling

export interface ModalContextValue extends UseModalReturn {}

export const ModalContext = createContext<ModalContextValue | null>(null)

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext)
  if (!ctx) {
    throw new Error('useModal deve ser usado dentro de <ModalProvider>')
  }
  return ctx
}

// Hook standalone (sem context) — para uso direto no ModalProvider

export function useModalStandalone(): UseModalReturn {
  const [state, dispatch] = useModalReducer()
  const abrirModal = useCallback(
    (config: Omit<ModalConfig, 'id'> & { id?: string }): string => {
      const modal = criarModalConfig(config)
      dispatch({ type: 'PUSH', payload: modal })
      return modal.id
    },
    [dispatch]
  )

  const fecharModal = useCallback(
    (id?: string): void => {
      if (id) {
        dispatch({ type: 'FECHAR_POR_ID', payload: id })
      } else {
        dispatch({ type: 'POP' })
      }
    },
    [dispatch]
  )

  const fecharTodos = useCallback((): void => {
    dispatch({ type: 'FECHAR_TODOS' })
  }, [dispatch])

  return { pilha: state.pilha, abrirModal, fecharModal, fecharTodos }
}
