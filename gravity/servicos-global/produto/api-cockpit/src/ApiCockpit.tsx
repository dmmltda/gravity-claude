import { useState, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Scope = 'read' | 'write' | 'delete'
type Environment = 'live' | 'test'
type Tab = 'docs' | 'tokens' | 'playground' | 'webhooks' | 'usage'

interface ApiToken {
  id: string
  name: string
  prefix: string
  scope: Scope[]
  rate_limit: number
  expires_at: string | null
  last_used_at: string | null
  created_at: string
}

interface WebhookDelivery {
  id: string
  event: string
  status_code: number | null
  latency_ms: number | null
  attempts: number
  delivered_at: string | null
  created_at: string
}

interface ApiWebhook {
  id: string
  url: string
  events: string[]
  active: boolean
  created_at: string
  deliveries: WebhookDelivery[]
}

interface UsageDay {
  date: string
  count: number
}

interface UsageEndpoint {
  endpoint: string
  count: number
}

interface UsageData {
  total: number
  days: number
  by_day: UsageDay[]
  by_endpoint: UsageEndpoint[]
}

interface NewTokenForm {
  name: string
  scope: Scope[]
  environment: Environment
  rate_limit: number
  expires_in_days: string
}

interface NewWebhookForm {
  url: string
  events: string
  active: boolean
}

interface PlaygroundCall {
  endpoint: string
  method: string
  body: string
  response: string
  status: number | null
  latency: number | null
}

interface ApiCockpitProps {
  /** URL base das rotas do cockpit — ex: /api/v1/cockpit */
  baseUrl: string
  /** Token de autenticação Bearer para chamar as rotas */
  authToken?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCOPE_LABELS: Record<Scope, string> = {
  read: 'Leitura (GET)',
  write: 'Escrita (POST, PUT)',
  delete: 'Exclusão (DELETE)',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function statusColor(code: number | null): string {
  if (code === null) return '#6b7280'
  if (code < 300) return '#22c55e'
  if (code < 500) return '#f59e0b'
  return '#ef4444'
}

// ---------------------------------------------------------------------------
// Sub-componentes de aba
// ---------------------------------------------------------------------------

// Documentação -----------------------------------------------------------

function TabDocumentacao({ baseUrl, authToken }: { baseUrl: string; authToken?: string }) {
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${baseUrl}/docs`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then((r) => r.json())
      .then((data) => { setSpec(data); setLoading(false) })
      .catch(() => { setError('Falha ao carregar documentação'); setLoading(false) })
  }, [baseUrl, authToken])

  if (loading) return <p style={styles.muted}>Carregando documentação…</p>
  if (error) return <p style={styles.error}>{error}</p>
  if (!spec) return null

  const paths = (spec.paths ?? {}) as Record<string, Record<string, { summary?: string; tags?: string[] }>>

  return (
    <div>
      <h2 style={styles.sectionTitle}>{String((spec.info as Record<string, unknown>)?.title ?? 'API')}</h2>
      <p style={styles.muted}>v{String((spec.info as Record<string, unknown>)?.version ?? '1.0.0')}</p>
      {Object.entries(paths).map(([path, methods]) => (
        <div key={path} style={styles.docPath}>
          <span style={styles.pathLabel}>{path}</span>
          {Object.entries(methods).map(([method, def]) => (
            <div key={method} style={styles.docMethod}>
              <span style={{ ...styles.methodBadge, backgroundColor: methodColor(method) }}>
                {method.toUpperCase()}
              </span>
              <span style={styles.docSummary}>{def.summary ?? ''}</span>
              {def.tags?.map((tag) => (
                <span key={tag} style={styles.tagBadge}>{tag}</span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function methodColor(method: string): string {
  const colors: Record<string, string> = {
    get: '#3b82f6', post: '#22c55e', put: '#f59e0b', delete: '#ef4444', patch: '#a855f7',
  }
  return colors[method.toLowerCase()] ?? '#6b7280'
}

// Tokens -----------------------------------------------------------------

function TabTokens({ baseUrl, authToken }: { baseUrl: string; authToken?: string }) {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [form, setForm] = useState<NewTokenForm>({
    name: '',
    scope: ['read'],
    environment: 'live',
    rate_limit: 60,
    expires_in_days: '',
  })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const headers = useCallback((): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  }), [authToken])

  const loadTokens = useCallback(() => {
    setLoading(true)
    fetch(`${baseUrl}/tokens`, { headers: headers() })
      .then((r) => r.json())
      .then((data) => { setTokens(data.tokens ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [baseUrl, headers])

  useEffect(() => { loadTokens() }, [loadTokens])

  function toggleScope(scope: Scope) {
    setForm((f) => ({
      ...f,
      scope: f.scope.includes(scope) ? f.scope.filter((s) => s !== scope) : [...f.scope, scope],
    }))
  }

  async function handleCreate() {
    if (!form.name.trim()) { setFormError('Nome obrigatório'); return }
    if (form.scope.length === 0) { setFormError('Selecione ao menos um escopo'); return }
    setFormError(null)
    setCreating(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        scope: form.scope,
        environment: form.environment,
        rate_limit: form.rate_limit,
      }
      if (form.expires_in_days) body.expires_in_days = parseInt(form.expires_in_days, 10)

      const res = await fetch(`${baseUrl}/tokens`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      })
      const data = await res.json() as { token?: { plain_token?: string } }
      if (!res.ok) throw new Error('Erro ao criar token')
      setNewToken(data.token?.plain_token ?? null)
      loadTokens()
    } catch {
      setFormError('Falha ao criar token')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    await fetch(`${baseUrl}/tokens/${id}`, { method: 'DELETE', headers: headers() })
    loadTokens()
  }

  return (
    <div>
      <div style={styles.rowBetween}>
        <h2 style={styles.sectionTitle}>Tokens de Acesso</h2>
        <button style={styles.btnPrimary} onClick={() => { setShowModal(true); setNewToken(null) }}>
          + Gerar Token
        </button>
      </div>

      {loading && <p style={styles.muted}>Carregando…</p>}

      <table style={styles.table}>
        <thead>
          <tr>
            {['Nome', 'Prefixo', 'Escopos', 'Rate limit', 'Expira em', 'Último uso', ''].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.id} style={styles.tr}>
              <td style={styles.td}>{t.name}</td>
              <td style={styles.td}><code style={styles.code}>{t.prefix}…</code></td>
              <td style={styles.td}>{(t.scope as Scope[]).join(', ')}</td>
              <td style={styles.td}>{t.rate_limit} req/min</td>
              <td style={styles.td}>{formatDate(t.expires_at)}</td>
              <td style={styles.td}>{formatDate(t.last_used_at)}</td>
              <td style={styles.td}>
                <button style={styles.btnDanger} onClick={() => handleRevoke(t.id)}>Revogar</button>
              </td>
            </tr>
          ))}
          {tokens.length === 0 && !loading && (
            <tr><td colSpan={7} style={{ ...styles.td, ...styles.muted, textAlign: 'center' }}>Nenhum token ativo</td></tr>
          )}
        </tbody>
      </table>

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            {newToken ? (
              <div>
                <h3 style={styles.modalTitle}>Token gerado com sucesso</h3>
                <p style={{ ...styles.muted, marginBottom: 8 }}>
                  ⚠️ Copie agora — este token não será exibido novamente.
                </p>
                <div style={styles.tokenDisplay}>
                  <code style={styles.tokenCode}>{newToken}</code>
                </div>
                <button style={styles.btnPrimary} onClick={() => { setShowModal(false); setForm({ name: '', scope: ['read'], environment: 'live', rate_limit: 60, expires_in_days: '' }) }}>
                  Fechar
                </button>
              </div>
            ) : (
              <div>
                <h3 style={styles.modalTitle}>Gerar novo token</h3>
                {formError && <p style={styles.error}>{formError}</p>}
                <label style={styles.label}>Nome
                  <input style={styles.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Integração SAP" />
                </label>
                <label style={styles.label}>Escopo
                  <div style={styles.checkGroup}>
                    {(['read', 'write', 'delete'] as Scope[]).map((s) => (
                      <label key={s} style={styles.checkLabel}>
                        <input type="checkbox" checked={form.scope.includes(s)} onChange={() => toggleScope(s)} />
                        {SCOPE_LABELS[s]}
                      </label>
                    ))}
                  </div>
                </label>
                <label style={styles.label}>Ambiente
                  <select style={styles.input} value={form.environment} onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value as Environment }))}>
                    <option value="live">Produção (gv_live_sk_)</option>
                    <option value="test">Sandbox (gv_test_sk_)</option>
                  </select>
                </label>
                <label style={styles.label}>Rate limit (req/min)
                  <input type="number" style={styles.input} value={form.rate_limit} min={1} max={10000} onChange={(e) => setForm((f) => ({ ...f, rate_limit: parseInt(e.target.value, 10) || 60 }))} />
                </label>
                <label style={styles.label}>Expiração (dias — deixe em branco para nunca)
                  <input type="number" style={styles.input} value={form.expires_in_days} min={1} placeholder="Ex: 90" onChange={(e) => setForm((f) => ({ ...f, expires_in_days: e.target.value }))} />
                </label>
                <div style={styles.rowGap}>
                  <button style={styles.btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
                  <button style={styles.btnPrimary} onClick={handleCreate} disabled={creating}>
                    {creating ? 'Gerando…' : 'Gerar token'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Playground -------------------------------------------------------------

const EXAMPLE_ENDPOINTS = [
  { method: 'GET', path: '/cockpit/tokens' },
  { method: 'GET', path: '/cockpit/usage' },
  { method: 'GET', path: '/cockpit/webhooks' },
  { method: 'GET', path: '/cockpit/docs' },
]

type ExportFormat = 'curl' | 'node' | 'python' | 'php'

function buildExport(format: ExportFormat, method: string, url: string, body: string, token?: string): string {
  const authHeader = token ? ` -H "Authorization: Bearer ${token}"` : ''
  const bodyFlag = body && method !== 'GET' ? ` -d '${body}'` : ''

  if (format === 'curl') {
    return `curl -X ${method} "${url}"${authHeader} -H "Content-Type: application/json"${bodyFlag}`
  }
  if (format === 'node') {
    return `const res = await fetch("${url}", {\n  method: "${method}",\n  headers: { "Content-Type": "application/json"${token ? `, "Authorization": "Bearer ${token}"` : ''} },\n  ${method !== 'GET' && body ? `body: JSON.stringify(${body}),` : ''}\n})\nconst data = await res.json()\nconsole.log(data)`
  }
  if (format === 'python') {
    return `import requests\nres = requests.${method.toLowerCase()}(\n  "${url}",\n  headers={"Authorization": "Bearer ${token ?? ''}"},\n  ${method !== 'GET' && body ? `json=${body}` : ''}\n)\nprint(res.json())`
  }
  return `<?php\n$ch = curl_init("${url}");\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${method}");\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer ${token ?? ''}", "Content-Type: application/json"]);\n$result = curl_exec($ch);\necho $result;`
}

function TabPlayground({ baseUrl, authToken }: { baseUrl: string; authToken?: string }) {
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production')
  const [selected, setSelected] = useState(EXAMPLE_ENDPOINTS[0])
  const [body, setBody] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('curl')
  const [call, setCall] = useState<PlaygroundCall | null>(null)
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<PlaygroundCall[]>([])

  const fullUrl = `${baseUrl.replace('/v1', environment === 'sandbox' ? '/v1-test' : '/v1')}${selected.path}`

  async function run() {
    setRunning(true)
    const start = Date.now()
    try {
      const res = await fetch(fullUrl, {
        method: selected.method,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        ...(selected.method !== 'GET' && body ? { body } : {}),
      })
      const latency = Date.now() - start
      const text = await res.text()
      const entry: PlaygroundCall = { endpoint: selected.path, method: selected.method, body, response: text, status: res.status, latency }
      setCall(entry)
      setHistory((h) => [entry, ...h].slice(0, 20))
    } catch (err) {
      const entry: PlaygroundCall = { endpoint: selected.path, method: selected.method, body, response: String(err), status: null, latency: null }
      setCall(entry)
    } finally {
      setRunning(false)
    }
  }

  const exportCode = buildExport(exportFormat, selected.method, fullUrl, body, authToken)

  return (
    <div>
      <h2 style={styles.sectionTitle}>Playground</h2>
      <div style={styles.rowGap}>
        <label style={styles.label}>Ambiente
          <select style={styles.input} value={environment} onChange={(e) => setEnvironment(e.target.value as 'production' | 'sandbox')}>
            <option value="production">Produção</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </label>
        <label style={styles.label}>Endpoint
          <select style={styles.input} onChange={(e) => setSelected(EXAMPLE_ENDPOINTS[parseInt(e.target.value, 10)])}>
            {EXAMPLE_ENDPOINTS.map((ep, i) => (
              <option key={i} value={i}>{ep.method} {ep.path}</option>
            ))}
          </select>
        </label>
      </div>

      {selected.method !== 'GET' && (
        <label style={styles.label}>Body (JSON)
          <textarea style={{ ...styles.input, height: 120, fontFamily: 'monospace', resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} placeholder='{"key": "value"}' />
        </label>
      )}

      <button style={styles.btnPrimary} onClick={run} disabled={running}>
        {running ? 'Enviando…' : `Executar ${selected.method} ${selected.path}`}
      </button>

      {call && (
        <div style={styles.playgroundResult}>
          <div style={styles.rowBetween}>
            <span style={{ color: statusColor(call.status) }}>
              {call.status ?? 'Erro'} — {call.latency !== null ? `${call.latency}ms` : '—'}
            </span>
            <div style={styles.rowGap}>
              <span style={styles.muted}>Exportar como:</span>
              {(['curl', 'node', 'python', 'php'] as ExportFormat[]).map((f) => (
                <button key={f} style={exportFormat === f ? styles.btnPrimary : styles.btnSecondary} onClick={() => setExportFormat(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <pre style={styles.codeBlock}>{exportCode}</pre>
          <pre style={styles.codeBlock}>{call.response}</pre>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={styles.subTitle}>Histórico (últimas {history.length})</h3>
          {history.map((h, i) => (
            <div key={i} style={styles.historyRow}>
              <span style={{ ...styles.methodBadge, backgroundColor: methodColor(h.method) }}>{h.method}</span>
              <span style={styles.muted}>{h.endpoint}</span>
              <span style={{ color: statusColor(h.status) }}>{h.status ?? 'Erro'}</span>
              <span style={styles.muted}>{h.latency !== null ? `${h.latency}ms` : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Webhooks ---------------------------------------------------------------

function TabWebhooks({ baseUrl, authToken }: { baseUrl: string; authToken?: string }) {
  const [webhooks, setWebhooks] = useState<ApiWebhook[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [form, setForm] = useState<NewWebhookForm>({ url: '', events: '', active: true })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const headers = useCallback((): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  }), [authToken])

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${baseUrl}/webhooks`, { headers: headers() })
      .then((r) => r.json())
      .then((data) => { setWebhooks(data.webhooks ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [baseUrl, headers])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!form.url) { setFormError('URL obrigatória'); return }
    if (!form.events.trim()) { setFormError('Informe ao menos um evento'); return }
    setFormError(null)
    setCreating(true)
    try {
      const events = form.events.split('\n').map((e) => e.trim()).filter(Boolean)
      const res = await fetch(`${baseUrl}/webhooks`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ url: form.url, events, active: form.active }),
      })
      const data = await res.json() as { secret?: string }
      if (!res.ok) throw new Error()
      setNewSecret(data.secret ?? null)
      load()
    } catch {
      setFormError('Falha ao criar webhook')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggle(id: string, active: boolean) {
    await fetch(`${baseUrl}/webhooks/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ active }),
    })
    load()
  }

  async function handleTest(id: string) {
    await fetch(`${baseUrl}/webhooks/${id}/test`, { method: 'POST', headers: headers() })
    load()
  }

  async function handleDelete(id: string) {
    await fetch(`${baseUrl}/webhooks/${id}`, { method: 'DELETE', headers: headers() })
    load()
  }

  return (
    <div>
      <div style={styles.rowBetween}>
        <h2 style={styles.sectionTitle}>Webhooks</h2>
        <button style={styles.btnPrimary} onClick={() => { setShowModal(true); setNewSecret(null) }}>+ Adicionar Webhook</button>
      </div>

      {loading && <p style={styles.muted}>Carregando…</p>}

      {webhooks.map((wh) => (
        <div key={wh.id} style={styles.webhookCard}>
          <div style={styles.rowBetween}>
            <div>
              <code style={styles.code}>{wh.url}</code>
              <div style={styles.tagRow}>
                {wh.events.map((ev) => <span key={ev} style={styles.tagBadge}>{ev}</span>)}
              </div>
            </div>
            <div style={styles.rowGap}>
              <button style={wh.active ? styles.btnSecondary : styles.btnPrimary} onClick={() => handleToggle(wh.id, !wh.active)}>
                {wh.active ? 'Desativar' : 'Ativar'}
              </button>
              <button style={styles.btnSecondary} onClick={() => handleTest(wh.id)}>Testar</button>
              <button style={styles.btnDanger} onClick={() => handleDelete(wh.id)}>Remover</button>
            </div>
          </div>

          {wh.deliveries.length > 0 && (
            <table style={{ ...styles.table, marginTop: 12 }}>
              <thead>
                <tr>{['Data', 'Evento', 'Status', 'Latência', 'Tentativas'].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {wh.deliveries.map((d) => (
                  <tr key={d.id} style={styles.tr}>
                    <td style={styles.td}>{formatDate(d.created_at)}</td>
                    <td style={styles.td}>{d.event}</td>
                    <td style={{ ...styles.td, color: statusColor(d.status_code) }}>{d.status_code ?? '—'}</td>
                    <td style={styles.td}>{d.latency_ms !== null ? `${d.latency_ms}ms` : '—'}</td>
                    <td style={styles.td}>{d.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {webhooks.length === 0 && !loading && <p style={styles.muted}>Nenhum webhook configurado</p>}

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            {newSecret ? (
              <div>
                <h3 style={styles.modalTitle}>Webhook criado</h3>
                <p style={{ ...styles.muted, marginBottom: 8 }}>
                  ⚠️ Guarde o secret agora — não será exibido novamente. Use-o para verificar a assinatura HMAC-SHA256 em <code>X-Gravity-Signature</code>.
                </p>
                <div style={styles.tokenDisplay}><code style={styles.tokenCode}>{newSecret}</code></div>
                <button style={styles.btnPrimary} onClick={() => { setShowModal(false); setForm({ url: '', events: '', active: true }) }}>Fechar</button>
              </div>
            ) : (
              <div>
                <h3 style={styles.modalTitle}>Novo Webhook</h3>
                {formError && <p style={styles.error}>{formError}</p>}
                <label style={styles.label}>URL destino
                  <input style={styles.input} value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://seu-erp.com/gravity/eventos" />
                </label>
                <label style={styles.label}>Eventos (um por linha)
                  <textarea style={{ ...styles.input, height: 100, resize: 'vertical' }} value={form.events} onChange={(e) => setForm((f) => ({ ...f, events: e.target.value }))} placeholder={'simulacao.criada\ncotacao.aprovada'} />
                </label>
                <label style={{ ...styles.checkLabel, marginBottom: 16 }}>
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                  Ativar imediatamente
                </label>
                <div style={styles.rowGap}>
                  <button style={styles.btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
                  <button style={styles.btnPrimary} onClick={handleCreate} disabled={creating}>
                    {creating ? 'Criando…' : 'Criar webhook'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Consumo ----------------------------------------------------------------

function TabConsumo({ baseUrl, authToken }: { baseUrl: string; authToken?: string }) {
  const [data, setData] = useState<UsageData | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${baseUrl}/usage?days=${days}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then((r) => r.json())
      .then((d) => { setData(d as UsageData); setLoading(false) })
      .catch(() => setLoading(false))
  }, [baseUrl, authToken, days])

  const maxCount = data ? Math.max(...data.by_day.map((d) => d.count), 1) : 1

  return (
    <div>
      <div style={styles.rowBetween}>
        <h2 style={styles.sectionTitle}>Consumo de API</h2>
        <select style={styles.input} value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))}>
          {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}
        </select>
      </div>

      {loading && <p style={styles.muted}>Carregando…</p>}

      {data && (
        <>
          <p style={styles.muted}><strong>{data.total}</strong> requisições nos últimos {data.days} dias</p>

          {/* Gráfico de barras simples */}
          <div style={styles.chartContainer}>
            {data.by_day.map((entry) => (
              <div key={entry.date} style={styles.barWrapper} title={`${entry.date}: ${entry.count} req`}>
                <div
                  style={{
                    ...styles.bar,
                    height: `${Math.round((entry.count / maxCount) * 100)}%`,
                  }}
                />
                <span style={styles.barLabel}>{entry.date.slice(5)}</span>
              </div>
            ))}
          </div>

          <h3 style={styles.subTitle}>Por endpoint</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Endpoint</th>
                <th style={styles.th}>Requisições</th>
                <th style={styles.th}>% do total</th>
              </tr>
            </thead>
            <tbody>
              {data.by_endpoint.map((ep) => (
                <tr key={ep.endpoint} style={styles.tr}>
                  <td style={styles.td}><code style={styles.code}>{ep.endpoint}</code></td>
                  <td style={styles.td}>{ep.count}</td>
                  <td style={styles.td}>{data.total > 0 ? ((ep.count / data.total) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ApiCockpit({ baseUrl, authToken }: ApiCockpitProps) {
  const [activeTab, setActiveTab] = useState<Tab>('docs')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'docs', label: '📄 Documentação' },
    { key: 'tokens', label: '🔑 Tokens' },
    { key: 'playground', label: '🧪 Playground' },
    { key: 'webhooks', label: '🪝 Webhooks' },
    { key: 'usage', label: '📊 Consumo' },
  ]

  return (
    <div style={styles.root}>
      <nav style={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            style={activeTab === tab.key ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div style={styles.content}>
        {activeTab === 'docs' && <TabDocumentacao baseUrl={baseUrl} authToken={authToken} />}
        {activeTab === 'tokens' && <TabTokens baseUrl={baseUrl} authToken={authToken} />}
        {activeTab === 'playground' && <TabPlayground baseUrl={baseUrl} authToken={authToken} />}
        {activeTab === 'webhooks' && <TabWebhooks baseUrl={baseUrl} authToken={authToken} />}
        {activeTab === 'usage' && <TabConsumo baseUrl={baseUrl} authToken={authToken} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Estilos inline — design system Gravity (Solid Slate dark mode)
// ---------------------------------------------------------------------------

type CSSProperties = React.CSSProperties

const styles = {
  root: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    backgroundColor: 'var(--color-bg, #0f172a)',
    color: 'var(--color-text, #e2e8f0)',
    minHeight: '100vh',
    padding: 0,
  } as CSSProperties,

  tabBar: {
    display: 'flex',
    gap: 4,
    padding: '12px 24px 0',
    borderBottom: '1px solid var(--color-border, #1e293b)',
    backgroundColor: 'var(--color-surface, #1e293b)',
  } as CSSProperties,

  tab: {
    padding: '10px 20px',
    background: 'none',
    border: 'none',
    color: 'var(--color-muted, #94a3b8)',
    cursor: 'pointer',
    fontSize: 14,
    borderRadius: '6px 6px 0 0',
  } as CSSProperties,

  tabActive: {
    padding: '10px 20px',
    background: 'var(--color-bg, #0f172a)',
    border: '1px solid var(--color-border, #1e293b)',
    borderBottom: 'none',
    color: 'var(--color-text, #e2e8f0)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: '6px 6px 0 0',
  } as CSSProperties,

  content: {
    padding: 24,
  } as CSSProperties,

  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: '0 0 16px',
  } as CSSProperties,

  subTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: '20px 0 10px',
  } as CSSProperties,

  muted: {
    color: 'var(--color-muted, #94a3b8)',
    fontSize: 13,
    margin: '4px 0',
  } as CSSProperties,

  error: {
    color: '#ef4444',
    fontSize: 13,
    margin: '4px 0 12px',
  } as CSSProperties,

  rowBetween: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  } as CSSProperties,

  rowGap: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  } as CSSProperties,

  btnPrimary: {
    padding: '8px 16px',
    background: 'var(--color-primary, #6366f1)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  } as CSSProperties,

  btnSecondary: {
    padding: '8px 16px',
    background: 'var(--color-surface, #1e293b)',
    color: 'var(--color-text, #e2e8f0)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  } as CSSProperties,

  btnDanger: {
    padding: '8px 16px',
    background: 'transparent',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  } as CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  } as CSSProperties,

  th: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-muted, #94a3b8)',
    borderBottom: '1px solid var(--color-border, #1e293b)',
  } as CSSProperties,

  td: {
    padding: '10px 12px',
    fontSize: 13,
    borderBottom: '1px solid var(--color-border, #1e293b)',
  } as CSSProperties,

  tr: {
    transition: 'background 0.1s',
  } as CSSProperties,

  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: 'var(--color-surface, #1e293b)',
    padding: '2px 6px',
    borderRadius: 4,
  } as CSSProperties,

  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    fontSize: 13,
    color: 'var(--color-muted, #94a3b8)',
    marginBottom: 14,
  } as CSSProperties,

  input: {
    padding: '8px 12px',
    background: 'var(--color-surface, #1e293b)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: 6,
    color: 'var(--color-text, #e2e8f0)',
    fontSize: 13,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  } as CSSProperties,

  checkGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  } as CSSProperties,

  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--color-text, #e2e8f0)',
    cursor: 'pointer',
  } as CSSProperties,

  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as CSSProperties,

  modal: {
    background: 'var(--color-surface, #1e293b)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: 12,
    padding: 32,
    width: 480,
    maxWidth: '90vw',
  } as CSSProperties,

  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: '0 0 20px',
  } as CSSProperties,

  tokenDisplay: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    wordBreak: 'break-all' as const,
  } as CSSProperties,

  tokenCode: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#22c55e',
  } as CSSProperties,

  docPath: {
    marginBottom: 16,
    borderBottom: '1px solid var(--color-border, #1e293b)',
    paddingBottom: 12,
  } as CSSProperties,

  pathLabel: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 600,
    display: 'block',
    marginBottom: 8,
  } as CSSProperties,

  docMethod: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  } as CSSProperties,

  docSummary: {
    fontSize: 13,
  } as CSSProperties,

  methodBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    fontFamily: 'monospace',
    flexShrink: 0,
  } as CSSProperties,

  tagBadge: {
    padding: '2px 8px',
    backgroundColor: 'var(--color-surface, #1e293b)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: 12,
    fontSize: 11,
    color: 'var(--color-muted, #94a3b8)',
  } as CSSProperties,

  tagRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
    marginTop: 6,
  } as CSSProperties,

  playgroundResult: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'var(--color-surface, #1e293b)',
    borderRadius: 8,
    border: '1px solid var(--color-border, #334155)',
  } as CSSProperties,

  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    maxHeight: 300,
    overflowY: 'auto' as const,
  } as CSSProperties,

  historyRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid var(--color-border, #1e293b)',
    fontSize: 13,
  } as CSSProperties,

  webhookCard: {
    backgroundColor: 'var(--color-surface, #1e293b)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  } as CSSProperties,

  chartContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 4,
    height: 140,
    padding: '8px 0',
    borderBottom: '1px solid var(--color-border, #334155)',
    marginBottom: 24,
    overflowX: 'auto' as const,
  } as CSSProperties,

  barWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    minWidth: 20,
    gap: 4,
  } as CSSProperties,

  bar: {
    width: 16,
    backgroundColor: 'var(--color-primary, #6366f1)',
    borderRadius: '3px 3px 0 0',
    minHeight: 2,
    transition: 'height 0.2s',
  } as CSSProperties,

  barLabel: {
    fontSize: 9,
    color: 'var(--color-muted, #94a3b8)',
    writingMode: 'vertical-rl' as const,
    transform: 'rotate(180deg)',
  } as CSSProperties,
}
