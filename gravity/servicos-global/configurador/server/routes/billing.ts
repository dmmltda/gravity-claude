import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client.js'
import { AppError } from '../errors/AppError.js'

const router = Router()

const subscribeSchema = z.object({
  tenantId: z.string().min(1),
  productId: z.string().min(1),
  stripeId: z.string().optional(),
})

// GET /api/v1/billing/:tenantId/subscriptions
router.get('/:tenantId/subscriptions', async (req, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { tenantId: req.params.tenantId },
    })
    res.json(subscriptions)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/billing/subscribe
router.post('/subscribe', async (req, res, next) => {
  const result = subscribeSchema.safeParse(req.body)
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos'))
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: result.data.tenantId },
    })
    if (!tenant) {
      return next(new AppError(404, 'NOT_FOUND', 'Tenant não encontrado'))
    }

    const subscription = await prisma.subscription.create({
      data: {
        tenantId: result.data.tenantId,
        productId: result.data.productId,
        stripeId: result.data.stripeId,
        status: 'trial',
      },
    })
    res.status(201).json(subscription)
  } catch (err) {
    next(err)
  }
})

export { router as billingRoutes }
