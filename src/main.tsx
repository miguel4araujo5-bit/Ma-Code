import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'

import './index.css'

const App = lazy(() => import('./pages/App'))

const MACarteiraPage = lazy(
  () => import('./pages/MACarteiraPage')
)

const path =
  window.location.pathname.replace(/\/+$/, '') ||
  '/'

const RootPage =
  path === '/produtos/ma-carteira'
    ? MACarteiraPage
    : App

function PageLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div
        className="rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-5 text-center shadow-2xl backdrop-blur"
        role="status"
        aria-live="polite"
      >
        <span className="block text-sm font-semibold text-cyan-200">
          MA-Code
        </span>

        <span className="mt-2 block text-sm text-slate-300">
          A carregar…
        </span>
      </div>
    </main>
  )
}

ReactDOM.createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <Suspense fallback={<PageLoading />}>
      <RootPage />
    </Suspense>
  </React.StrictMode>
)
