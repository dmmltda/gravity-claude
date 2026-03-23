import {
  useState,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import type { ConfirmarConfig, ConfirmarState } from './types.js'

const CONFIG_PADRAO: ConfirmarConfig = {
  mensagem: '',
  titulo: 'Confirmar',
  textoBotaoConfirmar: 'Confirmar',
  textoBotaoCancelar: 'Cancelar',
  variante: 'padrao',
}

export interface UseConfirmarReturn {
  estado: ConfirmarState
  confirmar: (config: ConfirmarConfig | string) => Promise<boolean>
  responder: (valor: boolean) => void
}

export function useConfirmarInterno(): UseConfirmarReturn {
  const [estado, setEstado] = useState<ConfirmarState>({
    visivel: false,
    config: CONFIG_PADRAO,
    resolver: null,
  })

  const confirmar = useCallback((configOuMensagem: ConfirmarConfig | string): Promise<boolean> => {
    const config: ConfirmarConfig =
      typeof configOuMensagem === 'string'
        ? { ...CONFIG_PADRAO, mensagem: configOuMensagem }
        : { ...CONFIG_PADRAO, ...configOuMensagem }

    return new Promise<boolean>((resolve) => {
      setEstado({
        visivel: true,
        config,
        resolver: resolve,
      })
    })
  }, [])

  const responder = useCallback((valor: boolean): void => {
    setEstado((prev) => {
      prev.resolver?.(valor)
      return { visivel: false, config: CONFIG_PADRAO, resolver: null }
    })
  }, [])

  return { estado, confirmar, responder }
}

// Context

export interface ConfirmarContextValue {
  confirmar: (config: ConfirmarConfig | string) => Promise<boolean>
}

export const ConfirmarContext = createContext<ConfirmarContextValue | null>(null)

export function useConfirmar(): ConfirmarContextValue {
  const ctx = useContext(ConfirmarContext)
  if (!ctx) {
    throw new Error('useConfirmar deve ser usado dentro de <ConfirmarProvider>')
  }
  return ctx
}
