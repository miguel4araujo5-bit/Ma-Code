import MACode from './MACode'
import PortfolioPage from './PortfolioPage'
import ServicePage from './ServicePage'
import { servicePages, type ServicePageSlug } from '../data/servicePages'

type AppPage =
  | { type: 'home' }
  | { type: 'portfolio' }
  | { type: 'service'; slug: ServicePageSlug }

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/'
}

function getPageFromPath(): AppPage {
  const path = normalizePath(window.location.pathname)

  if (path === '/projetos') {
    return { type: 'portfolio' }
  }

  const servicePage = servicePages.find((page) => page.path === path)

  if (servicePage) {
    return {
      type: 'service',
      slug: servicePage.slug,
    }
  }

  return { type: 'home' }
}

export default function App() {
  const page = getPageFromPath()

  if (page.type === 'portfolio') {
    return <PortfolioPage />
  }

  if (page.type === 'service') {
    return <ServicePage slug={page.slug} />
  }

  return <MACode />
}
