// query-builder.ts — translates natural language (from Gabi) to OData/SQL queries
// System prompt is COMEX-aware with SAP entity mappings

export interface ODataQueryIntent {
  entity: string
  filter?: string
  select?: string[]
  top?: number
  orderby?: string
}

export interface QueryBuilderResult {
  queryType: 'odata' | 'sql'
  odata?: ODataQueryIntent
  sql?: string
  humanReadable: string
}

// COMEX system prompt for Gabi — sent to OpenAI with each query translation request
export const COMEX_SYSTEM_PROMPT = `
Você é a Gabi, assistente de importação da plataforma Gravity.

TERMINOLOGIA COMEX:
- DI: Declaração de Importação (SISCOMEX) — documento de registro da mercadoria importada
- LI: Licença de Importação (validade: 60 dias úteis a partir da emissão)
- NCM: Nomenclatura Comum do Mercosul (8 dígitos, ex: 84833000)
- II: Imposto de Importação
- IPI: Imposto sobre Produtos Industrializados
- SISCOMEX: Sistema Integrado de Comércio Exterior

ENTIDADES SAP DISPONÍVEIS VIA ODATA:
- MM_GOODSMVT_SRV/GoodsMovementSet: Movimentações de material (Material, NCM, Quantity, PostingDate, MovementType)
- MM_PUR_PO_MAINT_V2_SRV/PurchaseOrderSet: Pedidos de compra (PurchaseOrder, Supplier, NetAmount, DocumentCurrency)
- MM_SRV_0001/SupplierInvoiceSet: Notas fiscais de entrada (SupplierInvoice, SupplierInvoiceItem, TaxAmount)

REGRAS:
- Sempre use $select para limitar campos — nunca selecione tudo
- Datas no formato SAP OData: datetime'YYYY-MM-DDT00:00:00'
- Valores monetários em USD com símbolo $
- NCM sempre com 8 dígitos sem pontos ou traços
- Responda SOMENTE com JSON válido no formato especificado

FORMATO DE RESPOSTA:
{
  "queryType": "odata" | "sql",
  "odata": {
    "entity": "ServicoOData/EntitySet",
    "filter": "$filter OData string",
    "select": ["Campo1", "Campo2"],
    "top": 100,
    "orderby": "Campo desc"
  },
  "humanReadable": "Descrição em português do que a query faz"
}
`.trim()

interface GabiQueryResponse {
  queryType: 'odata' | 'sql'
  odata?: {
    entity: string
    filter?: string
    select?: string[]
    top?: number
    orderby?: string
  }
  sql?: string
  humanReadable: string
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
  choices: Array<{
    message: { content: string }
  }>
}

export async function buildQueryFromNaturalLanguage(
  naturalLanguage: string,
  productContext: string,
): Promise<QueryBuilderResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return buildFallbackQuery(naturalLanguage)
  }

  const messages: OpenAIMessage[] = [
    { role: 'system', content: COMEX_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Produto: ${productContext}\nConsulta: ${naturalLanguage}`,
    },
  ]

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      return buildFallbackQuery(naturalLanguage)
    }

    const data = (await response.json()) as OpenAIResponse
    const content = data.choices[0]?.message.content ?? '{}'
    const parsed = JSON.parse(content) as GabiQueryResponse

    return {
      queryType: parsed.queryType,
      odata: parsed.odata
        ? {
            entity: parsed.odata.entity,
            filter: parsed.odata.filter,
            select: parsed.odata.select,
            top: parsed.odata.top ?? 100,
            orderby: parsed.odata.orderby,
          }
        : undefined,
      sql: parsed.sql,
      humanReadable: parsed.humanReadable,
    }
  } catch {
    return buildFallbackQuery(naturalLanguage)
  }
}

// Fallback when OpenAI is unavailable — maps common COMEX queries to known OData patterns
export function buildFallbackQuery(naturalLanguage: string): QueryBuilderResult {
  const lower = naturalLanguage.toLowerCase()

  if (lower.includes('li') && (lower.includes('venc') || lower.includes('expir'))) {
    return {
      queryType: 'odata',
      odata: {
        entity: 'LicencaImportacao/LicencaSet',
        filter: `Status eq 'ATIVA'`,
        select: ['LicencaId', 'NCM', 'Validade', 'Status'],
        top: 100,
        orderby: 'Validade asc',
      },
      humanReadable: 'Licenças de Importação ativas ordenadas por validade',
    }
  }

  if (lower.includes('di') && lower.includes('atrasa')) {
    return {
      queryType: 'odata',
      odata: {
        entity: 'DeclaracaoImportacao/DeclaracaoSet',
        filter: `Status eq 'PENDENTE'`,
        select: ['DeclaracaoId', 'DataRegistro', 'Canal', 'Status'],
        top: 100,
        orderby: 'DataRegistro asc',
      },
      humanReadable: 'Declarações de Importação pendentes de despacho',
    }
  }

  if (lower.includes('movimentaç') || lower.includes('material')) {
    return {
      queryType: 'odata',
      odata: {
        entity: 'MM_GOODSMVT_SRV/GoodsMovementSet',
        select: ['MaterialDocumentItem', 'Material', 'Quantity', 'UnitOfEntry', 'PostingDate', 'MovementType'],
        top: 100,
        orderby: 'PostingDate desc',
      },
      humanReadable: 'Movimentações de material recentes',
    }
  }

  // Generic fallback
  return {
    queryType: 'odata',
    odata: {
      entity: 'MM_GOODSMVT_SRV/GoodsMovementSet',
      select: ['MaterialDocumentItem', 'Material', 'Quantity', 'PostingDate'],
      top: 50,
    },
    humanReadable: `Consulta genérica: ${naturalLanguage}`,
  }
}
