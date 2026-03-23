import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client.js'
import { AppError } from '../errors/AppError.js'

const router = Router()

const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  subdomain: z.string().min(1).max(100).optional(),
})

// POST /api/v1/tenants/:tenantId/companies
router.post('/tenants/:tenantId/companies', async (req, res, next) => {
  const result = createCompanySchema.safeParse(req.body)
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos'))
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.tenantId },
    })
    if (!tenant) {
      return next(new AppError(404, 'NOT_FOUND', 'Tenant não encontrado'))
    }

    const company = await prisma.company.create({
      data: {
        tenantId: req.params.tenantId,
        name: result.data.name,
        subdomain: result.data.subdomain,
      },
    })
    res.status(201).json(company)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/companies/:id
router.get('/:id', async (req, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
    })
    if (!company) {
      return next(new AppError(404, 'NOT_FOUND', 'Empresa não encontrada'))
    }
    res.json(company)
  } catch (err) {
    next(err)
  }
})

export { router as companiesRoutes }
