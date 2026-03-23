import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/tokens.css'

const Dashboard        = lazy(() => import('./pages/Dashboard.js').then((m) => ({ default: m.Dashboard })))
const NovaEstimativa   = lazy(() => import('./pages/NovaEstimativa.js').then((m) => ({ default: m.NovaEstimativa })))
const DetalheEstimativa = lazy(() => import('./pages/DetalheEstimativa.js').then((m) => ({ default: m.DetalheEstimativa })))

function Carregando() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-muted)' }}>
      Carregando...
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route path="/"                         element={<Dashboard />} />
          <Route path="/estimativas/nova"         element={<NovaEstimativa />} />
          <Route path="/estimativas/:id"          element={<DetalheEstimativa />} />
          <Route path="/estimativas/:id/editar"   element={<NovaEstimativa />} />
          <Route path="*"                         element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
