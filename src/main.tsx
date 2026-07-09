import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './pages/App'
import MACarteiraPage from './pages/MACarteiraPage'

import './index.css'

const path =
  window.location.pathname.replace(/\/+$/, '') ||
  '/'

const RootPage =
  path === '/produtos/ma-carteira'
    ? MACarteiraPage
    : App

ReactDOM.createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <RootPage />
  </React.StrictMode>
)
