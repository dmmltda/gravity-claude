import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client.js'
import { AppError } from '../errors/AppError.js'

const router = Router()

const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  plan: z.enum(['trial', 'basic', 'pro', 'enterprise']).default('trial'),
})

// POST /api/v1/tenants
router.post('/', async (req, res, next) => {
  const result = createTenantSchema.safeParse(req.body)
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos'))
  }

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name: result.data.name,
        plan: result.data.plan,
      },
    })
    res.status(201).json(tenant)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/tenants/:id
router.get('/:id', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
    })
    if (!tenant) {
      return next(new AppError(404, 'NOT_FOUND', 'Tenant não encontrado'))
    }
    res.json(tenant)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/tenants/:id/companies
router.get('/:id/companies', async (req, res, next) => {
  try {
    const companies = await prisma.company.findMany({
      where: { tenantId: req.params.id },
    })
    res.json(companies)
  } catch (err) {
    next(err)
  }
})

export { router as tenantsRoutes }
