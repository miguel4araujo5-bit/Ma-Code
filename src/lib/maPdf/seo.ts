import { siteUrl } from './constants'

function updateMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updatePropertyMeta(property: string, content: string) {
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

function updateStructuredData(id: string, data: unknown) {
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

export function setupMaPdfSeo() {
  const pageUrl = `${siteUrl}/produtos/mapdf`
  const title =
    'MA PDF | Juntar, dividir, comprimir e converter PDF para JPG'
  const description =
    'Junte, divida, comprima e converta documentos PDF para JPG gratuitamente no navegador. Os ficheiros permanecem no seu dispositivo e não são enviados para servidores.'

  document.title = title

  updateMeta('description', description)
  updateMeta(
    'keywords',
    'MA PDF, juntar PDF, dividir PDF, comprimir PDF, PDF para JPG, converter PDF em imagem, ferramentas PDF grátis, PDF online, PDF privado, MA-Code'
  )
  updateMeta(
    'robots',
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  )

  updatePropertyMeta('og:type', 'website')
  updatePropertyMeta('og:locale', 'pt_PT')
  updatePropertyMeta('og:site_name', 'MA-Code')
  updatePropertyMeta('og:url', pageUrl)
  updatePropertyMeta('og:title', title)
  updatePropertyMeta(
    'og:description',
    'Ferramentas PDF gratuitas e privadas. Junte, divida, otimize e converta páginas PDF para JPG diretamente no navegador.'
  )
  updatePropertyMeta('og:image', `${siteUrl}/ma-code.png`)
  updatePropertyMeta('og:image:alt', 'MA PDF - ferramentas PDF da MA-Code')

  updateMeta('twitter:card', 'summary_large_image')
  updateMeta('twitter:url', pageUrl)
  updateMeta('twitter:title', title)
  updateMeta(
    'twitter:description',
    'Ferramentas PDF gratuitas que juntam, dividem, otimizam e convertem documentos para JPG diretamente no navegador.'
  )
  updateMeta('twitter:image', `${siteUrl}/ma-code.png`)
  updateMeta('twitter:image:alt', 'MA PDF - ferramentas PDF da MA-Code')

  updateCanonical(pageUrl)

  updateStructuredData('ma-pdf-product-page', {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        name: title,
        url: pageUrl,
        inLanguage: 'pt-PT',
        description:
          'Ferramentas PDF gratuitas para juntar, dividir, otimizar e converter documentos para JPG diretamente no navegador.',
        isPartOf: {
          '@id': `${siteUrl}/#website`
        }
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${pageUrl}#softwareapplication`,
        name: 'MA PDF',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        url: pageUrl,
        description:
          'Ferramentas PDF gratuitas para juntar, dividir, otimizar e converter páginas PDF para JPG sem enviar os ficheiros para servidores.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR'
        },
        featureList: [
          'Juntar ficheiros PDF',
          'Dividir PDF por páginas ou intervalos',
          'Otimizar a estrutura de ficheiros PDF',
          'Converter páginas PDF para imagens JPG',
          'Processamento local no navegador'
        ],
        creator: {
          '@type': 'Organization',
          name: 'MA-Code',
          url: siteUrl
        }
      }
    ]
  })
}
