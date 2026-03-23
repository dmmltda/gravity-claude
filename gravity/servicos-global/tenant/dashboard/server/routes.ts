import { Router } from 'express'
import type { Response, NextFunction } from 'express'
import { AppError } from '../../../errors/AppError.js'
import { withTenantIsolation } from '../../../middleware/tenant-isolation.js'
import type { TenantRequest } from '../../../middleware/types.js'
import {
  registerWidget,
  listWidgets,
  listWidgetsForProduct,
  hasWidget,
  getWidget,
} from '../src/registry.js'
import type { PrismaClient } from '@prisma/client'

import { registerWidgetSchema, updateWidgetSchema } from './schemas.js'

// ---------------------------------------------------------------------------
// Fábrica de rotas — recebe o PrismaClient com tenant isolation já aplicado
// ---------------------------------------------------------------------------

export function createDashboardRoutes(prisma: PrismaClient): Router {
  const router = Router()

  // Aplica tenant isolation em todas as rotas deste router
  router.use(withTenantIsolation)

  // -------------------------------------------------------------------------
  // GET /api/v1/dashboard
  // Retorna a lista de widgets salvos do tenant com posição e config
  // -------------------------------------------------------------------------
  router.get('/', async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      const widgets = await prisma.dashboardWidget.findMany({
        where: { tenant_id: req.tenantId, active: true },
        orderBy: { position: 'asc' },
      })
      res.json(widgets)
    } catch (err) {
      next(err)
    }
  })

  // -------------------------------------------------------------------------
  // GET /api/v1/dashboard/widgets
  // Lista widgets disponíveis no Registry (filtrado por product_id opcional)
  // -------------------------------------------------------------------------
  router.get('/widgets', (req: TenantRequest, res: Response) => {
    const productId = req.query['product_id']

    const available =
      typeof productId === 'string' && productId.length > 0
        ? listWidgetsForProduct(productId)
        : listWidgets()

    res.json(available)
  })

  // -------------------------------------------------------------------------
  // POST /api/v1/dashboard/widgets/register
  // Produto registra um novo widget no Registry em tempo de execução
  // -------------------------------------------------------------------------
  router.post(
    '/widgets/register',
    async (req: TenantRequest, res: Response, next: NextFunction) => {
      try {
        const result = registerWidgetSchema.safeParse(req.body)
        if (!result.success) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
        }

        const data = result.data

        if (hasWidget(data.id)) {
          throw new AppError(409, 'WIDGET_ALREADY_EXISTS', `Widget '${data.id}' já está registrado`)
        }

        registerWidget(data)

        res.status(201).json({ registered: true, widgetId: data.id })
      } catch (err) {
        next(err)
      }
    }
  )

  // -------------------------------------------------------------------------
  // PUT /api/v1/dashboard/widgets/:id
  // Atualiza posição, config ou estado ativo de um widget do tenant
  // -------------------------------------------------------------------------
  router.put(
    '/widgets/:id',
    async (req: TenantRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as { id: string }

        const result = updateWidgetSchema.safeParse(req.body)
        if (!result.success) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
        }

        const existing = await prisma.dashboardWidget.findFirst({
          where: { widget_id: id, tenant_id: req.tenantId },
        })

        if (!existing) {
          // Widget ainda não foi salvo para este tenant — cria com defaults do Registry
          const registryWidget = getWidget(id)
          if (!registryWidget) {
            throw new AppError(404, 'WIDGET_NOT_FOUND', `Widget '${id}' não encontrado`)
          }

          const created = await prisma.dashboardWidget.create({
            data: {
              tenant_id: req.tenantId,
              widget_id: id,
              title: registryWidget.title,
              size: registryWidget.size,
              position: result.data.position ?? 0,
              product_id: registryWidget.productId ?? null,
              permissions: registryWidget.permissions,
              config: result.data.config ?? {},
              active: result.data.active ?? true,
            },
          })

          res.status(201).json(created)
          return
        }

        const updated = await prisma.dashboardWidget.update({
          where: { id: existing.id },
          data: {
            ...(result.data.position !== undefined && { position: result.data.position }),
            ...(result.data.config !== undefined && { config: result.data.config }),
            ...(result.data.active !== undefined && { active: result.data.active }),
          },
        })

        res.json(updated)
      } catch (err) {
        next(err)
      }
    }
  )

  // -------------------------------------------------------------------------
  // GET /api/v1/dashboard/stats
  // KPIs agregados: tarefas pendentes, emails não lidos, etc.
  // Dados vêm do banco — usados por widgets de polling
  // -------------------------------------------------------------------------
  router.get(
    '/stats',
    async (req: TenantRequest, res: Response, next: NextFunction) => {
      try {
        // Cada contador é buscado de forma independente para não bloquear
        // caso um dos serviços esteja lento
        const [pendingTasksResult, widgetCount] = await Promise.all([
          prisma.dashboardWidget.count({
            where: { tenant_id: req.tenantId, active: true },
          }),
          prisma.dashboardWidget.count({
            where: { tenant_id: req.tenantId },
          }),
        ])

        // Os contadores de email, notificações e timers são buscados dos
        // serviços respectivos via API REST (isolamento de serviços)
        // Aqui retornamos o que está disponível localmente
        res.json({
          pendingTasks: pendingTasksResult,
          totalWidgets: widgetCount,
          // TODO(coordenador, 2026-03): integrar com serviço de email e notificações via API REST
          unreadEmails: null,
          unreadNotifications: null,
          activeTimers: null,
        })
      } catch (err) {
        next(err)
      }
    }
  )

  // -------------------------------------------------------------------------
  // GET /api/v1/dashboard/stream
  // SSE — contadores críticos em tempo real para o tenant
  // -------------------------------------------------------------------------
  router.get(
    '/stream',
    (req: TenantRequest, res: Response, next: NextFunction) => {
      try {
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders()

        const tenantId = req.tenantId

        const sendStats = async () => {
          try {
            const count = await prisma.dashboardWidget.count({
              where: { tenant_id: tenantId, active: true },
            })

            const payload = JSON.stringify({
              pendingTasks: count,
              unreadEmails: 0,
              unreadNotifications: 0,
              activeTimers: 0,
            })

            res.write(`event: stats\ndata: ${payload}\n\n`)
          } catch (err) {
            console.error('[dashboard/stream] Erro ao buscar stats')
          }
        }

        // Envia imediatamente e depois a cada 5s
        void sendStats()
        const interval = setInterval(() => void sendStats(), 5_000)

        req.on('close', () => {
          clearInterval(interval)
          res.end()
        })
      } catch (err) {
        next(err)
      }
    }
  )

  return router
}
