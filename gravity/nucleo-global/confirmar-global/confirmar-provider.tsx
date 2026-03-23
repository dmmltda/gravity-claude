import React, { type ReactNode } from 'react'
import { Confirmar } from './confirmar.js'
import { ConfirmarContext, useConfirmarInterno } from './use-confirmar.js'

interface ConfirmarProviderProps {
  children: ReactNode
}

export function ConfirmarProvider({ children }: ConfirmarProviderProps): React.ReactElement {
  const { estado, confirmar, responder } = useConfirmarInterno()

  return (
    <ConfirmarContext.Provider value={{ confirmar }}>
      {children}
      {estado.visivel && (
        <Confirmar
          config={estado.config}
          onConfirmar={() => responder(true)}
          onCancelar={() => responder(false)}
        />
      )}
    </ConfirmarContext.Provider>
  )
}
