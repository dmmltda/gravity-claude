import axios, { type AxiosInstance } from 'axios'
import { registrarInterceptorAutorizacao, registrarInterceptorErro } from './interceptors.js'
import type { TokenProvider } from './types.js'

export interface ClienteApiConfig {
  baseURL: string
  tokenProvider?: TokenProvider
  timeout?: number
  headers?: Record<string, string>
}

export function criarClienteApi(config: ClienteApiConfig): AxiosInstance {
  const instancia = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout ?? 15000,
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
  })

  if (config.tokenProvider) {
    registrarInterceptorAutorizacao(instancia, config.tokenProvider)
  }

  registrarInterceptorErro(instancia)

  return instancia
}

// Resolve a baseURL do singleton a partir de variáveis de ambiente.
// Dois contextos suportados — verificados em ordem:
//   1. Client-side (Vite / bundler): import.meta.env é injetado em build time → lê VITE_API_URL
//   2. Server-side (SSR / Node.js):  process.env está disponível em runtime  → lê API_URL
// Fallback '' permite usar URLs relativas (/api/v1/…) sem nenhuma configuração extra.
function resolverBaseURL(): string {
  // Client-side — Vite popula import.meta.env; em Node puro esse campo não existe.
  const viteEnv = (import.meta as { env?: Record<string, string> }).env
  if (viteEnv != null) {
    return viteEnv['VITE_API_URL'] ?? ''
  }

  // Server-side / SSR — Node.js expõe variáveis via process.env.
  if (typeof process !== 'undefined') {
    return process.env['API_URL'] ?? ''
  }

  return ''
}

// Singleton com configuração padrão.
// Cada produto pode sobrescrever via criarClienteApi() ou via apiClient.defaults.baseURL.
export const apiClient: AxiosInstance = criarClienteApi({ baseURL: resolverBaseURL() })
