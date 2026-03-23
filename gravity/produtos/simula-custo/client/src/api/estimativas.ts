import { apiFetch } from './client.js'
import type { Estimativa, CriarEstimativaInput } from '../types/estimativa.js'

export interface ListEstimativasParams {
  page?:   number
  limit?:  number
  status?: 'rascunho' | 'criada' | 'arquivada'
}

export interface ListEstimativasResponse {
  data: Estimativa[]
  meta: { total: number; page: number; pages: number }
}

export const estimativasApi = {
  listar(params: ListEstimativasParams = {}): Promise<ListEstimativasResponse> {
    const q = new URLSearchParams()
    if (params.page)   q.set('page',   String(params.page))
    if (params.limit)  q.set('limit',  String(params.limit))
    if (params.status) q.set('status', params.status)
    return apiFetch(`/api/v1/estimativas?${q}`)
  },

  buscar(id: string): Promise<Estimativa> {
    return apiFetch(`/api/v1/estimativas/${id}`)
  },

  criar(body: CriarEstimativaInput): Promise<Estimativa> {
    return apiFetch('/api/v1/estimativas', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  atualizar(id: string, body: Partial<CriarEstimativaInput>): Promise<Estimativa> {
    return apiFetch(`/api/v1/estimativas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  calcular(id: string): Promise<Estimativa> {
    return apiFetch(`/api/v1/estimativas/${id}/calcular`, { method: 'POST' })
  },

  arquivar(id: string): Promise<void> {
    return apiFetch(`/api/v1/estimativas/${id}`, { method: 'DELETE' })
  },
}
