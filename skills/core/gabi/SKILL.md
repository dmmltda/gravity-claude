---
name: antigravity-gabi
description: "Use esta skill sempre que uma tarefa envolver a Gabi AI da plataforma Gravity. Define a Gabi como agente autônomo com permissões espelhadas do usuário — pode criar, editar, excluir, enviar emails, WhatsApp, gerar relatórios e executar qualquer ação que o usuário tenha permissão. Cobre 4 papéis (Help Desk, Customer Success, Treinamento e Analista de Dados), 6 barreiras de segurança (assertGabiPermission, auditoria com snapshot, rollback se audit falhar, confirmação para ações destrutivas, ator identificado como gabi, transparência), streaming SSE, recebimento de arquivos, contexto de 20 mensagens com sumarização e schema Prisma."
---

# Gravity — Gabi AI

## O Que é a Gabi

A Gabi é a inteligência central da Gravity — um **agente de execução** que opera com a mesma autoridade e contexto do usuário logado. Seu objetivo é eliminar tarefas manuais repetitivas através de linguagem natural.

> **A Gabi não tem permissão própria.** Ela atua como um "proxy" do usuário — executa apenas o que o usuário poderia executar manualmente.

---

## 4 Papéis da Gabi

### 1 — Help Desk Inteligente
- Responde dúvidas sobre o uso da plataforma Gravity
- Consulta a base de conhecimento (skills e docs) para orientar o usuário
- Explica regras de negócio complexas

### 2 — Customer Success
- Analisa a saúde dos clientes com base em dados de uso e alertas
- Sugere ações proativas: *"O cliente X não envia emails há 10 dias, quer que eu redija um contato?"*

### 3 — Treinamento e Onboarding
- Gera guias passo a passo baseados nos processos do próprio tenant
- Cria materiais de treinamento personalizados para novos usuários

### 4 — Analista de Dados
- Interpreta planilhas e resultados de relatórios
- Gera insights e gráficos (via dashboard) sob demanda

---

## O Que a Gabi Pode Fazer

| Categoria | Ações |
|:---|:---|
| **Dados** | Criar, editar, listar e excluir registros |
| **Comunicação** | Enviar emails (Resend) e mensagens WhatsApp |
| **Relatórios** | Gerar relatórios PDF/Excel sob demanda |
| **Tempo** | Iniciar, pausar e consultar cronômetros |
| **Atividades** | Registrar e consultar históricos de alterações |
| **Configurações** | Ajustar políticas, configurar conectores ERP/SAP (se tiver permissão) |

---

## Barreira de Segurança 1 — Permissões Espelhadas

```typescript
export async function assertGabiPermission(
  userId: string,
  action: string,
  resource: string
) {
  const hasPermission = await checkUserPermission(userId, action, resource)
  if (!hasPermission) {
    throw new Error(
      `Gabi: Usuário ${userId} não tem permissão para ${action} em ${resource}`
    )
  }
}
```

> **Regra:** `assertGabiPermission()` é a **primeira linha** de toda função de ação da Gabi.

---

## Barreira de Segurança 2 — Print da Conversa no Histórico

Toda ação executada pela Gabi é acompanhada de um snapshot da conversa gravado na tabela `GabiUsageLog`.

```typescript
async function executeGabiAction(userId: string, actionPayload: GabiAction) {
  // 1. Verifica permissão
  await assertGabiPermission(userId, actionPayload.type, actionPayload.resource)

  // 2. Grava log ANTES de executar
  const log = await prisma.gabiUsageLog.create({
    data: {
      userId,
      actionTaken: actionPayload.type,
      conversationSnapshot: actionPayload.context  // snapshot obrigatório
    }
  })

  // 3. Se o log falhar, cancela a ação (Barreira 3 — rollback)
  if (!log) {
    throw new Error('Falha ao registrar auditoria da Gabi. Ação cancelada.')
  }

  return await runService(actionPayload)
}
```

**Exemplo de snapshot:**
```json
{
  "last_user_query": "Gabi, por favor exclua todos os serviços do tenant 'Teste'",
  "gabi_plan": "Vou listar os serviços do tenant 'Teste' (ID: 123) e excluí-los um por um.",
  "reasoning": "Usuário deu comando explícito em linguagem natural."
}
```

---

## 6 Barreiras de Segurança — Resumo

| Barreira | Regra | Implementação |
|:---|:---|:---|
| 1 — Permissão verificada | `assertGabiPermission()` é a primeira linha de toda ação | Código em todo service |
| 2 — Print da conversa | `auditGabiAction()` com `conversation_snapshot` obrigatório | Tabela `GabiUsageLog` |
| 3 — Rollback se audit falhar | `executeGabiAction()` cancela se o histórico não gravar | Try/Catch com rollback |
| 4 — Confirmação destrutiva | Delete e exclusão em massa sempre pedem confirmação | Intervenção UI |
| 5 — Ator identificado | `actor_type: 'gabi' + triggered_by: userId` no audit log | Metadata de transação |
| 6 — Transparência | Gabi informa quando verifica permissão e quando executa | UI Feedback |

---

## Streaming — UX Rápida Obrigatória

Como a Gabi pode executar processos longos, o chat usa **Server-Sent Events (SSE)** para que o usuário veja o "raciocínio" da Gabi sendo construído em tempo real.

- Indicador `. . .` obrigatório antes do primeiro token
- Aviso **"📝 Esta conversa será salva no histórico"** antes de toda ação que modifica dados

---

## Modelos e Configurações

| Configuração | Valor |
|:---|:---|
| **Engine** | Gemini 1.5 Pro ou Flash (configurável por tenant) |
| **Contexto** | Últimas 20 mensagens em memória |
| **Sumarização** | Automática para conversas mais longas |
| **Fallback chain** | 5 modelos Gemini |

### Recebimento de Arquivos

Suporta: **PDF, PNG/JPG, Excel, vídeos curtos**

A Gabi lê o conteúdo e age sobre ele: *"Importe este Excel de serviços"*

- Preview do arquivo antes de enviar (obrigatório)

---

## Contexto da Conversa — System Prompt

O system prompt é injetado dinamicamente com:

```typescript
const systemPrompt = `
Você é a Gabi, agente de execução da Gravity.
Você atua com as permissões do usuário: ${user.name} (${user.role}).

TENANT: ${tenant.name}
SERVIÇOS ATIVOS: ${activeServices.join(', ')}

REGRAS ABSOLUTAS:
- Nunca execute uma ação sem verificar permissão primeiro
- Toda ação que modifica dados deve ser registrada no histórico
- Ações destrutivas (delete, exclusão em massa) sempre exigem confirmação do usuário
`
```

---

## Integrações Externas

| Integração | Canal |
|:---|:---|
| WhatsApp | Via API dedicada com logs de entrega |
| Email | Via Resend, com template padrão da Gravity |
| SAP/ERP | Via Conector ERP, respeitando tokens S2S |

---

## Sistema de Alertas de Custo

- Configuração de limite financeiro por tenant
- Seções: Limite & Alertas | Consumo do Mês Atual | Notificações de Alerta
- Anti-spam: alerta enviado no máximo 1x por mês

---

## Schema Prisma (fragment.prisma)

```prisma
model GabiConversation {
  id        String        @id @default(cuid())
  tenant_id String
  userId    String
  title     String?
  messages  GabiMessage[]
  updatedAt DateTime      @updatedAt

  @@index([tenant_id])
  @@index([userId])
}

model GabiMessage {
  id             String           @id @default(cuid())
  conversationId String
  role           String           // 'user' | 'assistant' | 'system'
  content        String
  attachments    String?          // JSON com links de arquivos
  conversation   GabiConversation @relation(fields: [conversationId], references: [id])
}

model GabiUsageLog {
  id                   String   @id @default(cuid())
  userId               String
  tenantId             String
  actionTaken          String
  conversationSnapshot String   // JSON com contexto da conversa
  createdAt            DateTime @default(now())

  @@index([tenantId])
  @@index([userId])
}
```

---

## Checklist — Antes de Entregar

- [ ] Aviso "📝 Esta conversa será salva no histórico" antes de toda ação que modifica dados?
- [ ] Confirmação obrigatória para ações destrutivas com aviso de registro?
- [ ] Gabi responde dúvidas de help desk sobre o produto?
- [ ] Gabi analisa saúde de clientes e sugere ações proativas (CS)?
- [ ] Gabi gera guias e material de treinamento?
- [ ] Gabi interpreta dados e gera insights em linguagem natural?
- [ ] Gabi redige emails/WhatsApp com opção de revisar antes de enviar?
- [ ] Indicador `. . .` antes do primeiro token (streaming)?
- [ ] `assertGabiPermission()` como primeira linha de toda função de ação?
- [ ] `auditGabiAction()` com `conversation_snapshot` em toda ação efetiva?
- [ ] Rollback da ação se o audit falhar?
- [ ] Recebimento de imagem, PDF, Excel, vídeo?
- [ ] Preview de arquivo antes de enviar?
- [ ] System prompt com permissões do usuário atual + serviços ativos?
- [ ] Contexto das últimas 20 mensagens + sumarização automática?
- [ ] Fallback chain com 5 modelos Gemini?
- [ ] Alerta de custo com anti-spam mensal?
- [ ] Fragment.prisma com `GabiConversation`, `GabiMessage` e `GabiUsageLog`?
