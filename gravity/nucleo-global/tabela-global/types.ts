import type { ReactNode } from 'react'

export type ColumnType = 'text' | 'date' | 'number' | 'badge' | 'actions'

export interface Row {
  id: string | number
  [key: string]: unknown
}

export interface Column<T extends Row> {
  key: keyof T
  label: string
  type?: ColumnType
  sortable?: boolean
  width?: string
  renderCell?: (value: T[keyof T], row: T) => ReactNode
}

export interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

export interface TabelaProps<T extends Row> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  filtro?: string
  pageSize?: number
}
