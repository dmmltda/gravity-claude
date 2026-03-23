import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import type { TokenProvider, ApiError } from './types.js'

export function registrarInterceptorAutorizacao(
  instancia: AxiosInstance,
  tokenProvider: TokenProvider
): void {
  instancia.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await tokenProvider.getToken()
    if (token) {
      config.headers = config.headers ?? {}
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  })
}

export function registrarInterceptorErro(instancia: AxiosInstance): void {
  instancia.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      const status = error.response?.status ?? 0
      const dados = error.response?.data as Record<string, unknown> | undefined

      const apiError: ApiError = {
        code: (dados?.['code'] as string | undefined) ?? codigoParaStatus(status),
        message: (dados?.['message'] as string | undefined) ?? error.message,
        status,
        details: (dados?.['details'] as Record<string, unknown> | undefined) ?? undefined,
      }

      return Promise.reject(apiError)
    }
  )
}

function codigoParaStatus(status: number): string {
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 422) return 'VALIDATION_ERROR'
  if (status >= 500) return 'INTERNAL_ERROR'
  return 'REQUEST_ERROR'
}
