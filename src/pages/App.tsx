import MACode from './MACode'
import PortfolioPage from './PortfolioPage'
import ServicePage from './ServicePage'
import { getServicePageByPath, type ServicePageSlug } from '../data/servicePages'

type AppPage =
  | { type: 'home' }
  | { type: 'portfolio' }
  | { type: 'service'; slug: ServicePageSlug }

function getPageFromPath(): AppPage {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  if (path === '/projetos') {
    return { type: 'portfolio' }
  }

  const servicePage = getServicePageByPath(path)

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
