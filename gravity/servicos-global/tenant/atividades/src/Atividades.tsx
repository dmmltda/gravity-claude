import React, { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@nucleo/api-global'
import { TabelaGlobal } from '@nucleo/tabela-global'
import { useModal } from '@nucleo/modal-global'
import { useConfirmar } from '@nucleo/confirmar-global'
import type { Column } from '@nucleo/tabela-global'

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'

interface Activity {
  id: string
  tenant_id: string
  product_id: string | null
  user_id: string
  title: string
  description: string | null
  status: ActivityStatus
  due_date: string | null
  reminder_at: string | null
  reminder_sent: boolean
  reminder_whatsapp: boolean
  next_step: string | null
  next_step_date: string | null
  next_step_reminder_sent: boolean
  send_invite_whatsapp: boolean
  send_summary_whatsapp: boolean
  send_recording_whatsapp: boolean
  recording_url: string | null
  recording_sent: boolean
  created_at: string
  updated_at: string
}

type TabType = 'todas' | 'minhas' | 'vencidas' | 'hoje'
type ModalTabType = 'informacoes' | 'tempo' | 'proximo-passo' | 'lembrete'

interface AtividadesProps {
  productId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ActivityStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
}

const STATUS_COLORS: Record<ActivityStatus, string> = {
  pending: 'badge-warning',
  in_progress: 'badge-info',
  done: 'badge-success',
  cancelled: 'badge-neutral',
}

function isOverdue(activity: Activity): boolean {
  if (!activity.due_date) return false
  return new Date(activity.due_date) < new Date() && activity.status !== 'done'
}

function isToday(activity: Activity): boolean {
  if (!activity.due_date) return false
  const due = new Date(activity.due_date)
  const today = new Date()
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// ─── Modal de Criação/Edição ───────────────────────────────────────────────────

interface FormState {
  title: string
  description: string
  user_id: string
  status: ActivityStatus
  due_date: string
  reminder_at: string
  reminder_whatsapp: boolean
  next_step: string
  next_step_date: string
  send_invite_whatsapp: boolean
  send_summary_whatsapp: boolean
  send_recording_whatsapp: boolean
  recording_url: string
}

const FORM_EMPTY: FormState = {
  title: '',
  description: '',
  user_id: '',
  status: 'pending',
  due_date: '',
  reminder_at: '',
  reminder_whatsapp: false,
  next_step: '',
  next_step_date: '',
  send_invite_whatsapp: false,
  send_summary_whatsapp: false,
  send_recording_whatsapp: false,
  recording_url: '',
}

function activityToForm(a: Activity): FormState {
  return {
    title: a.title,
    description: a.description ?? '',
    user_id: a.user_id,
    status: a.status,
    due_date: a.due_date ? a.due_date.slice(0, 16) : '',
    reminder_at: a.reminder_at ? a.reminder_at.slice(0, 16) : '',
    reminder_whatsapp: a.reminder_whatsapp,
    next_step: a.next_step ?? '',
    next_step_date: a.next_step_date ? a.next_step_date.slice(0, 16) : '',
    send_invite_whatsapp: a.send_invite_whatsapp,
    send_summary_whatsapp: a.send_summary_whatsapp,
    send_recording_whatsapp: a.send_recording_whatsapp,
    recording_url: a.recording_url ?? '',
  }
}

interface ModalConteudoProps {
  form: FormState
  onChange: (patch: Partial<FormState>) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  editingId: string | null
}

function ModalConteudo({ form, onChange, onSave, onClose, saving, editingId }: ModalConteudoProps) {
  const [activeTab, setActiveTab] = useState<ModalTabType>('informacoes')

  const tabs: { key: ModalTabType; label: string }[] = [
    { key: 'informacoes', label: 'Informações' },
    { key: 'tempo', label: 'Tempo' },
    { key: 'proximo-passo', label: 'Próximo Passo' },
    { key: 'lembrete', label: 'Lembrete' },
  ]

  return (
    <div className="modal-atividade">
      <div className="modal-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`modal-tab ${activeTab === t.key ? 'modal-tab--ativa' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="modal-tab-conteudo">
        {activeTab === 'informacoes' && (
          <div className="tab-informacoes">
            <label className="campo-label">
              Título *
              <input
                type="text"
                value={form.title}
                onChange={(e) => onChange({ title: e.target.value })}
                maxLength={300}
                placeholder="Título da atividade"
                className="campo-input"
              />
            </label>

            <label className="campo-label">
              Descrição
              <textarea
                value={form.description}
                onChange={(e) => onChange({ description: e.target.value })}
                maxLength={2000}
                placeholder="Descrição opcional"
                className="campo-textarea"
                rows={3}
              />
            </label>

            <label className="campo-label">
              Responsável (user_id) *
              <input
                type="text"
                value={form.user_id}
                onChange={(e) => onChange({ user_id: e.target.value })}
                placeholder="ID do usuário responsável"
                className="campo-input"
              />
            </label>

            <label className="campo-label">
              Status
              <select
                value={form.status}
                onChange={(e) => onChange({ status: e.target.value as ActivityStatus })}
                className="campo-select"
              >
                {(Object.keys(STATUS_LABELS) as ActivityStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="campo-label">
              Data de vencimento
              <input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => onChange({ due_date: e.target.value })}
                className="campo-input"
              />
            </label>
          </div>
        )}

        {activeTab === 'tempo' && (
          <div className="tab-tempo">
            {/* TODO(daniel, 2026-03): integrar <Cronometro activityId={editingId} /> quando o serviço cronometro estiver disponível */}
            {editingId ? (
              <p className="placeholder-cronometro">
                Cronômetro disponível após criação da atividade.
                {/* <Cronometro activityId={editingId} /> */}
              </p>
            ) : (
              <p className="placeholder-cronometro">
                Salve a atividade primeiro para acessar o cronômetro.
              </p>
            )}
          </div>
        )}

        {activeTab === 'proximo-passo' && (
          <div className="tab-proximo-passo">
            <label className="campo-label">
              Próximo passo
              <textarea
                value={form.next_step}
                onChange={(e) => onChange({ next_step: e.target.value })}
                maxLength={1000}
                placeholder="Descreva o próximo passo"
                className="campo-textarea"
                rows={3}
              />
            </label>

            <label className="campo-label">
              Data do próximo passo
              <input
                type="datetime-local"
                value={form.next_step_date}
                onChange={(e) => onChange({ next_step_date: e.target.value })}
                className="campo-input"
              />
            </label>

            <label className="campo-label">
              URL da gravação
              <input
                type="url"
                value={form.recording_url}
                onChange={(e) => onChange({ recording_url: e.target.value })}
                placeholder="https://..."
                className="campo-input"
              />
            </label>

            <div className="campo-checkboxes">
              <label className="campo-checkbox">
                <input
                  type="checkbox"
                  checked={form.send_invite_whatsapp}
                  onChange={(e) => onChange({ send_invite_whatsapp: e.target.checked })}
                />
                Enviar convite via WhatsApp
              </label>
              <label className="campo-checkbox">
                <input
                  type="checkbox"
                  checked={form.send_summary_whatsapp}
                  onChange={(e) => onChange({ send_summary_whatsapp: e.target.checked })}
                />
                Enviar resumo via WhatsApp
              </label>
              <label className="campo-checkbox">
                <input
                  type="checkbox"
                  checked={form.send_recording_whatsapp}
                  onChange={(e) => onChange({ send_recording_whatsapp: e.target.checked })}
                />
                Enviar gravação via WhatsApp
              </label>
            </div>
          </div>
        )}

        {activeTab === 'lembrete' && (
          <div className="tab-lembrete">
            <label className="campo-label">
              Lembrete em
              <input
                type="datetime-local"
                value={form.reminder_at}
                onChange={(e) => onChange({ reminder_at: e.target.value })}
                className="campo-input"
              />
            </label>

            <label className="campo-checkbox">
              <input
                type="checkbox"
                checked={form.reminder_whatsapp}
                onChange={(e) => onChange({ reminder_whatsapp: e.target.checked })}
              />
              Enviar lembrete via WhatsApp
            </label>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button
          className="btn-primary"
          onClick={onSave}
          disabled={saving || !form.title.trim() || !form.user_id.trim()}
        >
          {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar atividade'}
        </button>
      </div>
    </div>
  )
}

// ─── Colunas da Tabela ─────────────────────────────────────────────────────────

const columns: Column<Activity>[] = [
  {
    key: 'title',
    label: 'Título',
    sortable: true,
  },
  {
    key: 'status',
    label: 'Status',
    type: 'badge',
    sortable: true,
    renderCell: (value) => {
      const s = value as ActivityStatus
      return <span className={`badge ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]}</span>
    },
  },
  {
    key: 'user_id',
    label: 'Responsável',
    sortable: true,
  },
  {
    key: 'due_date',
    label: 'Vencimento',
    type: 'date',
    sortable: true,
    renderCell: (value) => formatDate(value as string | null),
  },
]

// ─── Componente Principal ─────────────────────────────────────────────────────

export function Atividades({ productId }: AtividadesProps) {
  const { abrirModal, fecharModal } = useModal()
  const { confirmar } = useConfirmar()

  const [activeTab, setActiveTab] = useState<TabType>('todas')
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [filtro, setFiltro] = useState('')

  const mainTabs: { key: TabType; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'minhas', label: 'Minhas' },
    { key: 'vencidas', label: 'Vencidas' },
    { key: 'hoje', label: 'Hoje' },
  ]

  const loadActivities = useCallback(async () => {
    setLoading(true)
    try {
      if (activeTab === 'minhas') {
        const res = await apiClient.get<{ activities: Activity[] }>('/api/v1/activities/mine')
        setActivities(res.data.activities)
      } else {
        const params = new URLSearchParams()
        if (productId) params.set('product_id', productId)
        const res = await apiClient.get<{ activities: Activity[] }>(
          `/api/v1/activities?${params.toString()}`
        )
        setActivities(res.data.activities)
      }
    } finally {
      setLoading(false)
    }
  }, [activeTab, productId])

  useEffect(() => {
    void loadActivities()
  }, [loadActivities])

  const displayedActivities = activities.filter((a) => {
    if (activeTab === 'vencidas') return isOverdue(a)
    if (activeTab === 'hoje') return isToday(a)
    return true
  })

  function openModal(editingActivity: Activity | null) {
    const form: FormState = editingActivity ? activityToForm(editingActivity) : FORM_EMPTY
    let currentForm = { ...form }
    let saving = false

    const modalId = abrirModal({
      titulo: editingActivity ? 'Editar atividade' : 'Nova atividade',
      largura: '640px',
      fecharComEsc: true,
      fecharComBackdrop: false,
      conteudo: (
        <ModalConteudo
          form={currentForm}
          onChange={(patch) => {
            currentForm = { ...currentForm, ...patch }
            // Re-render via re-open — o state vive no componente
            fecharModal(modalId)
            openModalWithForm(editingActivity, currentForm)
          }}
          onSave={() => void handleSave(editingActivity?.id ?? null, currentForm, modalId)}
          onClose={() => fecharModal(modalId)}
          saving={saving}
          editingId={editingActivity?.id ?? null}
        />
      ),
    })
  }

  function openModalWithForm(editingActivity: Activity | null, form: FormState) {
    let currentForm = { ...form }

    const modalId = abrirModal({
      titulo: editingActivity ? 'Editar atividade' : 'Nova atividade',
      largura: '640px',
      fecharComEsc: true,
      fecharComBackdrop: false,
      conteudo: (
        <ModalConteudo
          form={currentForm}
          onChange={(patch) => {
            currentForm = { ...currentForm, ...patch }
            fecharModal(modalId)
            openModalWithForm(editingActivity, currentForm)
          }}
          onSave={() => void handleSave(editingActivity?.id ?? null, currentForm, modalId)}
          onClose={() => fecharModal(modalId)}
          saving={false}
          editingId={editingActivity?.id ?? null}
        />
      ),
    })
  }

  async function handleSave(editingId: string | null, form: FormState, modalId: string) {
    const payload = {
      title: form.title,
      description: form.description || undefined,
      user_id: form.user_id,
      status: form.status,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
      reminder_at: form.reminder_at ? new Date(form.reminder_at).toISOString() : undefined,
      reminder_whatsapp: form.reminder_whatsapp,
      next_step: form.next_step || undefined,
      next_step_date: form.next_step_date ? new Date(form.next_step_date).toISOString() : undefined,
      send_invite_whatsapp: form.send_invite_whatsapp,
      send_summary_whatsapp: form.send_summary_whatsapp,
      send_recording_whatsapp: form.send_recording_whatsapp,
      recording_url: form.recording_url || undefined,
    }

    if (editingId) {
      await apiClient.put(`/api/v1/activities/${editingId}`, payload)
    } else {
      await apiClient.post('/api/v1/activities', payload)
    }

    fecharModal(modalId)
    void loadActivities()
  }

  async function handleDelete(activity: Activity) {
    const confirmed = await confirmar({
      titulo: 'Excluir atividade',
      mensagem: `Tem certeza que deseja excluir "${activity.title}"? Esta ação não pode ser desfeita.`,
      textoBotaoConfirmar: 'Excluir',
      textoBotaoCancelar: 'Cancelar',
      variante: 'perigo',
    })
    if (!confirmed) return

    await apiClient.delete(`/api/v1/activities/${activity.id}`)
    void loadActivities()
  }

  const columnsWithActions: Column<Activity>[] = [
    ...columns,
    {
      key: 'id',
      label: 'Ações',
      type: 'actions',
      renderCell: (_value, row) => (
        <div className="acoes-celula">
          <button
            className="btn-icon"
            onClick={() => openModal(row)}
            title="Editar"
          >
            ✏️
          </button>
          <button
            className="btn-icon btn-delete"
            onClick={() => void handleDelete(row)}
            title="Excluir"
          >
            🗑
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="atividades">
      <div className="atividades-header">
        <h2 className="atividades-titulo">Atividades</h2>
        <button className="btn-primary" onClick={() => openModal(null)}>
          + Nova atividade
        </button>
      </div>

      <div className="atividades-tabs">
        {mainTabs.map((t) => (
          <button
            key={t.key}
            className={`aba ${activeTab === t.key ? 'aba--ativa' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="atividades-filtros">
        <input
          type="text"
          placeholder="Filtrar por título..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="campo-input campo-filtro"
        />
      </div>

      <TabelaGlobal
        columns={columnsWithActions}
        data={displayedActivities}
        loading={loading}
        emptyMessage="Nenhuma atividade encontrada."
        filtro={filtro}
      />
    </div>
  )
}
