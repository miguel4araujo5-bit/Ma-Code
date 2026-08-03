import {
  useEffect
} from 'react'

import MAQuadroApp from '../components/ma-quadro/MAQuadroApp'

const siteUrl = 'https://ma-code.pt'
const productPath = '/produtos/ma-quadro'

function updateMeta(
  name: string,
  content: string
) {
  let meta = document.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`
  )

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updatePropertyMeta(
  property: string,
  content: string
) {
  let meta = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`
  )

  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('property', property)
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updateCanonical(href: string) {
  let canonical = document.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  )

  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }

  canonical.href = href
}

function updateStructuredData(
  id: string,
  data: unknown
) {
  let script = document.querySelector<HTMLScriptElement>(
    `script[data-schema-id="${id}"]`
  )

  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.schemaId = id
    document.head.appendChild(script)
  }

  script.textContent = JSON.stringify(data)
}

export default function MAQuadroPage() {
  useEffect(() => {
    const pageUrl = `${siteUrl}${productPath}`

    document.title =
      'MA-Quadro | Editor de design local da MA-Code'

    updateMeta(
      'description',
      'Crie publicações, stories, cabeçalhos e cartazes com texto, imagens, formas, camadas, modelos e exportação local. Sem conta e sem telemetria.'
    )
    updateMeta(
      'keywords',
      'MA-Quadro, editor de design online, alternativa Canva, criar post Instagram, criar story, cartaz A4, editor local, Fabric.js'
    )
    updateMeta(
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )
    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:locale', 'pt_PT')
    updatePropertyMeta('og:site_name', 'MA-Code')
    updatePropertyMeta('og:url', pageUrl)
    updatePropertyMeta(
      'og:title',
      'MA-Quadro | Editor de design local'
    )
    updatePropertyMeta(
      'og:description',
      'Editor visual para criar designs com imagens, texto, formas, modelos e exportação local.'
    )
    updatePropertyMeta(
      'og:image',
      `${siteUrl}/ma-code.png`
    )
    updatePropertyMeta(
      'og:image:alt',
      'MA-Quadro da MA-Code'
    )
    updateMeta('twitter:card', 'summary_large_image')
    updateMeta(
      'twitter:title',
      'MA-Quadro | Editor de design local'
    )
    updateMeta(
      'twitter:description',
      'Crie e guarde designs no próprio dispositivo, sem conta e sem telemetria.'
    )
    updateMeta(
      'twitter:image',
      `${siteUrl}/ma-code.png`
    )
    updateCanonical(pageUrl)
    updateStructuredData('ma-quadro-product', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'MA-Quadro',
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web',
      url: pageUrl,
      inLanguage: 'pt-PT',
      description:
        'Editor de design local para criar publicações, stories, cabeçalhos e cartazes sem conta nem telemetria.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR'
      }
    })
  }, [])

  return <MAQuadroApp />
}
