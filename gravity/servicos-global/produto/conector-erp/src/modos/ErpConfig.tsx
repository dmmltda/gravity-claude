import React, { useEffect, useState } from 'react'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

type Protocol = 'odata' | 'hana' | 'rest' | 'jdbc'
type SyncFrequency = 'manual' | 'hourly' | 'every6h' | 'daily'
type ConnectionStatus = 'untested' | 'ok' | 'failed'

interface ErpConnectionView {
  id: string
  system_type: string
  protocol: Protocol
  base_url: string
  username: string
  sync_frequency: SyncFrequency
  connection_status: ConnectionStatus
  last_tested_at: string | null
  error_message: string | null
}

interface TestResult {
  ok: boolean
  latency_ms: number
  version?: string
  error?: string
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const configSchema = z.object({
  system_type: z.enum(['SAP', 'TOTVS', 'Oracle', 'custom']),
  protocol: z.enum(['odata', 'hana', 'rest', 'jdbc']),
  base_url: z.string().url('URL de base inválida'),
  username: z.string().min(1, 'Usuário obrigatório'),
  password: z.string().min(1, 'Senha obrigatória'),
  sync_frequency: z.enum(['manual', 'hourly', 'every6h', 'daily']),
})

type ConfigFormData = z.infer<typeof configSchema>
type FieldErrors = Partial<Record<keyof ConfigFormData, string>>

// ─── Props ────────────────────────────────────────────────────────────────────

interface ErpConfigProps {
  productId: string
  apiBase: string // e.g. '/api/v1/erp'
  authToken: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ErpConfig({ productId, apiBase, authToken }: ErpConfigProps): React.ReactElement {
  const [existing, setExisting] = useState<ErpConnectionView | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Partial<ConfigFormData>>({
    protocol: 'odata',
    sync_frequency: 'manual',
    system_type: 'SAP',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
  }

  useEffect(() => {
    void fetchConnection()
  }, [productId])

  async function fetchConnection(): Promise<void> {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/connections?product_id=${productId}`, { headers })
      if (res.ok) {
        const data = (await res.json()) as ErpConnectionView | null
        setExisting(data)
        if (data) {
          setValues({
            system_type: data.system_type as ConfigFormData['system_type'],
            protocol: data.protocol,
            base_url: data.base_url,
            username: data.username,
            sync_frequency: data.sync_frequency,
          })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  function handleChange(field: keyof ConfigFormData, value: string): void {
    setValues((prev) => ({ ...prev, [field]: value }))
    const result = configSchema.safeParse({ ...values, [field]: value })
    if (!result.success) {
      const fieldError = result.error.flatten().fieldErrors[field]
      setErrors((prev) => ({ ...prev, [field]: fieldError?.[0] }))
    } else {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSave(): Promise<void> {
    const result = configSchema.safeParse(values)
    if (!result.success) {
      const allErrors = result.error.flatten().fieldErrors
      const mapped: FieldErrors = {}
      for (const [key, msgs] of Object.entries(allErrors)) {
        mapped[key as keyof ConfigFormData] = msgs?.[0]
      }
      setErrors(mapped)
      return
    }

    setSaving(true)
    try {
      const payload = { ...result.data, product_id: productId }

      const res = existing
        ? await fetch(`${apiBase}/connections/${existing.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload),
          })
        : await fetch(`${apiBase}/connections`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          })

      if (res.ok) {
        await fetchConnection()
        setEditing(false)
        setTestResult(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(): Promise<void> {
    if (!existing) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${apiBase}/connections/${existing.id}/test`, {
        method: 'POST',
        headers,
      })
      if (res.ok) {
        const data = (await res.json()) as TestResult
        setTestResult(data)
        await fetchConnection()
      }
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!existing) return
    if (!confirm('Tem certeza? A conexão e todas as credenciais serão removidas.')) return

    const res = await fetch(`${apiBase}/connections/${existing.id}`, {
      method: 'DELETE',
      headers,
    })
    if (res.ok) {
      setExisting(null)
      setEditing(true)
      setValues({ protocol: 'odata', sync_frequency: 'manual', system_type: 'SAP' })
    }
  }

  if (loading) return <div style={styles.loading}>Carregando configuração...</div>

  return (
    <div style={styles.container}>
      {/* Status banner */}
      {existing && !editing && (
        <StatusBanner
          conn={existing}
          testResult={testResult}
          onTest={handleTest}
          onEdit={() => setEditing(true)}
          onDelete={handleDelete}
          testing={testing}
        />
      )}

      {/* Form */}
      {(editing || !existing) && (
        <ConfigForm
          values={values}
          errors={errors}
          isUpdate={!!existing}
          saving={saving}
          onChange={handleChange}
          onSave={handleSave}
          onCancel={existing ? () => setEditing(false) : undefined}
        />
      )}

      {/* Test result inline */}
      {testResult && (
        <TestResultBanner result={testResult} />
      )}

      {/* Protocol info */}
      <ProtocolInfo protocol={(values.protocol ?? 'odata') as Protocol} />
    </div>
  )
}

// ─── Status Banner ────────────────────────────────────────────────────────────

interface StatusBannerProps {
  conn: ErpConnectionView
  testResult: TestResult | null
  onTest: () => void
  onEdit: () => void
  onDelete: () => void
  testing: boolean
}

function StatusBanner({ conn, onTest, onEdit, onDelete, testing }: StatusBannerProps): React.ReactElement {
  const statusColor: Record<ConnectionStatus, string> = {
    ok: 'var(--color-success, #34d399)',
    failed: 'var(--color-error, #ef4444)',
    untested: 'var(--color-text-muted, #64748b)',
  }
  const statusLabel: Record<ConnectionStatus, string> = {
    ok: 'Conectado',
    failed: 'Falha',
    untested: 'Não testado',
  }

  return (
    <div style={styles.statusBanner}>
      <div style={styles.statusLeft}>
        <span style={{ ...styles.statusDot, background: statusColor[conn.connection_status] }} />
        <div>
          <p style={styles.statusTitle}>
            {conn.system_type} via {conn.protocol.toUpperCase()} — {statusLabel[conn.connection_status]}
          </p>
          <p style={styles.statusMeta}>
            {conn.base_url} · Usuário: {conn.username}
          </p>
          {conn.last_tested_at && (
            <p style={styles.statusMeta}>
              Último teste: {new Date(conn.last_tested_at).toLocaleString('pt-BR')}
            </p>
          )}
          {conn.error_message && (
            <p style={styles.errorText}>{conn.error_message}</p>
          )}
        </div>
      </div>
      <div style={styles.statusActions}>
        <button style={styles.testButton} onClick={onTest} disabled={testing}>
          {testing ? 'Testando...' : 'Testar conexão'}
        </button>
        <button style={styles.editButton} onClick={onEdit}>Editar</button>
        <button style={styles.deleteButton} onClick={onDelete}>Remover</button>
      </div>
    </div>
  )
}

// ─── Config Form ──────────────────────────────────────────────────────────────

interface ConfigFormProps {
  values: Partial<ConfigFormData>
  errors: FieldErrors
  isUpdate: boolean
  saving: boolean
  onChange: (field: keyof ConfigFormData, value: string) => void
  onSave: () => void
  onCancel?: () => void
}

function ConfigForm({
  values, errors, isUpdate, saving, onChange, onSave, onCancel,
}: ConfigFormProps): React.ReactElement {
  return (
    <div style={styles.form}>
      <h3 style={styles.formTitle}>
        {isUpdate ? 'Atualizar conexão ERP' : 'Configurar conexão ERP'}
      </h3>

      <div style={styles.grid}>
        <FormField label="Sistema *" error={errors.system_type}>
          <select style={styles.select} value={values.system_type ?? 'SAP'} onChange={(e) => onChange('system_type', e.target.value)}>
            <option value="SAP">SAP</option>
            <option value="TOTVS">TOTVS</option>
            <option value="Oracle">Oracle</option>
            <option value="custom">Personalizado</option>
          </select>
        </FormField>

        <FormField label="Protocolo *" error={errors.protocol}>
          <select style={styles.select} value={values.protocol ?? 'odata'} onChange={(e) => onChange('protocol', e.target.value)}>
            <option value="odata">OData (padrão SAP)</option>
            <option value="hana">SAP HANA direto</option>
            <option value="rest">REST genérico</option>
            <option value="jdbc">JDBC/ODBC legado</option>
          </select>
        </FormField>

        <FormField label="Frequência de sync" error={errors.sync_frequency}>
          <select style={styles.select} value={values.sync_frequency ?? 'manual'} onChange={(e) => onChange('sync_frequency', e.target.value)}>
            <option value="manual">Manual</option>
            <option value="hourly">A cada hora</option>
            <option value="every6h">A cada 6 horas</option>
            <option value="daily">Diário</option>
          </select>
        </FormField>

        <FormField label="URL de base *" hint="Ex: https://sap.empresa.com/sap/opu/odata/sap" error={errors.base_url} fullWidth>
          <input
            style={inputStyle(!!errors.base_url)}
            value={values.base_url ?? ''}
            onChange={(e) => onChange('base_url', e.target.value)}
            placeholder="https://sap.empresa.com/sap/opu/odata/sap"
          />
        </FormField>

        <FormField label="Usuário SAP *" error={errors.username}>
          <input
            style={inputStyle(!!errors.username)}
            value={values.username ?? ''}
            onChange={(e) => onChange('username', e.target.value)}
            placeholder="BPINST"
            autoComplete="username"
          />
        </FormField>

        <FormField label={isUpdate ? 'Nova senha (deixe em branco para manter)' : 'Senha SAP *'} error={errors.password}>
          <input
            style={inputStyle(!!errors.password)}
            type="password"
            value={values.password ?? ''}
            onChange={(e) => onChange('password', e.target.value)}
            autoComplete="new-password"
          />
        </FormField>
      </div>

      <p style={styles.securityNote}>
        🔒 A senha é criptografada com AES-256-GCM antes de ser armazenada. Nunca é exibida ou registrada em logs.
      </p>

      <div style={styles.formActions}>
        {onCancel && (
          <button style={styles.secondaryButton} onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        )}
        <button style={styles.primaryButton} onClick={onSave} disabled={saving}>
          {saving ? 'Salvando...' : isUpdate ? 'Atualizar conexão' : 'Salvar conexão'}
        </button>
      </div>
    </div>
  )
}

// ─── Test Result Banner ────────────────────────────────────────────────────────

function TestResultBanner({ result }: { result: TestResult }): React.ReactElement {
  return (
    <div style={{ ...styles.testResultBanner, background: result.ok ? 'var(--color-success-bg, #064e3b)' : 'var(--color-error-bg, #450a0a)' }}>
      <span style={{ color: result.ok ? 'var(--color-success, #34d399)' : 'var(--color-error, #ef4444)' }}>
        {result.ok ? '✓ Conexão bem-sucedida' : '✗ Falha na conexão'}
      </span>
      <span style={styles.testMeta}>Latência: {result.latency_ms}ms</span>
      {result.version && <span style={styles.testMeta}>Versão SAP: {result.version}</span>}
      {result.error && <span style={styles.errorText}>{result.error}</span>}
    </div>
  )
}

// ─── Protocol Info ────────────────────────────────────────────────────────────

const PROTOCOL_INFO: Record<Protocol, { title: string; description: string }> = {
  odata: {
    title: 'OData — Padrão SAP',
    description:
      'Recomendado para S/4HANA e ECC. Nenhuma instalação necessária no servidor SAP — já exposto nativamente. Alta compatibilidade e velocidade.',
  },
  hana: {
    title: 'SAP HANA direto',
    description:
      'Conexão direta via driver hdb. Velocidade máxima para queries analíticas. Requer porta 30015 liberada e usuário com permissão SELECT.',
  },
  rest: {
    title: 'REST genérico',
    description:
      'Para ERPs com API REST própria (TOTVS Fluig, Oracle Fusion, etc.). Configure a URL base da API.',
  },
  jdbc: {
    title: 'JDBC/ODBC legado',
    description:
      'Para sistemas legados com banco relacional exposto. Use apenas quando OData e REST não estiverem disponíveis.',
  },
}

function ProtocolInfo({ protocol }: { protocol: Protocol }): React.ReactElement {
  const info = PROTOCOL_INFO[protocol]
  return (
    <div style={styles.protocolInfo}>
      <strong style={styles.protocolTitle}>{info.title}</strong>
      <p style={styles.protocolDesc}>{info.description}</p>
    </div>
  )
}

// ─── Field ────────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string
  hint?: string
  error?: string
  fullWidth?: boolean
  children: React.ReactNode
}

function FormField({ label, hint, error, fullWidth = false, children }: FormFieldProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <label style={styles.label}>{label}</label>
      {hint && <span style={styles.hint}>{hint}</span>}
      {children}
      {error && <span style={styles.errorText}>{error}</span>}
    </div>
  )
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 0.75rem',
    background: 'var(--color-surface-2, #1e293b)',
    border: `1px solid ${hasError ? 'var(--color-error, #ef4444)' : 'var(--color-border, #334155)'}`,
    borderRadius: '6px',
    color: 'var(--color-text, #f1f5f9)',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: { display: 'flex', flexDirection: 'column' as const, gap: '1.25rem' },
  loading: { color: 'var(--color-text-muted, #64748b)', fontSize: '0.875rem', padding: '1rem' },
  statusBanner: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '1rem', background: 'var(--color-surface-2, #1e293b)', borderRadius: '8px',
    border: '1px solid var(--color-border, #334155)',
  },
  statusLeft: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem' },
  statusDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  statusTitle: { margin: '0 0 0.25rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text, #f1f5f9)' },
  statusMeta: { margin: '0', fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' },
  statusActions: { display: 'flex', gap: '0.5rem', flexShrink: 0 },
  testButton: {
    padding: '0.375rem 0.875rem', background: 'var(--color-primary, #3b82f6)', color: '#fff',
    border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
  },
  editButton: {
    padding: '0.375rem 0.75rem', background: 'transparent', border: '1px solid var(--color-border, #334155)',
    borderRadius: '6px', color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.8rem', cursor: 'pointer',
  },
  deleteButton: {
    padding: '0.375rem 0.75rem', background: 'transparent', border: '1px solid var(--color-error, #ef4444)',
    borderRadius: '6px', color: 'var(--color-error, #ef4444)', fontSize: '0.8rem', cursor: 'pointer',
  },
  form: {
    padding: '1.25rem', background: 'var(--color-surface-2, #1e293b)', borderRadius: '8px',
    border: '1px solid var(--color-border, #334155)',
  },
  formTitle: { margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text, #f1f5f9)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' },
  select: {
    padding: '0.5rem 0.75rem', background: 'var(--color-surface-2, #1e293b)',
    border: '1px solid var(--color-border, #334155)', borderRadius: '6px',
    color: 'var(--color-text, #f1f5f9)', fontSize: '0.875rem', width: '100%',
  },
  label: {
    fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  },
  hint: { fontSize: '0.7rem', color: 'var(--color-text-muted, #64748b)' },
  errorText: { color: 'var(--color-error, #ef4444)', fontSize: '0.75rem' },
  securityNote: {
    fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)',
    padding: '0.75rem', background: 'var(--color-surface-3, #0f172a)',
    borderRadius: '6px', margin: '1rem 0 0',
  },
  formActions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' },
  primaryButton: {
    padding: '0.625rem 1.5rem', background: 'var(--color-primary, #3b82f6)', color: '#fff',
    border: 'none', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
  secondaryButton: {
    padding: '0.625rem 1rem', background: 'transparent', border: '1px solid var(--color-border, #334155)',
    borderRadius: '6px', color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.875rem', cursor: 'pointer',
  },
  testResultBanner: {
    display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem',
    borderRadius: '8px', fontSize: '0.875rem', flexWrap: 'wrap' as const,
  },
  testMeta: { color: 'var(--color-text-muted, #64748b)', fontSize: '0.8rem' },
  protocolInfo: {
    padding: '0.75rem 1rem', background: 'var(--color-surface-3, #0f172a)',
    borderRadius: '6px', border: '1px solid var(--color-border, #334155)',
  },
  protocolTitle: { fontSize: '0.8rem', color: 'var(--color-text-secondary, #94a3b8)' },
  protocolDesc: { margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.5 },
} satisfies Record<string, React.CSSProperties>
