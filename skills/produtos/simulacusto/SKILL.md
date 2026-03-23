---
name: antigravity-simulacusto
description: "Use esta skill sempre que uma tarefa envolver o produto SimulaCusto da plataforma Gravity. Define as regras de negócio exclusivas do produto: engine de cálculo fiscal (II, IPI, PIS, COFINS, ICMS por dentro), estrutura completa dos campos da Estimativa de Custo, integração com Portal Único SISCOMEX via hCaptcha/certificado A1, cotação BACEN PTAX, estratégia anti-captcha com CapSolver, cache de alíquotas, fallback offline com TIPI/TEC, acordos comerciais, ICMS por UF, dashboard de estimativas e PRODUCT_CONFIG do produto. NÃO cobre funcionalidades já existentes no Gravity (Tabela Global, Modal, Gabi, Email, WhatsApp, Relatórios, Histórico, Notificações, etc.) — para esses, consultar as skills específicas de cada serviço."
---

# SimulaCusto — Produto Gravity

## O Que é Este Produto

Módulo de inteligência fiscal e viabilidade financeira da plataforma Gravity. Permite que importadores e tradings calculem o **custo total de uma operação de importação (Landed Cost)** antes mesmo de fechar o negócio, considerando impostos, taxas, frete e câmbio em tempo real.

---

## O Que NÃO precisa ser construído no produto

O SimulaCusto consome os serviços core da plataforma — **não reinvente a roda:**

| Funcionalidade | Skill a Consultar |
|:---|:---|
| Login / Multi-tenant | `antigravity-autenticacao-s2s`, `antigravity-tenant-isolation` |
| Sidebar / Navbar | `antigravity-service-registry` |
| Tabela de Listagem | `antigravity-componentes` (usar `DataTable` global) |
| Feedback via WhatsApp | `antigravity-whatsapp` |
| IA Gabi para análise | `antigravity-gabi` |
| Logs de Alteração | `antigravity-historico` |
| Relatórios | `antigravity-relatorios` |
| Notificações | `antigravity-notificacoes` |

---

## PRODUCT_CONFIG

```json
{
  "product": "simulacusto",
  "enabled": true,
  "features": {
    "siscomex_integration": "active",
    "bacen_auto_update": true,
    "default_icms_mode": "inside_calc",
    "anti_captcha_provider": "capsolver"
  },
  "services": [
    "engine-fiscal",
    "siscomex-connector",
    "ptax-service",
    "docx-generator"
  ]
}
```

---

## Estrutura de Pastas

```text
products/simulacusto/
├── components/       ← UI específica: Tabela de Taxas, Cards de KPI
├── services/         ← Engine de cálculo, Integrador Siscomex
├── hooks/            ← usePtax, useNcmCache
└── types/            ← Interfaces da Estimativa
```

---

## Fluxo — Nova Estimativa de Custo

**4 modos de entrada:**

| Modo | Como funciona |
|:---|:---|
| **Manual** | Preenche todos os campos |
| **Lote** | Sobe um CSV/Excel simplificado |
| **Smart Read** | Sobe um PDF de Invoice e a Gabi extrai os dados |
| **API** | Recebe de um ERP externo via `antigravity-api-cockpit` |

---

## Campos da Estimativa — 6 Abas

### Aba: Dados da Estimativa
- Descrição/Referência (ex: "Importação Componentes China")
- Importador (Selecionar do Tenant)
- Porto/Aeroporto de Destino
- Data da Simulação (Default: Hoje)

### Aba: Produto
- NCM (Autocomplete com cache de alíquotas)
- Incoterm (FOB, CIF, FCA, etc.)
- Quantidade total
- Moeda do produto (USD, EUR, CNY, etc.)
- Valor total do produto na origem

### Aba: Frete Internacional
- Moeda do frete internacional
- Valor do frete internacional

### Aba: Seguro Internacional
- Moeda do seguro internacional
- Valor do seguro internacional

### Aba: Taxas na Origem (tabela)
- Nome da Taxa (Pick-list: Inspeção, Fumigação, Pick-up, Outras)
- Moeda | Valor

### Aba: Taxas no Destino (tabela)
- Nome da Taxa (Pick-list: Capatazia, Armazenagem, Despacho, SDA, Outras)
- Moeda (Default: BRL) | Valor
- Base de Cálculo (Checkbox: Siscomex/FOB/Outro)

### Aba: ICMS
- Alíquota ICMS % (Conforme UF de destino)
- FCP % (Fundo de Combate à Pobreza)
- Benefício Fiscal (%) [Opcional]

---

## Status da Estimativa

| Status | Quando |
|:---|:---|
| `rascunho` | Salva automaticamente parcial |
| `criada` | Cálculo completo realizado |
| `arquivada` | Não aparece no dashboard principal |

**Numeração:** `EST-[ANO]-[SEQUENCIAL]` (ex: `EST-2024-00042`)

---

## Dashboard — Lista + KPIs

**KPIs no topo:**
- **Total Estimado (Mês):** Soma de todos os Landed Costs em BRL
- **Economia via Acordos:** Diferença entre II Alíquota Cheia vs II Acordo Comercial
- **Top NCMs:** Top 3 NCMs mais simulados

**Lista:** `DataTable` da skill `ux/componentes` — colunas: ID, Descrição, NCM, Valor Total (BRL), Status, Ações (Duplicar, Editar, PDF)

---

## Engine de Cálculo Fiscal

`products/simulacusto/services/calc-engine.ts` — **a ordem de cálculo importa:**

```typescript
// 1. Valor Aduaneiro (BRL)
const valorAduaneiro = (produto + frete + seguro + taxasOrigem) * ptaxVenda

// 2. II
const ii = valorAduaneiro * aliquotaII

// 3. IPI
const ipi = (valorAduaneiro + ii) * aliquotaIPI

// 4. PIS
const pis = valorAduaneiro * aliquotaPIS

// 5. COFINS
const cofins = valorAduaneiro * aliquotaCOFINS

// 6. Taxa Siscomex (valor fixo RFB)
const taxaSiscomex = getTaxaSiscomexFixa()

// 7. ICMS — Cálculo "por dentro" obrigatório se default_icms_mode = 'inside_calc'
const baseICMS = (valorAduaneiro + ii + ipi + pis + cofins + taxaSiscomex + taxasDestino)
               / (1 - aliquotaICMSEfetiva)
const icms = baseICMS * aliquotaICMSEfetiva
```

### Acordos Comerciais
Se o NCM possuir acordo comercial (Mercosul, Israel, México), aplica o redutor na alíquota de II **antes** de calcular o IPI.

---

## Integração — Portal Único SISCOMEX

Para buscar alíquotas oficiais de II, IPI, PIS, COFINS por NCM.

**Endpoints:**
- `GET /api/consultar-ncm?numero=[NCM]`
- `GET /api/consultar-atributos?ncm=[NCM]`

**Mapeamento de campos:**
- `codigoSupino` → `aliquota_ii`
- `aliquotaIPI` → `aliquota_ipi`

### Estratégia Anti-Captcha (Híbrida)

| Modo | Quando usar |
|:---|:---|
| **Certificado A1 (primário)** | Tenant sobe PFX via UI → backend assina a requisição, bypassa captcha |
| **CapSolver (fallback)** | Fluxo público sem certificado |

```typescript
const solver = new CapSolver(process.env.CAPSOLVER_API_KEY)
const token = await solver.solve({
  type: 'HCaptchaTaskProxyLess',
  websiteURL: 'https://portalunico.siscomex.gov.br/...',
  websiteKey: process.env.SISCOMEX_HCAPTCHA_SITE_KEY
})
```

**Por fase:**
- **Dev:** Mock de alíquotas (JSON local)
- **Staging:** CapSolver
- **Produção:** CapSolver + AntiCaptcha.com (redundância)

---

## Integração — BACEN PTAX

- **Endpoint:** OData BACEN (público, gratuito)
- **Update:** Uma vez ao dia às 09:00 via cron do `antigravity-notificacoes`
- **Cache de alíquotas por NCM:** TTL de 24h (alíquotas não mudam com frequência)
- **Fallback offline:** Tabela local SQLite `tipi_tec_fallback.db` se Portal Único estiver fora

---

## Documento de Resultado (.docx)

Botão "Gerar Memória de Cálculo" usa `docx-templates` para preencher um `.docx` com:
- Logo do Importador
- Tabela detalhada de todos os impostos
- Nota de rodapé com a PTAX utilizada

---

## Rotas da API

```text
GET  /api/products/simulacusto/estimates         ← Listar estimativas
POST /api/products/simulacusto/estimates         ← Criar estimativa
GET  /api/products/simulacusto/calc?ncm=...      ← Cálculo rápido (preview)
```

---

## Schema Prisma (fragment.prisma)

```prisma
model Estimativa {
  id               String   @id @default(cuid())
  tenant_id        String
  user_id          String
  numero_sequencial String   @unique           // EST-2024-00042
  descricao        String
  ncm              String
  incoterm         String
  moeda            String
  valor_produto    Float
  valor_frete      Float    @default(0)
  valor_seguro     Float    @default(0)
  ptax_utilizado   Float
  valor_aduaneiro  Float
  ii               Float
  ipi              Float
  pis              Float
  cofins           Float
  icms             Float
  taxa_siscomex    Float
  landed_cost_brl  Float
  status           String   @default("rascunho")  // rascunho | criada | arquivada
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  taxas TaxaEstimativa[]

  @@index([tenant_id])
  @@index([tenant_id, status])
  @@index([tenant_id, ncm])
}

model TaxaEstimativa {
  id           String     @id @default(cuid())
  estimativa_id String
  tipo         String     // origem | destino
  nome         String
  moeda        String
  valor        Float
  estimativa   Estimativa @relation(fields: [estimativa_id], references: [id])
}

model CacheAliquota {
  ncm          String   @id
  aliquota_ii  Float
  aliquota_ipi Float
  aliquota_pis Float
  aliquota_cofins Float
  fonte        String   // siscomex | tipi_fallback
  updated_at   DateTime @updatedAt
}

model CacheCambio {
  moeda        String   @id
  ptax_venda   Float
  ptax_compra  Float
  data_cotacao DateTime
  updated_at   DateTime @updatedAt
}
```

---

## Variáveis de Ambiente

```bash
# Siscomex
PORTAL_UNICO_CERT_PFX=...          # Base64 do PFX
PORTAL_UNICO_CERT_SENHA=...        # Senha do certificado
PORTAL_UNICO_HCAPTCHA_SITE_KEY=... # Site key do hCaptcha do portal

# Anti-Captcha
CAPSOLVER_API_KEY=CAP-...          # Primário
ANTICAPTCHA_API_KEY=...            # Fallback

# BACEN (público)
BACEN_URL=https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata

# Câmbio fallback quando BACEN offline
CAMBIO_USD_FALLBACK=6.00
```

---

## Checklist — Antes de Entregar

- [ ] `PRODUCT_CONFIG` com todos os serviços declarados?
- [ ] Dashboard unificado com KPIs + Lista de estimativas?
- [ ] 4 modos de entrada: manual, lote, Smart Read, API?
- [ ] Numeração automática EST-[ANO]-[SEQ] por tenant?
- [ ] Todos os campos das 6 abas implementados?
- [ ] Status `rascunho` (salvo automaticamente) e `criada`?
- [ ] Engine de cálculo na ordem correta (A+B+C+D → Valor Aduaneiro)?
- [ ] ICMS por dentro com suporte a benefício fiscal por UF?
- [ ] Integração BACEN PTAX com cache de 24h?
- [ ] Integração Portal Único — certificado A1 como primário?
- [ ] Anti-captcha CapSolver como fallback para fluxo público?
- [ ] Cache de alíquotas por NCM com TTL 24h?
- [ ] Fallback offline com TIPI/TEC quando Portal Único cair?
- [ ] Circuit breaker após 5 falhas em 60s?
- [ ] Retry com backoff exponencial (1s → 4s → 16s)?
- [ ] Exportar estimativa como .docx com breakdown completo?
- [ ] Fragment.prisma com Estimativa, TaxaEstimativa, CacheAliquota, CacheCambio?
