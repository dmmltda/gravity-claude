import { describe, it, expect, vi } from 'vitest'
import type {
  AxiosInstance,
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { criarClienteApi, apiClient } from '../../../../nucleo-global/api-global/client.js'
import {
  registrarInterceptorAutorizacao,
  registrarInterceptorErro,
} from '../../../../nucleo-global/api-global/interceptors.js'
import type { ApiError, TokenProvider } from '../../../../nucleo-global/api-global/types.js'

// ─── helpers ───────────────────────────────────────────────────────────────
// Cria um mock de AxiosInstance que captura os handlers registrados nos
// interceptors sem fazer nenhuma chamada HTTP real.

interface InterceptorCapturado {
  instancia: AxiosInstance
  getRequestHandler: () => ((cfg: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>) | null
  getErroHandler: () => ((err: AxiosError) => Promise<never>) | null
}

function criarInstanciaMock(): InterceptorCapturado {
  let requestHandler: ((cfg: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>) | null = null
  let erroHandler: ((err: AxiosError) => Promise<never>) | null = null

  const instancia = {
    interceptors: {
      request: {
        use: vi.fn((handler: (cfg: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>) => {
          requestHandler = handler
        }),
      },
      response: {
        use: vi.fn((_ok: (r: AxiosResponse) => AxiosResponse, err: (e: AxiosError) => Promise<never>) => {
          erroHandler = err
        }),
      },
    },
  } as unknown as AxiosInstance

  return {
    instancia,
    getRequestHandler: () => requestHandler,
    getErroHandler: () => erroHandler,
  }
}

function criarErroAxios(
  status: number,
  dados?: Record<string, unknown>,
  mensagem = 'Request failed'
): AxiosError {
  return {
    isAxiosError: true,
    message: mensagem,
    response: {
      status,
      data: dados ?? {},
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      statusText: '',
    },
    config: {} as InternalAxiosRequestConfig,
    toJSON: () => ({}),
    name: 'AxiosError',
  } as unknown as AxiosError
}

// ─── criarClienteApi ───────────────────────────────────────────────────────

describe('criarClienteApi', () => {
  it('configura baseURL corretamente', () => {
    const instancia = criarClienteApi({ baseURL: 'https://api.exemplo.com' })
    expect(instancia.defaults.baseURL).toBe('https://api.exemplo.com')
  })

  it('usa timeout padrão de 15000ms quando não informado', () => {
    const instancia = criarClienteApi({ baseURL: '' })
    expect(instancia.defaults.timeout).toBe(15000)
  })

  it('usa timeout customizado quando informado', () => {
    const instancia = criarClienteApi({ baseURL: '', timeout: 5000 })
    expect(instancia.defaults.timeout).toBe(5000)
  })

  it('define Content-Type: application/json por padrão', () => {
    const instancia = criarClienteApi({ baseURL: '' })
    const headers = instancia.defaults.headers as Record<string, unknown>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('mescla headers customizados com os padrão', () => {
    const instancia = criarClienteApi({
      baseURL: '',
      headers: { 'X-App-Version': '1.0.0' },
    })
    const headers = instancia.defaults.headers as Record<string, unknown>
    expect(headers['X-App-Version']).toBe('1.0.0')
    // Content-Type padrão não deve ter sido removido
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('retorna uma instância axios com método get', () => {
    const instancia = criarClienteApi({ baseURL: '' })
    expect(typeof instancia.get).toBe('function')
    expect(typeof instancia.post).toBe('function')
  })
})

// ─── apiClient (singleton) ─────────────────────────────────────────────────

describe('apiClient', () => {
  it('é uma instância axios válida com método get', () => {
    expect(typeof apiClient.get).toBe('function')
    expect(typeof apiClient.post).toBe('function')
    expect(typeof apiClient.put).toBe('function')
    expect(typeof apiClient.delete).toBe('function')
  })

  it('tem defaults definidos', () => {
    expect(apiClient.defaults).toBeDefined()
  })
})

// ─── registrarInterceptorAutorizacao ──────────────────────────────────────

describe('registrarInterceptorAutorizacao', () => {
  it('injeta Authorization: Bearer [token] quando token existe', async () => {
    const { instancia, getRequestHandler } = criarInstanciaMock()
    const tokenProvider: TokenProvider = { getToken: () => 'meu-token-123' }

    registrarInterceptorAutorizacao(instancia, tokenProvider)

    const handler = getRequestHandler()!
    const config = { headers: {} } as InternalAxiosRequestConfig
    const resultado = await handler(config)

    expect(resultado.headers['Authorization']).toBe('Bearer meu-token-123')
  })

  it('não injeta Authorization quando token é null', async () => {
    const { instancia, getRequestHandler } = criarInstanciaMock()
    const tokenProvider: TokenProvider = { getToken: () => null }

    registrarInterceptorAutorizacao(instancia, tokenProvider)

    const handler = getRequestHandler()!
    const config = { headers: {} } as InternalAxiosRequestConfig
    const resultado = await handler(config)

    expect(resultado.headers['Authorization']).toBeUndefined()
  })

  it('não injeta Authorization quando token é string vazia', async () => {
    const { instancia, getRequestHandler } = criarInstanciaMock()
    const tokenProvider: TokenProvider = { getToken: () => '' }

    registrarInterceptorAutorizacao(instancia, tokenProvider)

    const handler = getRequestHandler()!
    const config = { headers: {} } as InternalAxiosRequestConfig
    const resultado = await handler(config)

    expect(resultado.headers['Authorization']).toBeUndefined()
  })

  it('suporta tokenProvider assíncrono', async () => {
    const { instancia, getRequestHandler } = criarInstanciaMock()
    const tokenProvider: TokenProvider = {
      getToken: () => Promise.resolve('token-async'),
    }

    registrarInterceptorAutorizacao(instancia, tokenProvider)

    const handler = getRequestHandler()!
    const config = { headers: {} } as InternalAxiosRequestConfig
    const resultado = await handler(config)

    expect(resultado.headers['Authorization']).toBe('Bearer token-async')
  })

  it('registra exatamente um interceptor de request', () => {
    const { instancia } = criarInstanciaMock()
    const tokenProvider: TokenProvider = { getToken: () => null }

    registrarInterceptorAutorizacao(instancia, tokenProvider)

    expect((instancia.interceptors.request.use as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })
})

// ─── registrarInterceptorErro ─────────────────────────────────────────────

describe('registrarInterceptorErro', () => {
  async function capturarApiError(erro: AxiosError): Promise<ApiError> {
    const { instancia, getErroHandler } = criarInstanciaMock()
    registrarInterceptorErro(instancia)
    const handler = getErroHandler()!
    try {
      await handler(erro)
      throw new Error('Deveria ter rejeitado')
    } catch (e) {
      return e as ApiError
    }
  }

  it('mapeia status 401 para código UNAUTHORIZED', async () => {
    const erro = criarErroAxios(401)
    const apiError = await capturarApiError(erro)
    expect(apiError.code).toBe('UNAUTHORIZED')
    expect(apiError.status).toBe(401)
  })

  it('mapeia status 403 para código FORBIDDEN', async () => {
    const apiError = await capturarApiError(criarErroAxios(403))
    expect(apiError.code).toBe('FORBIDDEN')
  })

  it('mapeia status 404 para código NOT_FOUND', async () => {
    const apiError = await capturarApiError(criarErroAxios(404))
    expect(apiError.code).toBe('NOT_FOUND')
  })

  it('mapeia status 422 para código VALIDATION_ERROR', async () => {
    const apiError = await capturarApiError(criarErroAxios(422))
    expect(apiError.code).toBe('VALIDATION_ERROR')
  })

  it('mapeia status 500 para código INTERNAL_ERROR', async () => {
    const apiError = await capturarApiError(criarErroAxios(500))
    expect(apiError.code).toBe('INTERNAL_ERROR')
  })

  it('mapeia status 503 para código INTERNAL_ERROR (>= 500)', async () => {
    const apiError = await capturarApiError(criarErroAxios(503))
    expect(apiError.code).toBe('INTERNAL_ERROR')
  })

  it('mapeia ausência de response (status 0) para REQUEST_ERROR', async () => {
    const erroSemResponse = {
      isAxiosError: true,
      message: 'Network Error',
      response: undefined,
      config: {} as InternalAxiosRequestConfig,
      toJSON: () => ({}),
      name: 'AxiosError',
    } as unknown as AxiosError
    const apiError = await capturarApiError(erroSemResponse)
    expect(apiError.code).toBe('REQUEST_ERROR')
    expect(apiError.status).toBe(0)
  })

  it('usa code do body do erro quando presente', async () => {
    const erro = criarErroAxios(400, { code: 'CUSTOM_CODE', message: 'Mensagem customizada' })
    const apiError = await capturarApiError(erro)
    expect(apiError.code).toBe('CUSTOM_CODE')
    expect(apiError.message).toBe('Mensagem customizada')
  })

  it('inclui details do body quando presentes', async () => {
    const details = { campo: ['Campo obrigatório'] }
    const erro = criarErroAxios(422, { code: 'VALIDATION_ERROR', details })
    const apiError = await capturarApiError(erro)
    expect(apiError.details).toEqual(details)
  })

  it('usa a mensagem do axios quando body não traz message', async () => {
    const erro = criarErroAxios(500, {}, 'Internal Server Error')
    const apiError = await capturarApiError(erro)
    expect(apiError.message).toBe('Internal Server Error')
  })

  it('registra exatamente um interceptor de response', () => {
    const { instancia } = criarInstanciaMock()
    registrarInterceptorErro(instancia)
    expect((instancia.interceptors.response.use as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })
})
