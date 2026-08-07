import { lazy } from 'react'

import {
  getServicePageByPath,
  type ServicePageSlug
} from '../data/servicePages'

const MACode = lazy(
  () => import('./MACode')
)

const PortfolioPage = lazy(
  () => import('./PortfolioPage')
)

const ServicePage = lazy(
  () => import('./ServicePage')
)

const ContactPage = lazy(
  () => import('./ContactPage')
)

const ProductsPage = lazy(
  () => import('./ProductsPage')
)

const MAPdfPage = lazy(
  () => import('./MAPdfPage')
)

const MABtcAlertsPage = lazy(
  () => import('./MABtcAlertsPage')
)

const MARecortesPage = lazy(
  () => import('./MARecortesPage')
)

const MAProfessorPage = lazy(
  () => import('./MAProfessorPage')
)

const MAQuadroPage = lazy(
  () => import('./MAQuadroPage')
)

const AdminPage = lazy(
  () => import('./AdminPage')
)

const MAProfessorAdminPage = lazy(
  () => import('./MAProfessorAdminPage')
)

const RedeZeroAdminPage = lazy(
  () => import('./RedeZeroAdminPage')
)

const NotFoundPage = lazy(
  () => import('./NotFoundPage')
)

type AppPage =
  | {
      type: 'home'
    }
  | {
      type: 'portfolio'
    }
  | {
      type: 'contact'
    }
  | {
      type: 'products'
    }
  | {
      type: 'ma-pdf'
    }
  | {
      type: 'ma-btc-alertas'
    }
  | {
      type: 'ma-recortes'
    }
  | {
      type: 'ma-professor'
    }
  | {
      type: 'ma-quadro'
    }
  | {
      type: 'admin'
    }
  | {
      type:
        'admin-ma-professor'
    }
  | {
      type:
        'admin-redezero'
    }
  | {
      type: 'service'
      slug: ServicePageSlug
    }
  | {
      type: 'not-found'
    }

function getPageFromPath(): AppPage {
  const path =
    window.location.pathname.replace(
      /\/+$/,
      ''
    ) || '/'

  if (path === '/') {
    return {
      type: 'home'
    }
  }

  if (
    path === '/projetos'
  ) {
    return {
      type: 'portfolio'
    }
  }

  if (
    path === '/contacto'
  ) {
    return {
      type: 'contact'
    }
  }

  if (
    path === '/produtos'
  ) {
    return {
      type: 'products'
    }
  }

  if (
    path ===
      '/produtos/mapdf' ||
    path ===
      '/produtos/ma-pdf'
  ) {
    return {
      type: 'ma-pdf'
    }
  }

  if (
    path ===
    '/produtos/ma-btc-alertas'
  ) {
    return {
      type:
        'ma-btc-alertas'
    }
  }

  if (
    path ===
    '/produtos/ma-recortes'
  ) {
    return {
      type: 'ma-recortes'
    }
  }

  if (
    path ===
    '/produtos/ma-professor'
  ) {
    return {
      type:
        'ma-professor'
    }
  }

  if (
    path ===
    '/produtos/ma-quadro'
  ) {
    return {
      type: 'ma-quadro'
    }
  }

  if (
    path === '/admin'
  ) {
    return {
      type: 'admin'
    }
  }

  if (
    path ===
    '/admin/ma-professor'
  ) {
    return {
      type:
        'admin-ma-professor'
    }
  }

  if (
    path ===
    '/admin/redezero'
  ) {
    return {
      type:
        'admin-redezero'
    }
  }

  const servicePage =
    getServicePageByPath(
      path
    )

  if (servicePage) {
    return {
      type: 'service',
      slug:
        servicePage.slug
    }
  }

  return {
    type: 'not-found'
  }
}

export default function App() {
  const page =
    getPageFromPath()

  if (
    page.type ===
    'portfolio'
  ) {
    return (
      <PortfolioPage />
    )
  }

  if (
    page.type ===
    'contact'
  ) {
    return (
      <ContactPage />
    )
  }

  if (
    page.type ===
    'service'
  ) {
    return (
      <ServicePage
        slug={page.slug}
      />
    )
  }

  if (
    page.type ===
    'products'
  ) {
    return (
      <ProductsPage />
    )
  }

  if (
    page.type ===
    'ma-pdf'
  ) {
    return (
      <MAPdfPage />
    )
  }

  if (
    page.type ===
    'ma-btc-alertas'
  ) {
    return (
      <MABtcAlertsPage />
    )
  }

  if (
    page.type ===
    'ma-recortes'
  ) {
    return (
      <MARecortesPage />
    )
  }

  if (
    page.type ===
    'ma-professor'
  ) {
    return (
      <MAProfessorPage />
    )
  }

  if (
    page.type ===
    'ma-quadro'
  ) {
    return (
      <MAQuadroPage />
    )
  }

  if (
    page.type ===
    'admin'
  ) {
    return (
      <AdminPage />
    )
  }

  if (
    page.type ===
    'admin-ma-professor'
  ) {
    return (
      <MAProfessorAdminPage />
    )
  }

  if (
    page.type ===
    'admin-redezero'
  ) {
    return (
      <RedeZeroAdminPage />
    )
  }

  if (
    page.type ===
    'not-found'
  ) {
    return (
      <NotFoundPage />
    )
  }

  return <MACode />
}
