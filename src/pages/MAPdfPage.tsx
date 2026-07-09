import { useEffect, useMemo, useState } from 'react'

const siteUrl = 'https://ma-code.pt'

type ToolAccent = 'cyan' | 'blue' | 'violet' | 'emerald' | 'amber' | 'orange'

type PdfTool = {
  title: string
  description: string
  badge: string
  accent: ToolAccent
}

const pdfTools: PdfTool[] = [
  {
    title: 'Juntar PDF',
    description: 'Combine vários PDF num único documento de forma simples.',
    badge: 'PDF+',
    accent: 'cyan'
  },
  {
    title: 'Dividir PDF',
    description: 'Separe páginas ou ficheiros PDF em vários documentos.',
    badge: 'PDF÷',
    accent: 'violet'
  },
  {
    title: 'Comprimir PDF',
    description: 'Reduza o tamanho do PDF mantendo a melhor qualidade possível.',
    badge: 'ZIP',
    accent: 'cyan'
  },
  {
    title: 'PDF para Word',
    description: 'Converta PDF para documentos Word editáveis.',
    badge: 'W',
    accent: 'blue'
  },
  {
    title: 'Word para PDF',
    description: 'Converta documentos Word de forma rápida para PDF.',
    badge: 'W→',
    accent: 'blue'
  },
  {
    title: 'PDF para DOC',
    description: 'Extraia texto de PDF para ficheiros DOC editáveis.',
    badge: 'DOC',
    accent: 'blue'
  },
  {
    title: 'DOC para PDF',
    description: 'Converta ficheiros DOC para PDF com qualidade.',
    badge: 'DOC→',
    accent: 'blue'
  },
  {
    title: 'PDF para JPG',
    description: 'Extraia imagens ou converta páginas PDF para JPG.',
    badge: 'JPG',
    accent: 'amber'
  },
  {
    title: 'JPG para PDF',
    description: 'Converta imagens JPG para um PDF organizado.',
    badge: 'IMG',
    accent: 'amber'
  },
  {
    title: 'PDF para Excel',
    description: 'Converta tabelas de PDF para ficheiros Excel editáveis.',
    badge: 'XLS',
    accent: 'emerald'
  },
  {
    title: 'Excel para PDF',
    description: 'Converta folhas de cálculo Excel para PDF com um clique.',
    badge: 'X→',
    accent: 'emerald'
  },
  {
    title: 'PDF para PowerPoint',
    description: 'Converta PDF em apresentações PowerPoint editáveis.',
    badge: 'PPT',
    accent: 'orange'
  },
  {
    title: 'PowerPoint para PDF',
    description: 'Transforme apresentações PowerPoint em PDF.',
    badge: 'P→',
    accent: 'orange'
  },
  {
    title: 'Editar PDF',
    description: 'Adicione texto, imagens, formas e anotações com facilidade.',
    badge: '✎',
    accent: 'violet'
  },
  {
    title: 'Assinar PDF',
    description: 'Assine documentos PDF de forma eletrónica rápida e segura.',
    badge: 'SIG',
    accent: 'cyan'
  },
  {
    title: 'Marca de água',
    description: 'Adicione marcas de água de texto ou imagem aos seus PDF.',
    badge: 'WM',
    accent: 'violet'
  }
]

const roadmapItems = [
  {
    title: 'Primeira versão',
    description: 'Ferramentas essenciais para juntar, dividir, comprimir e converter documentos.'
  },
  {
    title: 'Pagamentos simples',
    description: 'Modelo preparado para MB WAY, pagamentos únicos ou pacotes de utilização.'
  },
  {
    title: 'Conta de utilizador',
    description:
      'Login apenas quando fizer sentido: histórico, pacotes ativos, faturas e ferramentas pagas.'
  }
]

const accentClasses: Record<ToolAccent, string> = {
  cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 shadow-cyan-950/30',
  blue: 'border-sky-300/25 bg-sky-400/10 text-sky-100 shadow-sky-950/30',
  violet: 'border-violet-300/25 bg-violet-400/10 text-violet-100 shadow-violet-950/30',
  emerald: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100 shadow-emerald-950/30',
  amber: 'border-amber-300/25 bg-amber-400/10 text-amber-100 shadow-amber-950/30',
  orange: 'border-orange-300/25 bg-orange-400/10 text-orange-100 shadow-orange-950/30'
}

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
  let meta = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)

  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('property', property)
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updateCanonical(href: string) {
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }

  canonical.href = href
}

function updateStructuredData(id: string, data: unknown) {
  let script = document.querySelector<HTMLScriptElement>(`script[data-schema-id="${id}"]`)

  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.schemaId = id
    document.head.appendChild(script)
  }

  script.textContent = JSON.stringify(data)
}

function PdfHeroIcon() {
  return (
    <div className="relative mx-auto hidden max-w-[17rem] lg:block" aria-hidden="true">
      <div className="absolute inset-x-8 bottom-0 h-12 rounded-full bg-cyan-300/20 blur-2xl" />

      <div className="relative rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/40 backdrop-blur">
        <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.16),transparent_50%)]" />

        <div className="relative aspect-[4/5] rounded-[1.55rem] border border-cyan-200/35 bg-cyan-300/[0.06] p-5 shadow-inner shadow-cyan-200/10">
          <div className="absolute right-5 top-5 h-12 w-12 rounded-bl-3xl border-b border-l border-cyan-200/30 bg-cyan-200/10" />

          <div className="flex h-full items-end justify-center gap-3 text-center">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/70">
              MA
            </span>

            <span className="text-5xl font-black tracking-tight text-cyan-200 drop-shadow-[0_0_18px_rgba(103,232,249,0.35)]">
              PDF
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolCard({ tool, index, mounted }: { tool: PdfTool; index: number; mounted: boolean }) {
  return (
    <article
      className={`group relative overflow-hidden rounded-[1.6rem] border border-cyan-300/[0.12] bg-slate-950/60 p-5 shadow-xl shadow-cyan-950/10 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-slate-900/80 md:p-6 ${
        mounted ? 'animate-fade-in-up' : 'opacity-0'
      }`}
      style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
    >
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent opacity-70" />
      <span className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-cyan-300/[0.08] blur-3xl transition duration-500 group-hover:bg-cyan-300/[0.14]" />

      <div className="relative z-10 flex h-full gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-sm font-black tracking-tight shadow-lg ${accentClasses[tool.accent]}`}
        >
          {tool.badge}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight text-white md:text-xl">
              {tool.title}
            </h3>

            <span className="mt-1 text-xl text-cyan-200 transition duration-300 group-hover:translate-x-1">
              →
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-300">{tool.description}</p>
        </div>
      </div>
    </article>
  )
}

export default function MAPdfPage() {
  const [mounted, setMounted] = useState(false)

  const groupedTools = useMemo(() => pdfTools, [])

  useEffect(() => {
    setMounted(true)

    document.title = 'MA PDF | Ferramentas PDF com pagamento por MB WAY | MA-Code'

    updateMeta(
      'description',
      'MA PDF é uma ferramenta da MA-Code para juntar, dividir, comprimir, converter e editar documentos PDF, com foco em pagamentos simples por MB WAY e sem mensalidades obrigatórias.'
    )

    updateMeta(
      'keywords',
      'MA PDF, ferramentas PDF, juntar PDF, dividir PDF, comprimir PDF, converter PDF, PDF para Word, Word para PDF, DOC para PDF, PDF para DOC, MB WAY, MA-Code'
    )

    updateMeta(
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )

    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:locale', 'pt_PT')
    updatePropertyMeta('og:site_name', 'MA-Code')
    updatePropertyMeta('og:url', `${siteUrl}/produtos/mapdf`)
    updatePropertyMeta('og:title', 'MA PDF | Ferramentas PDF com pagamento por MB WAY')
    updatePropertyMeta(
      'og:description',
      'Ferramentas PDF simples, rápidas e acessíveis: juntar, dividir, comprimir, converter, editar e assinar PDF.'
    )
    updatePropertyMeta('og:image', `${siteUrl}/ma-code.png`)
    updatePropertyMeta('og:image:alt', 'MA PDF - ferramentas PDF da MA-Code')

    updateMeta('twitter:card', 'summary_large_image')
    updateMeta('twitter:url', `${siteUrl}/produtos/mapdf`)
    updateMeta('twitter:title', 'MA PDF | Ferramentas PDF com pagamento por MB WAY')
    updateMeta(
      'twitter:description',
      'Ferramentas PDF simples, rápidas e acessíveis com pagamento por MB WAY e sem mensalidades obrigatórias.'
    )
    updateMeta('twitter:image', `${siteUrl}/ma-code.png`)
    updateMeta('twitter:image:alt', 'MA PDF - ferramentas PDF da MA-Code')

    updateCanonical(`${siteUrl}/produtos/mapdf`)

    updateStructuredData('ma-pdf-product-page', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/produtos/mapdf#webpage`,
          name: 'MA PDF | Ferramentas PDF com pagamento por MB WAY',
          url: `${siteUrl}/produtos/mapdf`,
          inLanguage: 'pt-PT',
          description:
            'Página do produto MA PDF, uma ferramenta para juntar, dividir, comprimir, converter e editar ficheiros PDF.',
          isPartOf: {
            '@id': `${siteUrl}/#website`
          }
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${siteUrl}/produtos/mapdf#softwareapplication`,
          name: 'MA PDF',
          applicationCategory: 'ProductivityApplication',
          operatingSystem: 'Web',
          url: `${siteUrl}/produtos/mapdf`,
          description:
            'Ferramentas PDF online para juntar, dividir, comprimir, converter, editar, assinar e organizar documentos PDF.',
          offers: {
            '@type': 'Offer',
            priceCurrency: 'EUR',
            description: 'Pagamento por utilização, pacote ou acesso simples por MB WAY.'
          },
          creator: {
            '@type': 'Organization',
            name: 'MA-Code',
            url: siteUrl
          }
        }
      ]
    })
  }, [])

  return (
    <main className="site-shell">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative z-10 overflow-hidden px-5 pb-10 pt-6 sm:px-6 md:px-10 md:pb-12 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex items-center justify-between gap-4 md:mb-12">
            <a href="/" className="brand-mark" aria-label="MA-Code.pt - Página inicial">
              <img
                src="/ma-code.png"
                alt="MA-Code.pt"
                className="shrink-0 object-contain"
                loading="eager"
                decoding="async"
              />
              <span>MA-Code.pt</span>
            </a>

            <div className="hidden items-center gap-3 sm:flex">
              <a
                href="/produtos"
                className="text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Produtos
              </a>

              <a
                href="/produtos/mapdf"
                className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100"
              >
                MA PDF
              </a>

              <a href="/contacto?tipo=ma-pdf" className="btn-ghost text-sm">
                Acesso antecipado
              </a>
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-center">
            <PdfHeroIcon />

            <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>Produto MA-Code · MA PDF</span>
              </div>

              <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Ferramentas PDF{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                  simples, rápidas e acessíveis
                </span>
                .
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
                Edite, converta e otimize ficheiros PDF com uma experiência moderna, pagamento
                simples por MB WAY e sem mensalidades obrigatórias para quem só precisa de usar
                ferramentas quando precisa.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                  Pagamento por MB WAY
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">
                  Sem subscrição obrigatória
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">
                  Seguro e privado
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="ferramentas" className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {groupedTools.map((tool, index) => (
              <div
                key={tool.title}
                id={
                  tool.title === 'Juntar PDF'
                    ? 'juntar-pdf'
                    : tool.title === 'Dividir PDF'
                      ? 'dividir-pdf'
                      : tool.title === 'Comprimir PDF'
                        ? 'comprimir-pdf'
                        : undefined
                }
              >
                <ToolCard tool={tool} index={index} mounted={mounted} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div className="service-card">
              <div className="service-card__line" />

              <div className="relative z-10">
                <span className="section-label">Modelo de produto</span>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Mais barato para quem não quer pagar mensalidade.
                </h2>

                <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
                  O posicionamento do MA PDF deve ser simples: ferramentas essenciais, preço baixo,
                  pagamento por utilização ou pacote, e checkout adaptado a Portugal com MB WAY.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                      Preço
                    </span>

                    <strong className="mt-2 block text-lg text-white">Baixo</strong>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                      Pagamento
                    </span>

                    <strong className="mt-2 block text-lg text-white">MB WAY</strong>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                      Acesso
                    </span>

                    <strong className="mt-2 block text-lg text-white">Sem fidelização</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {roadmapItems.map((item, index) => (
                <article key={item.title} className="service-card">
                  <div className="service-card__line" />

                  <div className="relative z-10 flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-sm font-black text-cyan-100">
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white">{item.title}</h3>

                      <p className="mt-2 text-sm leading-7 text-slate-300">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="section-label">Próximo passo</span>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Quer avançar com o MA PDF como primeiro produto próprio?
                </h2>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                  A página já pode existir no site como produto em desenvolvimento. Depois ligamos
                  upload de ficheiros, pagamentos por MB WAY, login e processamento real dos PDFs.
                </p>
              </div>

              <a href="/contacto?tipo=ma-pdf" className="btn-primary hightech-button">
                <span className="btn-shine" />
                <span className="relative z-10">Pedir acesso antecipado</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
