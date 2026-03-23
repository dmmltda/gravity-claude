import { createHmac } from 'crypto'
import { AppError } from '../errors/AppError.js'

interface ServiceTokenPayload {
  tenantId: string
  userId: string
  scope: string
  iat: number
  exp: number
}

/**
 * Verifica um service token (JWT HS256) emitido pelo Configurador.
 * Lança AppError 401 INVALID_SERVICE_TOKEN se o token for inválido ou expirado.
 */
export function verifyServiceToken(token: string): {
  tenantId: string
  userId: string
  scope: string
} {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new AppError(401, 'INVALID_SERVICE_TOKEN')
  }

  const [header, payloadPart, signature] = parts
  const secret = process.env.JWT_SERVICE_SECRET ?? ''

  // Verificar assinatura HMAC-SHA256 (HS256)
  const expectedSig = createHmac('sha256', secret)
    .update(`${header}.${payloadPart}`)
    .digest('base64url')

  if (signature !== expectedSig) {
    throw new AppError(401, 'INVALID_SERVICE_TOKEN')
  }

  // Decodificar payload
  let decoded: ServiceTokenPayload
  try {
    decoded = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString('utf8')
    ) as ServiceTokenPayload
  } catch {
    throw new AppError(401, 'INVALID_SERVICE_TOKEN')
  }

  // Verificar expiração
  if (typeof decoded.exp === 'number' && Math.floor(Date.now() / 1000) > decoded.exp) {
    throw new AppError(401, 'INVALID_SERVICE_TOKEN')
  }

  const { tenantId, userId, scope } = decoded

  if (
    typeof tenantId !== 'string' ||
    typeof userId !== 'string' ||
    typeof scope !== 'string'
  ) {
    throw new AppError(401, 'INVALID_SERVICE_TOKEN')
  }

  return { tenantId, userId, scope }
}
