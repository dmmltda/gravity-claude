import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client.js'
import { AppError } from '../errors/AppError.js'

const router = Router()

const createMembershipSchema = z.object({
  clerkId: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.enum(['admin', 'standard', 'viewer']).default('standard'),
})

const enableUserSchema = z.object({
  companyId: z.string().min(1),
})

// POST /api/v1/users/membership
router.post('/membership', async (req, res, next) => {
  const result = createMembershipSchema.safeParse(req.body)
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos'))
  }

  try {
    const membership = await prisma.userMembership.create({
      data: {
        clerkId: result.data.clerkId,
        tenantId: result.data.tenantId,
        role: result.data.role,
      },
    })
    res.status(201).json(membership)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/tenants/:tenantId/users
router.get('/tenants/:tenantId/users', async (req, res, next) => {
  try {
    const memberships = await prisma.userMembership.findMany({
      where: { tenantId: req.params.tenantId },
      include: { enablements: { include: { company: true } } },
    })
    res.json(memberships)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/users/:membershipId/enable
router.post('/:membershipId/enable', async (req, res, next) => {
  const result = enableUserSchema.safeParse(req.body)
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos'))
  }

  try {
    const membership = await prisma.userMembership.findUnique({
      where: { id: req.params.membershipId },
    })
    if (!membership) {
      return next(new AppError(404, 'NOT_FOUND', 'Membership não encontrado'))
    }

    const enablement = await prisma.userEnablement.create({
      data: {
        membershipId: req.params.membershipId,
        companyId: result.data.companyId,
      },
    })
    res.status(201).json(enablement)
  } catch (err) {
    next(err)
  }
})

export { router as usersRoutes }
