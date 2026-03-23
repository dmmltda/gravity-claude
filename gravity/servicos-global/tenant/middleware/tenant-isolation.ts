import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'
import { verifyServiceToken } from './service-token-auth.js'
import type { TenantRequest } from './types.js'

interface JwtPayload {
  tenant_id?: string
  sub?: string
}

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new AppError(401, 'UNAUTHORIZED', 'Token JWT inválido')
  }
  const payload = parts[1]
  const decoded = Buffer.from(payload, 'base64url').toString('utf8')
  return JSON.parse(decoded) as JwtPayload
}

export function withTenantIsolation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization']

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Authorization header ausente'))
    return
  }

  const token = authHeader.slice(7)

  // Tenta como Machine Token (HS256) primeiro
  try {
    const servicePayload = verifyServiceToken(token)
    const augmented = req as TenantRequest
    augmented.tenantId = servicePayload.tenantId
    augmented.userId = servicePayload.userId
    augmented.isServiceToken = true
    next()
    return
  } catch {
    // Não é um service token — tenta como JWT Clerk
  }

  // Clerk JWT path (comportamento original mantido)
  // O Clerk já validou a assinatura na borda — aqui apenas extraímos o payload
  let payload: JwtPayload
  try {
    payload = decodeJwtPayload(token)
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Token JWT malformado'))
    return
  }

  if (!payload.tenant_id) {
    next(new AppError(401, 'UNAUTHORIZED', 'tenant_id ausente no token'))
    return
  }

  const userId = payload.sub ?? ''

  const augmented = req as TenantRequest
  augmented.tenantId = payload.tenant_id
  augmented.userId = userId
  augmented.isServiceToken = false

  next()
}
