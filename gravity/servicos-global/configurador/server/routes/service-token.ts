import { Router } from 'express'
import { z } from 'zod'
import { createHmac } from 'crypto'
import { AppError } from '../errors/AppError.js'

const router = Router()

const serviceTokenBodySchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  scope: z.literal('service'),
})

/**
 * Assina um JWT HS256 manualmente.
 * Compatível com verifyServiceToken no tenant middleware.
 */
function signServiceToken(
  payload: Record<string, unknown>,
  secret: string
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url')

  const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url')

  const signature = createHmac('sha256', secret)
    .update(`${header}.${payloadPart}`)
    .digest('base64url')

  return `${header}.${payloadPart}.${signature}`
}

// POST /api/internal/service-token
router.post('/', (req, res, next) => {
  const result = serviceTokenBodySchema.safeParse(req.body)
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos'))
  }

  const secret = process.env.JWT_SERVICE_SECRET
  if (!secret) {
    return next(
      new AppError(500, 'INTERNAL_ERROR', 'JWT_SERVICE_SECRET não configurada')
    )
  }

  const { tenantId, userId, scope } = result.data
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = 86400 // 24h

  const token = signServiceToken(
    { tenantId, userId, scope, iat: now, exp: now + expiresIn },
    secret
  )

  res.json({ token, expiresIn })
})

export { router as serviceTokenRoutes }
