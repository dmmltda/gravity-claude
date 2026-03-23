import React, { useState, useMemo } from 'react'
import { Cabecalho } from './cabecalho.js'
import { Celula } from './celula.js'
import type { Row, Column, SortConfig, TabelaProps } from './types.js'

const DEFAULT_PAGE_SIZE = 10

function sortData<T extends Row>(data: T[], sortConfig: SortConfig | null): T[] {
  if (!sortConfig) return data

  return [...data].sort((a, b) => {
    const aVal = a[sortConfig.key as keyof T]
    const bVal = b[sortConfig.key as keyof T]

    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1

    let comparison = 0
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal
    } else {
      comparison = String(aVal).localeCompare(String(bVal), 'pt-BR')
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison
  })
}

function filterData<T extends Row>(data: T[], filtro: string): T[] {
  if (!filtro.trim()) return data
  const termo = filtro.toLowerCase().trim()

  return data.filter((row) =>
    Object.values(row).some((val) => {
      if (val === null || val === undefined) return false
      return String(val).toLowerCase().includes(termo)
    })
  )
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'var(--bg-base)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-sm)',
  fontSize: '0.875rem',
  color: 'var(--text-primary)',
}

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderBottom: '1px solid var(--bg-elevated)',
  verticalAlign: 'middle',
}

const loadingStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '2rem',
  color: 'var(--text-muted)',
}

const paginationStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 1rem',
  background: 'var(--bg-surface)',
  fontSize: '0.8125rem',
  color: 'var(--text-secondary)',
  borderTop: '1px solid var(--bg-elevated)',
}

const btnPageStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  padding: '0.25rem 0.75rem',
  color: 'var(--text-primary)',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  fontWeight: 600,
}

export function TabelaGlobal<T extends Row>({
  columns,
  data,
  loading = false,
  emptyMessage = 'Nenhum registro encontrado.',
  filtro = '',
  pageSize = DEFAULT_PAGE_SIZE,
}: TabelaProps<T>): React.ReactElement {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [pagina, setPagina] = useState(1)

  const handleSort = (key: string): void => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === 'asc' ? { key, direction: 'desc' } : null
      }
      return { key, direction: 'asc' }
    })
    setPagina(1)
  }

  const dadosFiltrados = useMemo(() => filterData(data, filtro), [data, filtro])
  const dadosOrdenados = useMemo(() => sortData(dadosFiltrados, sortConfig), [dadosFiltrados, sortConfig])

  const totalPaginas = Math.max(1, Math.ceil(dadosOrdenados.length / pageSize))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * pageSize
  const dadosPagina = dadosOrdenados.slice(inicio, inicio + pageSize)

  const renderCelulaColuna = (col: Column<T>, row: T): React.ReactNode => {
    const value = row[col.key]
    if (col.renderCell) return col.renderCell(value, row)
    return <Celula value={value} type={col.type} />
  }

  return (
    <div style={{ width: '100%' }}>
      <table style={tableStyle} role="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <Cabecalho
                key={String(col.key)}
                label={col.label}
                columnKey={String(col.key)}
                sortable={col.sortable}
                sortConfig={sortConfig}
                onSort={handleSort}
                width={col.width}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={loadingStyle} aria-busy="true">
                Carregando…
              </td>
            </tr>
          ) : dadosPagina.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={loadingStyle}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            dadosPagina.map((row) => (
              <tr key={row.id}>
                {columns.map((col) => (
                  <td key={String(col.key)} style={tdStyle}>
                    {renderCelulaColuna(col, row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {!loading && dadosOrdenados.length > pageSize && (
        <div style={paginationStyle}>
          <span>
            {inicio + 1}–{Math.min(inicio + pageSize, dadosOrdenados.length)} de {dadosOrdenados.length}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              style={btnPageStyle}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              aria-label="Página anterior"
            >
              ‹
            </button>
            <span>{paginaAtual} / {totalPaginas}</span>
            <button
              style={btnPageStyle}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              aria-label="Próxima página"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
