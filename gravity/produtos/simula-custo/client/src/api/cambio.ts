import { apiFetch } from './client.js'
import type { Cambio } from '../types/estimativa.js'

export const cambioApi = {
  cotacao(moeda: string): Promise<Cambio> {
    return apiFetch(`/api/v1/cambio/${moeda}`)
  },

  sincronizar(): Promise<{ sincronizado: Array<{ moeda: string; ptax_venda: number; ptax_compra: number }> }> {
    return apiFetch('/api/v1/cambio/atualizar', { method: 'POST' })
  },
}
