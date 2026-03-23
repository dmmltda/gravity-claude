import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client.js'
import { AppError } from '../errors/AppError.js'
import { evaluatePermission, isSubscriptionActive, type ActionType } from '../services/check-access-logic.js'

const router = Router()

const checkAccessQuerySchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  productId: z.string().min(1),
  resource: z.string().min(1),
  action: z.enum(['read', 'write', 'delete', 'admin']),
})

// GET /api/check-access
router.get('/', async (req, res, next) => {
  // a) Verificar x-internal-key
  const internalKey = req.headers['x-internal-key']
  if (internalKey !== process.env.INTERNAL_SERVICE_KEY) {
    return next(new AppError(401, 'UNAUTHORIZED', 'x-internal-key inválido'))
  }

  const result = checkAccessQuerySchema.safeParse(req.query)
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos'))
  }

  const { tenantId, userId, productId, resource, action } = result.data

  try {
    // b) Buscar UserEnablement via UserMembership
    // userId no contexto S2S = clerkId do usuário
    const membership = await prisma.userMembership.findUnique({
      where: { clerkId_tenantId: { clerkId: userId, tenantId } },
    })

    if (!membership) {
      return res.json({ allowed: false, reason: 'user_not_enabled' })
    }

    const enablement = await prisma.userEnablement.findFirst({
      where: { membershipId: membership.id },
      include: {
        permissions: { where: { productId } },
      },
    })

    if (!enablement) {
      return res.json({ allowed: false, reason: 'user_not_enabled' })
    }

    // c) Verificar ProductPermission e resource/action
    const productPermission = enablement.permissions[0]
    if (!productPermission) {
      return res.json({ allowed: false, reason: 'permission_denied' })
    }

    const granted = evaluatePermission(
      productPermission.permissions,
      resource,
      action as ActionType
    )

    if (!granted) {
      return res.json({ allowed: false, reason: 'permission_denied' })
    }

    // d) Verificar Subscription ativa do tenant para o produto
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, productId },
    })

    if (!subscription || !isSubscriptionActive(subscription.status)) {
      return res.json({ allowed: false, reason: 'subscription_inactive' })
    }

    // e) Todas as verificações passaram
    res.json({ allowed: true })
  } catch (err) {
    next(err)
  }
})

export { router as checkAccessRoutes }
