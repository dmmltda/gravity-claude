import { apiFetch } from './client.js'
import type { Aliquotas } from '../types/estimativa.js'

export const ncmApi = {
  aliquotas(ncm: string): Promise<Aliquotas> {
    return apiFetch(`/api/v1/ncm/${ncm}/aliquotas`)
  },
}
