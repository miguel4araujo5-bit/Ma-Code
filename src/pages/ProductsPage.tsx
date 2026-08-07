import {
  useEffect,
  useState
} from 'react'

const siteUrl =
  'https://ma-code.pt'

type ProductStatus =
  | 'Disponível'
  | 'Brevemente disponível'
  | 'Em desenvolvimento'
  | 'Planeado'

type ProductCard = {
  name: string
  eyebrow: string
  description: string
  href?: string
  status: ProductStatus
  highlights: string[]
  badge: string
  badgeClassName?: string
}

const products:
  ProductCard[] = [
  {
    name: 'MA PDF',
    eyebrow:
      'Ferramentas PDF',
    description:
      'Junte, divida, comprima, converta, edite e assine documentos PDF com uma experiência simples, moderna e preparada para pagamentos por MB WAY.',
    href:
      '/produtos/mapdf',
    status:
      'Disponível',
    badge: 'PDF',
    highlights: [
      'Juntar PDF',
      'Comprimir PDF',
      'PDF para Word',
      'MB WAY'
    ]
  },
  {
    name: 'MA Carteira',
    eyebrow:
      'Carteira digital',
    description:
      'Guarde endereços públicos, dê nomes às carteiras, acompanhe saldos e consulte histórico sem nunca pedir seed phrase ou chaves privadas.',
    href:
      '/produtos/ma-carteira',
    status:
      'Em desenvolvimento',
    badge: 'WAL',
    highlights: [
      'Watch wallet',
      'Histórico',
      'Endereços nomeados',
      'Seguro'
    ]
  },
  {
    name:
      'MA-BTC ALERTAS',
    eyebrow:
      'Alertas Bitcoin',
    description:
      'Receba notificações quando o BTC/USD acumular uma subida ou descida de pelo menos 1%, com consultas horárias e snooze de 8 horas.',
    href:
      '/produtos/ma-btc-alertas',
    status:
      'Disponível',
    badge: '₿',
    badgeClassName:
      'border-orange-300/35 bg-[#f7931a]/15 text-orange-100 shadow-orange-950/30',
    highlights: [
      'BTC/USD',
      'Alertas ±1%',
      'Snooze 8h',
      '07:00–23:00'
    ]
  },
  {
    name:
      'MA-Recortes',
    eyebrow:
      'Criador de stickers',
    description:
      'Carregue uma fotografia, remova o fundo automaticamente ou faça o recorte totalmente à mão. Corrija os detalhes e exporte em PNG transparente ou para o WhatsApp.',
    href:
      '/produtos/ma-recortes',
    status:
      'Disponível',
    badge: '✂',
    badgeClassName:
      'border-violet-300/30 bg-violet-300/10 text-violet-100 shadow-violet-950/30',
    highlights: [
      'Recorte automático',
      'Correção manual',
      'PNG transparente',
      'WhatsApp'
    ]
  },
  {
    name:
      'MA-Quadro',
    eyebrow:
      'Editor de design',
    description:
      'Crie publicações, stories, cabeçalhos e cartazes com texto, imagens, formas, camadas, modelos e exportação local, sem conta nem telemetria.',
    href:
      '/produtos/ma-quadro',
    status:
      'Em desenvolvimento',
    badge: '▦',
    badgeClassName:
      'border-cyan-300/30 bg-cyan-300/10 text-cyan-100 shadow-cyan-950/30',
    highlights: [
      'Modelos',
      'Camadas',
      'PNG e PDF',
      'Tudo local'
    ]
  },
  {
    name:
      'MA-Professor',
    eyebrow:
      'Gestão pedagógica',
    description:
      'Organize planificações, sumários, UFCD, avaliações, faltas e recuperações de aprendizagens num único espaço preparado para o trabalho diário dos professores.',
    status:
      'Brevemente disponível',
    badge: 'MP',
    badgeClassName:
      'border-emerald-300/30 bg-emerald-300/10 text-emerald-100 shadow-emerald-950/30',
    highlights: [
      'Sumários',
      'UFCD',
      'Avaliações',
      'Faltas'
    ]
  }
]

const publicProducts =
  products.filter(
    (
      product
    ): product is ProductCard & {
      href: string
    } =>
      typeof product.href ===
      'string'
  )

function updateMeta(
  name: string,
  content: string
) {
  let meta =
    document.querySelector<
      HTMLMetaElement
    >(
      `meta[name="${name}"]`
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.name = name

    document.head.appendChild(
      meta
    )
  }

  meta.content = content
}

function updatePropertyMeta(
  property: string,
  content: string
) {
  let meta =
    document.querySelector<
      HTMLMetaElement
    >(
      `meta[property="${property}"]`
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.setAttribute(
      'property',
      property
    )

    document.head.appendChild(
      meta
    )
  }

  meta.content = content
}

function updateCanonical(
  href: string
) {
  let canonical =
    document.querySelector<
      HTMLLinkElement
    >(
      'link[rel="canonical"]'
    )

  if (!canonical) {
    canonical =
      document.createElement(
        'link'
      )

    canonical.rel =
      'canonical'

    document.head.appendChild(
      canonical
    )
  }

  canonical.href = href
}

function updateStructuredData(
  id: string,
  data: unknown
) {
  let script =
    document.querySelector<
      HTMLScriptElement
    >(
      `script[data-schema-id="${id}"]`
    )

  if (!script) {
    script =
      document.createElement(
        'script'
      )

    script.type =
      'application/ld+json'

    script.dataset.schemaId =
      id

    document.head.appendChild(
      script
    )
  }

  script.textContent =
    JSON.stringify(data)
}

function ProductCardItem({
  product,
  index,
  mounted
}: {
  product: ProductCard
  index: number
  mounted: boolean
}) {
  const opensProduct =
    Boolean(product.href)

  return (
    <article
      className={`service-card group flex h-full flex-col ${
        mounted
          ? 'animate-fade-in-up'
          : 'opacity-0'
      }`}
      style={{
        animationDelay:
          `${index * 120}ms`
      }}
    >
      <div className="service-card__line" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {product.eyebrow}
            </span>

            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {product.name}
            </h2>
          </div>

          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-sm font-black shadow-lg ${
              product.badgeClassName ||
              'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 shadow-cyan-950/30'
            } ${
              product.badge ===
                '₿' ||
              product.badge ===
                '✂' ||
              product.badge ===
                '▦'
                ? 'text-3xl'
                : ''
            }`}
          >
            {product.badge}
          </div>
        </div>

        <p className="text-sm leading-7 text-slate-300 md:text-base">
          {product.description}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {product.highlights.map(
            (highlight) => (
              <span
                key={highlight}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200"
              >
                {highlight}
              </span>
            )
          )}
        </div>

        <div className="mt-7 flex items-center justify-between gap-4">
          <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-violet-100">
            {product.status}
          </span>
        </div>

        {product.href ? (
          <a
            href={product.href}
            className={`mt-7 inline-flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm font-semibold transition duration-300 ${
              opensProduct
                ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50 group-hover:border-cyan-200/40 group-hover:bg-cyan-300/15'
                : 'border-white/10 bg-white/[0.04] text-slate-200 group-hover:border-cyan-200/30 group-hover:bg-cyan-300/[0.06]'
            }`}
          >
            <span>
              {opensProduct
                ? 'Abrir produto'
                : 'Saber mais'}
            </span>

            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-cyan-200 text-slate-950 transition duration-300 group-hover:translate-x-1">
              →
            </span>
          </a>
        ) : (
          <div
            className="mt-7 inline-flex w-full cursor-not-allowed items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm font-semibold text-slate-500"
            aria-disabled="true"
          >
            <span>
              Brevemente disponível
            </span>

            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-500">
              —
            </span>
          </div>
        )}
      </div>
    </article>
  )
}

export default function ProductsPage() {
  const [
    mounted,
    setMounted
  ] = useState(false)

  useEffect(() => {
    setMounted(true)

    document.title =
      'Produtos MA-Code | Apps e ferramentas digitais'

    updateMeta(
      'description',
      'Conheça os produtos próprios da MA-Code: MA PDF, MA Carteira, MA-BTC ALERTAS, MA-Recortes, MA-Quadro e o futuro MA-Professor para gestão pedagógica.'
    )

    updateMeta(
      'keywords',
      'produtos MA-Code, MA PDF, ferramentas PDF, MA Carteira, MA-BTC ALERTAS, alertas bitcoin, MA-Recortes, criar stickers WhatsApp, MA-Quadro, editor de design, criar post Instagram, MA-Professor, gestão de sumários, UFCD, apps web, ferramentas digitais'
    )

    updateMeta(
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )

    updatePropertyMeta(
      'og:type',
      'website'
    )

    updatePropertyMeta(
      'og:locale',
      'pt_PT'
    )

    updatePropertyMeta(
      'og:site_name',
      'MA-Code'
    )

    updatePropertyMeta(
      'og:url',
      `${siteUrl}/produtos`
    )

    updatePropertyMeta(
      'og:title',
      'Produtos MA-Code | Apps e ferramentas digitais'
    )

    updatePropertyMeta(
      'og:description',
      'Produtos próprios da MA-Code: ferramentas PDF, carteira digital, alertas Bitcoin, criação de stickers, edição de design local e soluções de gestão pedagógica.'
    )

    updatePropertyMeta(
      'og:image',
      `${siteUrl}/ma-code.png`
    )

    updatePropertyMeta(
      'og:image:alt',
      'Produtos MA-Code'
    )

    updateMeta(
      'twitter:card',
      'summary_large_image'
    )

    updateMeta(
      'twitter:url',
      `${siteUrl}/produtos`
    )

    updateMeta(
      'twitter:title',
      'Produtos MA-Code | Apps e ferramentas digitais'
    )

    updateMeta(
      'twitter:description',
      'Produtos próprios da MA-Code: MA PDF, MA Carteira, MA-BTC ALERTAS, MA-Recortes, MA-Quadro e MA-Professor.'
    )

    updateMeta(
      'twitter:image',
      `${siteUrl}/ma-code.png`
    )

    updateMeta(
      'twitter:image:alt',
      'Produtos MA-Code'
    )

    updateCanonical(
      `${siteUrl}/produtos`
    )

    updateStructuredData(
      'ma-code-products-page',
      {
        '@context':
          'https://schema.org',
        '@graph': [
          {
            '@type':
              'CollectionPage',
            '@id':
              `${siteUrl}/produtos#collectionpage`,
            name:
              'Produtos MA-Code',
            url:
              `${siteUrl}/produtos`,
            inLanguage:
              'pt-PT',
            description:
              'Página de produtos próprios da MA-Code, incluindo ferramentas PDF, carteira digital, alertas Bitcoin, criação de stickers, um editor de design local e uma futura aplicação de gestão pedagógica.',
            isPartOf: {
              '@id':
                `${siteUrl}/#website`
            }
          },
          {
            '@type':
              'ItemList',
            '@id':
              `${siteUrl}/produtos#product-list`,
            name:
              'Produtos MA-Code',
            itemListElement:
              publicProducts.map(
                (
                  product,
                  index
                ) => ({
                  '@type':
                    'ListItem',
                  position:
                    index +
                    1,
                  item: {
                    '@type':
                      'SoftwareApplication',
                    name:
                      product.name,
                    applicationCategory:
                      'WebApplication',
                    operatingSystem:
                      'Web',
                    url:
                      `${siteUrl}${product.href}`,
                    description:
                      product.description
                  }
                })
              )
          }
        ]
      }
    )
  }, [])

  return (
    <main className="site-shell">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative z-10 overflow-hidden px-5 pb-12 pt-6 sm:px-6 md:px-10 md:pb-16 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex items-center justify-between gap-4 md:mb-12">
            <a
              href="/"
              className="brand-mark"
              aria-label="MA-Code.pt - Página inicial"
            >
              <img
                src="/ma-code.png"
                alt="MA-Code.pt"
                className="shrink-0 object-contain"
                loading="eager"
                decoding="async"
              />

              <span>
                MA-Code.pt
              </span>
            </a>

            <div className="hidden items-center gap-5 lg:flex">
              <a
                href="/"
                className="text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Início
              </a>

              <a
                href="/projetos"
                className="text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Projetos
              </a>

              <a
                href="/contacto"
                className="btn-ghost text-sm"
              >
                Pedir proposta
              </a>
            </div>
          </header>

          <div
            className={`${
              mounted
                ? 'animate-fade-in-up'
                : 'opacity-0'
            }`}
          >
            <div className="hero-topline">
              <span className="hero-topline__dot" />

              <span>
                Produtos próprios MA-Code
              </span>
            </div>

            <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Apps e ferramentas digitais{' '}

              <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                prontas para crescer
              </span>
              .
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
              Esta área reúne produtos próprios da MA-Code, como o
              MA PDF, a MA Carteira, a MA-BTC ALERTAS, o MA-Recortes,
              o MA-Quadro e o futuro MA-Professor, mantendo a estrutura
              preparada para acrescentar novas automações, ferramentas
              para negócios e apps web.
            </p>

            <div className="hero-actions">
              <a
                href="#produtos"
                className="btn-primary hightech-button"
              >
                <span className="btn-shine" />

                <span className="relative z-10">
                  Ver produtos
                </span>
              </a>

              <a
                href="/contacto?tipo=produto-ma-code"
                className="btn-secondary hightech-button-secondary"
              >
                Sugerir produto
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        id="produtos"
        className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-4xl">
            <span className="section-label">
              Catálogo
            </span>

            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-4xl">
              Produtos disponíveis e em desenvolvimento.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
              Cada produto tem a sua própria página dentro de
              /produtos. Assim, a estrutura fica limpa, organizada e
              preparada para SEO quando forem adicionadas novas
              ferramentas.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {products.map(
              (
                product,
                index
              ) => (
                <ProductCardItem
                  key={
                    product.name
                  }
                  product={
                    product
                  }
                  index={
                    index
                  }
                  mounted={
                    mounted
                  }
                />
              )
            )}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="section-label">
                  Próximos produtos
                </span>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Em breve, mais novidades.
                </h2>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                  Estamos continuamente a desenvolver novas soluções
                  para particulares, profissionais e empresas. Em breve
                  serão apresentados novos produtos para simplificar
                  tarefas, aumentar a produtividade e acelerar a
                  transformação digital.
                </p>
              </div>

              <a
                href="/contacto?tipo=produto-ma-code"
                className="btn-primary hightech-button"
              >
                <span className="btn-shine" />

                <span className="relative z-10">
                  Falar sobre produto
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
