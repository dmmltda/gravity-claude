import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'
import { verifyServiceToken } from '../../../servicos-global/tenant/middleware/service-token-auth.js'
import {
  evaluatePermission,
  isSubscriptionActive,
} from '../../../servicos-global/configurador/server/services/check-access-logic.js'
import { AppError } from '../../../servicos-global/tenant/errors/AppError.js'

// ─── Helper: assina token HS256 compatível com verifyServiceToken ─────────────

function signToken(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payloadPart}`)
    .digest('base64url')
  return `${header}.${payloadPart}.${signature}`
}

const TEST_SECRET = 'test-secret-gravity-auth-flow'

// ─── verifyServiceToken ───────────────────────────────────────────────────────

describe('verifyServiceToken', () => {
  const originalSecret = process.env.JWT_SERVICE_SECRET

  beforeEach(() => {
    process.env.JWT_SERVICE_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env.JWT_SERVICE_SECRET = originalSecret
  })

  it('token válido retorna payload correto', () => {
    const now = Math.floor(Date.now() / 1000)
    const token = signToken(
      { tenantId: 'tenant_abc', userId: 'user_xyz', scope: 'service', iat: now, exp: now + 86400 },
      TEST_SECRET
    )

    const result = verifyServiceToken(token)

    expect(result.tenantId).toBe('tenant_abc')
    expect(result.userId).toBe('user_xyz')
    expect(result.scope).toBe('service')
  })

  it('token expirado lança AppError 401', () => {
    const now = Math.floor(Date.now() / 1000)
    const token = signToken(
      { tenantId: 'tenant_abc', userId: 'user_xyz', scope: 'service', iat: now - 90000, exp: now - 3600 },
      TEST_SECRET
    )

    expect(() => verifyServiceToken(token)).toThrow(AppError)

    try {
      verifyServiceToken(token)
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).statusCode).toBe(401)
      expect((err as AppError).code).toBe('INVALID_SERVICE_TOKEN')
    }
  })

  it('token com secret errado lança AppError 401', () => {
    const now = Math.floor(Date.now() / 1000)
    const token = signToken(
      { tenantId: 'tenant_abc', userId: 'user_xyz', scope: 'service', iat: now, exp: now + 86400 },
      'secret-errado'
    )

    expect(() => verifyServiceToken(token)).toThrow(AppError)

    try {
      verifyServiceToken(token)
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).statusCode).toBe(401)
      expect((err as AppError).code).toBe('INVALID_SERVICE_TOKEN')
    }
  })

  it('token malformado (menos de 3 partes) lança AppError 401', () => {
    expect(() => verifyServiceToken('nao.e.um.jwt.valido')).toThrow(AppError)
    expect(() => verifyServiceToken('somente-uma-parte')).toThrow(AppError)
  })
})

// ─── evaluatePermission ───────────────────────────────────────────────────────

describe('evaluatePermission', () => {
  const permissions = {
    relatorios: { read: true, write: false, delete: false, admin: false },
    dashboard: { read: true, write: true, delete: false, admin: false },
    configuracoes: { read: false, write: false, delete: false, admin: true },
  }

  it('retorna true quando resource e action existem e são true', () => {
    expect(evaluatePermission(permissions, 'relatorios', 'read')).toBe(true)
    expect(evaluatePermission(permissions, 'dashboard', 'write')).toBe(true)
    expect(evaluatePermission(permissions, 'configuracoes', 'admin')).toBe(true)
  })

  it('retorna false quando action é false', () => {
    expect(evaluatePermission(permissions, 'relatorios', 'write')).toBe(false)
    expect(evaluatePermission(permissions, 'dashboard', 'delete')).toBe(false)
    expect(evaluatePermission(permissions, 'configuracoes', 'read')).toBe(false)
  })

  it('retorna false quando resource não existe', () => {
    expect(evaluatePermission(permissions, 'nao-existe', 'read')).toBe(false)
  })

  it('retorna false quando permissions é null', () => {
    expect(evaluatePermission(null, 'relatorios', 'read')).toBe(false)
  })

  it('retorna false quando permissions é string (inválido)', () => {
    expect(evaluatePermission('invalido', 'relatorios', 'read')).toBe(false)
  })

  it('retorna false quando permissions é array (inválido)', () => {
    expect(evaluatePermission([], 'relatorios', 'read')).toBe(false)
  })

  it('retorna false quando resource é objeto mas action não existe', () => {
    const perms = { relatorios: { read: true } }
    expect(evaluatePermission(perms, 'relatorios', 'delete')).toBe(false)
  })
})

// ─── isSubscriptionActive ─────────────────────────────────────────────────────

describe('isSubscriptionActive', () => {
  it('retorna true para status "active"', () => {
    expect(isSubscriptionActive('active')).toBe(true)
  })

  it('retorna true para status "trial"', () => {
    expect(isSubscriptionActive('trial')).toBe(true)
  })

  it('retorna false para status "inactive"', () => {
    expect(isSubscriptionActive('inactive')).toBe(false)
  })

  it('retorna false para status "cancelled"', () => {
    expect(isSubscriptionActive('cancelled')).toBe(false)
  })

  it('retorna false para status "expired"', () => {
    expect(isSubscriptionActive('expired')).toBe(false)
  })
})
