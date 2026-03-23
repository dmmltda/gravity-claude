// HANA driver — SAP HANA direct connection via hdb package
// Credentials are decrypted ONLY at query time, never cached or logged

import { decrypt } from './crypto.js'

// Minimal interface for the hdb client (no official @types/hdb)
interface HdbClient {
  connect(options: HdbConnectOptions, callback: (err: Error | null) => void): void
  exec(sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void): void
  end(): void
}

interface HdbConnectOptions {
  host: string
  port: number
  user: string
  password: string
  databaseName?: string
}

interface HanaCredentials {
  host: string
  port: number
  databaseName?: string
  username: string
  credentialsEncrypted: string
}

export interface HanaQueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
  latencyMs: number
}

export interface HanaTestResult {
  ok: boolean
  latencyMs: number
  hanaVersion?: string
  error?: string
}

// Dynamic import so products without hdb don't fail at startup
async function loadHdb(): Promise<{ createClient: (options: HdbConnectOptions) => HdbClient }> {
  // hdb must be installed in the product's package.json when HANA protocol is used
  const hdb = await import('hdb') as { default: { createClient: (options: HdbConnectOptions) => HdbClient } }
  return hdb.default
}

async function decryptPassword(credentialsEncrypted: string): Promise<string> {
  const key = process.env.ERP_ENCRYPTION_KEY
  if (!key) throw new Error('ERP_ENCRYPTION_KEY não configurada')
  return decrypt(credentialsEncrypted, key)
}

function connectClient(client: HdbClient, options: HdbConnectOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    client.connect(options, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function execQuery(client: HdbClient, sql: string, params: unknown[]): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    client.exec(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

export async function executeHanaQuery(
  creds: HanaCredentials,
  sql: string,
  params: unknown[] = [],
): Promise<HanaQueryResult> {
  const hdb = await loadHdb()
  const password = await decryptPassword(creds.credentialsEncrypted)

  const client = hdb.createClient({
    host: creds.host,
    port: creds.port,
    user: creds.username,
    password,
    databaseName: creds.databaseName,
  })

  const start = Date.now()

  try {
    await connectClient(client, {
      host: creds.host,
      port: creds.port,
      user: creds.username,
      password,
      databaseName: creds.databaseName,
    })

    const rawRows = await execQuery(client, sql, params)
    const rows = rawRows as Record<string, unknown>[]

    return {
      rows,
      rowCount: rows.length,
      latencyMs: Date.now() - start,
    }
  } finally {
    client.end()
  }
}

export async function testHanaConnection(creds: HanaCredentials): Promise<HanaTestResult> {
  const start = Date.now()

  try {
    const hdb = await loadHdb()
    const password = await decryptPassword(creds.credentialsEncrypted)

    const client = hdb.createClient({
      host: creds.host,
      port: creds.port,
      user: creds.username,
      password,
      databaseName: creds.databaseName,
    })

    await connectClient(client, {
      host: creds.host,
      port: creds.port,
      user: creds.username,
      password,
      databaseName: creds.databaseName,
    })

    const rows = await execQuery(client, 'SELECT VERSION FROM SYS.M_DATABASE', [])
    client.end()

    const versionRow = (rows[0] as Record<string, unknown> | undefined)
    const hanaVersion = versionRow ? String(versionRow['VERSION'] ?? '') : undefined

    return { ok: true, latencyMs: Date.now() - start, hanaVersion }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Erro de conexão HANA',
    }
  }
}

export type { HanaCredentials }
