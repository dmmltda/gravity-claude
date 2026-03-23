---
name: antigravity-conector-erp
description: "Use esta skill sempre que uma tarefa envolver o serviço de conector ERP/SAP da plataforma Gravity. Define o conector como serviço reutilizável em servicos-global/produto/conector-erp/ com três modos de entrada de dados: manual, planilha (CSV/Excel) e ERP via OData ou HANA direto. Cobre configuração de credenciais SAP pelo próprio cliente, isolamento multi-tenant com AES-256, tradução de linguagem natural para OData/SQL pela Gabi, entidades COMEX mapeadas (NCM, DI, LI, II, IPI, SISCOMEX), alertas inteligentes de LI/DI e geração de relatórios para Receita Federal."
---

# Gravity — Conector ERP/SAP

## O Que é Este Serviço

Serviço de produto **reutilizável** — qualquer produto do Gravity pode usar para receber dados de sistemas externos do cliente. Não é específico de nenhum produto; é um motor que qualquer produto instancia com suas próprias configurações.

### Três modos de entrada de dados

| Modo | Como funciona |
|:---|:---|
| **Manual** | Usuário digita os dados direto na interface do produto |
| **Planilha** | Upload de CSV ou Excel — importação em lote |
| **ERP/SAP** | Conexão direta via OData ou HANA — automático e em tempo real |

Os três modos produzem o mesmo resultado — os dados chegam no produto.

---

## Localização na Arquitetura

```text
servicos-global/produto/conector-erp/   ← serviço reutilizável
├── src/
│   ├── ConectorErp.tsx
│   ├── modos/
│   │   ├── ManualInput.tsx
│   │   ├── PlanilhaUpload.tsx
│   │   └── ErpConfig.tsx
│   └── index.ts
├── server/
│   ├── routes.ts
│   ├── odata.ts           ← cliente OData
│   ├── hana.ts            ← driver HANA direto
│   ├── crypto.ts          ← AES-256-GCM
│   └── query-builder.ts   ← Gabi → OData/SQL
└── prisma/
    └── fragment.prisma
```

**O produto não contém o código do conector — apenas o declara:**

```typescript
// produtos/classifica-comex/src/shared/config.ts
export const PRODUCT_CONFIG = {
  id: 'classifica-comex',
  productServices: ['helpdesk', 'conector-erp'],  // ← declara aqui
  navigation: [
    { id: 'dados',    label: 'Dados',    icon: 'database',    source: 'product' },
    { id: 'conector', label: 'Conector', icon: 'plug',        source: 'product' },
  ]
}
```

```typescript
// produtos/classifica-comex/server/index.ts
import erpRoutes from '../../servicos-global/produto/conector-erp/server/routes.js'
app.use('/api/erp', erpRoutes)  // ← uma linha, serviço inteiro disponível
```

---

## Modo 1 — Entrada Manual

- Validação em tempo real com Zod
- Campos obrigatórios marcados com *
- Sugestão automática de NCM pela Gabi ao digitar a descrição do produto

---

## Modo 2 — Upload de Planilha

**Fluxo (Wizard em 4 passos):**
```text
Passo 1: Upload ✅
Passo 2: Mapeamento de colunas
Passo 3: Preview e validação
Passo 4: Importar
```

**Score de validação:**
```text
SCORE DA IMPORTAÇÃO: 94%
✅ 47 válidos
❌ 3 inválidos
  Linha 12: NCM inválido — "8483.90" deve ter 8 dígitos sem ponto
  Linha 23: Data fora do formato — use DD/MM/AAAA
  Linha 31: País de origem "CHN" deve ser "CN"

[Corrigir e reimportar] [Importar apenas os válidos (47)]
```

**Formatos:** CSV, XLSX, XLS, ODS — Máx: 50MB / 100.000 linhas

---

## Modo 3 — Conector SAP/ERP

### Protocolos suportados

| Protocolo | Quando usar | Velocidade |
|:---|:---|:---|
| **OData** | SAP moderno (S/4HANA, ECC) — padrão universal | Alta |
| **SAP HANA direto** | HANA database — velocidade máxima via driver hdb | Máxima |
| **REST genérico** | ERPs com API própria (TOTVS, Oracle, etc.) | Alta |
| **JDBC/ODBC** | Sistemas legados com banco relacional | Média |

> **OData é o protocolo padrão** — todo SAP moderno expõe nativamente sem instalar nada no servidor do cliente.

### Criptografia de Credenciais (AES-256-GCM)

```typescript
// crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

export async function encrypt(text: string, key: string): Promise<string> {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv)

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // iv:authTag:encrypted — tudo em base64
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

export async function decrypt(encryptedText: string, key: string): Promise<string> {
  const [ivB64, authTagB64, encryptedB64] = encryptedText.split(':')
  const decipher = createDecipheriv(
    ALGORITHM,
    Buffer.from(key, 'hex'),
    Buffer.from(ivB64, 'base64')
  )
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  return decipher.update(Buffer.from(encryptedB64, 'base64')) + decipher.final('utf8')
}
```

### Exemplo de Query OData (Movimentações de Material)

```typescript
async function fetchGoodsMovements(tenantId: string, filters: { dateFrom: string; dateTo: string }) {
  const creds = await getDecryptedCredentials(tenantId)

  const params = new URLSearchParams({
    '$filter': `PostingDate ge '${filters.dateFrom}' and PostingDate le '${filters.dateTo}'`,
    '$select': 'MaterialDocumentItem,Material,Quantity,UnitOfEntry,PostingDate,MovementType',
    '$format': 'json'
  })

  const response = await fetch(`${creds.baseUrl}/MM_GOODSMVT_SRV/GoodsMovementSet?${params}`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${creds.user}:${creds.pass}`).toString('base64'),
      'Accept': 'application/json'
    }
  })
  return (await response.json()).d.results
}
```

---

## Gabi + Conector — Linguagem Natural para OData

```text
Pergunta → Gabi interpreta → gera OData → executa no SAP → formata resposta
```

**System prompt com terminologia COMEX:**
```typescript
const systemPrompt = `
Você é a Gabi, assistente de importação do ${product.name}.

TERMINOLOGIA COMEX:
- DI: Declaração de Importação (SISCOMEX)
- LI: Licença de Importação (validade: 60 dias úteis)
- NCM: Nomenclatura Comum do Mercosul (8 dígitos)
- II: Imposto de Importação
- IPI: Imposto sobre Produtos Industrializados
- SISCOMEX: Sistema Integrado de Comércio Exterior

REGRAS:
- Sempre filtre por tenant_id para isolar os dados
- Gere queries OData eficientes com $select
- Datas no formato DD/MM/AAAA
- Moeda em USD com símbolo
`
```

---

## Entidades COMEX Mapeadas

| Entidade SAP | Serviço OData | Campos COMEX relevantes |
|:---|:---|:---|
| Movimentação de Material | MM_GOODSMVT_SRV | Material, NCM, Quantity, PostingDate |
| Pedido de Compra | MM_PUR_PO_MAINT_V2_SRV | PO, Fornecedor, Valor, Moeda |
| Nota Fiscal de Entrada | MM_SRV_0001 | NF, CNPJ Emitente, Valor, Impostos |
| Declaração de Importação | Customizado | DI, LI, Canal, Impostos |
| Licença de Importação | Customizado | LI, NCM, Validade, Status |

---

## Alertas Inteligentes

| Alerta | Condição | Canal |
|:---|:---|:---|
| **LI vencendo** | LI com validade < 5 dias úteis | Email + WhatsApp |
| **DI atrasada** | DI sem despacho após 30 dias | Email |
| **Variação de imposto** | II/IPI diferente do histórico > 10% | In-app (sino) |
| **Quota NCM** | Quota de importação do NCM > 80% utilizada | Email + WhatsApp |
| **Câmbio crítico** | Variação USD/BRL > 3% no dia | In-app (sino) |

---

## Schema Prisma (fragment.prisma)

```prisma
model ErpConnection {
  id                    String    @id @default(cuid())
  tenant_id             String
  product_id            String
  system_type           String             // SAP | TOTVS | Oracle | custom
  protocol              String             // odata | hana | rest | jdbc
  base_url              String
  username              String
  credentials_encrypted String             // AES-256-GCM — nunca plain text
  sync_frequency        String    @default("manual")  // manual | hourly | every6h | daily
  last_synced_at        DateTime?
  last_tested_at        DateTime?
  connection_status     String    @default("untested")  // untested | ok | failed
  error_message         String?
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt

  @@unique([tenant_id, product_id])
}

model ErpSyncLog {
  id              String   @id @default(cuid())
  tenant_id       String
  product_id      String
  mode            String             // manual | planilha | erp | auto
  rows_processed  Int      @default(0)
  rows_success    Int      @default(0)
  rows_failed     Int      @default(0)
  error_details   Json?
  started_at      DateTime @default(now())
  finished_at     DateTime?
  status          String   @default("running")  // running | success | partial | failed
  triggered_by    String

  @@index([tenant_id])
  @@index([tenant_id, started_at])
}

model ErpQueryLog {
  id             String   @id @default(cuid())
  tenant_id      String
  product_id     String
  query_type     String             // odata | sql | rest
  query_text     String
  rows_returned  Int?
  latency_ms     Int?
  status         String             // success | error
  error_message  String?
  triggered_by   String             // user_id ou 'gabi'
  created_at     DateTime @default(now())

  @@index([tenant_id])
  @@index([tenant_id, created_at])
}

model ErpAlert {
  id           String    @id @default(cuid())
  tenant_id    String
  product_id   String
  type         String             // li_expiring | di_delayed | etc.
  title        String
  description  String
  severity     String    @default("warning")  // info | warning | critical
  entity_id    String?
  dismissed    Boolean   @default(false)
  dismissed_at DateTime?
  dismissed_by String?
  created_at   DateTime  @default(now())

  @@index([tenant_id])
  @@index([tenant_id, dismissed])
}
```

---

## Checklist — Antes de Entregar

- [ ] Três modos de entrada: manual, planilha e ERP — todos funcionais?
- [ ] Modelo de planilha para download (CSV e Excel)?
- [ ] Wizard de importação com score de validação e erros por linha?
- [ ] OData como protocolo padrão + HANA direto como opção avançada?
- [ ] Credenciais criptografadas AES-256-GCM — nunca plain text, nunca em logs?
- [ ] Teste de conexão com feedback imediato (versão SAP + latência)?
- [ ] Isolamento multi-tenant — cada cliente acessa apenas seu próprio SAP?
- [ ] Gabi traduz linguagem natural para OData com terminologia COMEX?
- [ ] System prompt com schema das entidades + glossário COMEX?
- [ ] Entidades COMEX mapeadas: DI, LI, NCM, II, IPI, SISCOMEX?
- [ ] Alertas automáticos: LI vencendo, DI atrasada, quota NCM?
- [ ] Fragment.prisma com ErpConnection, ErpSyncLog, ErpQueryLog e ErpAlert?
