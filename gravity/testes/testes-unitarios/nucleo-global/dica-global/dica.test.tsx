import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Dica } from '../../../../nucleo-global/dica-global/dica.js'
import { Popover } from '../../../../nucleo-global/dica-global/popover.js'

// ─── Dica (Tooltip) ────────────────────────────────────────────────────────
// Usa delay interno via setTimeout — os testes avançam o timer manualmente
// para não depender de tempo real.

describe('Dica', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('não exibe o tooltip inicialmente', () => {
    render(
      <Dica conteudo="Dica de teste">
        <button>Hover aqui</button>
      </Dica>
    )
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('exibe o tooltip após hover e decorrido o delay padrão (300ms)', () => {
    render(
      <Dica conteudo="Texto da dica">
        <button>Alvo</button>
      </Dica>
    )
    fireEvent.mouseEnter(screen.getByText('Alvo').parentElement!)
    // antes do delay: ainda invisível
    expect(screen.queryByRole('tooltip')).toBeNull()

    act(() => { vi.advanceTimersByTime(300) })

    expect(screen.getByRole('tooltip')).toBeDefined()
    expect(screen.getByRole('tooltip').textContent).toBe('Texto da dica')
  })

  it('exibe o tooltip após delay customizado', () => {
    render(
      <Dica conteudo="Dica rápida" delay={100}>
        <button>Alvo</button>
      </Dica>
    )
    const trigger = screen.getByText('Alvo').parentElement!
    fireEvent.mouseEnter(trigger)

    act(() => { vi.advanceTimersByTime(99) })
    expect(screen.queryByRole('tooltip')).toBeNull()

    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole('tooltip')).toBeDefined()
  })

  it('tooltip tem role="tooltip"', () => {
    render(
      <Dica conteudo="Conteúdo ARIA">
        <span>Elemento</span>
      </Dica>
    )
    const trigger = screen.getByText('Elemento').parentElement!
    fireEvent.mouseEnter(trigger)
    act(() => { vi.advanceTimersByTime(300) })

    expect(screen.getByRole('tooltip')).toBeDefined()
  })

  it('esconde o tooltip após mouseLeave', () => {
    render(
      <Dica conteudo="Esconder">
        <span>Alvo</span>
      </Dica>
    )
    const trigger = screen.getByText('Alvo').parentElement!
    fireEvent.mouseEnter(trigger)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByRole('tooltip')).toBeDefined()

    fireEvent.mouseLeave(trigger)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('cancela o timer ao fazer mouseLeave antes do delay expirar', () => {
    render(
      <Dica conteudo="Nunca aparece" delay={500}>
        <span>Alvo</span>
      </Dica>
    )
    const trigger = screen.getByText('Alvo').parentElement!
    fireEvent.mouseEnter(trigger)
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.mouseLeave(trigger)
    act(() => { vi.advanceTimersByTime(400) })

    // timer foi cancelado, tooltip não aparece mesmo após 600ms totais
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('disabled=true impede exibição do tooltip', () => {
    render(
      <Dica conteudo="Bloqueada" disabled>
        <span>Alvo</span>
      </Dica>
    )
    const trigger = screen.getByText('Alvo').parentElement!
    fireEvent.mouseEnter(trigger)
    act(() => { vi.advanceTimersByTime(500) })

    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('exibe tooltip ao receber foco (acessibilidade por teclado)', () => {
    render(
      <Dica conteudo="Via foco" delay={0}>
        <button>Focável</button>
      </Dica>
    )
    const trigger = screen.getByText('Focável').parentElement!
    fireEvent.focus(trigger)
    act(() => { vi.advanceTimersByTime(0) })

    expect(screen.getByRole('tooltip')).toBeDefined()
  })

  it('esconde tooltip ao perder foco', () => {
    render(
      <Dica conteudo="Via blur" delay={0}>
        <button>Focável</button>
      </Dica>
    )
    const trigger = screen.getByText('Focável').parentElement!
    fireEvent.focus(trigger)
    act(() => { vi.advanceTimersByTime(0) })
    expect(screen.getByRole('tooltip')).toBeDefined()

    fireEvent.blur(trigger)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('trigger tem aria-describedby apontando para o tooltip quando visível', () => {
    render(
      <Dica conteudo="ARIA describe" delay={0}>
        <button>Alvo</button>
      </Dica>
    )
    const trigger = screen.getByText('Alvo').parentElement!
    expect(trigger.getAttribute('aria-describedby')).toBeNull()

    fireEvent.mouseEnter(trigger)
    act(() => { vi.advanceTimersByTime(0) })

    const tooltipId = screen.getByRole('tooltip').getAttribute('id')
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltipId)
  })
})

// ─── Popover ───────────────────────────────────────────────────────────────

describe('Popover', () => {
  it('não exibe o popover inicialmente', () => {
    render(
      <Popover conteudo={<div>Conteúdo</div>}>
        <button>Abrir</button>
      </Popover>
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('abre ao clicar no trigger', () => {
    render(
      <Popover conteudo={<span>Dentro do popover</span>}>
        <button>Abrir</button>
      </Popover>
    )
    fireEvent.click(screen.getByText('Abrir').parentElement!)
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('Dentro do popover')).toBeDefined()
  })

  it('trigger tem aria-expanded=true quando aberto', () => {
    render(
      <Popover conteudo={<span>X</span>}>
        <button>Gatilho</button>
      </Popover>
    )
    const trigger = screen.getByText('Gatilho').parentElement!
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('fecha ao pressionar ESC', () => {
    render(
      <Popover conteudo={<span>Conteúdo ESC</span>}>
        <button>Abrir</button>
      </Popover>
    )
    fireEvent.click(screen.getByText('Abrir').parentElement!)
    expect(screen.getByRole('dialog')).toBeDefined()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('fecha ao clicar fora do popover', () => {
    render(
      <div>
        <Popover conteudo={<span>Conteúdo</span>}>
          <button>Abrir</button>
        </Popover>
        <div data-testid="fora">Área externa</div>
      </div>
    )
    fireEvent.click(screen.getByText('Abrir').parentElement!)
    expect(screen.getByRole('dialog')).toBeDefined()

    fireEvent.mouseDown(screen.getByTestId('fora'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('alterna entre aberto e fechado ao clicar no trigger duas vezes', () => {
    render(
      <Popover conteudo={<span>Toggle</span>}>
        <button>Toggle</button>
      </Popover>
    )
    const trigger = screen.getByText('Toggle').parentElement!
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeDefined()
    fireEvent.click(trigger)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('disabled=true impede abertura ao clicar', () => {
    render(
      <Popover conteudo={<span>Bloqueado</span>} disabled>
        <button>Clique</button>
      </Popover>
    )
    fireEvent.click(screen.getByText('Clique').parentElement!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('chama onAbrir ao abrir', () => {
    const onAbrir = vi.fn()
    render(
      <Popover conteudo={<span>X</span>} onAbrir={onAbrir}>
        <button>Abrir</button>
      </Popover>
    )
    fireEvent.click(screen.getByText('Abrir').parentElement!)
    expect(onAbrir).toHaveBeenCalledOnce()
  })

  it('chama onFechar ao fechar com ESC', () => {
    const onFechar = vi.fn()
    render(
      <Popover conteudo={<span>X</span>} onFechar={onFechar}>
        <button>Abrir</button>
      </Popover>
    )
    fireEvent.click(screen.getByText('Abrir').parentElement!)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onFechar).toHaveBeenCalledOnce()
  })

  it('modo controlado: exibe quando aberto=true', () => {
    render(
      <Popover conteudo={<span>Controlado</span>} aberto={true}>
        <button>Gatilho</button>
      </Popover>
    )
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('Controlado')).toBeDefined()
  })

  it('modo controlado: não exibe quando aberto=false', () => {
    render(
      <Popover conteudo={<span>Oculto</span>} aberto={false}>
        <button>Gatilho</button>
      </Popover>
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
