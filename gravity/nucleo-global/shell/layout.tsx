import React from 'react'
import { SidebarBase } from './sidebar-base.js'
import { HeaderBase } from './header-base.js'

interface LayoutProps {
  children: React.ReactNode
  sidebarContent?: React.ReactNode
  headerContent?: React.ReactNode
}

const mainLayoutStyle: React.CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  background: 'var(--bg-body-dark)',
}

const contentColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
}

const pageContentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
}

export function Layout({ children, sidebarContent, headerContent }: LayoutProps) {
  return (
    <div style={mainLayoutStyle}>
      <SidebarBase>{sidebarContent}</SidebarBase>
      <div style={contentColumnStyle}>
        <HeaderBase>{headerContent}</HeaderBase>
        <main style={pageContentStyle}>{children}</main>
      </div>
    </div>
  )
}
