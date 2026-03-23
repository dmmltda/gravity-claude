import React, { useState, useEffect, useRef, useCallback } from 'react'
import { apiClient } from '@nucleo/api-global'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportColumn {
  id:       string
  label:    string
  sortable: boolean
}

interface ReportFilter {
  id:    string
  label: string
  type:  'select' | 'search' | 'date_range'
}

interface ProductReportConfig {
  id:       string
  label:    string
  icon:     string
  endpoint: string
  columns:  ReportColumn[]
  filters:  ReportFilter[]
}

interface ProductConfig {
  reports: ProductReportConfig[]
}

interface ColumnConfig {
  id:      string
  label:   string
  visible: boolean
}

interface SavedReportMeta {
  id:         string
  name:       string
  report_id:  string
  product_id: string | null
  filters:    Record<string, unknown>
  columns:    ColumnConfig[]
  join_type:  'left' | 'inner'
  is_shared:  boolean
  updated_at: string
}

interface ScheduleChannels {
  email:    string[]
  whatsapp: string[]
  notify:   string[]
}

interface ScheduleForm {
  frequency:       'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
  cron_expression: string
  next_run_at:     string
  channels:        ScheduleChannels
  format:          'csv' | 'excel' | 'json' | 'xml' | 'txt'
}

interface RelatoriosProps {
  productConfig: ProductConfig
}

// ─── Built-in tabs (sempre presentes, dados do tenant) ────────────────────────

const BUILTIN_TABS: ProductReportConfig[] = [
  {
    id:       'tabela-de-empresas',
    label:    'Tabela de Empresas',
    icon:     'buildings',
    endpoint: '/api/v1/empresas/report',
    columns:  [
      { id: 'nome',          label: 'Empresa',      sortable: true  },
      { id: 'cnpj',          label: 'CNPJ',         sortable: false },
      { id: 'segmento',      label: 'Segmento',      sortable: true  },
      { id: 'responsavel',   label: 'Responsável',   sortable: true  },
      { id: 'health_score',  label: 'Health Score',  sortable: true  },
      { id: 'status',        label: 'Status',        sortable: true  },
    ],
    filters: [
      { id: 'status',    label: 'Status',      type: 'select'  },
      { id: 'segmento',  label: 'Segmento',    type: 'select'  },
      { id: 'search',    label: 'Buscar...',   type: 'search'  },
    ],
  },
  {
    id:       'aderencia-mensal',
    label:    'Aderência Mensal',
    icon:     'chart-line',
    endpoint: '/api/v1/dashboard/adherence-report',
    columns:  [
      { id: 'empresa',       label: 'Empresa',       sortable: true  },
      { id: 'mes',           label: 'Mês',            sortable: true  },
      { id: 'acessos',       label: 'Acessos',        sortable: true  },
      { id: 'score',         label: 'Score',          sortable: true  },
      { id: 'status',        label: 'Status',         sortable: true  },
    ],
    filters: [
      { id: 'data', label: 'Período', type: 'date_range' },
    ],
  },
]

const NEW_REPORT_TAB_ID = '__novo_relatorio__'

// ─── useDebounce ──────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  filters:        ReportFilter[]
  values:         Record<string, string>
  resultCount:    number
  onChange:       (id: string, value: string) => void
  onClear:        () => void
}

function FilterBar({ filters, values, resultCount, onChange, onClear }: FilterBarProps) {
  const hasAny = Object.values(values).some(Boolean)

  return (
    <div className="relatorios-filterbar">
      {filters.map((f) => {
        if (f.type === 'search') {
          return (
            <input
              key={f.id}
              type="text"
              placeholder={f.label}
              value={values[f.id] ?? ''}
              onChange={(e) => onChange(f.id, e.target.value)}
              className="filter-input-search"
            />
          )
        }
        if (f.type === 'date_range') {
          return (
            <div key={f.id} className="filter-date-range">
              <input
                type="date"
                value={values[`${f.id}_from`] ?? ''}
                onChange={(e) => onChange(`${f.id}_from`, e.target.value)}
              />
              <span>até</span>
              <input
                type="date"
                value={values[`${f.id}_to`] ?? ''}
                onChange={(e) => onChange(`${f.id}_to`, e.target.value)}
              />
            </div>
          )
        }
        return (
          <select
            key={f.id}
            value={values[f.id] ?? ''}
            onChange={(e) => onChange(f.id, e.target.value)}
            className="filter-select"
          >
            <option value="">{f.label} ▼</option>
          </select>
        )
      })}
      <span className="filter-count">{resultCount} resultado{resultCount !== 1 ? 's' : ''}</span>
      {hasAny && (
        <button className="btn-link" onClick={onClear}>
          Limpar filtros
        </button>
      )}
    </div>
  )
}

// ─── ColumnSelectorPanel — drag & drop ───────────────────────────────────────

interface ColumnSelectorPanelProps {
  columns:  ColumnConfig[]
  onChange: (cols: ColumnConfig[]) => void
  onClose:  () => void
}

function ColumnSelectorPanel({ columns, onChange, onClose }: ColumnSelectorPanelProps) {
  const dragIdx = useRef<number | null>(null)

  function handleDragStart(idx: number) {
    dragIdx.current = idx
  }

  function handleDrop(targetIdx: number) {
    if (dragIdx.current === null || dragIdx.current === targetIdx) return
    const reordered = [...columns]
    const [moved] = reordered.splice(dragIdx.current, 1)
    reordered.splice(targetIdx, 0, moved)
    onChange(reordered)
    dragIdx.current = null
  }

  function toggleVisible(id: string) {
    onChange(columns.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)))
  }

  return (
    <div className="column-selector-panel">
      <div className="column-selector-header">
        <span>COLUNAS VISÍVEIS</span>
        <button className="btn-icon" onClick={onClose}>✕</button>
      </div>
      <ul className="column-selector-list">
        {columns.map((col, idx) => (
          <li
            key={col.id}
            className="column-selector-item"
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
          >
            <span className="drag-handle" title="Arrastar">⠿⠿</span>
            <input
              type="checkbox"
              checked={col.visible}
              onChange={() => toggleVisible(col.id)}
              id={`col-${col.id}`}
            />
            <label htmlFor={`col-${col.id}`}>{col.label}</label>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── WorkspacePanel — salvar relatório ───────────────────────────────────────

interface WorkspacePanelProps {
  savedReports:  SavedReportMeta[]
  onSave:        (name: string) => void
  onLoad:        (report: SavedReportMeta) => void
  onDelete:      (id: string) => void
}

function WorkspacePanel({ savedReports, onSave, onLoad, onDelete }: WorkspacePanelProps) {
  const [name, setName] = useState('')

  function handleSave() {
    if (!name.trim()) return
    onSave(name.trim())
    setName('')
  }

  return (
    <div className="workspace-panel">
      <div className="workspace-save">
        <label className="workspace-label">Nome do relatório</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Empresas Ativas Sul"
          maxLength={200}
          className="workspace-input"
        />
        <div className="workspace-actions">
          <button className="btn-secondary" onClick={() => setName('')} disabled={!name}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
            Salvar
          </button>
        </div>
      </div>

      {savedReports.length > 0 && (
        <div className="workspace-saved-list">
          <span className="workspace-saved-title">RELATÓRIOS SALVOS</span>
          {savedReports.map((r) => (
            <div key={r.id} className="workspace-saved-item">
              <button className="btn-link workspace-saved-name" onClick={() => onLoad(r)}>
                {r.name}
              </button>
              <button
                className="btn-icon btn-delete"
                onClick={() => onDelete(r.id)}
                title="Excluir relatório"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ScheduleModal ────────────────────────────────────────────────────────────

interface ScheduleModalProps {
  savedReportId: string
  onClose:       () => void
}

const EMPTY_SCHEDULE: ScheduleForm = {
  frequency:       'weekly',
  cron_expression: '',
  next_run_at:     new Date().toISOString().slice(0, 16),
  channels:        { email: [], whatsapp: [], notify: [] },
  format:          'csv',
}

function ScheduleModal({ savedReportId, onClose }: ScheduleModalProps) {
  const [form, setForm] = useState<ScheduleForm>(EMPTY_SCHEDULE)
  const [emailInput, setEmailInput] = useState('')
  const [saving, setSaving] = useState(false)

  function addEmail() {
    if (!emailInput.trim()) return
    setForm((f) => ({ ...f, channels: { ...f.channels, email: [...f.channels.email, emailInput.trim()] } }))
    setEmailInput('')
  }

  function removeEmail(addr: string) {
    setForm((f) => ({ ...f, channels: { ...f.channels, email: f.channels.email.filter((e) => e !== addr) } }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiClient.post(`/api/v1/relatorios/saved/${savedReportId}/schedule`, form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Agendar envio</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <label>Frequência</label>
          <select
            value={form.frequency}
            onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as ScheduleForm['frequency'] }))}
          >
            <option value="once">Uma vez</option>
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
            <option value="custom">Personalizado</option>
          </select>

          {form.frequency === 'custom' && (
            <input
              type="text"
              placeholder="Expressão cron (ex: 0 8 * * 1)"
              value={form.cron_expression}
              onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
            />
          )}

          <label>Próximo envio</label>
          <input
            type="datetime-local"
            value={form.next_run_at}
            onChange={(e) => setForm((f) => ({ ...f, next_run_at: e.target.value }))}
          />

          <label>Formato</label>
          <select
            value={form.format}
            onChange={(e) => setForm((f) => ({ ...f, format: e.target.value as ScheduleForm['format'] }))}
          >
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
            <option value="json">JSON</option>
            <option value="xml">XML</option>
            <option value="txt">TXT</option>
          </select>

          <label>📧 Email</label>
          <div className="channel-input-row">
            <input
              type="email"
              placeholder="email@empresa.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addEmail() }}
            />
            <button className="btn-secondary" onClick={addEmail}>+ Adicionar</button>
          </div>
          {form.channels.email.map((addr) => (
            <div key={addr} className="channel-tag">
              {addr}
              <button className="btn-icon" onClick={() => removeEmail(addr)}>✕</button>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Agendar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ReportTable ──────────────────────────────────────────────────────────────

interface ReportTableProps {
  rows:    Record<string, unknown>[]
  columns: ColumnConfig[]
  loading: boolean
}

function ReportTable({ rows, columns, loading }: ReportTableProps) {
  const visibleCols = columns.filter((c) => c.visible)

  if (loading) return <div className="relatorios-loading">Carregando...</div>
  if (rows.length === 0) return <div className="relatorios-empty">Nenhum dado encontrado.</div>

  return (
    <div className="relatorios-table-wrapper">
      <table className="relatorios-table">
        <thead>
          <tr>
            {visibleCols.map((c) => (
              <th key={c.id}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {visibleCols.map((c) => (
                <td key={c.id}>{String(row[c.id] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Relatorios({ productConfig }: RelatoriosProps) {
  const allTabs: ProductReportConfig[] = [...BUILTIN_TABS, ...productConfig.reports]

  const [activeTabId, setActiveTabId]     = useState<string>(allTabs[0]?.id ?? NEW_REPORT_TAB_ID)
  const [rows, setRows]                   = useState<Record<string, unknown>[]>([])
  const [loading, setLoading]             = useState(false)
  const [filterValues, setFilterValues]   = useState<Record<string, string>>({})
  const [columns, setColumns]             = useState<ColumnConfig[]>([])
  const [showColumns, setShowColumns]     = useState(false)
  const [showWorkspace, setShowWorkspace] = useState(false)
  const [showSchedule, setShowSchedule]   = useState(false)
  const [savedReports, setSavedReports]   = useState<SavedReportMeta[]>([])
  const [savedReportId, setSavedReportId] = useState<string | null>(null)

  const debouncedFilters = useDebounce(filterValues, 300)
  const activeTab = allTabs.find((t) => t.id === activeTabId) ?? null

  // Inicializa colunas ao trocar de tab
  useEffect(() => {
    if (!activeTab) return
    setColumns(activeTab.columns.map((c) => ({ id: c.id, label: c.label, visible: true })))
    setFilterValues({})
    setRows([])
    setSavedReportId(null)
  }, [activeTabId])

  // Busca dados com debounce
  useEffect(() => {
    if (!activeTab || activeTabId === NEW_REPORT_TAB_ID) return
    void loadData(activeTab, debouncedFilters)
  }, [activeTabId, debouncedFilters])

  // Carrega relatórios salvos
  useEffect(() => {
    void loadSavedReports()
  }, [])

  async function loadData(tab: ProductReportConfig, filters: Record<string, string>) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        source_endpoint: tab.endpoint,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      })
      const res = await apiClient.get<{ data: Record<string, unknown>[] }>(
        `/api/v1/relatorios/${tab.id}?${params.toString()}`
      )
      setRows(res.data.data)
    } finally {
      setLoading(false)
    }
  }

  async function loadSavedReports() {
    const res = await apiClient.get<{ data: SavedReportMeta[] }>('/api/v1/relatorios/saved')
    setSavedReports(res.data.data)
  }

  function handleFilterChange(id: string, value: string) {
    setFilterValues((prev) => ({ ...prev, [id]: value }))
  }

  function handleFilterClear() {
    setFilterValues({})
  }

  const handleSaveReport = useCallback(async (name: string) => {
    if (!activeTab) return
    const res = await apiClient.post<SavedReportMeta>('/api/v1/relatorios/saved', {
      report_id:  activeTab.id,
      name,
      filters:    filterValues,
      columns:    columns.filter((c) => c.visible).map((c) => c.id),
      join_type:  'left',
      is_shared:  false,
    })
    setSavedReports((prev) => [res.data, ...prev])
    setSavedReportId(res.data.id)
    setShowWorkspace(false)
  }, [activeTab, filterValues, columns])

  const handleLoadReport = useCallback((report: SavedReportMeta) => {
    const filters = report.filters as Record<string, string>
    setFilterValues(filters)
    setSavedReportId(report.id)
    const savedCols = report.columns as ColumnConfig[]
    if (savedCols.length > 0) setColumns(savedCols)
    setShowWorkspace(false)
  }, [])

  const handleDeleteSaved = useCallback(async (id: string) => {
    await apiClient.delete(`/api/v1/relatorios/saved/${id}`)
    setSavedReports((prev) => prev.filter((r) => r.id !== id))
    if (savedReportId === id) setSavedReportId(null)
  }, [savedReportId])

  async function handleExport(format: string) {
    if (!activeTab) return
    const visibleCols = columns.filter((c) => c.visible).map((c) => c.id)
    const params = new URLSearchParams({
      source_endpoint: activeTab.endpoint,
      format,
      columns: JSON.stringify(visibleCols),
      name:    activeTab.label,
    })
    window.open(`/api/v1/relatorios/${activeTab.id}/export?${params.toString()}`, '_blank')
  }

  return (
    <div className="relatorios">
      {/* Tabs */}
      <div className="relatorios-tabs">
        {allTabs.map((tab) => (
          <button
            key={tab.id}
            className={`relatorios-tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <button
          className={`relatorios-tab relatorios-tab-new ${activeTabId === NEW_REPORT_TAB_ID ? 'active' : ''}`}
          onClick={() => setActiveTabId(NEW_REPORT_TAB_ID)}
        >
          + Novo Relatório
        </button>
      </div>

      {activeTabId === NEW_REPORT_TAB_ID ? (
        <NewReportWorkspace productConfig={productConfig} />
      ) : (
        <>
          {/* Toolbar */}
          <div className="relatorios-toolbar">
            {activeTab && (
              <FilterBar
                filters={activeTab.filters}
                values={filterValues}
                resultCount={rows.length}
                onChange={handleFilterChange}
                onClear={handleFilterClear}
              />
            )}
            <div className="relatorios-toolbar-actions">
              <button className="btn-secondary" onClick={() => setShowColumns((s) => !s)}>
                Colunas
              </button>
              <button className="btn-secondary" onClick={() => setShowWorkspace((s) => !s)}>
                Workspace
              </button>
              {savedReportId && (
                <button className="btn-secondary" onClick={() => setShowSchedule(true)}>
                  Agendar
                </button>
              )}
              <ExportDropdown onExport={handleExport} />
            </div>
          </div>

          {/* Coluna selector */}
          {showColumns && (
            <ColumnSelectorPanel
              columns={columns}
              onChange={setColumns}
              onClose={() => setShowColumns(false)}
            />
          )}

          {/* Workspace panel */}
          {showWorkspace && (
            <WorkspacePanel
              savedReports={savedReports}
              onSave={handleSaveReport}
              onLoad={handleLoadReport}
              onDelete={handleDeleteSaved}
            />
          )}

          {/* Tabela */}
          <ReportTable rows={rows} columns={columns} loading={loading} />

          {/* Modal agendamento */}
          {showSchedule && savedReportId && (
            <ScheduleModal
              savedReportId={savedReportId}
              onClose={() => setShowSchedule(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ─── ExportDropdown ───────────────────────────────────────────────────────────

interface ExportDropdownProps {
  onExport: (format: string) => void
}

const EXPORT_FORMATS = ['csv', 'excel', 'json', 'xml', 'txt'] as const

function ExportDropdown({ onExport }: ExportDropdownProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="export-dropdown">
      <button className="btn-primary" onClick={() => setOpen((o) => !o)}>
        Exportar ▼
      </button>
      {open && (
        <div className="export-dropdown-menu">
          {EXPORT_FORMATS.map((fmt) => (
            <button
              key={fmt}
              className="export-dropdown-item"
              onClick={() => { onExport(fmt); setOpen(false) }}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── NewReportWorkspace — workspace em branco para relatório unificado ────────

interface NewReportWorkspaceProps {
  productConfig: ProductConfig
}

interface SelectedSource {
  productId: string
  tableId:   string
  label:     string
  endpoint:  string
}

function NewReportWorkspace({ productConfig }: NewReportWorkspaceProps) {
  const [selected, setSelected]   = useState<SelectedSource[]>([])
  const [joinType, setJoinType]   = useState<'left' | 'inner'>('left')
  const [reportName, setReportName] = useState('')
  const [saving, setSaving]       = useState(false)

  function toggleSource(src: SelectedSource) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.tableId === src.tableId)
      return exists ? prev.filter((s) => s.tableId !== src.tableId) : [...prev, src]
    })
  }

  async function handleSave() {
    if (!reportName.trim() || selected.length === 0) return
    setSaving(true)
    try {
      await apiClient.post('/api/v1/relatorios/saved', {
        report_id:  'unified',
        product_id: null,
        name:       reportName.trim(),
        sources:    selected,
        join_type:  joinType,
        is_shared:  false,
      })
      setReportName('')
      setSelected([])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="new-report-workspace">
      <h3 className="new-report-title">Novo Relatório</h3>
      <p className="new-report-hint">Selecione as fontes de dados para cruzar:</p>

      <div className="new-report-sources">
        {[...BUILTIN_TABS, ...productConfig.reports].map((tab) => {
          const isSelected = selected.some((s) => s.tableId === tab.id)
          return (
            <label key={tab.id} className="source-option">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() =>
                  toggleSource({ productId: 'tenant', tableId: tab.id, label: tab.label, endpoint: tab.endpoint })
                }
              />
              {tab.label}
            </label>
          )
        })}
      </div>

      <div className="new-report-join">
        <label>Tipo de JOIN</label>
        <select value={joinType} onChange={(e) => setJoinType(e.target.value as 'left' | 'inner')}>
          <option value="left">LEFT JOIN — inclui registros sem correspondência</option>
          <option value="inner">INNER JOIN — somente com correspondência em todos</option>
        </select>
      </div>

      <div className="new-report-save">
        <input
          type="text"
          placeholder="Nome do relatório unificado"
          value={reportName}
          onChange={(e) => setReportName(e.target.value)}
          maxLength={200}
          className="workspace-input"
        />
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving || !reportName.trim() || selected.length === 0}
        >
          {saving ? 'Salvando...' : 'Salvar Relatório'}
        </button>
      </div>
    </div>
  )
}
