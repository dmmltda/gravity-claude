import type { ReactNode } from 'react'

interface KpiCardProps {
  label:    string
  value:    string | number
  sub?:     string
  icon?:    ReactNode
  accent?:  boolean
}

export function KpiCard({ label, value, sub, icon, accent }: KpiCardProps) {
  return (
    <div
      className="card"
      style={{
        borderColor: accent ? 'var(--color-accent)' : undefined,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {icon && (
        <span
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            fontSize: '1.5rem',
            opacity: 0.4,
          }}
        >
          {icon}
        </span>
      )}
      <p style={{ fontSize: 'var(--text-micro)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.75rem', fontWeight: 700, color: accent ? 'var(--color-accent)' : 'var(--color-text-primary)', lineHeight: 1.2 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
