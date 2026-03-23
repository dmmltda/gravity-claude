import React, { useCallback, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  lineNumber: number
  data: Record<string, string>
  errors: string[]
}

interface ValidationResult {
  score: number
  validRows: ParsedRow[]
  invalidRows: ParsedRow[]
  total: number
}

interface ColumnMapping {
  fileColumn: string
  targetField: string
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 50
const MAX_ROWS = 100_000

const REQUIRED_FIELDS = [
  { key: 'ncm', label: 'NCM' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'quantidade', label: 'Quantidade' },
  { key: 'unidade', label: 'Unidade' },
  { key: 'pais_origem', label: 'País Origem' },
  { key: 'valor_usd', label: 'Valor USD' },
  { key: 'data_embarque', label: 'Data Embarque' },
]

const ACCEPTED_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
]

// ─── CSV parser (minimal, for preview) ───────────────────────────────────────

function parseCSV(text: string): string[][] {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')))
}

function validateRow(row: Record<string, string>, lineNumber: number): ParsedRow {
  const errors: string[] = []

  const ncm = row['ncm'] ?? ''
  if (!/^\d{8}$/.test(ncm)) {
    errors.push(`NCM inválido — "${ncm}" deve ter 8 dígitos sem ponto`)
  }

  const pais = row['pais_origem'] ?? ''
  if (!/^[A-Z]{2}$/.test(pais.toUpperCase())) {
    errors.push(`País de origem "${pais}" deve ser código ISO 2 letras (ex: CN, US)`)
  }

  const data = row['data_embarque'] ?? ''
  if (data && !/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    errors.push(`Data fora do formato — use DD/MM/AAAA`)
  }

  const qtd = parseFloat(row['quantidade'] ?? '')
  if (isNaN(qtd) || qtd <= 0) {
    errors.push(`Quantidade deve ser número positivo`)
  }

  return { lineNumber, data: row, errors }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlanilhaUploadProps {
  productId: string
  onImport: (rows: Record<string, string>[]) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlanilhaUpload({ productId: _productId, onImport }: PlanilhaUploadProps): React.ReactElement {
  const [step, setStep] = useState<WizardStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [importOnlyValid, setImportOnlyValid] = useState(true)
  const [importProgress, setImportProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)

  // ── Step 1: Upload ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((selected: File) => {
    setFileError(null)

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setFileError('Formato não suportado. Use CSV, XLSX, XLS ou ODS.')
      return
    }

    const sizeMB = selected.size / (1024 * 1024)
    if (sizeMB > MAX_FILE_SIZE_MB) {
      setFileError(`Arquivo muito grande (${sizeMB.toFixed(1)}MB). Máximo: ${MAX_FILE_SIZE_MB}MB.`)
      return
    }

    setFile(selected)

    // CSV preview parse
    if (selected.type === 'text/csv') {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result
        if (typeof text !== 'string') return

        const rows = parseCSV(text)
        if (rows.length < 2) {
          setFileError('Arquivo CSV vazio ou com apenas cabeçalho.')
          return
        }

        if (rows.length - 1 > MAX_ROWS) {
          setFileError(`Arquivo tem ${rows.length - 1} linhas. Máximo: ${MAX_ROWS.toLocaleString()}.`)
          return
        }

        const fileHeaders = rows[0] ?? []
        setHeaders(fileHeaders)

        const dataRows = rows.slice(1).map((row) => {
          const obj: Record<string, string> = {}
          fileHeaders.forEach((h, i) => { obj[h] = row[i] ?? '' })
          return obj
        })
        setRawRows(dataRows)

        // Auto-map: match header name to field key (case-insensitive)
        const autoMapped = REQUIRED_FIELDS.map((field) => {
          const match = fileHeaders.find(
            (h) => h.toLowerCase().replace(/[\s_-]/g, '') === field.key.replace(/_/g, ''),
          )
          return { fileColumn: match ?? '', targetField: field.key }
        })
        setMappings(autoMapped)
        setStep('mapping')
      }
      reader.readAsText(selected)
    } else {
      // For XLSX/ODS, we'd need a library — show instruction
      setStep('mapping')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const dropped = e.dataTransfer.files[0]
      if (dropped) handleFileSelect(dropped)
    },
    [handleFileSelect],
  )

  // ── Step 2: Mapping ─────────────────────────────────────────────────────────

  function updateMapping(fieldKey: string, fileColumn: string): void {
    setMappings((prev) =>
      prev.map((m) => (m.targetField === fieldKey ? { ...m, fileColumn } : m)),
    )
  }

  function applyMappingAndValidate(): void {
    const mapped = rawRows.map((row) => {
      const remapped: Record<string, string> = {}
      mappings.forEach(({ fileColumn, targetField }) => {
        remapped[targetField] = row[fileColumn] ?? ''
      })
      return remapped
    })

    const validated = mapped.map((row, i) => validateRow(row, i + 2))
    const validRows = validated.filter((r) => r.errors.length === 0)
    const invalidRows = validated.filter((r) => r.errors.length > 0)
    const score = Math.round((validRows.length / validated.length) * 100)

    setValidation({ score, validRows, invalidRows, total: validated.length })
    setStep('preview')
  }

  // ── Step 3: Preview ─────────────────────────────────────────────────────────

  async function startImport(): Promise<void> {
    if (!validation) return
    const rows = importOnlyValid
      ? validation.validRows.map((r) => r.data)
      : [...validation.validRows, ...validation.invalidRows].map((r) => r.data)

    setStep('importing')
    setImportProgress(0)

    // Simulate progress during import
    const progressInterval = setInterval(() => {
      setImportProgress((p) => Math.min(p + 5, 90))
    }, 200)

    try {
      await onImport(rows)
      clearInterval(progressInterval)
      setImportProgress(100)
      setImportedCount(rows.length)
      setStep('done')
    } catch {
      clearInterval(progressInterval)
      setStep('preview')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      <StepIndicator current={step} />

      {step === 'upload' && (
        <UploadZone
          onSelect={handleFileSelect}
          onDrop={handleDrop}
          file={file}
          error={fileError}
        />
      )}

      {step === 'mapping' && (
        <MappingStep
          headers={headers}
          mappings={mappings}
          onUpdate={updateMapping}
          onNext={applyMappingAndValidate}
          onBack={() => setStep('upload')}
        />
      )}

      {step === 'preview' && validation && (
        <PreviewStep
          validation={validation}
          importOnlyValid={importOnlyValid}
          onToggleMode={setImportOnlyValid}
          onImport={startImport}
          onBack={() => setStep('mapping')}
        />
      )}

      {step === 'importing' && (
        <div style={styles.centered}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${importProgress}%` }} />
          </div>
          <p style={styles.progressText}>Importando... {importProgress}%</p>
        </div>
      )}

      {step === 'done' && (
        <div style={styles.successContainer}>
          <span style={styles.successIcon}>✓</span>
          <h3 style={styles.successTitle}>{importedCount} linhas importadas com sucesso</h3>
          <button style={styles.resetButton} onClick={() => { setStep('upload'); setFile(null); setValidation(null) }}>
            Importar nova planilha
          </button>
        </div>
      )}

      <DownloadTemplates />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: WizardStep }): React.ReactElement {
  const steps: { key: WizardStep; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'mapping', label: 'Mapeamento' },
    { key: 'preview', label: 'Revisão' },
    { key: 'importing', label: 'Importar' },
  ]
  const order: WizardStep[] = ['upload', 'mapping', 'preview', 'importing', 'done']
  const currentIdx = order.indexOf(current)

  return (
    <div style={styles.stepIndicator}>
      {steps.map((s, i) => {
        const done = order.indexOf(s.key) < currentIdx
        const active = s.key === current
        return (
          <React.Fragment key={s.key}>
            <div style={{ ...styles.stepDot, ...(done ? styles.stepDone : active ? styles.stepActive : {}) }}>
              {done ? '✓' : i + 1}
            </div>
            <span style={{ ...styles.stepLabel, ...(active ? styles.stepLabelActive : {}) }}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div style={styles.stepLine} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

interface UploadZoneProps {
  onSelect: (file: File) => void
  onDrop: (e: React.DragEvent) => void
  file: File | null
  error: string | null
}

function UploadZone({ onSelect, onDrop, file, error }: UploadZoneProps): React.ReactElement {
  return (
    <div>
      <div
        style={styles.dropzone}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.ods"
          style={styles.hiddenInput}
          id="planilha-upload"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelect(f) }}
        />
        <label htmlFor="planilha-upload" style={styles.dropzoneLabel}>
          {file ? (
            <>
              <span style={styles.fileIcon}>📄</span>
              <strong>{file.name}</strong>
              <span style={styles.fileMeta}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </>
          ) : (
            <>
              <span style={styles.uploadIcon}>⬆</span>
              <span>Arraste o arquivo aqui ou clique para selecionar</span>
              <span style={styles.fileFormats}>CSV, XLSX, XLS, ODS — Máx. 50MB / 100.000 linhas</span>
            </>
          )}
        </label>
      </div>
      {error && <p style={styles.errorText}>{error}</p>}
    </div>
  )
}

interface MappingStepProps {
  headers: string[]
  mappings: ColumnMapping[]
  onUpdate: (field: string, column: string) => void
  onNext: () => void
  onBack: () => void
}

function MappingStep({ headers, mappings, onUpdate, onNext, onBack }: MappingStepProps): React.ReactElement {
  return (
    <div>
      <h3 style={styles.sectionTitle}>Mapeamento de colunas</h3>
      <table style={styles.mappingTable}>
        <thead>
          <tr>
            <th style={styles.th}>Campo obrigatório</th>
            <th style={styles.th}>Coluna do arquivo</th>
          </tr>
        </thead>
        <tbody>
          {REQUIRED_FIELDS.map((field) => {
            const mapping = mappings.find((m) => m.targetField === field.key)
            return (
              <tr key={field.key}>
                <td style={styles.td}>{field.label}</td>
                <td style={styles.td}>
                  <select
                    style={styles.select}
                    value={mapping?.fileColumn ?? ''}
                    onChange={(e) => onUpdate(field.key, e.target.value)}
                  >
                    <option value="">— selecione —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={styles.buttonRow}>
        <button style={styles.secondaryButton} onClick={onBack}>Voltar</button>
        <button style={styles.primaryButton} onClick={onNext}>Validar dados</button>
      </div>
    </div>
  )
}

interface PreviewStepProps {
  validation: ValidationResult
  importOnlyValid: boolean
  onToggleMode: (val: boolean) => void
  onImport: () => void
  onBack: () => void
}

function PreviewStep({ validation, importOnlyValid, onToggleMode, onImport, onBack }: PreviewStepProps): React.ReactElement {
  const { score, validRows, invalidRows, total } = validation

  return (
    <div>
      <div style={styles.scoreBox}>
        <div style={{ ...styles.scoreCircle, color: score >= 90 ? 'var(--color-success, #34d399)' : score >= 70 ? '#f59e0b' : '#ef4444' }}>
          {score}%
        </div>
        <div>
          <p style={styles.scoreTitle}>Score da importação</p>
          <p style={styles.scoreDetail}>✅ {validRows.length} válidos &nbsp;|&nbsp; ❌ {invalidRows.length} inválidos de {total}</p>
        </div>
      </div>

      {invalidRows.length > 0 && (
        <div style={styles.errorList}>
          {invalidRows.slice(0, 10).map((row) => (
            <div key={row.lineNumber} style={styles.errorItem}>
              <strong>Linha {row.lineNumber}:</strong>{' '}
              {row.errors.join(' · ')}
            </div>
          ))}
          {invalidRows.length > 10 && (
            <div style={styles.errorItem}>… e mais {invalidRows.length - 10} erros</div>
          )}
        </div>
      )}

      {invalidRows.length > 0 && (
        <div style={styles.modeToggle}>
          <label style={styles.toggleLabel}>
            <input
              type="radio"
              checked={importOnlyValid}
              onChange={() => onToggleMode(true)}
            />
            {' '}Importar apenas os válidos ({validRows.length})
          </label>
          <label style={styles.toggleLabel}>
            <input
              type="radio"
              checked={!importOnlyValid}
              onChange={() => onToggleMode(false)}
            />
            {' '}Importar todos ({total})
          </label>
        </div>
      )}

      <div style={styles.buttonRow}>
        <button style={styles.secondaryButton} onClick={onBack}>Corrigir e reimportar</button>
        <button style={styles.primaryButton} onClick={onImport} disabled={validRows.length === 0}>
          Importar {importOnlyValid ? validRows.length : total} linhas
        </button>
      </div>
    </div>
  )
}

function DownloadTemplates(): React.ReactElement {
  function downloadCSV(): void {
    const headers = REQUIRED_FIELDS.map((f) => f.key).join(',')
    const example = '84833000,Rolamento de esferas,1000,KG,CN,5000.00,01/03/2026'
    const blob = new Blob([`${headers}\n${example}\n`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-importacao.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={styles.templateSection}>
      <span style={styles.templateLabel}>Não tem planilha? Baixe o modelo:</span>
      <button style={styles.templateButton} onClick={downloadCSV}>
        ⬇ Modelo CSV
      </button>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: { display: 'flex', flexDirection: 'column' as const, gap: '1.5rem' },
  stepIndicator: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
  stepDot: {
    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
    background: 'var(--color-surface-2, #1e293b)', color: 'var(--color-text-muted, #64748b)',
    border: '1px solid var(--color-border, #334155)',
  },
  stepDone: { background: 'var(--color-success, #34d399)', color: '#0a0a0a', border: 'none' },
  stepActive: { background: 'var(--color-primary, #3b82f6)', color: '#fff', border: 'none' },
  stepLabel: { fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' },
  stepLabelActive: { color: 'var(--color-text, #f1f5f9)', fontWeight: 600 },
  stepLine: { flex: 1, height: 1, background: 'var(--color-border, #334155)' },
  dropzone: {
    border: '2px dashed var(--color-border, #334155)', borderRadius: '8px',
    padding: '2.5rem', textAlign: 'center' as const, cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  hiddenInput: { display: 'none' },
  dropzoneLabel: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    gap: '0.5rem', cursor: 'pointer', color: 'var(--color-text-secondary, #94a3b8)',
  },
  uploadIcon: { fontSize: '2rem' },
  fileIcon: { fontSize: '2rem' },
  fileFormats: { fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' },
  fileMeta: { fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' },
  errorText: { color: 'var(--color-error, #ef4444)', fontSize: '0.8rem', marginTop: '0.5rem' },
  sectionTitle: { fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text, #f1f5f9)' },
  mappingTable: { width: '100%', borderCollapse: 'collapse' as const },
  th: {
    textAlign: 'left' as const, padding: '0.5rem 0.75rem', fontSize: '0.75rem',
    fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    color: 'var(--color-text-muted, #64748b)', borderBottom: '1px solid var(--color-border, #334155)',
  },
  td: { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border, #334155)' },
  select: {
    padding: '0.375rem 0.625rem', background: 'var(--color-surface-2, #1e293b)',
    border: '1px solid var(--color-border, #334155)', borderRadius: '6px',
    color: 'var(--color-text, #f1f5f9)', fontSize: '0.875rem', width: '100%',
  },
  buttonRow: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' },
  primaryButton: {
    padding: '0.625rem 1.5rem', background: 'var(--color-primary, #3b82f6)',
    color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
  secondaryButton: {
    padding: '0.625rem 1rem', background: 'transparent',
    color: 'var(--color-text-secondary, #94a3b8)', border: '1px solid var(--color-border, #334155)',
    borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer',
  },
  scoreBox: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--color-surface-2, #1e293b)', borderRadius: '8px' },
  scoreCircle: { fontSize: '2rem', fontWeight: 700, minWidth: 64, textAlign: 'center' as const },
  scoreTitle: { fontWeight: 600, margin: 0 },
  scoreDetail: { fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)', margin: '0.25rem 0 0' },
  errorList: { maxHeight: 200, overflowY: 'auto' as const, background: 'var(--color-surface-2, #1e293b)', borderRadius: '6px', padding: '0.75rem' },
  errorItem: { fontSize: '0.8rem', color: 'var(--color-error, #ef4444)', padding: '0.25rem 0', borderBottom: '1px solid var(--color-border, #334155)' },
  modeToggle: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  toggleLabel: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' },
  centered: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1rem', padding: '2rem' },
  progressBar: { width: '100%', maxWidth: 400, height: 8, background: 'var(--color-surface-2, #1e293b)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--color-primary, #3b82f6)', transition: 'width 0.2s' },
  progressText: { fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)' },
  successContainer: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '0.75rem', padding: '2rem' },
  successIcon: { fontSize: '3rem', color: 'var(--color-success, #34d399)' },
  successTitle: { margin: 0, fontWeight: 600 },
  resetButton: {
    padding: '0.625rem 1.5rem', background: 'var(--color-primary, #3b82f6)',
    color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer',
  },
  templateSection: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderTop: '1px solid var(--color-border, #334155)', marginTop: 'auto' },
  templateLabel: { fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' },
  templateButton: {
    padding: '0.375rem 0.75rem', background: 'transparent',
    border: '1px solid var(--color-border, #334155)', borderRadius: '6px',
    color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.8rem', cursor: 'pointer',
  },
} satisfies Record<string, React.CSSProperties>
