import MACode from './MACode'
import PortfolioPage from './PortfolioPage'
import ServicePage from './ServicePage'
import ContactPage from './ContactPage'
import ProductsPage from './ProductsPage'
import { getServicePageByPath, type ServicePageSlug } from '../data/servicePages'

type AppPage =
  | { type: 'home' }
  | { type: 'portfolio' }
  | { type: 'contact' }
  | { type: 'products' }
  | { type: 'service'; slug: ServicePageSlug }

function getPageFromPath(): AppPage {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  if (path === '/projetos') {
    return { type: 'portfolio' }
  }

  if (path === '/contacto') {
    return { type: 'contact' }
  }

  if (path === '/produtos' || path === '/produtos/ma-pdf') {
    return { type: 'products' }
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

  if (page.type === 'contact') {
    return <ContactPage />
  }

  if (page.type === 'service') {
    return <ServicePage slug={page.slug} />
  }

  if (page.type === 'products') {
    return <ProductsPage />
  }

  return <MACode />
}
