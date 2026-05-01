import MACode from './MACode'
import PortfolioPage from './PortfolioPage'

function getPageFromPath() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  if (path === '/projetos') {
    return 'portfolio'
  }

  return 'home'
}

export default function App() {
  const page = getPageFromPath()

  if (page === 'portfolio') {
    return <PortfolioPage />
  }

  return <MACode />
}
