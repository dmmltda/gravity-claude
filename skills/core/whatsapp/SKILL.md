---
name: antigravity-whatsapp
description: "Use esta skill sempre que uma tarefa envolver o serviço de WhatsApp da plataforma Gravity. Define arquitetura completa com Meta Cloud API (envio e recebimento), normalização de número brasileiro, janela de 24 horas e templates, webhook com validação HMAC-SHA256, SSE para tempo real, modo Gabi por conversa com resposta automática, análise de temperatura ao encerrar, sistema de alertas de custo, painel de conversas com filtros e schema completo do banco."
---

# Gravity — Serviço de WhatsApp

## O Que é Este Serviço

Serviço de tenant — existe **uma vez por empresa**. Uma conversa por contato, não por produto.

> **Princípio:** inbox unificada por tenant com rastreamento completo de cada conversa, análise de sentimento (temperatura) e respostas automáticas via Gabi.

---

## Localização na Arquitetura

```text
servicos-global/tenant/whatsapp/
├── src/
│   ├── WhatsApp.tsx
│   └── index.ts
├── server/
│   └── routes.ts
└── prisma/
    └── fragment.prisma
```

> **Regra crítica:** nenhum arquivo chama a API Meta diretamente. Toda comunicação passa por `sendTextMessage()` ou `sendTemplateMessage()` em `server/services/whatsapp.ts`.

---

## Integrações Externas

| Serviço | Função |
|:---|:---|
| **Meta Cloud API** | `graph.facebook.com/v19.0` — envio e recebimento |
| **Gabi (Gemini 2.5 Flash)** | Resposta automática e análise de temperatura ao encerrar |

---

## Variáveis de Ambiente

```bash
WHATSAPP_ACCESS_TOKEN=...       # System User Token PERMANENTE do Meta Business Manager
WHATSAPP_PHONE_NUMBER_ID=...    # ID do número business na Meta
WHATSAPP_APP_SECRET=...         # Segredo para validar HMAC do webhook
WHATSAPP_VERIFY_TOKEN=...       # Token livre para verificação inicial
WHATSAPP_MONTHLY_LIMIT_USD=20
WHATSAPP_ALERT_PCT=80
WHATSAPP_ALERT_EMAIL=...
```

> ⚠️ O token deve ser um **System User Access Token PERMANENTE** gerado no Meta Business Manager. Tokens temporários expiram em 60 dias e causam falhas silenciosas.
> **Nota:** `app_settings` tem prioridade sobre `.env` — permite alterar o token pelo painel sem reiniciar o servidor.

---

## Fluxo 1 — Envio (Outbound)

```text
Agente ou Gabi
  → chama sendTextMessage() ou sendTemplateMessage()
  → server/services/whatsapp.ts (único acesso à Meta)
  → POST graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
  → Meta Cloud API
  → retorna { messages: [{ id: "wamid.xxx" }] }
```

### Normalização brasileira obrigatória

A Meta envia webhooks com números de 12 dígitos (sem o 9), mas para entregar precisa de 13. O serviço injeta o 9 automaticamente:

```typescript
// 554888480707 → 5548988480707
function normalizePhoneForSend(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.length === 12 && clean.startsWith('55')) {
    return clean.slice(0, 4) + '9' + clean.slice(4)
  }
  return clean
}
```

---

## Fluxo 2 — Recebimento (Inbound / Webhook)

```text
Meta Cloud API → POST webhook → /api/v1/whatsapp/webhook
```

Processamento obrigatório:
1. Valida HMAC-SHA256 imediatamente
2. Responde **200 OK imediatamente** (obrigatório em < 5s)
3. Processa assincronamente via `setImmediate()`:
   - Normaliza número
   - `findOrCreateConversation()`
   - Grava mensagem no banco
   - Emite via SSE para agentes
   - Se `ai_enabled` → aciona Gabi

---

## Janela de Conversa de 24 Horas

| Situação | O que pode enviar | Custo estimado |
|:---|:---|:---|
| Dentro da janela (cliente escreveu nas últimas 24h) | Mensagem de texto livre | ~$0.025/conversa/dia |
| Fora da janela (+24h desde o último contato) | Apenas Mensagens de Template (aprovadas pela Meta) | Custo por categoria |

---

## Validação HMAC-SHA256 (Segurança do Webhook)

```typescript
import crypto from 'crypto'

function validateWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = 'sha256=' +
    crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET!)
      .update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
```

---

## Gestão de Conversas

### findOrCreateConversation()

```text
Número recebido
  → busca conversa 'open' do tenant
  → Achou → retorna conversa existente
  → Não achou → cria nova (temperatura: "neutra")
```

### Modo Gabi por Conversa (`ai_enabled`)

1. Busca histórico (últimas 10 mensagens)
2. Chama Gemini (`temperature: 0.2`)
3. Envia resposta com `origin: 'gabi'`
4. Emite via SSE

### Análise de Temperatura ao Encerrar

| Score | Temperatura | Significado |
|:---|:---|:---|
| 1/5 | Crítico | Cliente muito insatisfeito |
| 2/5 | Negativo | Reclamação |
| 3/5 | Neutro | Sem opinião clara |
| 4/5 | Positivo | Satisfeito |
| 5/5 | Encantado | Experiência excelente |

---

## SSE — Tempo Real para Agentes

```text
GET /api/v1/whatsapp/stream → text/event-stream
```

- `data: {"type":"new_message", ...}` — nova mensagem
- `:ping` a cada 30s (heartbeat)

---

## Schema Prisma (fragment.prisma)

```prisma
model WhatsAppConversation {
  id                      String    @id @default(cuid())
  tenant_id               String
  wa_phone_number         String
  status                  String    @default("open")
  contact_id              String?
  company_id              String?
  contact_nome            String?
  company_nome            String?
  activity_id             String?
  ai_enabled              Boolean   @default(false)
  opened_at               DateTime  @default(now())
  closed_at               DateTime?
  gabi_temperatura        String?
  gabi_temperatura_score  Int?
  gabi_resumo             String?
  gabi_acoes_sugeridas    Json?

  @@index([tenant_id])
  @@index([tenant_id, status])
  @@index([tenant_id, wa_phone_number])
}

model WhatsAppMessage {
  id              String   @id @default(cuid())
  tenant_id       String
  conversation_id String
  wa_message_id   String?  @unique
  direction       String
  content_type    String   @default("text")
  content         String
  origin          String   @default("agent")
  sent_by         String?
  status          String   @default("sent")
  created_at      DateTime @default(now())

  @@index([tenant_id])
  @@index([tenant_id, conversation_id])
  @@index([wa_message_id])
}

model WhatsAppUsageLog {
  id                    String   @id @default(cuid())
  tenant_id             String
  conversation_id       String?
  company_id            String?
  conversation_category String
  origin                String
  cost_usd              Decimal
  created_at            DateTime @default(now())

  @@index([tenant_id])
}

model WhatsAppAutomation {
  id           String   @id @default(cuid())
  tenant_id    String
  name         String
  trigger      String
  conditions   Json?
  template_id  String
  recipient    String
  active       Boolean  @default(true)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  @@index([tenant_id])
  @@index([tenant_id, active])
}
```

---

## Checklist — Antes de Entregar

- [ ] Iniciar conversa bloqueado se contato não tem WhatsApp cadastrado?
- [ ] Badge "⚠️ Não vinculado" + botão "Vincular" para números desconhecidos?
- [ ] Encerramento bloqueado sem vínculo — alerta antes de confirmar?
- [ ] Webhook responde 200 OK imediatamente + processa via `setImmediate()`?
- [ ] Validação HMAC-SHA256 com `timingSafeEqual`?
- [ ] Normalização do 9º dígito BR no envio?
- [ ] Modo Gabi por conversa (`ai_enabled`) com fallback chain Gemini?
- [ ] Análise de temperatura ao encerrar conversa?
- [ ] SSE com heartbeat de 30s e auto-cleanup?
- [ ] `wa_message_id` UNIQUE para deduplicação nativa?
- [ ] Fragment.prisma com as 4 tabelas e índices obrigatórios?
- [ ] Todas as variáveis de ambiente no `.env.example`?
