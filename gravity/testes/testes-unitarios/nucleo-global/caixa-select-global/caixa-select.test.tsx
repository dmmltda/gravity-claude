import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CaixaSelectGlobal } from '../../../../nucleo-global/caixa-select-global/caixa-select.js'
import { Opcao } from '../../../../nucleo-global/caixa-select-global/opcao.js'
import type { SelectOption } from '../../../../nucleo-global/caixa-select-global/types.js'

// ─── fixtures ──────────────────────────────────────────────────────────────

const opcoes: SelectOption[] = [
  { value: 'sp', label: 'São Paulo' },
  { value: 'rj', label: 'Rio de Janeiro' },
  { value: 'mg', label: 'Minas Gerais' },
  { value: 'ba', label: 'Bahia', disabled: true },
]

// Wrapper controlado para modo single
function WrapperSingle({
  initial = null,
  placeholder,
}: {
  initial?: string | null
  placeholder?: string
}): React.ReactElement {
  const [valor, setValor] = useState<string | null>(initial)
  return (
    <CaixaSelectGlobal
      options={opcoes}
      value={valor}
      onChange={setValor}
      placeholder={placeholder}
    />
  )
}

// Wrapper controlado para modo multiple
function WrapperMultiple({
  initial = [],
}: {
  initial?: string[]
}): React.ReactElement {
  const [valores, setValores] = useState<string[]>(initial)
  return (
    <CaixaSelectGlobal
      options={opcoes}
      value={valores}
      onChange={setValores}
      multiple
    />
  )
}

// ─── renderização ──────────────────────────────────────────────────────────

describe('CaixaSelectGlobal — renderização', () => {
  it('exibe placeholder padrão quando não há valor selecionado', () => {
    render(<WrapperSingle />)
    expect(screen.getByText('Selecione…')).toBeDefined()
  })

  it('exibe placeholder customizado', () => {
    render(<WrapperSingle placeholder="Escolha um estado" />)
    expect(screen.getByText('Escolha um estado')).toBeDefined()
  })

  it('dropdown está fechado inicialmente (aria-expanded=false)', () => {
    render(<WrapperSingle />)
    const botao = screen.getByRole('button')
    expect(botao.getAttribute('aria-expanded')).toBe('false')
  })

  it('não exibe as opções antes de abrir', () => {
    render(<WrapperSingle />)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('exibe o label da opção selecionada quando há valor', () => {
    render(<WrapperSingle initial="rj" />)
    expect(screen.getByText('Rio de Janeiro')).toBeDefined()
  })
})

// ─── abertura e fechamento ─────────────────────────────────────────────────

describe('CaixaSelectGlobal — abertura e fechamento', () => {
  it('abre o dropdown ao clicar no botão', () => {
    render(<WrapperSingle />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('listbox')).toBeDefined()
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true')
  })

  it('exibe campo de busca ao abrir', () => {
    render(<WrapperSingle />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByLabelText('Buscar opções')).toBeDefined()
  })

  it('exibe todas as opções ao abrir', () => {
    render(<WrapperSingle />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('São Paulo')).toBeDefined()
    expect(screen.getByText('Rio de Janeiro')).toBeDefined()
    expect(screen.getByText('Minas Gerais')).toBeDefined()
  })

  it('fecha o dropdown ao pressionar ESC', () => {
    render(<WrapperSingle />)
    const container = screen.getByRole('button').parentElement!
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('listbox')).toBeDefined()
    fireEvent.keyDown(container, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('não abre quando o componente está desabilitado', () => {
    const onChange = vi.fn()
    render(
      <CaixaSelectGlobal options={opcoes} value={null} onChange={onChange} disabled />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

// ─── busca (filtro local) ──────────────────────────────────────────────────

describe('CaixaSelectGlobal — busca', () => {
  it('filtra opções pelo texto digitado', () => {
    render(<WrapperSingle />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByLabelText('Buscar opções'), { target: { value: 'paulo' } })
    expect(screen.getByText('São Paulo')).toBeDefined()
    expect(screen.queryByText('Rio de Janeiro')).toBeNull()
  })

  it('busca é case-insensitive', () => {
    render(<WrapperSingle />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByLabelText('Buscar opções'), { target: { value: 'MINAS' } })
    expect(screen.getByText('Minas Gerais')).toBeDefined()
  })

  it('exibe "Nenhum resultado." quando nenhuma opção corresponde', () => {
    render(<WrapperSingle />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByLabelText('Buscar opções'), { target: { value: 'xyzxyz' } })
    expect(screen.getByText('Nenhum resultado.')).toBeDefined()
  })
})

// ─── seleção única ─────────────────────────────────────────────────────────

describe('CaixaSelectGlobal — seleção única', () => {
  it('seleciona opção ao clicar e fecha o dropdown', () => {
    render(<WrapperSingle />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('São Paulo'))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByText('São Paulo')).toBeDefined()
  })

  it('chama onChange com o valor correto ao selecionar', () => {
    const onChange = vi.fn()
    render(<CaixaSelectGlobal options={opcoes} value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('Minas Gerais'))
    expect(onChange).toHaveBeenCalledWith('mg')
  })

  it('chama onChange com null ao clicar na opção já selecionada (deselect)', () => {
    const onChange = vi.fn()
    render(<CaixaSelectGlobal options={opcoes} value="sp" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getAllByText('São Paulo')[0])
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('não chama onChange ao clicar em opção desabilitada', () => {
    const onChange = vi.fn()
    render(<CaixaSelectGlobal options={opcoes} value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('Bahia'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ─── seleção múltipla ──────────────────────────────────────────────────────

describe('CaixaSelectGlobal — seleção múltipla', () => {
  it('acumula seleções e não fecha o dropdown', () => {
    render(<WrapperMultiple />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('São Paulo'))
    // dropdown ainda aberto
    expect(screen.getByRole('listbox')).toBeDefined()
    fireEvent.click(screen.getByText('Rio de Janeiro'))
    expect(screen.getByRole('listbox')).toBeDefined()
  })

  it('exibe "2 selecionados" quando dois valores estão ativos', () => {
    render(<WrapperMultiple initial={['sp', 'rj']} />)
    expect(screen.getByText('2 selecionados')).toBeDefined()
  })

  it('exibe label único quando apenas um valor está selecionado', () => {
    render(<WrapperMultiple initial={['mg']} />)
    expect(screen.getByText('Minas Gerais')).toBeDefined()
  })

  it('remove valor ao clicar em opção já selecionada', () => {
    const onChange = vi.fn()
    render(
      <CaixaSelectGlobal
        options={opcoes}
        value={['sp', 'rj']}
        onChange={onChange}
        multiple
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('São Paulo'))
    expect(onChange).toHaveBeenCalledWith(['rj'])
  })

  it('chama onChange com array contendo novo valor ao selecionar', () => {
    const onChange = vi.fn()
    render(
      <CaixaSelectGlobal
        options={opcoes}
        value={['sp']}
        onChange={onChange}
        multiple
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('Rio de Janeiro'))
    expect(onChange).toHaveBeenCalledWith(['sp', 'rj'])
  })

  it('listbox tem aria-multiselectable=true no modo múltiplo', () => {
    render(<WrapperMultiple />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true')
  })
})

// ─── Opcao (componente) ────────────────────────────────────────────────────

describe('Opcao', () => {
  it('renderiza o label da opção', () => {
    const op: SelectOption = { value: 'sp', label: 'São Paulo' }
    render(
      <Opcao
        opcao={op}
        selecionada={false}
        focada={false}
        onSelecionar={vi.fn()}
        onFocar={vi.fn()}
        index={0}
      />
    )
    expect(screen.getByText('São Paulo')).toBeDefined()
  })

  it('exibe checkmark quando selecionada', () => {
    const op: SelectOption = { value: 'sp', label: 'São Paulo' }
    render(
      <Opcao
        opcao={op}
        selecionada={true}
        focada={false}
        onSelecionar={vi.fn()}
        onFocar={vi.fn()}
        index={0}
      />
    )
    expect(screen.getByText('✓')).toBeDefined()
  })

  it('não exibe checkmark quando não selecionada', () => {
    const op: SelectOption = { value: 'rj', label: 'Rio de Janeiro' }
    render(
      <Opcao
        opcao={op}
        selecionada={false}
        focada={false}
        onSelecionar={vi.fn()}
        onFocar={vi.fn()}
        index={0}
      />
    )
    expect(screen.queryByText('✓')).toBeNull()
  })

  it('chama onSelecionar com o value ao clicar', () => {
    const onSelecionar = vi.fn()
    const op: SelectOption = { value: 'mg', label: 'Minas Gerais' }
    render(
      <Opcao
        opcao={op}
        selecionada={false}
        focada={false}
        onSelecionar={onSelecionar}
        onFocar={vi.fn()}
        index={0}
      />
    )
    fireEvent.click(screen.getByRole('option'))
    expect(onSelecionar).toHaveBeenCalledWith('mg')
  })

  it('não chama onSelecionar quando disabled', () => {
    const onSelecionar = vi.fn()
    const op: SelectOption = { value: 'ba', label: 'Bahia', disabled: true }
    render(
      <Opcao
        opcao={op}
        selecionada={false}
        focada={false}
        onSelecionar={onSelecionar}
        onFocar={vi.fn()}
        index={0}
      />
    )
    fireEvent.click(screen.getByRole('option'))
    expect(onSelecionar).not.toHaveBeenCalled()
  })

  it('tem aria-selected correto', () => {
    const op: SelectOption = { value: 'sp', label: 'São Paulo' }
    const { rerender } = render(
      <Opcao opcao={op} selecionada={false} focada={false} onSelecionar={vi.fn()} onFocar={vi.fn()} index={0} />
    )
    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe('false')

    rerender(
      <Opcao opcao={op} selecionada={true} focada={false} onSelecionar={vi.fn()} onFocar={vi.fn()} index={0} />
    )
    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe('true')
  })
})
