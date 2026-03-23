// servicos-global/tenant/relatorios/server/routes.ts
import { Router } from 'express'
import { z } from 'zod'
import type { Request, Response, NextFunction } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AppError } from '../../errors/AppError.js'
import { pickColumns, buildCSV, buildTXT, buildXML, buildExcelBuffer } from './format-utils.js'

type TenantRequest = Request & { tenantId: string; userId: string; prisma: PrismaClient }

const router = Router()

// ─── Schemas ─────────────────────────────────────────────────────────────────

const savedReportBodySchema = z.object({
  report_id:  z.string().min(1),
  product_id: z.string().optional(),
  name:       z.string().min(1).max(200),
  sources:    z.array(z.unknown()).default([]),
  filters:    z.record(z.unknown()).default({}),
  columns:    z.array(z.unknown()).default([]),
  join_type:  z.enum(['left', 'inner']).default('left'),
  is_shared:  z.boolean().default(false),
})

const scheduleBodySchema = z.object({
  frequency:       z.enum(['once', 'daily', 'weekly', 'monthly', 'custom']),
  cron_expression: z.string().optional(),
  next_run_at:     z.string().datetime(),
  channels:        z.object({
    email:    z.array(z.string()).default([]),
    whatsapp: z.array(z.string()).default([]),
    notify:   z.array(z.string()).default([]),
  }),
  format: z.enum(['csv', 'excel', 'json', 'xml', 'txt']).default('csv'),
  active: z.boolean().default(true),
})

const shareBodySchema = z.object({
  user_id: z.string().min(1),
})

const dataQuerySchema = z.object({
  source_endpoint: z.string().url().optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(500).default(50),
  sort:   z.string().optional(),
  order:  z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
})

const exportQuerySchema = z.object({
  source_endpoint: z.string().url().optional(),
  format:   z.enum(['csv', 'excel', 'json', 'xml', 'txt']).default('csv'),
  columns:  z.string().optional(), // JSON string com array de colunas visíveis
  filters:  z.string().optional(), // JSON string com filtros ativos
  name:     z.string().default('relatorio'),
})

// ─── Helper proxy: busca dados do endpoint do produto ────────────────────────

async function fetchSourceData(
  sourceEndpoint: string,
  authHeader: string,
  extraParams: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const url = new URL(sourceEndpoint)
  Object.entries(extraParams).forEach(([k, v]) => url.searchParams.set(k, v))

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: authHeader,
      'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
    },
  })

  if (!response.ok) {
    throw new AppError(502, 'UPSTREAM_ERROR', 'Erro ao buscar dados da fonte')
  }

  const json = (await response.json()) as { data?: Record<string, unknown>[] } | Record<string, unknown>[]
  return Array.isArray(json) ? json : (json.data ?? [])
}

// ─── GET /saved — listar relatórios salvos ────────────────────────────────────
// ATENÇÃO: /saved e sub-rotas DEVEM vir antes de /:report_id

router.get('/saved', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, prisma } = req as TenantRequest

    const reports = await prisma.savedReport.findMany({
      where: { tenant_id: tenantId },
      orderBy: { updated_at: 'desc' },
    })

    res.json({ data: reports })
  } catch (err) {
    next(err)
  }
})

// ─── POST /saved — salvar relatório ──────────────────────────────────────────

router.post('/saved', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = savedReportBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos'))
    }

    const { tenantId, userId, prisma } = req as TenantRequest
    const data = parsed.data

    const report = await prisma.savedReport.create({
      data: {
        tenant_id:  tenantId,
        user_id:    userId,
        report_id:  data.report_id,
        product_id: data.product_id ?? null,
        name:       data.name,
        sources:    data.sources,
        filters:    data.filters,
        columns:    data.columns,
        join_type:  data.join_type,
        is_shared:  data.is_shared,
      },
    })

    res.status(201).json(report)
  } catch (err) {
    next(err)
  }
})

// ─── PUT /saved/:id — atualizar relatório salvo ───────────────────────────────

router.put('/saved/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = savedReportBodySchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos'))
    }

    const { tenantId, prisma } = req as TenantRequest
    const { id } = req.params

    const existing = await prisma.savedReport.findFirst({
      where: { id, tenant_id: tenantId },
    })
    if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Relatório não encontrado'))

    const updated = await prisma.savedReport.update({
      where: { id },
      data: parsed.data,
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /saved/:id — deletar relatório salvo ──────────────────────────────

router.delete('/saved/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, prisma } = req as TenantRequest
    const { id } = req.params

    const existing = await prisma.savedReport.findFirst({
      where: { id, tenant_id: tenantId },
    })
    if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Relatório não encontrado'))

    await prisma.savedReport.delete({ where: { id } })

    // Remove schedule vinculado, se existir
    await prisma.reportSchedule.deleteMany({
      where: { saved_report_id: id, tenant_id: tenantId },
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ─── GET /saved/:id/schedule — ver agendamento ───────────────────────────────

router.get('/saved/:id/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, prisma } = req as TenantRequest
    const { id } = req.params

    const schedule = await prisma.reportSchedule.findFirst({
      where: { saved_report_id: id, tenant_id: tenantId },
    })

    if (!schedule) return next(new AppError(404, 'NOT_FOUND', 'Agendamento não encontrado'))

    res.json(schedule)
  } catch (err) {
    next(err)
  }
})

// ─── POST /saved/:id/schedule — criar agendamento ────────────────────────────

router.post('/saved/:id/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = scheduleBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos'))
    }

    const { tenantId, prisma } = req as TenantRequest
    const { id } = req.params

    const report = await prisma.savedReport.findFirst({
      where: { id, tenant_id: tenantId },
    })
    if (!report) return next(new AppError(404, 'NOT_FOUND', 'Relatório não encontrado'))

    const existing = await prisma.reportSchedule.findFirst({
      where: { saved_report_id: id, tenant_id: tenantId },
    })
    if (existing) return next(new AppError(409, 'CONFLICT', 'Agendamento já existe — use PUT para atualizar'))

    const { frequency, cron_expression, next_run_at, channels, format, active } = parsed.data

    const schedule = await prisma.reportSchedule.create({
      data: {
        tenant_id:       tenantId,
        saved_report_id: id,
        frequency,
        cron_expression: cron_expression ?? null,
        next_run_at:     new Date(next_run_at),
        channels,
        format,
        active,
      },
    })

    res.status(201).json(schedule)
  } catch (err) {
    next(err)
  }
})

// ─── PUT /saved/:id/schedule — atualizar agendamento ─────────────────────────

router.put('/saved/:id/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = scheduleBodySchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos'))
    }

    const { tenantId, prisma } = req as TenantRequest
    const { id } = req.params

    const existing = await prisma.reportSchedule.findFirst({
      where: { saved_report_id: id, tenant_id: tenantId },
    })
    if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Agendamento não encontrado'))

    const updateData: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.next_run_at) {
      updateData.next_run_at = new Date(parsed.data.next_run_at)
    }

    const updated = await prisma.reportSchedule.update({
      where: { id: existing.id },
      data: updateData,
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /saved/:id/schedule — cancelar agendamento ───────────────────────

router.delete('/saved/:id/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, prisma } = req as TenantRequest
    const { id } = req.params

    const existing = await prisma.reportSchedule.findFirst({
      where: { saved_report_id: id, tenant_id: tenantId },
    })
    if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Agendamento não encontrado'))

    await prisma.reportSchedule.delete({ where: { id: existing.id } })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ─── POST /saved/:id/share — compartilhar relatório ──────────────────────────

router.post('/saved/:id/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = shareBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos'))
    }

    const { tenantId, userId, prisma } = req as TenantRequest
    const { id } = req.params

    const report = await prisma.savedReport.findFirst({
      where: { id, tenant_id: tenantId, user_id: userId },
    })
    if (!report) return next(new AppError(404, 'NOT_FOUND', 'Relatório não encontrado ou sem permissão'))

    await prisma.savedReport.update({
      where: { id },
      data:  { is_shared: true },
    })

    // TODO(daniel, 2026-03): persistir permissão por user_id em tabela de compartilhamento dedicada
    res.json({ shared: true, user_id: parsed.data.user_id })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /saved/:id/share/:user_id — remover acesso ───────────────────────

router.delete('/saved/:id/share/:user_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, userId, prisma } = req as TenantRequest
    const { id } = req.params

    const report = await prisma.savedReport.findFirst({
      where: { id, tenant_id: tenantId, user_id: userId },
    })
    if (!report) return next(new AppError(404, 'NOT_FOUND', 'Relatório não encontrado ou sem permissão'))

    // TODO(daniel, 2026-03): remover permissão por user_id da tabela de compartilhamento
    res.json({ removed: true })
  } catch (err) {
    next(err)
  }
})

// ─── GET /:report_id/export — exportar dados ─────────────────────────────────
// ATENÇÃO: deve vir antes de /:report_id para que o Express não confunda

router.get('/:report_id/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = exportQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos'))
    }

    const { source_endpoint, format, columns: columnsRaw, name } = parsed.data
    const authHeader = req.headers['authorization'] ?? ''

    if (!source_endpoint) {
      return next(new AppError(400, 'MISSING_SOURCE', 'source_endpoint é obrigatório para exportação'))
    }

    const extraFilters = columnsRaw ? {} : {}
    const rows = await fetchSourceData(source_endpoint, authHeader, extraFilters)

    const cols: string[] = columnsRaw ? (JSON.parse(columnsRaw) as string[]) : []
    const filteredRows = rows.map((r) => pickColumns(r, cols))
    const safeRows = filteredRows as Record<string, unknown>[]

    const dateStr = new Date().toISOString().slice(0, 10)
    const filename = `${name}-${dateStr}`

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
      return res.send('\ufeff' + buildCSV(safeRows, cols))
    }

    if (format === 'txt') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`)
      return res.send(buildTXT(safeRows, cols))
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`)
      return res.send(JSON.stringify(safeRows, null, 2))
    }

    if (format === 'xml') {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xml"`)
      return res.send(buildXML(safeRows, cols, name))
    }

    if (format === 'excel') {
      const buffer = buildExcelBuffer(safeRows, cols)
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xls"`)
      return res.send(buffer)
    }

    return next(new AppError(400, 'INVALID_FORMAT', 'Formato não suportado'))
  } catch (err) {
    next(err)
  }
})

// ─── GET /:report_id — dados com filtros e paginação ─────────────────────────

router.get('/:report_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = dataQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos'))
    }

    const { source_endpoint, page, limit, sort, order, search } = parsed.data
    const { tenantId, prisma } = req as TenantRequest
    const { report_id } = req.params
    const authHeader = req.headers['authorization'] ?? ''

    // Tenta carregar configuração de relatório salvo pelo report_id (saved report)
    const savedReport = await prisma.savedReport.findFirst({
      where: { id: report_id, tenant_id: tenantId },
    })

    const endpoint = source_endpoint ?? (savedReport ? null : null)

    if (!endpoint) {
      return next(
        new AppError(400, 'MISSING_SOURCE', 'source_endpoint é obrigatório para relatórios sem configuração salva')
      )
    }

    const extraParams: Record<string, string> = {
      page:  String(page),
      limit: String(limit),
      ...(sort   && { sort }),
      ...(order  && { order }),
      ...(search && { search }),
    }

    const rows = await fetchSourceData(endpoint, authHeader, extraParams)

    res.json({
      data: rows,
      pagination: { page, limit, total: rows.length },
      saved_config: savedReport
        ? { filters: savedReport.filters, columns: savedReport.columns, join_type: savedReport.join_type }
        : null,
    })
  } catch (err) {
    next(err)
  }
})

export { router as relatoriosRoutes }
