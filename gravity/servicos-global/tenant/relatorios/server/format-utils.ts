// Utilitários de formatação de relatórios — extraídos para permitir testes unitários

/**
 * Seleciona apenas as colunas especificadas de um objeto.
 * Se cols for vazio, retorna o objeto completo.
 */
export function pickColumns(
  row: Record<string, unknown>,
  cols: string[]
): Record<string, unknown> {
  if (cols.length === 0) return row
  return Object.fromEntries(cols.map((c) => [c, row[c] ?? '']))
}

/**
 * Gera string CSV a partir de um array de objetos.
 * Inclui cabeçalho, escapa aspas duplas e usa CRLF como separador de linha.
 */
export function buildCSV(rows: Record<string, unknown>[], cols: string[]): string {
  if (rows.length === 0) return ''
  const headers = cols.length > 0 ? cols : Object.keys(rows[0])
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ]
  return lines.join('\r\n')
}

/**
 * Gera string TXT (TSV) a partir de um array de objetos.
 * Colunas separadas por tab, linhas separadas por newline.
 */
export function buildTXT(rows: Record<string, unknown>[], cols: string[]): string {
  if (rows.length === 0) return ''
  const headers = cols.length > 0 ? cols : Object.keys(rows[0])
  const lines = [
    headers.join('\t'),
    ...rows.map((r) => headers.map((h) => String(r[h] ?? '')).join('\t')),
  ]
  return lines.join('\n')
}

/**
 * Gera string XML a partir de um array de objetos.
 * O tag raiz é derivado do parâmetro name (sanitizado).
 */
export function buildXML(rows: Record<string, unknown>[], cols: string[], name: string): string {
  const tag = name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'relatorio'
  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const headers = cols.length > 0 ? cols : rows.length > 0 ? Object.keys(rows[0]) : []
  const items = rows
    .map((r) => {
      const fields = headers.map((h) => `    <${h}>${esc(r[h])}</${h}>`).join('\n')
      return `  <item>\n${fields}\n  </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<${tag}>\n${items}\n</${tag}>`
}

/**
 * Gera buffer Excel (CSV com BOM UTF-8) para compatibilidade com Excel.
 * TODO: substituir por exceljs para XLSX real.
 */
export function buildExcelBuffer(rows: Record<string, unknown>[], cols: string[]): Buffer {
  const content = buildCSV(rows, cols)
  return Buffer.from('\ufeff' + content, 'utf8')
}
