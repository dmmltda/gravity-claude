import { describe, it, expect, beforeEach } from 'vitest'
import { useShellStore } from '../../../../nucleo-global/shell/state/store.js'
import type { CurrentUser } from '../../../../nucleo-global/shell/state/types.js'

const initialState = {
  sidebarOpen: true,
  currentTheme: 'dark' as const,
  currentUser: { id: '', name: '', email: '' },
  notifications: [],
}

beforeEach(() => {
  useShellStore.setState(initialState)
})

describe('toggleSidebar', () => {
  it('fecha a sidebar quando está aberta', () => {
    useShellStore.getState().toggleSidebar()
    expect(useShellStore.getState().sidebarOpen).toBe(false)
  })

  it('abre a sidebar quando está fechada', () => {
    useShellStore.setState({ sidebarOpen: false })
    useShellStore.getState().toggleSidebar()
    expect(useShellStore.getState().sidebarOpen).toBe(true)
  })

  it('alterna duas vezes volta ao estado original', () => {
    useShellStore.getState().toggleSidebar()
    useShellStore.getState().toggleSidebar()
    expect(useShellStore.getState().sidebarOpen).toBe(true)
  })
})

describe('setTheme', () => {
  it('define o tema como light', () => {
    useShellStore.getState().setTheme('light')
    expect(useShellStore.getState().currentTheme).toBe('light')
  })

  it('define o tema como dark', () => {
    useShellStore.setState({ currentTheme: 'light' })
    useShellStore.getState().setTheme('dark')
    expect(useShellStore.getState().currentTheme).toBe('dark')
  })
})

describe('setCurrentUser', () => {
  it('salva os dados do usuário completos', () => {
    const user: CurrentUser = {
      id: 'user-123',
      name: 'Daniel',
      email: 'daniel@gravity.com',
      avatarUrl: 'https://example.com/avatar.png',
    }
    useShellStore.getState().setCurrentUser(user)
    expect(useShellStore.getState().currentUser).toEqual(user)
  })

  it('salva usuário sem avatarUrl', () => {
    const user: CurrentUser = { id: 'u-1', name: 'Ana', email: 'ana@gravity.com' }
    useShellStore.getState().setCurrentUser(user)
    expect(useShellStore.getState().currentUser).toEqual(user)
    expect(useShellStore.getState().currentUser.avatarUrl).toBeUndefined()
  })
})

describe('addNotification', () => {
  it('adiciona notificação do tipo success com id gerado', () => {
    useShellStore.getState().addNotification({ type: 'success', message: 'Salvo!' })
    const { notifications } = useShellStore.getState()
    expect(notifications).toHaveLength(1)
    expect(notifications[0].type).toBe('success')
    expect(notifications[0].message).toBe('Salvo!')
    expect(notifications[0].id).toBeTruthy()
  })

  it('gera ids únicos para notificações distintas', () => {
    useShellStore.getState().addNotification({ type: 'error', message: 'Erro A' })
    useShellStore.getState().addNotification({ type: 'warning', message: 'Aviso B' })
    const { notifications } = useShellStore.getState()
    expect(notifications).toHaveLength(2)
    expect(notifications[0].id).not.toBe(notifications[1].id)
  })

  it('acumula múltiplas notificações', () => {
    useShellStore.getState().addNotification({ type: 'success', message: 'Um' })
    useShellStore.getState().addNotification({ type: 'error', message: 'Dois' })
    useShellStore.getState().addNotification({ type: 'warning', message: 'Três' })
    expect(useShellStore.getState().notifications).toHaveLength(3)
  })
})

describe('removeNotification', () => {
  it('remove apenas a notificação com o id fornecido', () => {
    useShellStore.getState().addNotification({ type: 'success', message: 'A' })
    useShellStore.getState().addNotification({ type: 'error', message: 'B' })
    const { notifications } = useShellStore.getState()
    const idParaRemover = notifications[0].id

    useShellStore.getState().removeNotification(idParaRemover)

    const restantes = useShellStore.getState().notifications
    expect(restantes).toHaveLength(1)
    expect(restantes[0].message).toBe('B')
  })

  it('não afeta a lista quando id inexistente', () => {
    useShellStore.getState().addNotification({ type: 'success', message: 'Mantida' })
    useShellStore.getState().removeNotification('id-que-nao-existe')
    expect(useShellStore.getState().notifications).toHaveLength(1)
  })

  it('resulta em lista vazia ao remover a única notificação', () => {
    useShellStore.getState().addNotification({ type: 'warning', message: 'Única' })
    const id = useShellStore.getState().notifications[0].id
    useShellStore.getState().removeNotification(id)
    expect(useShellStore.getState().notifications).toHaveLength(0)
  })
})
