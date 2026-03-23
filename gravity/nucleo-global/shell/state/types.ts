export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning'
  message: string
}

export interface CurrentUser {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

export interface ShellState {
  sidebarOpen: boolean
  currentTheme: 'light' | 'dark'
  currentUser: CurrentUser
  notifications: Notification[]
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
  setCurrentUser: (user: CurrentUser) => void
  addNotification: (n: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
}
