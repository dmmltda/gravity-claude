import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client.js'
import { AppError } from '../errors/AppError.js'

const router = Router()

const checkAccessSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  productId: z.string().min(1),
  clerkId: z.string().min(1),
})

// GET /api/internal/check-access
router.get('/check-access', async (req, res, next) => {
  const result = checkAccessSchema.safeParse(req.query)
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos'))
  }

  const { tenantId, companyId, productId, clerkId } = result.data

  try {
    const membership = await prisma.userMembership.findUnique({
      where: { clerkId_tenantId: { clerkId, tenantId } },
    })

    if (!membership) {
      return res.json({ allowed: false, role: null, permissions: {} })
    }

    const enablement = await prisma.userEnablement.findUnique({
      where: {
        membershipId_companyId: {
          membershipId: membership.id,
          companyId,
        },
      },
      include: {
        permissions: {
          where: { productId },
        },
      },
    })

    if (!enablement) {
      return res.json({ allowed: false, role: membership.role, permissions: {} })
    }

    const productPermission = enablement.permissions[0]
    const permissions = productPermission ? productPermission.permissions : {}

    res.json({
      allowed: true,
      role: membership.role,
      permissions,
    })
  } catch (err) {
    next(err)
  }
})

export { router as accessRoutes }
