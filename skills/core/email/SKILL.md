---
name: antigravity-email
description: "Use esta skill sempre que uma tarefa envolver o serviço de email da plataforma Gravity. Define arquitetura completa com Resend (envio) e Resend Inbound Webhooks (recebimento), Reply-To dinâmico com UUID para threading, sistema de deduplicação em 3 camadas, integração com Gabi (Gemini 2.5 Flash) para triagem e resposta automática, score de sentimento, SLAs de tempo de resposta, sistema de alertas de custo da Gabi, monitor de emails com filtros e modal de thread, deep link para navegação direta e schema completo do banco."
---

# Gravity — Serviço de Email

## O Que é Este Serviço

Serviço de tenant — existe **uma vez por empresa**, independente de quantos produtos ela use. Uma inbox por empresa, não por produto.

> **Princípio:** uma inbox unificada por tenant, com rastreamento completo de cada thread, análise de sentimento pela Gabi e respostas automáticas para intenções simples.

---

## Localização na Arquitetura

```text
servicos-global/tenant/email/
├── src/
│   ├── Email.tsx
│   └── index.ts
├── server/
│   └── routes.ts
└── prisma/
    └── fragment.prisma
```

---

## Integrações Externas

| Serviço | Função |
|:---|:---|
| **Resend API** | Envio — único ponto de acesso em todo o sistema |
| **Resend Inbound Webhooks** | Recebimento — MX roteia para o Resend |
| **Gabi (Gemini 2.5 Flash)** | IA — triagem, sentimento, resposta automática |

---

## Variáveis de Ambiente

```bash
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=...
EMAIL_FROM=Produto <aviso@resend.dev>
EMAIL_INBOUND_ADDRESS=reply@dominio.com.br  # base do Reply-To dinâmico
GABI_MONTHLY_LIMIT_USD=20
GABI_ALERT_PCT=80
GABI_ALERT_EMAIL=...
```

> **Regra crítica:** nenhum arquivo faz chamadas diretas ao Resend. Toda comunicação passa pela função `sendEmail()` em `server/services/email.ts`.

---

## Fluxo 1 — Envio (Outbound)

```text
Qualquer parte do sistema
  → chama sendEmail()
  → server/services/email.ts (Resend API)
  → Servidor de destino
```

**Reply-To dinâmico:** cada email enviado tem `Reply-To: reply+{uuid}@dominio.com.br`. O UUID é o `dedup_key` do log de envio.

```typescript
// email.ts — Reply-To dinâmico
const [local, domain] = process.env.EMAIL_INBOUND_ADDRESS!.split('@')
sendOpts.replyTo = `${local}+${dedupKey}@${domain}`
// Resultado: reply+f47ac10b-58cc-4372-a567@dominio.com.br
```

> ⚠️ Se `EMAIL_INBOUND_ADDRESS` não estiver configurado, o webhook não consegue vincular a resposta ao email pai.

---

## Fluxo 2 — Recebimento (Inbound) + Gabi AI

```text
Cliente responde
  → Resend Webhook (identifica Reply-To)
  → server/routes.ts
  → Fila / Dedup 3 camadas
  → Gabi: Triagem
  → Ação: auto_reply | escalate_to_human
```

### Deduplicação — 3 Camadas

1. **Resend ID:** Bloqueia IDs de mensagem já processados
2. **Timestamp:** Ignora emails com mesmo conteúdo/remetente em < 5s
3. **IA Hash:** Gabi compara se o novo corpo é semanticamente idêntico ao anterior

---

## Gabi — Inteligência e Custos

### Score de Sentimento

| Nível | Emoji | Pontos | Descrição |
|:---|:---|:---|:---|
| `very_positive` | ❤️ | 100 | Elogios efusivos |
| `positive` | ✅ | 75 | Satisfeito |
| `neutral` | 😐 | 50 | Neutro |
| `negative` | ⚠️ | 25 | Reclamação |
| `very_negative` | 🔴 | 0 | Ameaça cancelar |

Score final: `-1 a 1`. Emails com score `< -0.5` disparam alerta imediato.

### Alertas de Custo

- **80% do limite:** E-mail de aviso para `GABI_ALERT_EMAIL`
- **100% do limite:** Gabi entra em **"Somente Triagem"** — para de gerar respostas automáticas

### Modelos usados

- **Principal:** `gemini-2.5-flash`
- **Fallback:** `gemini-flash-latest`

### Fallback por palavras-chave

```typescript
const isNegative = /ruim|péssimo|horrível|insatisfeito|cancelar|não consigo|reclamação|problema/i.test(body)
```

---

## SLAs e Métricas

| Responsável | SLA |
|:---|:---|
| Gabi (resposta automática) | ≤ 2 minutos |
| Equipe (resposta humana) | ≤ 2 horas |
| Cliente (resposta recebida) | ≤ 24 horas |

---

## Schema de Banco (fragment.prisma)

```prisma
model EmailThread {
  id         String         @id @default(uuid())
  tenant_id  String
  subject    String
  sentiment  Float          @default(0)  // -1 a 1
  status     String         @default("open")  // open, archived, resolved
  messages   EmailMessage[]
  created_at DateTime       @default(now())
  updated_at DateTime       @updatedAt

  @@index([tenant_id])
}

model EmailMessage {
  id               String      @id @default(uuid())
  thread_id        String
  thread           EmailThread @relation(fields: [thread_id], references: [id])
  resend_id        String?     @unique
  direction        String      // inbound | outbound
  from             String
  to               String
  body             String      @db.Text
  sent_at          DateTime    @default(now())
  gabi_response    String?     @db.Text
  gabi_confidence  Float?

  @@index([thread_id])
}
```

---

## Monitor de Emails (UI)

- **Filtros:** Por sentimento, status e thread
- **Thread Modal:** Conversa completa estilo Gmail com resposta manual
- **Deep Link:** `https://.../email/thread/{uuid}` — linkado em alertas automáticos

---

## Emissão de Eventos

```typescript
emit('email:received', { id, from, subject, tenantId })
emit('email:failed',   { to, subject, error, tenantId })

// Gabi escuta e responde
on('email:received', ({ id, tenantId }) => {
  // Gabi analisa e decide: auto_replied ou escalated_to_human
})
```

---

## Escala — BullMQ (Fase 3)

| Plano Resend | Throughput | 1000 emails |
|:---|:---|:---|
| Free | 1 req/s | ~17 min |
| **Pro (mínimo para produção)** | **10 req/s** | **~10-30s** |
| Business | 100 req/s | ~10s |

---

## Regras de Isolamento

- `tenant_id` obrigatório em toda query
- Middleware `withTenantIsolation` aplicado
- RLS configurado em `EmailSendLog`, `EmailTemplate`, `EmailDraft`

---

## Checklist — Antes de Entregar

- [ ] Caixa de saída com barra de progresso e tempo estimado em tempo real?
- [ ] Stat cards atualizando a cada 2 segundos?
- [ ] Tabela da fila com posição, tentativas e próxima tentativa?
- [ ] Botões pausar/retomar/cancelar (individual e total)?
- [ ] Reply-To dinâmico com UUID quando `EMAIL_INBOUND_ADDRESS` presente?
- [ ] Webhook busca conteúdo via `GET /emails/{id}` — não usa payload bruto?
- [ ] Deduplicação em 3 camadas implementada?
- [ ] Gabi analisa com Gemini 2.5 Flash + fallback por palavras-chave?
- [ ] Auto-resposta com tag `gabi-auto-reply` e `skipLog: true`?
- [ ] Escalamento criando atividade com deep link `[EMAIL_LOG:{id}]`?
- [ ] Alertas de custo da Gabi (80% e 100% do limite)?
- [ ] Monitor com 5 stat cards e filtros completos?
- [ ] Modal de thread com sentimento, SLAs e bloco de triagem da Gabi?
- [ ] Fragment.prisma com `dedup_key`, `direction`, `parent_email_id`, `gabi_analysis`?
- [ ] Todas as variáveis no `.env.example`?
