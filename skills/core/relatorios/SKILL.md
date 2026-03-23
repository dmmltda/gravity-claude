---
name: antigravity-relatorios
description: "Use esta skill sempre que uma tarefa envolver o serviço de relatórios da plataforma Gravity. Define o relatório como serviço de tenant com workspace para criar, filtrar, customizar colunas com drag and drop, salvar relatórios nomeados, agendar envio via email/WhatsApp/notificação interna, compartilhar com permissões e exportar em CSV, Excel, JSON, XML e TXT. Cada produto define suas próprias colunas e dados via PRODUCT_CONFIG."
---

# Gravity — Serviço de Relatórios

## O Que é Este Serviço

Serviço de tenant — relatórios cruzam dados de todos os produtos que o tenant usa.

> **Princípio:** "Explore, filtre e exporte os dados do produto." O usuário monta a visão que precisa, salva com um nome e pode compartilhar ou agendar envio automático.

---

## Localização na Arquitetura

```text
servicos-global/tenant/relatorios/
├── src/
│   ├── Relatorios.tsx
│   └── index.ts
├── server/
│   └── routes.ts
└── prisma/
    └── fragment.prisma
```

---

## Como o Serviço Identifica o Produto Ativo

Ao inicializar, o serviço:
1. Lê o `PRODUCT_CONFIG` do produto atual para descobrir as tabelas disponíveis
2. Carrega as tabs correspondentes às tabelas registradas pelo produto
3. Aplica os filtros e colunas específicos de cada tabela

```text
Usuário abre Relatórios no NF Importação
  → Lê PRODUCT_CONFIG.reports.tables do NF Importação
  → Monta tabs: Declarações | Notas Fiscais | [+ Novo Relatório]

Usuário abre Relatórios no Simulador Comex
  → Lê PRODUCT_CONFIG.reports.tables do Simulador Comex
  → Monta tabs: Simulações | Cotações | [+ Novo Relatório]
```

**Tabs sempre presentes (dados do tenant, independente do produto):**
- Tab: **Tabela de Empresas** — dados consolidados do tenant
- Tab: **Aderência Mensal** — engajamento por período
- Tab: **+ Novo Relatório** — workspace em branco

> **Regra:** o serviço de relatórios nunca hardcoda tabelas de produtos. Tudo vem do `PRODUCT_CONFIG` do produto ativo.

---

## Relatório Unificado (Multi-Produto)

Quando o tenant tem 2+ produtos ativos, o usuário pode cruzar dados de múltiplos produtos:

```text
Tenant com 3 produtos: NF Importação + Simulador Comex + Bid Frete

1. Usuário abre "+ Novo Relatório"
2. Seleciona fontes de dados:
   [x] NF Importação → Notas Fiscais
   [x] Simulador Comex → Simulações
   [x] Bid Frete → Cotações de Frete
   [x] Tenant → Tabela de Empresas
3. Sistema consolida com JOIN por tenant_id e company_id
4. Relatório unificado com colunas de todos os produtos
```

**Regras de JOIN:**
- Campo padrão de cruzamento: `company_id`
- LEFT JOIN por padrão (registros sem correspondência aparecem mesmo assim)
- Usuário pode restringir apenas com correspondência em todos (INNER JOIN)
- Relatórios unificados salvos com `product_id: null` e campo `sources`

---

## Filtros

```text
[🔍 Buscar...]  [Status ▼]  [Tipo ▼]  [Segmento ▼]  [Health Score ▼]  [Responsável ▼]
[data início] até [data fim]
```

- Filtros aplicados em tempo real (debounce 300ms)
- Contador de resultados
- Botão Limpar — reseta todos os filtros
- Filtros disponíveis são configurados pelo produto no `PRODUCT_CONFIG`

---

## Colunas Visíveis — Drag & Drop

Botão "Colunas" abre painel com lista:
```text
COLUNAS VISÍVEIS
:: [x] Empresa
:: [x] CNPJ
:: [x] Status
:: [ ] Usuário
:: [ ] Cidade
```

- Ícone `::` (dots-six-vertical) para arrastar e reordenar
- Checkbox para mostrar/ocultar coluna
- Ordem aqui = ordem na tabela e na exportação

---

## Workspace — Salvar Relatório

```text
Nome do relatório
[Empresas Ativas Sul]

[Cancelar] [Salvar]
```

**Relatórios salvos:**
- Listados no painel lateral do workspace
- Podem ser renomeados, editados ou deletados
- Compartilháveis com outros usuários do tenant

---

## Agendamento de Envio

**Canais:**
- 📧 **Email** — anexo (CSV ou Excel) para os endereços configurados
- 💬 **WhatsApp** — mensagem com resumo + link de download
- 🔔 **Notificação interna** — aviso no sino para outro usuário

**Frequências:** Uma vez | Diário | Semanal | Mensal | Personalizado

---

## Exportação

| Formato | Conteúdo |
|:---|:---|
| CSV | Colunas visíveis separadas por vírgula |
| Excel | Formatado com cabeçalho e largura automática |
| JSON | Array de objetos com colunas visíveis |
| XML | Estrutura XML com namespace do produto |
| TXT | Colunas separadas por tabulação |

> **Regras:** exporta apenas os dados filtrados. Respeita ordem e visibilidade das colunas. Arquivo: `[nome-relatorio]-[data].[ext]`

---

## Como Produto Registra seu Relatório

```typescript
// produtos/nf-importacao/src/shared/config.ts
export const PRODUCT_CONFIG = {
  reports: [
    {
      id:       'notas-fiscais',
      label:    'Notas Fiscais',
      icon:     'receipt',
      endpoint: '/api/v1/notas-fiscais/report',
      columns: [
        { id: 'numero',      label: 'Número da NF',  sortable: true  },
        { id: 'data',        label: 'Data da NF',    sortable: true  },
        { id: 'valor_total', label: 'Valor Total',   sortable: true  },
        { id: 'qtde_itens',  label: 'Qtde Itens',    sortable: false },
        { id: 'status',      label: 'Status',        sortable: true  },
        { id: 'fornecedor',  label: 'Fornecedor',    sortable: true  },
      ],
      filters: [
        { id: 'status',     label: 'Status',     type: 'select' },
        { id: 'fornecedor', label: 'Fornecedor', type: 'search' },
        { id: 'data',       label: 'Data',       type: 'date_range' },
      ]
    }
  ]
}
```

---

## Rotas da API

```text
# Dados
GET  /api/v1/relatorios/:report_id           ← dados com filtros e paginação
GET  /api/v1/relatorios/:report_id/export    ← exportar (format=csv|excel|json|xml|txt)

# Workspace
GET    /api/v1/relatorios/saved              ← listar relatórios salvos
POST   /api/v1/relatorios/saved              ← salvar relatório
PUT    /api/v1/relatorios/saved/:id          ← atualizar
DELETE /api/v1/relatorios/saved/:id          ← deletar

# Agendamento
GET    /api/v1/relatorios/saved/:id/schedule ← ver agendamento
POST   /api/v1/relatorios/saved/:id/schedule ← criar
PUT    /api/v1/relatorios/saved/:id/schedule ← atualizar
DELETE /api/v1/relatorios/saved/:id/schedule ← cancelar

# Compartilhamento
POST   /api/v1/relatorios/saved/:id/share             ← compartilhar
DELETE /api/v1/relatorios/saved/:id/share/:user_id    ← remover acesso
```

---

## Schema Prisma (fragment.prisma)

```prisma
// servicos-global/tenant/relatorios/prisma/fragment.prisma

model SavedReport {
  id         String  @id @default(cuid())
  tenant_id  String
  user_id    String
  report_id  String           // ID do tipo de relatório base
  product_id String?          // null = multi-produto (relatório unificado)
  sources    Json    @default("[]")  // [{ productId, tableId, columns }]
  name       String           // ex: "Empresas Ativas Sul"
  filters    Json    @default("{}")  // filtros salvos
  columns    Json    @default("[]")  // colunas visíveis e ordem
  join_type  String  @default("left") // left | inner
  is_shared  Boolean @default(false)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([tenant_id])
  @@index([tenant_id, user_id])
  @@index([tenant_id, report_id])
  @@index([tenant_id, product_id])
}

model ReportSchedule {
  id              String  @id @default(cuid())
  tenant_id       String
  saved_report_id String
  frequency       String           // once|daily|weekly|monthly|custom
  cron_expression String?
  next_run_at     DateTime
  channels        Json             // { email:[...], whatsapp:[...], notify:[...] }
  format          String  @default("csv")  // csv|excel|json|xml|txt
  active          Boolean @default(true)
  last_run_at     DateTime?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  @@index([tenant_id])
  @@index([active, next_run_at])
}
```
