import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToastContainer } from '../../../../nucleo-global/shell/notifications/toast-container.js'
import { useShellStore } from '../../../../nucleo-global/shell/state/store.js'
import type { Notification } from '../../../../nucleo-global/shell/state/types.js'

const makeNotification = (id: string, override: Partial<Notification> = {}): Notification => ({
  id,
  type: 'success',
  message: `Notificação ${id}`,
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

describe('ToastContainer', () => {
  it('não renderiza nada quando a lista de notificações está vazia', () => {
    const { container } = render(<ToastContainer />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza um toast para cada notificação na store', () => {
    useShellStore.setState({
      notifications: [
        makeNotification('n1', { message: 'Mensagem um' }),
        makeNotification('n2', { message: 'Mensagem dois' }),
        makeNotification('n3', { message: 'Mensagem três' }),
      ],
    })

    render(<ToastContainer />)

    expect(screen.getByText('Mensagem um')).toBeTruthy()
    expect(screen.getByText('Mensagem dois')).toBeTruthy()
    expect(screen.getByText('Mensagem três')).toBeTruthy()
  })

  it('renderiza toasts de tipos distintos corretamente', () => {
    useShellStore.setState({
      notifications: [
        makeNotification('s1', { type: 'success', message: 'Sucesso' }),
        makeNotification('e1', { type: 'error', message: 'Erro' }),
        makeNotification('w1', { type: 'warning', message: 'Aviso' }),
      ],
    })

    render(<ToastContainer />)

    expect(screen.getByText('Sucesso')).toBeTruthy()
    expect(screen.getByText('Erro')).toBeTruthy()
    expect(screen.getByText('Aviso')).toBeTruthy()
  })

  it('renderiza um único toast quando há uma notificação', () => {
    useShellStore.setState({
      notifications: [makeNotification('solo', { message: 'Única' })],
    })

    render(<ToastContainer />)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})
