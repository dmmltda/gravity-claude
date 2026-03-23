import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ExitDrawer from './components/ExitDrawer'
import './styles/tokens.css'

const Home = lazy(() => import('./pages/Home'))
const Produto = lazy(() => import('./pages/Produto'))
const Precos = lazy(() => import('./pages/Precos'))
const Trial = lazy(() => import('./pages/Trial'))
const Checkout = lazy(() => import('./pages/Checkout'))

function PageFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-muted)',
        fontSize: 14,
      }}
    >
      Carregando...
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/produtos/:slug" element={<Produto />} />
          <Route path="/precos" element={<Precos />} />
          <Route path="/trial" element={<Trial />} />
          <Route path="/checkout" element={<Checkout />} />
        </Routes>
      </Suspense>

      {/* ExitDrawer montado globalmente — fora das rotas */}
      <ExitDrawer />
    </BrowserRouter>
  )
}
