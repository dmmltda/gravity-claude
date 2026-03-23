import type { AxiosRequestConfig } from 'axios'

export interface ApiResponse<T> {
  data: T
  status: number
  message?: string
}

export interface ApiError {
  code: string
  message: string
  status: number
  details?: Record<string, unknown>
}

export type RequestConfig = AxiosRequestConfig

export interface TokenProvider {
  getToken: () => string | null | Promise<string | null>
}
