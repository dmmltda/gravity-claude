import type { RequestHandler, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import { AppError } from '../errors/AppError.js'

export interface TenantProxyOptions {
  baseUrl: string
  services: string[]
}

/**
 * Cria um middleware Express que faz proxy de requisições para os serviços de tenant.
 *
 * Monte em /api/v1/ — o proxy extrai o nome do serviço do primeiro segmento do path
 * e encaminha para ${baseUrl}/api/v1/${service}/${rest}.
 *
 * @example
 * app.use('/api/v1', createTenantProxy({ baseUrl: process.env.TENANT_SERVICE_URL, services: ['cronometro', 'email'] }))
 */
export function createTenantProxy(options: TenantProxyOptions): RequestHandler {
  const { baseUrl, services } = options

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // req.path é o sub-path após o ponto de montagem (ex.: /cronometro/entries/123)
      const segments = req.path.replace(/^\//, '').split('/')
      const service = segments[0]
      const rest = segments.slice(1).join('/')

      if (!service || !services.includes(service)) {
        return next(new AppError(404, 'SERVICE_NOT_FOUND', `Serviço '${service}' não disponível neste proxy`))
      }

      const upstreamPath = rest
        ? `${baseUrl}/api/v1/${service}/${rest}`
        : `${baseUrl}/api/v1/${service}`

      // Preserva query string original
      const queryString = req.url.includes('?')
        ? req.url.slice(req.url.indexOf('?'))
        : ''
      const fullUrl = `${upstreamPath}${queryString}`

      // Propaga ou gera correlation ID
      const correlationId =
        (req.headers['x-correlation-id'] as string | undefined) ?? randomUUID()

      const controller = new AbortController()
      const timeoutHandle = setTimeout(() => controller.abort(), 10_000)

      let upstream: globalThis.Response
      try {
        upstream = await fetch(fullUrl, {
          method: req.method,
          headers: {
            'content-type': 'application/json',
            ...(req.headers['authorization']
              ? { authorization: req.headers['authorization'] as string }
              : {}),
            'x-internal-key': process.env.INTERNAL_SERVICE_KEY ?? '',
            'x-correlation-id': correlationId,
            ...(req.headers['x-tenant-id']
              ? { 'x-tenant-id': req.headers['x-tenant-id'] as string }
              : {}),
          },
          ...(req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined
            ? { body: JSON.stringify(req.body as unknown) }
            : {}),
          signal: controller.signal,
        })
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new AppError(502, 'UPSTREAM_TIMEOUT', 'Serviço de tenant indisponível')
        }
        throw new AppError(502, 'UPSTREAM_ERROR', 'Serviço de tenant indisponível')
      } finally {
        clearTimeout(timeoutHandle)
      }

      const body = await upstream.text()
      const contentType = upstream.headers.get('content-type') ?? 'application/json'

      // Repassa o status do upstream: 4xx chegam como 4xx ao cliente;
      // 5xx do upstream viram 502 para indicar falha no serviço de tenant.
      const status = upstream.status >= 500 ? 502 : upstream.status

      res.status(status).set('content-type', contentType)

      if (body.length > 0) {
        res.send(body)
      } else {
        res.end()
      }
    } catch (err) {
      next(err)
    }
  }
}
