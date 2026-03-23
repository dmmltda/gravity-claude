// routes.ts — conector-erp
// Factory function: the product mounts this router inside its own server
// Usage: app.use('/api/v1/erp', createErpRouter(prisma))

import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { AppError } from '../../../../tenant/errors/AppError.js'
import { withTenantIsolation } from '../../../../tenant/middleware/tenant-isolation.js'
import type { TenantRequest } from '../../../../tenant/middleware/types.js'
import { encrypt } from './crypto.js'
import { executeODataQuery, testODataConnection } from './odata.js'
import { executeHanaQuery, testHanaConnection } from './hana.js'
import { buildQueryFromNaturalLanguage } from './query-builder.js'

// ─── Minimal DB interface (satisfied by the product's generated PrismaClient) ─

interface ErpConnectionRecord {
  id: string
  tenant_id: string
  product_id: string
  system_type: string
  protocol: string
  base_url: string
  username: string
  credentials_encrypted: string
  sync_frequency: string
  last_synced_at: Date | null
  last_tested_at: Date | null
  connection_status: string
  error_message: string | null
  created_at: Date
  updated_at: Date
}

interface ErpSyncLogRecord {
  id: string
  tenant_id: string
  product_id: string
  mode: string
  rows_processed: number
  rows_success: number
  rows_failed: number
  error_details: unknown
  started_at: Date
  finished_at: Date | null
  status: string
  triggered_by: string
}

interface ErpQueryLogRecord {
  id: string
  tenant_id: string
  product_id: string
  query_type: string
  query_text: string
  rows_returned: number | null
  latency_ms: number | null
  status: string
  error_message: string | null
  triggered_by: string
  created_at: Date
}

interface ErpAlertRecord {
  id: string
  tenant_id: string
  product_id: string
  type: string
  title: string
  description: string
  severity: string
  entity_id: string | null
  dismissed: boolean
  dismissed_at: Date | null
  dismissed_by: string | null
  created_at: Date
}

interface WhereClause {
  tenant_id: string
  product_id?: string
  id?: string
  dismissed?: boolean
}

interface ErpDb {
  erpConnection: {
    findFirst(args: { where: WhereClause }): Promise<ErpConnectionRecord | null>
    create(args: { data: Omit<ErpConnectionRecord, 'id' | 'created_at' | 'updated_at'> }): Promise<ErpConnectionRecord>
    update(args: { where: { id: string }; data: Partial<ErpConnectionRecord> }): Promise<ErpConnectionRecord>
    delete(args: { where: { id: string } }): Promise<ErpConnectionRecord>
  }
  erpSyncLog: {
    findMany(args: { where: WhereClause; orderBy: Record<string, string>; skip: number; take: number }): Promise<ErpSyncLogRecord[]>
    count(args: { where: WhereClause }): Promise<number>
    create(args: { data: Omit<ErpSyncLogRecord, 'id' | 'started_at'> }): Promise<ErpSyncLogRecord>
  }
  erpQueryLog: {
    findMany(args: { where: WhereClause; orderBy: Record<string, string>; skip: number; take: number }): Promise<ErpQueryLogRecord[]>
    count(args: { where: WhereClause }): Promise<number>
    create(args: { data: Omit<ErpQueryLogRecord, 'id' | 'created_at'> }): Promise<ErpQueryLogRecord>
  }
  erpAlert: {
    findMany(args: { where: WhereClause; orderBy: Record<string, string>; skip: number; take: number }): Promise<ErpAlertRecord[]>
    count(args: { where: WhereClause }): Promise<number>
    findUnique(args: { where: { id: string } }): Promise<ErpAlertRecord | null>
    create(args: { data: Omit<ErpAlertRecord, 'id' | 'created_at'> }): Promise<ErpAlertRecord>
    update(args: { where: { id: string }; data: Partial<ErpAlertRecord> }): Promise<ErpAlertRecord>
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tenantReq(req: Request): TenantRequest {
  return req as TenantRequest
}

function safeConnectionView(conn: ErpConnectionRecord): Omit<ErpConnectionRecord, 'credentials_encrypted'> {
  const { credentials_encrypted: _hidden, ...safe } = conn
  return safe
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createConnectionSchema = z.object({
  product_id: z.string().min(1),
  system_type: z.enum(['SAP', 'TOTVS', 'Oracle', 'custom']),
  protocol: z.enum(['odata', 'hana', 'rest', 'jdbc']),
  base_url: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1), // raw password — encrypted before saving
  sync_frequency: z.enum(['manual', 'hourly', 'every6h', 'daily']).default('manual'),
})

const updateConnectionSchema = z.object({
  system_type: z.enum(['SAP', 'TOTVS', 'Oracle', 'custom']).optional(),
  protocol: z.enum(['odata', 'hana', 'rest', 'jdbc']).optional(),
  base_url: z.string().url().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(), // raw — encrypted before saving
  sync_frequency: z.enum(['manual', 'hourly', 'every6h', 'daily']).optional(),
})

const querySchema = z.object({
  product_id: z.string().min(1),
  natural_language: z.string().min(1).max(500),
  product_context: z.string().min(1).max(100),
})

const listLogsSchema = z.object({
  product_id: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const listAlertsSchema = z.object({
  product_id: z.string().min(1),
  dismissed: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const createAlertSchema = z.object({
  product_id: z.string().min(1),
  type: z.enum(['li_expiring', 'di_delayed', 'tax_variance', 'ncm_quota', 'exchange_critical']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  entity_id: z.string().optional(),
})

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createErpRouter(db: ErpDb): Router {
  const router = Router()
  router.use(withTenantIsolation)

  // ── POST /connections ─────────────────────────────────────────────────────

  router.post('/connections', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createConnectionSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
      }

      const { tenantId } = tenantReq(req)
      const { product_id, system_type, protocol, base_url, username, password, sync_frequency } =
        parsed.data

      const encryptionKey = process.env.ERP_ENCRYPTION_KEY
      if (!encryptionKey) throw new AppError(500, 'CONFIG_ERROR', 'Chave de criptografia não configurada')

      const credentials_encrypted = await encrypt(password, encryptionKey)

      const existing = await db.erpConnection.findFirst({ where: { tenant_id: tenantId, product_id } })
      if (existing) {
        throw new AppError(409, 'CONFLICT', 'Conexão ERP já existe para este produto')
      }

      const conn = await db.erpConnection.create({
        data: {
          tenant_id: tenantId,
          product_id,
          system_type,
          protocol,
          base_url,
          username,
          credentials_encrypted,
          sync_frequency,
          last_synced_at: null,
          last_tested_at: null,
          connection_status: 'untested',
          error_message: null,
        },
      })

      res.status(201).json(safeConnectionView(conn))
    } catch (err) {
      next(err)
    }
  })

  // ── GET /connections ──────────────────────────────────────────────────────

  router.get('/connections', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = req.query['product_id']
      if (typeof productId !== 'string' || !productId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'product_id é obrigatório')
      }

      const { tenantId } = tenantReq(req)
      const conn = await db.erpConnection.findFirst({
        where: { tenant_id: tenantId, product_id: productId },
      })

      if (!conn) {
        res.json(null)
        return
      }

      res.json(safeConnectionView(conn))
    } catch (err) {
      next(err)
    }
  })

  // ── PUT /connections/:id ──────────────────────────────────────────────────

  router.put('/connections/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateConnectionSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
      }

      const { tenantId } = tenantReq(req)
      const conn = await db.erpConnection.findFirst({
        where: { tenant_id: tenantId, id: req.params['id'] },
      })
      if (!conn) throw new AppError(404, 'NOT_FOUND', 'Conexão não encontrada')

      const updateData: Partial<ErpConnectionRecord> = {}
      const { password, ...rest } = parsed.data

      if (rest.system_type) updateData.system_type = rest.system_type
      if (rest.protocol) updateData.protocol = rest.protocol
      if (rest.base_url) updateData.base_url = rest.base_url
      if (rest.username) updateData.username = rest.username
      if (rest.sync_frequency) updateData.sync_frequency = rest.sync_frequency

      if (password) {
        const key = process.env.ERP_ENCRYPTION_KEY
        if (!key) throw new AppError(500, 'CONFIG_ERROR', 'Chave de criptografia não configurada')
        updateData.credentials_encrypted = await encrypt(password, key)
        // Reset test status when credentials change
        updateData.connection_status = 'untested'
        updateData.last_tested_at = null
        updateData.error_message = null
      }

      const updated = await db.erpConnection.update({
        where: { id: conn.id },
        data: updateData,
      })

      res.json(safeConnectionView(updated))
    } catch (err) {
      next(err)
    }
  })

  // ── DELETE /connections/:id ───────────────────────────────────────────────

  router.delete('/connections/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = tenantReq(req)
      const conn = await db.erpConnection.findFirst({
        where: { tenant_id: tenantId, id: req.params['id'] },
      })
      if (!conn) throw new AppError(404, 'NOT_FOUND', 'Conexão não encontrada')

      await db.erpConnection.delete({ where: { id: conn.id } })
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  })

  // ── POST /connections/:id/test ────────────────────────────────────────────

  router.post('/connections/:id/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = tenantReq(req)
      const conn = await db.erpConnection.findFirst({
        where: { tenant_id: tenantId, id: req.params['id'] },
      })
      if (!conn) throw new AppError(404, 'NOT_FOUND', 'Conexão não encontrada')

      const creds = {
        baseUrl: conn.base_url,
        username: conn.username,
        credentialsEncrypted: conn.credentials_encrypted,
      }

      let testResult: { ok: boolean; latencyMs: number; error?: string; sapVersion?: string; hanaVersion?: string }

      if (conn.protocol === 'hana') {
        const url = new URL(conn.base_url)
        testResult = await testHanaConnection({
          host: url.hostname,
          port: parseInt(url.port, 10) || 30015,
          username: conn.username,
          credentialsEncrypted: conn.credentials_encrypted,
        })
      } else {
        testResult = await testODataConnection(creds)
      }

      const newStatus = testResult.ok ? 'ok' : 'failed'
      await db.erpConnection.update({
        where: { id: conn.id },
        data: {
          connection_status: newStatus,
          last_tested_at: new Date(),
          error_message: testResult.error ?? null,
        },
      })

      res.json({
        ok: testResult.ok,
        latency_ms: testResult.latencyMs,
        version: testResult.sapVersion ?? testResult.hanaVersion,
        error: testResult.error,
      })
    } catch (err) {
      next(err)
    }
  })

  // ── POST /query ───────────────────────────────────────────────────────────

  router.post('/query', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = querySchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
      }

      const { tenantId, userId } = tenantReq(req)
      const { product_id, natural_language, product_context } = parsed.data

      const conn = await db.erpConnection.findFirst({
        where: { tenant_id: tenantId, product_id },
      })
      if (!conn) throw new AppError(404, 'NOT_FOUND', 'Conexão ERP não configurada')
      if (conn.connection_status === 'failed') {
        throw new AppError(503, 'CONNECTION_FAILED', 'Conexão ERP com falha — reconfigure as credenciais')
      }

      const queryIntent = await buildQueryFromNaturalLanguage(natural_language, product_context)
      const start = Date.now()

      let rowCount = 0
      let queryError: string | null = null
      let results: unknown[] = []

      try {
        if (queryIntent.queryType === 'odata' && queryIntent.odata) {
          const creds = {
            baseUrl: conn.base_url,
            username: conn.username,
            credentialsEncrypted: conn.credentials_encrypted,
          }
          const odataResult = await executeODataQuery(creds, queryIntent.odata)
          results = odataResult.results
          rowCount = results.length
        } else if (queryIntent.queryType === 'sql' && queryIntent.sql) {
          if (conn.protocol !== 'hana') {
            throw new AppError(400, 'PROTOCOL_MISMATCH', 'SQL direto requer protocolo HANA')
          }
          const url = new URL(conn.base_url)
          const hanaResult = await executeHanaQuery(
            {
              host: url.hostname,
              port: parseInt(url.port, 10) || 30015,
              username: conn.username,
              credentialsEncrypted: conn.credentials_encrypted,
            },
            queryIntent.sql,
          )
          results = hanaResult.rows
          rowCount = hanaResult.rowCount
        }
      } catch (err) {
        queryError = err instanceof Error ? err.message : 'Erro na query'
      }

      const latencyMs = Date.now() - start

      await db.erpQueryLog.create({
        data: {
          tenant_id: tenantId,
          product_id,
          query_type: queryIntent.queryType,
          query_text: natural_language,
          rows_returned: queryError ? null : rowCount,
          latency_ms: latencyMs,
          status: queryError ? 'error' : 'success',
          error_message: queryError,
          triggered_by: userId || 'gabi',
        },
      })

      if (queryError) {
        throw new AppError(502, 'QUERY_ERROR', queryError)
      }

      res.json({
        results,
        row_count: rowCount,
        latency_ms: latencyMs,
        human_readable: queryIntent.humanReadable,
        query_type: queryIntent.queryType,
      })
    } catch (err) {
      next(err)
    }
  })

  // ── GET /logs/sync ────────────────────────────────────────────────────────

  router.get('/logs/sync', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listLogsSchema.safeParse(req.query)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos')
      }

      const { tenantId } = tenantReq(req)
      const { product_id, page, limit } = parsed.data

      const where: WhereClause = { tenant_id: tenantId, product_id }

      const [logs, total] = await Promise.all([
        db.erpSyncLog.findMany({
          where,
          orderBy: { started_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.erpSyncLog.count({ where }),
      ])

      res.json({ logs, total, page, limit })
    } catch (err) {
      next(err)
    }
  })

  // ── GET /logs/query ───────────────────────────────────────────────────────

  router.get('/logs/query', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listLogsSchema.safeParse(req.query)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos')
      }

      const { tenantId } = tenantReq(req)
      const { product_id, page, limit } = parsed.data

      const where: WhereClause = { tenant_id: tenantId, product_id }

      const [logs, total] = await Promise.all([
        db.erpQueryLog.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.erpQueryLog.count({ where }),
      ])

      res.json({ logs, total, page, limit })
    } catch (err) {
      next(err)
    }
  })

  // ── GET /alerts ───────────────────────────────────────────────────────────

  router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listAlertsSchema.safeParse(req.query)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos')
      }

      const { tenantId } = tenantReq(req)
      const { product_id, dismissed, page, limit } = parsed.data

      const where: WhereClause = { tenant_id: tenantId, product_id }
      if (dismissed !== undefined) {
        where.dismissed = dismissed === 'true'
      }

      const [alerts, total] = await Promise.all([
        db.erpAlert.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.erpAlert.count({ where }),
      ])

      res.json({ alerts, total, page, limit })
    } catch (err) {
      next(err)
    }
  })

  // ── POST /alerts ──────────────────────────────────────────────────────────

  router.post('/alerts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createAlertSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
      }

      const { tenantId } = tenantReq(req)
      const { product_id, type, title, description, severity, entity_id } = parsed.data

      const alert = await db.erpAlert.create({
        data: {
          tenant_id: tenantId,
          product_id,
          type,
          title,
          description,
          severity,
          entity_id: entity_id ?? null,
          dismissed: false,
          dismissed_at: null,
          dismissed_by: null,
        },
      })

      res.status(201).json(alert)
    } catch (err) {
      next(err)
    }
  })

  // ── POST /alerts/:id/dismiss ──────────────────────────────────────────────

  router.post('/alerts/:id/dismiss', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, userId } = tenantReq(req)

      const alert = await db.erpAlert.findUnique({ where: { id: req.params['id'] } })
      if (!alert || alert.tenant_id !== tenantId) {
        throw new AppError(404, 'NOT_FOUND', 'Alerta não encontrado')
      }
      if (alert.dismissed) {
        throw new AppError(409, 'ALREADY_DISMISSED', 'Alerta já foi dispensado')
      }

      const updated = await db.erpAlert.update({
        where: { id: alert.id },
        data: {
          dismissed: true,
          dismissed_at: new Date(),
          dismissed_by: userId,
        },
      })

      res.json(updated)
    } catch (err) {
      next(err)
    }
  })

  return router
}

export type { ErpDb }
