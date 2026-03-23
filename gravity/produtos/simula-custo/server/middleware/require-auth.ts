import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'

export interface TenantRequest extends Request {
  tenantId: string
  auth: { userId: string }
}

interface JwtPayload {
  sub?: string
}

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new AppError(401, 'UNAUTHORIZED', 'Token JWT inválido')
  }
  const decoded = Buffer.from(parts[1], 'base64url').toString('utf8')
  return JSON.parse(decoded) as JwtPayload
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const tenantId = req.headers['x-tenant-id']
  if (!tenantId || typeof tenantId !== 'string') {
    return next(new AppError(401, 'UNAUTHORIZED', 'Header x-tenant-id ausente'))
  }

  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authorization header ausente'))
  }

  const token = authHeader.slice(7)
  let payload: JwtPayload
  try {
    payload = decodeJwtPayload(token)
  } catch {
    return next(new AppError(401, 'UNAUTHORIZED', 'Token JWT malformado'))
  }

  const userId = payload.sub
  if (!userId) {
    return next(new AppError(401, 'UNAUTHORIZED', 'userId ausente no token'))
  }

  const r = req as TenantRequest
  r.tenantId = tenantId
  r.auth = { userId }

  next()
}
