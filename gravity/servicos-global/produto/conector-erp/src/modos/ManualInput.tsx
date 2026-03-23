import React, { useState } from 'react'
import { z } from 'zod'

// ─── Schema ──────────────────────────────────────────────────────────────────

const manualInputSchema = z.object({
  ncm: z
    .string()
    .length(8, 'NCM deve ter exatamente 8 dígitos')
    .regex(/^\d{8}$/, 'NCM deve conter apenas números'),
  descricao: z.string().min(3, 'Descrição obrigatória').max(500),
  quantidade: z.coerce.number().positive('Quantidade deve ser positiva'),
  unidade: z.string().min(1, 'Unidade obrigatória').max(10),
  pais_origem: z
    .string()
    .length(2, 'Código de país deve ter 2 letras (ISO 3166-1 alpha-2)')
    .regex(/^[A-Z]{2}$/, 'Use código ISO 3166-1 alpha-2 (ex: CN, US, DE)'),
  valor_usd: z.coerce.number().positive('Valor deve ser positivo'),
  data_embarque: z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data no formato DD/MM/AAAA'),
  numero_di: z.string().optional(),
  numero_li: z.string().optional(),
})

type ManualInputData = z.infer<typeof manualInputSchema>
type FieldErrors = Partial<Record<keyof ManualInputData, string>>

// ─── Props ────────────────────────────────────────────────────────────────────

interface ManualInputProps {
  productId: string
  onSubmit: (data: ManualInputData) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ManualInput({ productId: _productId, onSubmit }: ManualInputProps): React.ReactElement {
  const [values, setValues] = useState<Partial<ManualInputData>>({})
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function validateField(field: keyof ManualInputData, value: string): string | undefined {
    const partial = { ...values, [field]: value }
    const result = manualInputSchema.safeParse(partial)
    if (!result.success) {
      const fieldError = result.error.flatten().fieldErrors[field]
      return fieldError?.[0]
    }
    return undefined
  }

  function handleChange(field: keyof ManualInputData, value: string): void {
    setValues((prev) => ({ ...prev, [field]: value }))
    const error = validateField(field, value)
    setErrors((prev) => ({ ...prev, [field]: error }))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()

    const result = manualInputSchema.safeParse(values)
    if (!result.success) {
      const allErrors = result.error.flatten().fieldErrors
      const mapped: FieldErrors = {}
      for (const [key, msgs] of Object.entries(allErrors)) {
        mapped[key as keyof ManualInputData] = msgs?.[0]
      }
      setErrors(mapped)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(result.data)
      setSubmitted(true)
      setValues({})
      setErrors({})
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={styles.successBanner}>
        <span style={styles.successIcon}>✓</span>
        Dados importados com sucesso.{' '}
        <button style={styles.linkButton} onClick={() => setSubmitted(false)}>
          Adicionar outro
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form} noValidate>
      <div style={styles.grid}>
        <Field
          label="NCM *"
          hint="8 dígitos sem pontos — ex: 84833000"
          error={errors.ncm}
        >
          <input
            style={inputStyle(!!errors.ncm)}
            value={values.ncm ?? ''}
            onChange={(e) => handleChange('ncm', e.target.value)}
            maxLength={8}
            placeholder="84833000"
            inputMode="numeric"
          />
        </Field>

        <Field label="País de Origem *" hint="Código ISO 3166-1 alpha-2 — ex: CN, US" error={errors.pais_origem}>
          <input
            style={inputStyle(!!errors.pais_origem)}
            value={values.pais_origem ?? ''}
            onChange={(e) => handleChange('pais_origem', e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="CN"
          />
        </Field>

        <Field label="Quantidade *" error={errors.quantidade} fullWidth={false}>
          <input
            style={inputStyle(!!errors.quantidade)}
            type="number"
            step="0.001"
            min="0"
            value={values.quantidade ?? ''}
            onChange={(e) => handleChange('quantidade', e.target.value)}
            placeholder="1000"
          />
        </Field>

        <Field label="Unidade *" hint="ex: KG, UN, M2" error={errors.unidade}>
          <input
            style={inputStyle(!!errors.unidade)}
            value={values.unidade ?? ''}
            onChange={(e) => handleChange('unidade', e.target.value.toUpperCase())}
            maxLength={10}
            placeholder="KG"
          />
        </Field>

        <Field label="Valor USD *" error={errors.valor_usd}>
          <input
            style={inputStyle(!!errors.valor_usd)}
            type="number"
            step="0.01"
            min="0"
            value={values.valor_usd ?? ''}
            onChange={(e) => handleChange('valor_usd', e.target.value)}
            placeholder="5000.00"
          />
        </Field>

        <Field label="Data de Embarque *" hint="DD/MM/AAAA" error={errors.data_embarque}>
          <input
            style={inputStyle(!!errors.data_embarque)}
            value={values.data_embarque ?? ''}
            onChange={(e) => handleChange('data_embarque', e.target.value)}
            placeholder="01/03/2026"
            maxLength={10}
          />
        </Field>

        <Field label="Descrição *" error={errors.descricao} fullWidth>
          <input
            style={inputStyle(!!errors.descricao)}
            value={values.descricao ?? ''}
            onChange={(e) => handleChange('descricao', e.target.value)}
            maxLength={500}
            placeholder="Rolamento de esferas de aço inoxidável"
          />
        </Field>

        <Field label="N° DI" hint="Opcional — Declaração de Importação" error={errors.numero_di}>
          <input
            style={inputStyle(!!errors.numero_di)}
            value={values.numero_di ?? ''}
            onChange={(e) => handleChange('numero_di', e.target.value)}
            placeholder="26/1234567-8"
          />
        </Field>

        <Field label="N° LI" hint="Opcional — Licença de Importação" error={errors.numero_li}>
          <input
            style={inputStyle(!!errors.numero_li)}
            value={values.numero_li ?? ''}
            onChange={(e) => handleChange('numero_li', e.target.value)}
            placeholder="26BR000001234"
          />
        </Field>
      </div>

      <div style={styles.footer}>
        <button type="submit" style={styles.submitButton} disabled={submitting}>
          {submitting ? 'Importando...' : 'Importar dados'}
        </button>
      </div>
    </form>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  hint?: string
  error?: string
  fullWidth?: boolean
  children: React.ReactNode
}

function Field({ label, hint, error, fullWidth = false, children }: FieldProps): React.ReactElement {
  return (
    <div style={{ ...styles.field, gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <label style={styles.label}>{label}</label>
      {hint && <span style={styles.hint}>{hint}</span>}
      {children}
      {error && <span style={styles.errorText}>{error}</span>}
    </div>
  )
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    ...styles.input,
    borderColor: hasError ? 'var(--color-error, #ef4444)' : 'var(--color-border, #334155)',
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary, #94a3b8)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  hint: {
    fontSize: '0.7rem',
    color: 'var(--color-text-muted, #64748b)',
  },
  input: {
    padding: '0.5rem 0.75rem',
    background: 'var(--color-surface-2, #1e293b)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: '6px',
    color: 'var(--color-text, #f1f5f9)',
    fontSize: '0.875rem',
    outline: 'none',
    transition: 'border-color 0.15s',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  errorText: {
    fontSize: '0.7rem',
    color: 'var(--color-error, #ef4444)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  submitButton: {
    padding: '0.625rem 1.5rem',
    background: 'var(--color-primary, #3b82f6)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  successBanner: {
    padding: '1rem',
    background: 'var(--color-success-bg, #064e3b)',
    color: 'var(--color-success, #34d399)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
  },
  successIcon: {
    fontWeight: 700,
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: 'var(--color-success, #34d399)',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: 'inherit',
    padding: 0,
  },
} satisfies Record<string, React.CSSProperties>

export type { ManualInputData }
