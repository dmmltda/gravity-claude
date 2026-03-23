import { describe, it, expect } from 'vitest'
import {
  pickColumns,
  buildCSV,
  buildTXT,
  buildXML,
  buildExcelBuffer,
} from '../../../servicos-global/tenant/relatorios/server/format-utils.js'

const rows = [
  { nome: 'Alice', valor: 100, ativo: true },
  { nome: 'Bob', valor: 200, ativo: false },
]

// ─── pickColumns ──────────────────────────────────────────────────────────────

describe('pickColumns', () => {
  it('retorna o objeto completo quando cols é vazio', () => {
    expect(pickColumns(rows[0], [])).toEqual(rows[0])
  })

  it('seleciona apenas as colunas especificadas', () => {
    expect(pickColumns(rows[0], ['nome'])).toEqual({ nome: 'Alice' })
  })

  it('preenche com string vazia para coluna inexistente', () => {
    expect(pickColumns(rows[0], ['inexistente'])).toEqual({ inexistente: '' })
  })
})

// ─── buildCSV ────────────────────────────────────────────────────────────────

describe('buildCSV', () => {
  it('retorna string vazia para array vazio', () => {
    expect(buildCSV([], [])).toBe('')
  })

  it('inclui cabeçalho e dados separados por CRLF', () => {
    const csv = buildCSV(rows, ['nome', 'valor'])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('"nome","valor"')
    expect(lines[1]).toBe('"Alice","100"')
    expect(lines[2]).toBe('"Bob","200"')
  })

  it('usa colunas do primeiro objeto quando cols é vazio', () => {
    const csv = buildCSV(rows, [])
    expect(csv).toContain('"nome"')
    expect(csv).toContain('"valor"')
  })

  it('escapa aspas duplas no conteúdo', () => {
    const data = [{ descricao: 'disse "olá"' }]
    const csv = buildCSV(data, ['descricao'])
    expect(csv).toContain('"disse ""olá"""')
  })
})

// ─── buildTXT ────────────────────────────────────────────────────────────────

describe('buildTXT', () => {
  it('retorna string vazia para array vazio', () => {
    expect(buildTXT([], [])).toBe('')
  })

  it('usa tab como separador e newline entre linhas', () => {
    const txt = buildTXT(rows, ['nome', 'valor'])
    const lines = txt.split('\n')
    expect(lines[0]).toBe('nome\tvalor')
    expect(lines[1]).toBe('Alice\t100')
  })
})

// ─── buildXML ────────────────────────────────────────────────────────────────

describe('buildXML', () => {
  it('gera XML com declaração e tag raiz derivada do nome', () => {
    const xml = buildXML(rows, ['nome'], 'relatorio')
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<relatorio>')
    expect(xml).toContain('</relatorio>')
  })

  it('sanitiza nome com caracteres especiais para tag válida', () => {
    const xml = buildXML(rows, ['nome'], 'meu relatorio!')
    expect(xml).toContain('<meu_relatorio_>')
  })

  it('escapa entidades HTML nos valores', () => {
    const data = [{ msg: '<script>alert("xss")</script>' }]
    const xml = buildXML(data, ['msg'], 'teste')
    expect(xml).toContain('&lt;script&gt;')
    expect(xml).not.toContain('<script>')
  })

  it('retorna XML vazio (sem items) para array vazio', () => {
    const xml = buildXML([], [], 'vazio')
    expect(xml).toContain('<vazio>')
    expect(xml).toContain('</vazio>')
    expect(xml).not.toContain('<item>')
  })
})

// ─── buildExcelBuffer ─────────────────────────────────────────────────────────

describe('buildExcelBuffer', () => {
  it('retorna um Buffer', () => {
    const buf = buildExcelBuffer(rows, ['nome'])
    expect(Buffer.isBuffer(buf)).toBe(true)
  })

  it('começa com BOM UTF-8 (\\uFEFF)', () => {
    const buf = buildExcelBuffer(rows, ['nome'])
    // BOM UTF-8 = 0xEF 0xBB 0xBF
    expect(buf[0]).toBe(0xef)
    expect(buf[1]).toBe(0xbb)
    expect(buf[2]).toBe(0xbf)
  })
})
