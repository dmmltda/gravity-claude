import { Router } from 'express'
import { z } from 'zod'
import { Webhook } from 'svix'
import { prisma } from '../prisma/client.js'
import { AppError } from '../errors/AppError.js'

const router = Router()

const userDeletedDataSchema = z.object({
  id: z.string().min(1),
})

const organizationCreatedDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

// POST /api/v1/auth/webhook
router.post('/webhook', async (req, res, next) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    return next(new AppError(500, 'CONFIGURATION_ERROR', 'Webhook secret não configurado'))
  }

  const svixId = req.headers['svix-id']
  const svixTimestamp = req.headers['svix-timestamp']
  const svixSignature = req.headers['svix-signature']

  if (!svixId || !svixTimestamp || !svixSignature) {
    return next(new AppError(400, 'INVALID_SIGNATURE', 'Assinatura inválida'))
  }

  let payload: { type: string; data: Record<string, unknown> }
  try {
    const wh = new Webhook(webhookSecret)
    payload = wh.verify(req.body as Buffer, {
      'svix-id': svixId as string,
      'svix-timestamp': svixTimestamp as string,
      'svix-signature': svixSignature as string,
    }) as { type: string; data: Record<string, unknown> }
  } catch {
    return next(new AppError(400, 'INVALID_SIGNATURE', 'Assinatura inválida'))
  }

  const { type, data } = payload

  try {
    switch (type) {
      case 'user.created': {
        // Usuário criado no Clerk — sem ação automática,
        // membership é criado explicitamente via /api/v1/users/membership
        break
      }

      case 'user.deleted': {
        const parsed = userDeletedDataSchema.safeParse(data)
        if (parsed.success) {
          await prisma.userMembership.deleteMany({ where: { clerkId: parsed.data.id } })
          await prisma.supplierTenantAccess.deleteMany({ where: { clerkId: parsed.data.id } })
        }
        break
      }

      case 'organization.created': {
        const parsed = organizationCreatedDataSchema.safeParse(data)
        if (parsed.success) {
          await prisma.tenant.create({
            data: { name: parsed.data.name, plan: 'trial' },
          })
        }
        break
      }

      default:
        // Evento não tratado — aceitar sem erro
        break
    }

    res.json({ received: true })
  } catch (err) {
    next(err)
  }
})

export { router as authRoutes }
