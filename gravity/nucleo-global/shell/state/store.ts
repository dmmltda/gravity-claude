import { create } from 'zustand'
import type { ShellState } from './types.js'

export const useShellStore = create<ShellState>((set) => ({
  sidebarOpen: true,
  currentTheme: 'dark',
  currentUser: { id: '', name: '', email: '' },
  notifications: [],
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ currentTheme: theme }),
  setCurrentUser: (user) => set({ currentUser: user }),
  addNotification: (n) =>
    set((s) => ({
      notifications: [...s.notifications, { ...n, id: crypto.randomUUID() }],
    })),
  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
}))
