import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant' | 'system'
type GabiRole = 'helpdesk' | 'customer_success' | 'treinamento' | 'analista'

interface Message {
  id: string
  role: MessageRole
  content: string
  isTyping?: boolean
}

interface FilePreview {
  file: File
  previewUrl: string | null
  type: 'image' | 'pdf' | 'excel' | 'video' | 'other'
}

interface UsageInfo {
  estimated_usd: number
  monthly_limit_usd: number
  usage_percent: number
}

interface GabiProps {
  tenantId: string
  userId: string
  productId: string
  apiBase?: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<GabiRole, string> = {
  helpdesk: 'Help Desk',
  customer_success: 'Customer Success',
  treinamento: 'Treinamento',
  analista: 'Analista de Dados',
}

const SUPPORTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'video/mp4', 'video/webm']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectFileType(file: File): FilePreview['type'] {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type.includes('spreadsheet') || file.type.includes('excel')) return 'excel'
  if (file.type.startsWith('video/')) return 'video'
  return 'other'
}

function generateId(): string {
  return Math.random().toString(36).slice(2)
}

// POST com streaming SSE usando fetch + ReadableStream
// (EventSource nativo só suporta GET)
async function postWithSse(
  url: string,
  body: Record<string, unknown>,
  onToken: (token: string) => void,
  onDone: (conversationId: string) => void,
  onError: (msg: string) => void
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    onError('Erro ao conectar com a Gabi')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const eventLine = part.split('\n').find((l) => l.startsWith('event:'))
      const dataLine = part.split('\n').find((l) => l.startsWith('data:'))
      if (!eventLine || !dataLine) continue

      const eventType = eventLine.replace('event:', '').trim()
      try {
        const parsed = JSON.parse(dataLine.replace('data:', '').trim()) as { content: string }
        if (eventType === 'token') onToken(parsed.content)
        if (eventType === 'done') onDone(parsed.content)
        if (eventType === 'error') onError(parsed.content)
      } catch {
        // fragmento incompleto
      }
    }
  }
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function Gabi({ tenantId, userId, productId, apiBase = '/api/v1/gabi' }: GabiProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeRole, setActiveRole] = useState<GabiRole>('helpdesk')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [pendingDestructive, setPendingDestructive] = useState<(() => void) | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll automático ao fim das mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Carrega consumo do mês ao montar
  useEffect(() => {
    void fetchUsage()
  }, [tenantId, productId])

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/usage?product_id=${productId}`)
      if (!res.ok) return
      const data = (await res.json()) as UsageInfo
      setUsage(data)
    } catch {
      // silencioso — uso não é crítico
    }
  }, [apiBase, productId])

  // ─── Envio de mensagem ───────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: Message = { id: generateId(), role: 'user', content: text }
    const typingMsg: Message = { id: generateId(), role: 'assistant', content: '', isTyping: true }

    setMessages((prev) => [...prev, userMsg, typingMsg])
    setInput('')
    setIsStreaming(true)

    let assistantId = typingMsg.id
    let fullContent = ''

    try {
      await postWithSse(
        `${apiBase}/chat`,
        { message: text, conversation_id: conversationId, product_id: productId },
        // onToken
        (token) => {
          fullContent += token
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: fullContent, isTyping: false }
                : m
            )
          )
        },
        // onDone
        (newConversationId) => {
          if (newConversationId) setConversationId(newConversationId)
          setIsStreaming(false)
          void fetchUsage()
        },
        // onError
        (errorMsg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Erro: ${errorMsg}`, isTyping: false }
                : m
            )
          )
          setIsStreaming(false)
        }
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Erro inesperado. Tente novamente.', isTyping: false }
            : m
        )
      )
      setIsStreaming(false)
    }
  }, [apiBase, conversationId, isStreaming, productId, fetchUsage])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      void sendMessage(input)
    },
    [input, sendMessage]
  )

  // ─── Upload de arquivo ───────────────────────────────────────────────────────

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!SUPPORTED_TYPES.includes(file.type)) {
      alert('Tipo de arquivo não suportado. Use PDF, imagem, Excel ou vídeo.')
      return
    }

    const type = detectFileType(file)
    let previewUrl: string | null = null

    if (type === 'image') {
      previewUrl = URL.createObjectURL(file)
    }

    setFilePreview({ file, previewUrl, type })
  }, [])

  const cancelFilePreview = useCallback(() => {
    if (filePreview?.previewUrl) URL.revokeObjectURL(filePreview.previewUrl)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [filePreview])

  // ─── Nova conversa ───────────────────────────────────────────────────────────

  const startNewConversation = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setInput('')
    setFilePreview(null)
  }, [])

  // ─── Confirmação destrutiva ──────────────────────────────────────────────────

  const requestDestructiveConfirmation = useCallback((action: () => void) => {
    setPendingDestructive(() => action)
  }, [])

  const confirmDestructive = useCallback(() => {
    if (pendingDestructive) {
      pendingDestructive()
      setPendingDestructive(null)
    }
  }, [pendingDestructive])

  // ─── Alerta de custo ─────────────────────────────────────────────────────────

  const showCostAlert =
    usage !== null &&
    !alertDismissed &&
    (usage.usage_percent >= 100 || usage.usage_percent >= 80)

  const costAlertLevel = usage && usage.usage_percent >= 100 ? 'critical' : 'warning'

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="gabi-container">

      {/* Header com 4 papéis */}
      <div className="gabi-header">
        <div className="gabi-title">
          <span className="gabi-avatar">✦</span>
          <strong>Gabi</strong>
        </div>
        <div className="gabi-roles">
          {(Object.keys(ROLE_LABELS) as GabiRole[]).map((role) => (
            <button
              key={role}
              className={`gabi-role-tab ${activeRole === role ? 'active' : ''}`}
              onClick={() => setActiveRole(role)}
              type="button"
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
        <button className="gabi-new-chat" onClick={startNewConversation} type="button">
          + Nova conversa
        </button>
      </div>

      {/* Alerta de custo — anti-spam: apenas 1x por sessão após fechar */}
      {showCostAlert && (
        <div className={`gabi-cost-alert gabi-cost-alert--${costAlertLevel}`}>
          <span>
            {costAlertLevel === 'critical'
              ? '⚠️ Limite mensal atingido (100%). Novas ações podem ser bloqueadas.'
              : `⚠️ Consumo em ${usage?.usage_percent ?? 0}% do limite mensal.`}
          </span>
          <button onClick={() => setAlertDismissed(true)} type="button">✕</button>
        </div>
      )}

      {/* Área de mensagens */}
      <div className="gabi-messages">
        {messages.length === 0 && (
          <div className="gabi-empty-state">
            <p>Olá! Sou a Gabi, sua assistente de execução.</p>
            <p>Como posso ajudar você hoje?</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`gabi-message gabi-message--${msg.role}`}>
            {msg.isTyping ? (
              <span className="gabi-typing-indicator">. . .</span>
            ) : (
              <p className="gabi-message-content">{msg.content}</p>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Preview de arquivo */}
      {filePreview && (
        <div className="gabi-file-preview">
          <div className="gabi-file-preview__header">
            <span>📎 {filePreview.file.name}</span>
            <button onClick={cancelFilePreview} type="button">✕ Cancelar</button>
          </div>
          {filePreview.type === 'image' && filePreview.previewUrl && (
            <img
              src={filePreview.previewUrl}
              alt="Preview"
              className="gabi-file-preview__image"
            />
          )}
          {filePreview.type !== 'image' && (
            <span className="gabi-file-preview__type-icon">
              {filePreview.type === 'pdf' && '📄 PDF'}
              {filePreview.type === 'excel' && '📊 Excel'}
              {filePreview.type === 'video' && '🎥 Vídeo'}
              {filePreview.type === 'other' && '📁 Arquivo'}
            </span>
          )}
        </div>
      )}

      {/* Input */}
      <form className="gabi-input-area" onSubmit={handleSubmit}>
        <button
          className="gabi-upload-btn"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Anexar arquivo (PDF, imagem, Excel, vídeo)"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.mp4,.webm"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <textarea
          className="gabi-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void sendMessage(input)
            }
          }}
          placeholder={`Pergunte para a Gabi (${ROLE_LABELS[activeRole]})...`}
          rows={1}
          disabled={isStreaming}
        />
        <button
          className="gabi-send-btn"
          type="submit"
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? '⏳' : '➤'}
        </button>
      </form>

      {/* Modal de confirmação para ações destrutivas */}
      {pendingDestructive && (
        <div className="gabi-modal-overlay">
          <div className="gabi-modal">
            <h3>⚠️ Confirmar ação destrutiva</h3>
            <p>Esta ação não pode ser desfeita e será registrada no histórico.</p>
            <p className="gabi-modal__notice">📝 Esta conversa será salva no histórico</p>
            <div className="gabi-modal__actions">
              <button
                className="gabi-modal__cancel"
                onClick={() => setPendingDestructive(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="gabi-modal__confirm"
                onClick={confirmDestructive}
                type="button"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Expõe requestDestructiveConfirmation para uso externo se necessário
export type { GabiProps, GabiRole }
