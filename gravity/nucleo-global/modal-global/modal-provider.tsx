import React, { type ReactNode } from 'react'
import { ModalOverlay } from './modal-overlay.js'
import { ModalContext, useModalStandalone } from './use-modal.js'

interface ModalProviderProps {
  children: ReactNode
}

const BASE_Z_INDEX = 1000

export function ModalProvider({ children }: ModalProviderProps): React.ReactElement {
  const modal = useModalStandalone()

  return (
    <ModalContext.Provider value={modal}>
      {children}
      {modal.pilha.map((m, i) => (
        <ModalOverlay
          key={m.id}
          modal={m}
          zIndex={BASE_Z_INDEX + i}
          onFechar={modal.fecharModal}
        />
      ))}
    </ModalContext.Provider>
  )
}
