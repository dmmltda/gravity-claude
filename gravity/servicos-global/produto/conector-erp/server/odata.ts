// OData client — SAP OData protocol (S/4HANA, ECC)
// Credentials are decrypted ONLY at query time, never cached or logged

import { decrypt } from './crypto.js'

export interface ODataCredentials {
  baseUrl: string
  username: string
  credentialsEncrypted: string
}

export interface ODataQueryParams {
  entity: string
  filter?: string
  select?: string[]
  top?: number
  skip?: number
  orderby?: string
}

export interface ODataResult<T> {
  results: T[]
  count?: number
  nextLink?: string
}

export interface ConnectionTestResult {
  ok: boolean
  latencyMs: number
  sapVersion?: string
  error?: string
}

interface ODataResponseEnvelope<T> {
  d: {
    results: T[]
    __count?: string
    __next?: string
  }
}

async function buildAuthHeader(creds: ODataCredentials): Promise<string> {
  const key = process.env.ERP_ENCRYPTION_KEY
  if (!key) throw new Error('ERP_ENCRYPTION_KEY não configurada')

  const password = await decrypt(creds.credentialsEncrypted, key)
  const token = Buffer.from(`${creds.username}:${password}`).toString('base64')
  return `Basic ${token}`
}

function buildUrl(baseUrl: string, params: ODataQueryParams): string {
  const url = new URL(`${baseUrl}/${params.entity}`)
  const q = new URLSearchParams()

  if (params.filter) q.set('$filter', params.filter)
  if (params.select?.length) q.set('$select', params.select.join(','))
  if (params.top !== undefined) q.set('$top', String(params.top))
  if (params.skip !== undefined) q.set('$skip', String(params.skip))
  if (params.orderby) q.set('$orderby', params.orderby)
  q.set('$format', 'json')

  url.search = q.toString()
  return url.toString()
}

export async function executeODataQuery<T = Record<string, unknown>>(
  creds: ODataCredentials,
  params: ODataQueryParams,
  timeoutMs = 30_000,
): Promise<ODataResult<T>> {
  const authHeader = await buildAuthHeader(creds)
  const url = buildUrl(creds.baseUrl, params)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'x-csrf-token': 'fetch',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`OData ${response.status}: ${body.slice(0, 200)}`)
    }

    const data = (await response.json()) as ODataResponseEnvelope<T>
    return {
      results: data.d.results,
      count: data.d.__count !== undefined ? parseInt(data.d.__count, 10) : undefined,
      nextLink: data.d.__next,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function testODataConnection(
  creds: ODataCredentials,
): Promise<ConnectionTestResult> {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)

  try {
    const authHeader = await buildAuthHeader(creds)

    const response = await fetch(`${creds.baseUrl}/`, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    const latencyMs = Date.now() - start

    if (!response.ok) {
      return { ok: false, latencyMs, error: `HTTP ${response.status}` }
    }

    const data = (await response.json()) as { version?: string }
    return { ok: true, latencyMs, sapVersion: data.version }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Erro de conexão',
    }
  } finally {
    clearTimeout(timer)
  }
}
