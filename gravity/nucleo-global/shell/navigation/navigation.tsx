import React, { lazy, Suspense } from 'react'
import type { NavItem } from './types.js'

interface NavigationProps {
  items: NavItem[]
}

const moduleCache = new Map<string, React.LazyExoticComponent<React.ComponentType>>()

function getLazyModule(path: string) {
  if (!moduleCache.has(path)) {
    const LazyComp = lazy(() => import(/* @vite-ignore */ path))
    moduleCache.set(path, LazyComp)
  }
  return moduleCache.get(path)!
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  padding: '0.5rem',
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem 0.75rem',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  transition: 'background 0.15s ease',
}

const dividerLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.6875rem',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '0.5rem 0.75rem 0.25rem',
}

function NavItemRow({ item }: { item: NavItem }) {
  const LazyIcon = getLazyModule(item.icon)

  return (
    <a href={item.path} style={itemStyle} aria-label={item.label}>
      <Suspense fallback={<span style={{ width: '1rem', height: '1rem', display: 'inline-block' }} />}>
        <LazyIcon />
      </Suspense>
      <span>{item.label}</span>
    </a>
  )
}

export function Navigation({ items }: NavigationProps) {
  const itensTenant = items.filter((item) => item.source === 'tenant')
  const itensProduto = items.filter((item) => item.source === 'product')
  const ambosComItens = itensTenant.length > 0 && itensProduto.length > 0

  return (
    <nav style={navStyle} aria-label="Navegação principal">
      {itensTenant.map((item) => (
        <NavItemRow key={item.id} item={item} />
      ))}

      {ambosComItens && (
        <span style={dividerLabelStyle} aria-hidden="true">Serviços</span>
      )}

      {itensProduto.map((item) => (
        <NavItemRow key={item.id} item={item} />
      ))}
    </nav>
  )
}
