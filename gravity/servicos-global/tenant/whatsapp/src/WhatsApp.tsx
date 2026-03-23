import React, { useState, useEffect, useCallback, useRef } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ConversationStatus = 'open' | 'closed'
type Temperatura = 'critico' | 'negativo' | 'neutro' | 'positivo' | 'encantado'

interface Conversation {
  id: string
  tenant_id: string
  wa_phone_number: string
  status: ConversationStatus
  contact_id: string | null
  company_id: string | null
  contact_nome: string | null
  company_nome: string | null
  ai_enabled: boolean
  opened_at: string
  closed_at: string | null
  gabi_temperatura: Temperatura | null
  gabi_temperatura_score: number | null
  gabi_resumo: string | null
}

interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  content_type: string
  content: string
  origin: 'agent' | 'gabi' | 'contact' | 'system'
  sent_by: string | null
  status: string
  created_at: string
}

interface ConversationsResponse {
  conversations: Conversation[]
  total: number
  page: number
  limit: number
}

interface ConversationDetailResponse {
  conversation: Conversation
  messages: Message[]
}

interface CloseForm {
  temperatura: Temperatura
  temperatura_score: number
  resumo: string
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

const TEMPERATURA_LABELS: Record<Temperatura, string> = {
  critico: '🔴 Crítico',
  negativo: '🟠 Negativo',
  neutro: '⚪ Neutro',
  positivo: '🟢 Positivo',
  encantado: '⭐ Encantado',
}

const TEMPERATURA_SCORES: Record<number, Temperatura> = {
  1: 'critico',
  2: 'negativo',
  3: 'neutro',
  4: 'positivo',
  5: 'encantado',
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.length === 13 && clean.startsWith('55')) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`
  }
  return `+${clean}`
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function WhatsApp(): React.ReactElement {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConversationDetailResponse | null>(null)
  const [sendText, setSendText] = useState('')
  const [sending, setSending] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeForm, setCloseForm] = useState<CloseForm>({
    temperatura: 'neutro',
    temperatura_score: 3,
    resumo: '',
  })

  // Filtros
  const [filterStatus, setFilterStatus] = useState<ConversationStatus | ''>('')
  const [filterTemperatura, setFilterTemperatura] = useState<Temperatura | ''>('')
  const [filterVinculado, setFilterVinculado] = useState<'true' | 'false' | ''>('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const LIMIT = 20

  // ─── SSE ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const es = new EventSource('/api/v1/whatsapp/stream')

    es.onmessage = (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data) as { type: string; conversation_id?: string }

      if (data.type === 'new_message' || data.type === 'conversation_closed') {
        void loadConversations()
        if (selectedId && data.conversation_id === selectedId) {
          void loadDetail(selectedId)
        }
      }
    }

    return () => {
      es.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ─── Scroll automático ───────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages])

  // ─── Fetch conversas ─────────────────────────────────────────────────────────

  const loadConversations = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (filterStatus) params.set('status', filterStatus)
      if (filterTemperatura) params.set('temperatura', filterTemperatura)
      if (filterVinculado) params.set('vinculado', filterVinculado)

      const res = await fetch(`/api/v1/whatsapp/conversations?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar conversas')
      const data = (await res.json()) as ConversationsResponse
      setConversations(data.conversations)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus, filterTemperatura, filterVinculado])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  // ─── Fetch detalhe ───────────────────────────────────────────────────────────

  const loadDetail = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/v1/whatsapp/conversations/${id}`)
    if (!res.ok) return
    const data = (await res.json()) as ConversationDetailResponse
    setDetail(data)
  }, [])

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId)
    } else {
      setDetail(null)
    }
  }, [selectedId, loadDetail])

  // ─── Enviar mensagem ─────────────────────────────────────────────────────────

  const handleSend = async (): Promise<void> => {
    if (!selectedId || !sendText.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/v1/whatsapp/conversations/${selectedId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sendText.trim() }),
      })
      if (!res.ok) throw new Error('Falha ao enviar mensagem')
      setSendText('')
      await loadDetail(selectedId)
    } finally {
      setSending(false)
    }
  }

  // ─── Encerrar conversa ───────────────────────────────────────────────────────

  const handleClose = async (): Promise<void> => {
    if (!selectedId) return
    const res = await fetch(`/api/v1/whatsapp/conversations/${selectedId}/close`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        temperatura: closeForm.temperatura,
        temperatura_score: closeForm.temperatura_score,
        resumo: closeForm.resumo || undefined,
      }),
    })
    if (!res.ok) return
    setShowCloseModal(false)
    setSelectedId(null)
    await loadConversations()
  }

  // ─── Toggle Gabi ─────────────────────────────────────────────────────────────

  const handleToggleGabi = async (conv: Conversation): Promise<void> => {
    // Chamada futura — endpoint de toggle ai_enabled
    // Por ora, emite aviso visual
    console.error(`[TODO] Toggle Gabi para conversa ${conv.id} — endpoint não implementado`)
  }

  const totalPages = Math.ceil(total / LIMIT)

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', gap: '1rem' }}>
      {/* Painel esquerdo — lista */}
      <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: 0 }}>WhatsApp</h2>

        {/* Filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as ConversationStatus | ''); setPage(1) }}
          >
            <option value="">Todos os status</option>
            <option value="open">Aberto</option>
            <option value="closed">Encerrado</option>
          </select>

          <select
            value={filterTemperatura}
            onChange={(e) => { setFilterTemperatura(e.target.value as Temperatura | ''); setPage(1) }}
          >
            <option value="">Todas as temperaturas</option>
            {(Object.keys(TEMPERATURA_LABELS) as Temperatura[]).map((t) => (
              <option key={t} value={t}>{TEMPERATURA_LABELS[t]}</option>
            ))}
          </select>

          <select
            value={filterVinculado}
            onChange={(e) => { setFilterVinculado(e.target.value as 'true' | 'false' | ''); setPage(1) }}
          >
            <option value="">Vinculado/Não vinculado</option>
            <option value="true">Vinculado</option>
            <option value="false">Não vinculado</option>
          </select>
        </div>

        {/* Lista */}
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', flex: 1 }}>
            {conversations.map((conv) => (
              <li
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                style={{
                  padding: '8px 10px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #333',
                  background: selectedId === conv.id ? '#1a1a2e' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{conv.contact_nome ?? formatPhone(conv.wa_phone_number)}</strong>
                  {conv.gabi_temperatura && (
                    <span style={{ fontSize: 11 }}>{TEMPERATURA_LABELS[conv.gabi_temperatura]}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  {formatPhone(conv.wa_phone_number)}
                </div>
                {!conv.contact_id && (
                  <span style={{ fontSize: 11, color: '#f5a623' }}>⚠️ Não vinculado</span>
                )}
                {conv.ai_enabled && (
                  <span style={{ fontSize: 11, color: '#7ec8e3', marginLeft: 6 }}>🤖 Gabi ativo</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        )}
      </div>

      {/* Painel direito — conversa */}
      {detail ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Header da conversa */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>
                {detail.conversation.contact_nome ?? formatPhone(detail.conversation.wa_phone_number)}
              </strong>
              {!detail.conversation.contact_id && (
                <span style={{ fontSize: 12, color: '#f5a623', marginLeft: 8 }}>
                  ⚠️ Não vinculado
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => void handleToggleGabi(detail.conversation)}
                style={{ fontSize: 12 }}
              >
                {detail.conversation.ai_enabled ? '🤖 Gabi ON' : '🤖 Gabi OFF'}
              </button>
              {detail.conversation.status === 'open' && (
                <button onClick={() => setShowCloseModal(true)} style={{ fontSize: 12 }}>
                  Encerrar
                </button>
              )}
            </div>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: 8 }}>
            {detail.messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  background: msg.direction === 'outbound' ? '#1a5276' : '#1a2744',
                  borderRadius: 8,
                  padding: '6px 10px',
                }}
              >
                {msg.origin === 'gabi' && (
                  <div style={{ fontSize: 10, color: '#7ec8e3', marginBottom: 2 }}>🤖 Gabi</div>
                )}
                <div>{msg.content}</div>
                <div style={{ fontSize: 10, color: '#aaa', textAlign: 'right', marginTop: 2 }}>
                  {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de envio */}
          {detail.conversation.status === 'open' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                rows={2}
                style={{ flex: 1, resize: 'none' }}
                placeholder="Mensagem... (Enter para enviar)"
                disabled={sending}
              />
              <button onClick={() => void handleSend()} disabled={sending || !sendText.trim()}>
                Enviar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
          Selecione uma conversa
        </div>
      )}

      {/* Modal de encerramento */}
      {showCloseModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div style={{ background: '#111', padding: 24, borderRadius: 8, width: 360 }}>
            <h3 style={{ marginTop: 0 }}>Encerrar conversa</h3>

            <label style={{ display: 'block', marginBottom: 8 }}>
              Temperatura (score 1–5)
              <input
                type="range"
                min={1}
                max={5}
                value={closeForm.temperatura_score}
                onChange={(e) => {
                  const score = Number(e.target.value)
                  setCloseForm((f) => ({
                    ...f,
                    temperatura_score: score,
                    temperatura: TEMPERATURA_SCORES[score] ?? 'neutro',
                  }))
                }}
                style={{ width: '100%', marginTop: 4 }}
              />
              <div style={{ textAlign: 'center' }}>
                {TEMPERATURA_LABELS[closeForm.temperatura]} ({closeForm.temperatura_score}/5)
              </div>
            </label>

            <label style={{ display: 'block', marginBottom: 12 }}>
              Resumo (opcional)
              <textarea
                value={closeForm.resumo}
                onChange={(e) => setCloseForm((f) => ({ ...f, resumo: e.target.value }))}
                rows={3}
                style={{ display: 'block', width: '100%', marginTop: 4, resize: 'none' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCloseModal(false)}>Cancelar</button>
              <button onClick={() => void handleClose()}>Confirmar encerramento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
