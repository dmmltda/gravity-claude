import { Router } from 'express'

const router = Router()

const PLANS = [
  {
    id: 'trial',
    name: 'Trial',
    description: 'Acesso gratuito por tempo limitado',
    priceMonthly: 0,
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Para pequenas empresas',
    priceMonthly: 99,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Para empresas em crescimento',
    priceMonthly: 299,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Para grandes operações',
    priceMonthly: null,
  },
]

// GET /api/v1/plans
router.get('/', (_req, res) => {
  res.json(PLANS)
})

export { router as plansRoutes }
