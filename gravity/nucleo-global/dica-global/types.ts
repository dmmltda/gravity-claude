import type { ReactNode } from 'react'

export type Placement = 'top' | 'bottom' | 'left' | 'right'

export interface DicaProps {
  conteudo: ReactNode
  children: ReactNode
  placement?: Placement
  delay?: number
  disabled?: boolean
}

export interface PopoverProps {
  conteudo: ReactNode
  children: ReactNode
  placement?: Placement
  disabled?: boolean
  aberto?: boolean
  onAbrir?: () => void
  onFechar?: () => void
}

export interface PosicaoCalculada {
  top: number
  left: number
}
