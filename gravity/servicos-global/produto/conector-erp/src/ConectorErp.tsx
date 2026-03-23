import React, { useState } from 'react'
import { ManualInput } from './modos/ManualInput.js'
import { PlanilhaUpload } from './modos/PlanilhaUpload.js'
import { ErpConfig } from './modos/ErpConfig.js'
import type { ManualInputData } from './modos/ManualInput.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'manual' | 'planilha' | 'erp'

interface ConectorErpProps {
  productId: string
  apiBase?: string
  authToken: string
  onManualSubmit?: (data: ManualInputData) => Promise<void>
  onPlanilhaImport?: (rows: Record<string, string>[]) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConectorErp({
  productId,
  apiBase = '/api/v1/erp',
  authToken,
  onManualSubmit,
  onPlanilhaImport,
}: ConectorErpProps): React.ReactElement {
  const [mode, setMode] = useState<Mode>('manual')

  const headers: { Authorization: string; 'Content-Type': string } = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  }

  async function defaultManualSubmit(data: ManualInputData): Promise<void> {
    const res = await fetch(`${apiBase}/import/manual`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ product_id: productId, ...data }),
    })
    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } }
      throw new Error(err.error?.message ?? 'Erro ao importar dados')
    }
  }

  async function defaultPlanilhaImport(rows: Record<string, string>[]): Promise<void> {
    const res = await fetch(`${apiBase}/import/planilha`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ product_id: productId, rows }),
    })
    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } }
      throw new Error(err.error?.message ?? 'Erro ao importar planilha')
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Entrada de Dados</h2>
        <p style={styles.subtitle}>
          Escolha como importar os dados para o produto
        </p>
      </div>

      <ModeSelector current={mode} onChange={setMode} />

      <div style={styles.content}>
        {mode === 'manual' && (
          <ManualInput
            productId={productId}
            onSubmit={onManualSubmit ?? defaultManualSubmit}
          />
        )}

        {mode === 'planilha' && (
          <PlanilhaUpload
            productId={productId}
            onImport={onPlanilhaImport ?? defaultPlanilhaImport}
          />
        )}

        {mode === 'erp' && (
          <ErpConfig
            productId={productId}
            apiBase={apiBase}
            authToken={authToken}
          />
        )}
      </div>
    </div>
  )
}

// ─── Mode Selector ────────────────────────────────────────────────────────────

const MODES: { key: Mode; label: string; icon: string; description: string }[] = [
  {
    key: 'manual',
    label: 'Manual',
    icon: '✏️',
    description: 'Digite os dados diretamente',
  },
  {
    key: 'planilha',
    label: 'Planilha',
    icon: '📊',
    description: 'CSV, Excel ou ODS em lote',
  },
  {
    key: 'erp',
    label: 'ERP / SAP',
    icon: '🔌',
    description: 'Conexão direta em tempo real',
  },
]

interface ModeSelectorProps {
  current: Mode
  onChange: (mode: Mode) => void
}

function ModeSelector({ current, onChange }: ModeSelectorProps): React.ReactElement {
  return (
    <div style={styles.modeSelector}>
      {MODES.map((m) => (
        <button
          key={m.key}
          style={{
            ...styles.modeButton,
            ...(current === m.key ? styles.modeButtonActive : {}),
          }}
          onClick={() => onChange(m.key)}
        >
          <span style={styles.modeIcon}>{m.icon}</span>
          <div style={styles.modeTextGroup}>
            <span style={styles.modeLabel}>{m.label}</span>
            <span style={styles.modeDesc}>{m.description}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
    padding: '1.5rem',
    background: 'var(--color-surface, #0f172a)',
    borderRadius: '12px',
    border: '1px solid var(--color-border, #334155)',
    minHeight: 400,
  },
  header: {
    borderBottom: '1px solid var(--color-border, #334155)',
    paddingBottom: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 700,
    color: 'var(--color-text, #f1f5f9)',
  },
  subtitle: {
    margin: '0.25rem 0 0',
    fontSize: '0.8rem',
    color: 'var(--color-text-muted, #64748b)',
  },
  modeSelector: {
    display: 'flex',
    gap: '0.75rem',
  },
  modeButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    background: 'var(--color-surface-2, #1e293b)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'border-color 0.15s, background 0.15s',
  },
  modeButtonActive: {
    borderColor: 'var(--color-primary, #3b82f6)',
    background: 'rgba(59, 130, 246, 0.08)',
  },
  modeIcon: {
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  modeTextGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.125rem',
  },
  modeLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--color-text, #f1f5f9)',
  },
  modeDesc: {
    fontSize: '0.7rem',
    color: 'var(--color-text-muted, #64748b)',
  },
  content: {
    flex: 1,
  },
} satisfies Record<string, React.CSSProperties>
