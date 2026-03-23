---
name: antigravity-api-cockpit
description: "Use esta skill sempre que uma tarefa envolver exposição de APIs de produtos, documentação de endpoints, geração e gestão de tokens de acesso, playground interativo, webhooks configuráveis pelo cliente, central de APIs no Configurador ou conector ERP/SAP reutilizável. Define a arquitetura do API Cockpit por produto, a central consolidada no Configurador, o padrão de conector OData/ERP para qualquer produto, segurança com AES-256 para credenciais e monitoramento de consumo por token."
---

# Gravity — API Cockpit

## O Que é o API Cockpit

Sistema que permite que clientes do Gravity consumam os produtos sem precisar de um frontend — integrando diretamente seus sistemas (ERP, WMS, SAP, etc.) com os produtos Gravity via API REST.

**Existe em dois lugares:**
1. **Dentro de cada produto** — cockpit específico daquele produto com seus endpoints, exemplos e tokens
2. **No Configurador** — central consolidada de todas as APIs de todos os produtos contratados

---

## Localização na Arquitetura

```text
servicos-global/configurador/
  └── src/pages/workspace/
      └── api-cockpit/      ← central de APIs (visão consolidada)

produtos/[nome-do-produto]/
  └── src/pages/
      └── api-cockpit/      ← cockpit específico do produto

servicos-global/produto/
  └── conector-erp/         ← conector OData/SAP reutilizável
```

---

## Parte 1 — API Cockpit por Produto

Menu: `[ 📄 Documentação] [ 🔑 Tokens] [ 🧪 Playground] [ 🪝 Webhooks] [ 📊 Consumo]`

### Tela 1 — Tokens de Acesso

**Modal — Gerar novo token:**
- **Nome:** campo livre (ex: "Integração SAP")
- **Escopo:** Leitura (GET) | Escrita (POST, PUT) | Exclusão (DELETE)
- **Expiração:** Nunca | 30 dias | 90 dias | Personalizado
- **Rate limit:** N req/min (padrão: 60)

**Regras de segurança:**
- Token exibido **apenas uma vez** após a criação
- Armazenado como hash SHA-256 — **nunca em plain text**
- Prefixo: `gv_live_sk_` (produção) ou `gv_test_sk_` (sandbox)
- Revogação imediata disponível a qualquer momento

### Tela 2 — Documentação (Swagger/Redoc)

Documentação gerada automaticamente a partir dos **schemas Zod** de cada rota:

```typescript
// O mesmo Zod que valida a rota gera a documentação
const createSimulacaoSchema = z.object({
  titulo: z.string().min(1).max(200).describe('Título da simulação'),
  valor:  z.number().positive().describe('Valor em USD'),
  ncm:    z.string().length(8).describe('Código NCM do produto'),
  origem: z.string().describe('País de origem da mercadoria'),
})
// Documentação gerada automaticamente pelo zod-to-openapi
```

### Tela 3 — Playground

Ambiente para testar chamadas à API ao vivo no browser:
- Seleção de ambiente: Produção / Sandbox
- Autocompletar endpoints disponíveis
- Validação do JSON antes de enviar
- Histórico das últimas 20 chamadas
- Copiar como **cURL, Node.js, Python ou PHP**
- Tempo de resposta exibido

### Tela 4 — Webhooks

```text
URL destino: https://erp-cliente.com.br/gravity/eventos
Secret: [gerado automaticamente] [↻ Regenerar]

Eventos:
✅ simulacao.criada
✅ simulacao.atualizada
⬜ simulacao.deletada
✅ cotacao.aprovada
```

**Segurança dos webhooks:**
- Secret gerado automaticamente (HMAC-SHA256)
- Cada disparo inclui `X-Gravity-Signature` no header
- Retry automático com backoff exponencial em caso de falha

**Histórico de disparos:**

| Data/Hora | Evento | Status | Latência | Tentativas |
|:---|:---|:---|:---|:---|
| 21/03 15:42 | simulacao.criada | ✅ 200 | 89ms | 1 |
| 21/03 14:30 | cotacao.aprovada | ❌ 500 | — | 3/3 (falhou) |

---

## Parte 2 — Central de APIs (Configurador)

No Configurador, o tenant vê todas as APIs de todos os produtos em uma única tela:

| Produto | Base URL | Status |
|:---|:---|:---|
| Simulador Comex | api.gravity.com.br/sim-comex | 🟢 Online |
| NF Importação | api.gravity.com.br/nf-import | 🟢 Online |
| Bid Frete | api.gravity.com.br/bid-frete | 🟢 Online |

---

## Parte 3 — Conector ERP/SAP (Serviço Reutilizável)

Para produtos que precisam se conectar ao sistema do cliente (SAP, ERP, WMS, etc.):

| Protocolo | Quando usar |
|:---|:---|
| **OData** | SAP moderno — universal, sem instalação no cliente |
| **SAP HANA direto** | HANA database — velocidade máxima via driver hdb |
| **REST genérico** | ERPs com API REST própria |
| **JDBC/ODBC** | Sistemas legados com banco relacional |

**Segurança das credenciais:**

```typescript
// Credenciais NUNCA em plain text no banco — AES-256-GCM
async function saveCredentials(tenantId: string, creds: ErpCredentials) {
  const encrypted = await encrypt(JSON.stringify(creds), process.env.ENCRYPTION_KEY!)
  await prisma.erpConnection.upsert({
    where:  { tenant_id: tenantId },
    create: { tenant_id: tenantId, credentials_encrypted: encrypted },
    update: { credentials_encrypted: encrypted }
  })
}

// Descriptografado apenas no momento da query — nunca exposto
async function executeErpQuery(tenantId: string, query: string) {
  const conn = await prisma.erpConnection.findUnique({ where: { tenant_id: tenantId } })
  const creds = JSON.parse(await decrypt(conn.credentials_encrypted, process.env.ENCRYPTION_KEY!))
  return await fetchOData(creds.baseUrl, creds.username, creds.password, query)
}
```

**Fluxo Gabi — linguagem natural para OData:**
```text
Usuário: "Quantos rolamentos importei esse mês?"
  → Gabi recebe pergunta + schema SAP do cliente no system prompt
  → Gabi gera OData:
    GET /sap/opu/odata/sap/MM_GOODSMVT_SRV/GoodsMovementSet
    ?$filter=PostingDate ge '2026-03-01'
    &$select=Material,Quantity,UnitOfEntry
    &$filter=Material eq 'ROLAMENTO*'
  → Conector executa no SAP do cliente
  → Gabi formata: "Você importou 1.240 rolamentos em março..."
```

---

## Rotas da API

```text
# API Cockpit
GET    /api/v1/cockpit/tokens              ← listar tokens
POST   /api/v1/cockpit/tokens              ← gerar token
DELETE /api/v1/cockpit/tokens/:id          ← revogar token
GET    /api/v1/cockpit/docs                ← OpenAPI JSON
GET    /api/v1/cockpit/usage               ← consumo do tenant
GET    /api/v1/cockpit/webhooks            ← listar webhooks
POST   /api/v1/cockpit/webhooks            ← criar webhook
PUT    /api/v1/cockpit/webhooks/:id        ← atualizar webhook
POST   /api/v1/cockpit/webhooks/:id/test   ← testar webhook
DELETE /api/v1/cockpit/webhooks/:id        ← deletar webhook

# Conector ERP
GET    /api/v1/erp/connection              ← status da conexão
POST   /api/v1/erp/connection              ← salvar credenciais
POST   /api/v1/erp/connection/test         ← testar conexão
POST   /api/v1/erp/query                   ← executar query OData/SQL
GET    /api/v1/erp/query/logs              ← histórico de queries
```

---

## Checklist — Antes de Entregar

- [ ] API Cockpit acessível dentro de cada produto?
- [ ] Central de APIs consolidada no Configurador (workspace)?
- [ ] Token exibido uma única vez — hash SHA-256 no banco?
- [ ] Prefixo `gv_live_sk_` (produção) e `gv_test_sk_` (sandbox)?
- [ ] Documentação gerada automaticamente a partir dos schemas Zod?
- [ ] Playground com execução ao vivo e exportar como cURL/código?
- [ ] Webhooks com secret HMAC-SHA256 e retry automático?
- [ ] Credenciais ERP criptografadas com AES-256-GCM?
- [ ] Fluxo Gabi → query OData → resultado em linguagem natural?
- [ ] Middleware de observabilidade em todas as rotas públicas?
