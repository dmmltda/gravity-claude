import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Toast } from '../../../../nucleo-global/shell/notifications/toast.js'
import { useShellStore } from '../../../../nucleo-global/shell/state/store.js'
import type { Notification } from '../../../../nucleo-global/shell/state/types.js'

const makeNotification = (override: Partial<Notification> = {}): Notification => ({
  id: 'notif-test-1',
  type: 'success',
  message: 'Mensagem de teste',
  ...override,
})

beforeEach(() => {
  useShellStore.setState({
    sidebarOpen: true,
    currentTheme: 'dark',
    currentUser: { id: '', name: '', email: '' },
    notifications: [],
  })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('renderização por tipo', () => {
  it('renderiza toast success com mensagem correta', () => {
    const notif = makeNotification({ type: 'success', message: 'Operação concluída!' })
    render(<Toast notification={notif} />)
    expect(screen.getByText('Operação concluída!')).toBeTruthy()
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('renderiza toast error com mensagem correta', () => {
    const notif = makeNotification({ type: 'error', message: 'Falha ao salvar.' })
    render(<Toast notification={notif} />)
    expect(screen.getByText('Falha ao salvar.')).toBeTruthy()
  })

  it('renderiza toast warning com mensagem correta', () => {
    const notif = makeNotification({ type: 'warning', message: 'Atenção ao prazo.' })
    render(<Toast notification={notif} />)
    expect(screen.getByText('Atenção ao prazo.')).toBeTruthy()
  })

  it('renderiza botão de fechar acessível', () => {
    const notif = makeNotification()
    render(<Toast notification={notif} />)
    expect(screen.getByLabelText('Fechar notificação')).toBeTruthy()
  })
})

describe('auto-dismiss', () => {
  it('remove a notificação da store após 4 segundos', () => {
    const notif = makeNotification({ id: 'auto-id' })
    useShellStore.setState({ notifications: [notif] })

    render(<Toast notification={notif} />)
    expect(useShellStore.getState().notifications).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(useShellStore.getState().notifications).toHaveLength(0)
  })

  it('não remove antes de 4 segundos', () => {
    const notif = makeNotification({ id: 'antes-id' })
    useShellStore.setState({ notifications: [notif] })

    render(<Toast notification={notif} />)

    act(() => {
      vi.advanceTimersByTime(3999)
    })

    expect(useShellStore.getState().notifications).toHaveLength(1)
  })
})
