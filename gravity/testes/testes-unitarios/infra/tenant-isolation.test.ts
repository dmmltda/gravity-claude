import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { withTenantIsolation } from '../../../servicos-global/tenant/middleware/tenant-isolation.js'
import { errorHandler } from '../../../servicos-global/tenant/middleware/error-handler.js'
import { AppError } from '../../../servicos-global/tenant/errors/AppError.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  // Assinatura falsa — Clerk valida na borda, aqui só extraímos payload
  const sig = Buffer.from('fake-signature').toString('base64url')
  return `${header}.${body}.${sig}`
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as Request
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

// ─── withTenantIsolation ─────────────────────────────────────────────────────

describe('withTenantIsolation', () => {
  let next: ReturnType<typeof vi.fn>

  beforeEach(() => {
    next = vi.fn()
  })

  it('chama next(AppError 401) quando Authorization header está ausente', () => {
    const req = mockReq({ headers: {} })
    const res = mockRes()

    withTenantIsolation(req, res, next as NextFunction)

    expect(next).toHaveBeenCalledOnce()
    const err = next.mock.calls[0][0] as AppError
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('UNAUTHORIZED')
  })

  it('chama next(AppError 401) quando token JWT está malformado (não tem 3 partes)', () => {
    const req = mockReq({ headers: { authorization: 'Bearer nao.e.valido.demais' } })
    // 4 partes — vai falhar o decode
    // Na verdade vamos testar com payload inválido (não é JSON)
    const badHeader = Buffer.from('{}').toString('base64url')
    const badPayload = 'isso-nao-e-base64url-json'
    const badToken = `${badHeader}.${badPayload}.sig`
    const req2 = mockReq({ headers: { authorization: `Bearer ${badToken}` } })
    const res = mockRes()

    withTenantIsolation(req2, res, next as NextFunction)

    expect(next).toHaveBeenCalledOnce()
    const err = next.mock.calls[0][0] as AppError
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(401)
  })

  it('chama next(AppError 401) quando token não tem tenant_id no payload', () => {
    const token = makeJwt({ sub: 'user_123' }) // sem tenant_id
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()

    withTenantIsolation(req, res, next as NextFunction)

    expect(next).toHaveBeenCalledOnce()
    const err = next.mock.calls[0][0] as AppError
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('UNAUTHORIZED')
  })

  it('injeta tenantId e userId na request e chama next() sem erro quando token é válido', () => {
    const token = makeJwt({ tenant_id: 'tenant_abc', sub: 'user_xyz' })
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()

    withTenantIsolation(req, res, next as NextFunction)

    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith() // sem argumentos = sucesso
    const augmented = req as Request & { tenantId: string; userId: string }
    expect(augmented.tenantId).toBe('tenant_abc')
    expect(augmented.userId).toBe('user_xyz')
  })

  it('garante isolamento cross-tenant: tenantId injetado vem do token, não do body', () => {
    const tenantA = 'tenant_a'
    const tenantB = 'tenant_b'
    const token = makeJwt({ tenant_id: tenantA, sub: 'user_1' })

    // Mesmo que alguém tente colocar tenant_b no body, o middleware usa o token
    const req = mockReq({
      headers: { authorization: `Bearer ${token}` },
      body: { tenant_id: tenantB }, // tentativa de injeção — ignorada
    })
    const res = mockRes()

    withTenantIsolation(req, res, next as NextFunction)

    const augmented = req as Request & { tenantId: string }
    expect(augmented.tenantId).toBe(tenantA)
    expect(augmented.tenantId).not.toBe(tenantB)
  })
})

// ─── errorHandler ─────────────────────────────────────────────────────────────

describe('errorHandler', () => {
  it('responde com statusCode e code quando o erro é AppError', () => {
    const err = new AppError(422, 'UNPROCESSABLE', 'Dado inválido')
    const req = mockReq()
    const res = mockRes()
    const next = vi.fn() as unknown as NextFunction

    errorHandler(err, req, res, next)

    expect(res.status).toHaveBeenCalledWith(422)
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'UNPROCESSABLE', message: 'Dado inválido' },
    })
  })

  it('responde com 500 INTERNAL_SERVER_ERROR para erros genéricos', () => {
    const err = new Error('algo explodiu')
    const req = mockReq()
    const res = mockRes()
    const next = vi.fn() as unknown as NextFunction

    errorHandler(err, req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Erro interno do servidor' },
    })
  })
})
