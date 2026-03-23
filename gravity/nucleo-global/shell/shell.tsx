import React from 'react'
import { Layout } from './layout.js'
import { ToastContainer } from './notifications/toast-container.js'

interface ShellProps {
  children: React.ReactNode
  sidebarContent?: React.ReactNode
  headerContent?: React.ReactNode
}

export function Shell({ children, sidebarContent, headerContent }: ShellProps) {
  return (
    <>
      <Layout sidebarContent={sidebarContent} headerContent={headerContent}>
        {children}
      </Layout>
      <ToastContainer />
    </>
  )
}
