---
name: antigravity-cronometro
description: "Use esta skill sempre que uma tarefa envolver o serviço de cronômetro da plataforma Gravity. Define o cronômetro como serviço de tenant para registro de tempo por usuário, integrado na aba Tempo de qualquer atividade. Cobre: timer com display HH:MM:SS, lançamento manual em minutos, sessões registradas com assunto editável, vínculo de sessão a ações específicas (NF, reunião, processo ou item personalizado), relatório de tempo consolidado e schema Prisma."
---

# Gravity — Serviço de Cronômetro

## O Que é Este Serviço

Serviço de tenant — o **tempo pertence ao usuário**, independente do produto. Um usuário pode cronometrar tempo em atividades do Simulador Comex, do NF Importação ou atividades próprias — tudo consolidado no mesmo lugar.

> **Princípio:** o tempo do usuário é do tenant, não do produto. Um único histórico de sessões por usuário, visível em todos os produtos.

---

## Localização na Arquitetura

```text
servicos-global/tenant/cronometro/
├── src/
│   ├── Cronometro.tsx
│   └── index.ts
├── server/
│   └── routes.ts
└── prisma/
    └── fragment.prisma
```

---

## Onde o Cronômetro Aparece

O cronômetro aparece na **aba Tempo** do modal de qualquer atividade. Não é uma tela separada — é um componente embutido no contexto de uma atividade.

```text
Modal de Atividade
├── Aba: Informações
├── Aba: Tempo        ← cronômetro vive aqui
├── Aba: Próximo Passo
└── Aba: Lembrete
```

---

## Casos de Uso

| Caso | Exemplo |
|:---|:---|
| Atividade própria | "Preparar relatório mensal" |
| Atividade do sistema | "[Intervenção Cód IA] Analisar resposta de e-mail" |
| Reunião | "Reunião com cliente Empresa X" |
| Processo específico | Emissão da NF nº 00123 |
| Item personalizado | Qualquer assunto que o usuário define livremente |

---

## Interface — Aba Tempo

### Seção CRONÔMETRO

```text
⏱ CRONÔMETRO
TEMPO TRABALHADO
00 : 00 : 00   [▶ Iniciar]
```

**Comportamento do timer:**
- Exibe `HH : MM : SS` em tempo real enquanto rodando
- **Iniciar** → começa a contar + muda para **Pausar**
- **Pausar** → pausa o timer (mantém o tempo acumulado)
- **Retomar** → continua de onde parou
- **Parar e Salvar** → encerra a sessão e grava no banco
- Apenas **um timer ativo por usuário** por vez — se abrir outra atividade, o timer continua em background

**Timer em background:**
- Quando o usuário fecha o modal sem parar, o timer continua contando
- Indicador visual no header/sidebar mostrando que há um timer ativo
- Clicar no indicador → abre a atividade com o timer rodando

---

### Seção OU INFORME MANUALMENTE

```text
✏️ OU INFORME MANUALMENTE
Tempo em minutos — ex: 90 = 1h30min
[______________________] campo numérico
[+ Adicionar sessão manual]
```

**Regras:**
- Aceita apenas números inteiros positivos
- Converte automaticamente: 90 min → 1h30min
- Cria sessão com `started_at` = agora e `duration_minutes` = valor informado
- Campo de assunto **obrigatório** para sessões manuais (rastreabilidade)

---

### Seção SESSÕES REGISTRADAS

| Coluna | Descrição |
|:---|:---|
| DATA | Data da sessão (ex: 18/03/2026) |
| HORA | Hora de início (ex: 16:28) |
| DURAÇÃO | Badge com tempo formatado (ex: ⏱ 1min, ⏱ 2h30min) |
| ASSUNTO | Campo editável inline — "Adicionar assunto..." |
| AÇÕES | Botão deletar sessão (ícone lixeira) |

---

## Vínculo de Sessão a Ações

Cada sessão pode ser vinculada a uma ação específica além do assunto livre:

| Tipo | Exemplo |
|:---|:---|
| Emissão de NF | NF nº 00123 — Empresa X |
| Reunião | Reunião de kickoff — 21/03/2026 |
| Processo | DI nº 2026/00456 |
| Item personalizado | Texto livre definido pelo usuário |

**Como vincular:**
```text
Usuário clica no campo "Assunto"
  ↓
Dropdown abre com opções:
  - Texto livre (digitar)
  - Vincular a NF → busca notas fiscais do produto
  - Vincular a Reunião → busca atividades do tipo reunião
  - Vincular a Processo → busca processos do produto
  - Item personalizado → campo livre com label
```

O vínculo é gravado nos campos `linked_type` + `linked_id` da sessão.

---

## Rotas da API

```text
# Sessões de tempo
GET    /api/v1/timers/:activity_id         ← sessões de uma atividade
POST   /api/v1/timers/:activity_id/start   ← iniciar timer
POST   /api/v1/timers/:activity_id/pause   ← pausar timer ativo
POST   /api/v1/timers/:activity_id/stop    ← parar e salvar sessão
POST   /api/v1/timers/:activity_id/manual  ← lançar tempo manual
PATCH  /api/v1/timers/sessions/:id         ← editar assunto / vínculo
DELETE /api/v1/timers/sessions/:id         ← deletar sessão

# Timer ativo do usuário
GET    /api/v1/timers/active               ← timer rodando agora (se houver)

# Relatório
GET    /api/v1/timers/report               ← tempo total por período/usuário
```

---

## Event Bus

```typescript
// Quando um timer é iniciado
emit('timer:started', { activity_id, user_id, tenantId })

// Quando um timer é pausado
emit('timer:paused', { activity_id, user_id, duration: seconds })

// Quando uma sessão é salva
emit('timer:stopped', { activity_id, duration })

// Dashboard e relatórios escutam para atualizar métricas
on('timer:stopped', ({ activity_id, duration }) => {
  // atualiza totais no dashboard
})
```

---

## Schema Prisma (fragment.prisma)

```prisma
// servicos-global/tenant/cronometro/prisma/fragment.prisma

model TimerSession {
  id               String   @id @default(cuid())
  tenant_id        String
  user_id          String
  activity_id      String
  product_id       String?

  // Dados da sessão
  started_at       DateTime
  ended_at         DateTime?
  duration_minutes Int?         // null = timer ainda ativo
  is_manual        Boolean  @default(false)

  // Assunto e vínculo
  subject          String?      // texto livre do assunto
  linked_type      String?      // nf | meeting | process | custom
  linked_id        String?      // ID do item vinculado
  linked_label     String?      // label de exibição

  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  @@index([tenant_id])
  @@index([tenant_id, user_id])
  @@index([tenant_id, activity_id])
  @@index([tenant_id, user_id, started_at])
}

model TimerActive {
  id                  String   @id @default(cuid())
  tenant_id           String
  user_id             String   @unique   // um timer ativo por usuário
  activity_id         String
  started_at          DateTime
  paused_at           DateTime?
  accumulated_seconds Int      @default(0)  // segundos acumulados antes de pausas

  @@index([tenant_id])
  @@index([user_id])
}
```

---

## Regras de Negócio

1. **Um timer por usuário** — se o usuário iniciar timer em outra atividade, o anterior é pausado automaticamente
2. **Timer persiste entre sessões** — se o usuário fechar o browser, o timer continua no banco com `started_at` registrado
3. **Sessões manuais** — sempre exigem assunto para rastreabilidade
4. **Deletar sessão** — perguntar confirmação via `ConfirmarGlobal`
5. **Tempo mínimo** — sessões com menos de 1 minuto são descartadas ao parar, para evitar registros acidentais (exceto manuais)
6. **Vínculo opcional** — o assunto livre sempre é aceito; o vínculo a NF/reunião/processo é opcional

---

## Regras de Isolamento

- `tenant_id` e `user_id` obrigatórios em toda query
- Usuário só vê suas próprias sessões — nunca de outro usuário do mesmo tenant
- Middleware `withTenantIsolation` aplicado em todas as queries
- Consultar `antigravity-tenant-isolation` para as regras completas

---

## Checklist — Antes de Entregar

- [ ] Display HH:MM:SS com Iniciar / Pausar / Retomar / Parar e Salvar?
- [ ] Timer em background com indicador visual no header quando ativo?
- [ ] Apenas um timer ativo por usuário — pausa o anterior automaticamente?
- [ ] Seção de lançamento manual com conversão minutos → horas?
- [ ] Tabela de sessões com Data, Hora, Duração (badge) e Assunto editável inline?
- [ ] Dropdown de vínculo: NF, Reunião, Processo, Item personalizado?
- [ ] Total acumulado da atividade exibido em tempo real?
- [ ] Event bus emitindo `timer:started`, `timer:paused`, `timer:stopped`?
- [ ] Timer persiste no banco entre sessões do browser?
- [ ] Sessões < 1 minuto descartadas automaticamente?
- [ ] Confirmação antes de deletar sessão via `ConfirmarGlobal`?
- [ ] Fragment.prisma com `TimerSession` e `TimerActive` e índices obrigatórios?
