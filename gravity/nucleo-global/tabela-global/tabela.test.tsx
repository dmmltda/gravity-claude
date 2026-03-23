import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabelaGlobal } from './tabela.js'
import type { Column, Row } from './types.js'

interface Produto extends Row {
  id: number
  nome: string
  preco: number
  status: string
}

const colunas: Column<Produto>[] = [
  { key: 'nome', label: 'Nome', sortable: true },
  { key: 'preco', label: 'Preço', type: 'number', sortable: true },
  { key: 'status', label: 'Status', type: 'badge' },
]

const dados: Produto[] = [
  { id: 1, nome: 'Arroz', preco: 25, status: 'ativo' },
  { id: 2, nome: 'Feijão', preco: 10, status: 'inativo' },
  { id: 3, nome: 'Macarrão', preco: 5, status: 'ativo' },
]

describe('TabelaGlobal', () => {
  it('renderiza cabeçalhos corretamente', () => {
    render(<TabelaGlobal columns={colunas} data={dados} />)
    expect(screen.getByText('NOME')).toBeDefined()
    expect(screen.getByText('PREÇO')).toBeDefined()
    expect(screen.getByText('STATUS')).toBeDefined()
  })

  it('renderiza dados das linhas', () => {
    render(<TabelaGlobal columns={colunas} data={dados} />)
    expect(screen.getByText('Arroz')).toBeDefined()
    expect(screen.getByText('Feijão')).toBeDefined()
    expect(screen.getByText('Macarrão')).toBeDefined()
  })

  it('exibe mensagem de vazio quando data está vazia', () => {
    render(<TabelaGlobal columns={colunas} data={[]} emptyMessage="Sem produtos." />)
    expect(screen.getByText('Sem produtos.')).toBeDefined()
  })

  it('exibe loading quando loading=true', () => {
    render(<TabelaGlobal columns={colunas} data={[]} loading={true} />)
    expect(screen.getByText('Carregando…')).toBeDefined()
  })

  it('ordena por nome ascendente ao clicar no cabeçalho', () => {
    render(<TabelaGlobal columns={colunas} data={dados} />)
    const nomeCabecalho = screen.getByText('NOME')
    fireEvent.click(nomeCabecalho)
    const linhas = screen.getAllByRole('row')
    // linha 0 = header, linha 1 = primeiro dado ordenado
    expect(linhas[1].textContent).toContain('Arroz')
    expect(linhas[2].textContent).toContain('Feijão')
  })

  it('inverte ordenação ao clicar duas vezes no cabeçalho', () => {
    render(<TabelaGlobal columns={colunas} data={dados} />)
    const nomeCabecalho = screen.getByText('NOME')
    fireEvent.click(nomeCabecalho)
    fireEvent.click(nomeCabecalho)
    const linhas = screen.getAllByRole('row')
    expect(linhas[1].textContent).toContain('Macarrão')
  })

  it('filtra dados pelo texto da prop filtro', () => {
    render(<TabelaGlobal columns={colunas} data={dados} filtro="arroz" />)
    expect(screen.getByText('Arroz')).toBeDefined()
    expect(screen.queryByText('Feijão')).toBeNull()
  })

  it('exibe paginação quando há mais dados que pageSize', () => {
    const muitosDados: Produto[] = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      nome: `Produto ${i + 1}`,
      preco: i * 10,
      status: 'ativo',
    }))
    render(<TabelaGlobal columns={colunas} data={muitosDados} pageSize={10} />)
    expect(screen.getByText('1 / 2')).toBeDefined()
  })
})
