import type { ReactNode } from 'react'

export interface ModalAba {
  id: string
  label: string
  conteudo: ReactNode
}

export interface ModalConfig {
  id: string
  titulo?: string
  conteudo: ReactNode
  footer?: ReactNode
  largura?: string
  fecharComEsc?: boolean
  fecharComBackdrop?: boolean
  /** Quando presente, o body exibe uma barra de tabs (underline) no lugar de `conteudo` direto. */
  abas?: ModalAba[]
}

export interface ModalState {
  pilha: ModalConfig[]
}

export type ModalAction =
  | { type: 'PUSH'; payload: ModalConfig }
  | { type: 'POP' }
  | { type: 'FECHAR_POR_ID'; payload: string }
  | { type: 'FECHAR_TODOS' }
