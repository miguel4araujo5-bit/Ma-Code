import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  getServicePageBySlug,
  servicePages,
  siteUrl,
  type ServicePageSlug
} from '../data/servicePages'

type ServicePageProps = {
  slug: ServicePageSlug
}

type ContactFormState = {
  name: string
  email: string
  phone: string
  projectType: string
  hasWebsite: string
  message: string
  botcheck: string
}

type ResolvedServicePage = NonNullable<ReturnType<typeof getServicePageBySlug>>

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

function updateJsonLd(id: string, data: unknown) {
  let script = document.getElementById(id) as HTMLScriptElement | null

  if (!script) {
    script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }

  script.text = JSON.stringify(data)
}

function createInitialForm(projectType: string): ContactFormState {
  return {
    name: '',
    email: '',
    phone: '',
    projectType,
    hasWebsite: '',
    message: '',
    botcheck: ''
  }
}

function createServiceSchema(page: ResolvedServicePage) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${page.seo.canonical}#webpage`,
        url: page.seo.canonical,
        name: page.seo.title,
        description: page.seo.description,
        inLanguage: 'pt-PT',
        isPartOf: {
          '@type': 'WebSite',
          '@id': `${siteUrl}/#website`,
          name: 'MA-Code',
          url: siteUrl
        },
        breadcrumb: {
          '@id': `${page.seo.canonical}#breadcrumb`
        }
      },
      {
        '@type': 'Service',
        '@id': `${page.seo.canonical}#service`,
        name: page.label,
        description: page.hero.description,
        provider: {
          '@type': 'Organization',
          name: 'MA-Code',
          url: siteUrl
        },
        areaServed: {
          '@type': 'Country',
          name: 'Portugal'
        },
        serviceType: page.label,
        url: page.seo.canonical
      },
      {
        '@type': 'FAQPage',
        '@id': `${page.seo.canonical}#faq`,
        mainEntity: page.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer
          }
        }))
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${page.seo.canonical}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Início',
            item: `${siteUrl}/`
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: page.label,
            item: page.seo.canonical
          }
        ]
      }
    ]
  }
}

function getServiceOutcome(slug: ServicePageSlug) {
  if (slug === 'criacao-websites') {
    return 'Website profissional preparado para receber contactos.'
  }

  if (slug === 'lojas-online') {
    return 'Loja online preparada para apresentar produtos e receber encomendas.'
  }

  if (slug === 'sistemas-marcacao') {
    return 'Sistema de marcações para organizar horários e reduzir mensagens perdidas.'
  }

  if (slug === 'automacao-ia') {
    return 'Automação, IA e integrações para reduzir trabalho manual.'
  }

  return 'Solução digital ajustada ao objetivo do negócio.'
}

function getServicePlaceholder(slug: ServicePageSlug) {
  if (slug === 'criacao-websites') {
    return 'Exemplo: preciso de um website para apresentar os meus serviços, receber contactos por WhatsApp e passar uma imagem mais profissional.'
  }

  if (slug === 'lojas-online') {
    return 'Exemplo: quero criar uma loja online para apresentar produtos, receber encomendas e preparar o negócio para vender pela internet.'
  }

  if (slug === 'sistemas-marcacao') {
    return 'Exemplo: preciso de um sistema para receber marcações online, gerir horários e evitar pedidos perdidos por chamada ou mensagem.'
  }

  if (slug === 'automacao-ia') {
    return 'Exemplo: quero automatizar tarefas repetitivas, organizar pedidos ou usar IA para responder melhor aos clientes e poupar tempo.'
  }

  return 'Exemplo: preciso de uma solução digital para apresentar o negócio, receber contactos e organizar melhor o trabalho do dia a dia.'
}

export default function ServicePage({ slug }: ServicePageProps) {
  const page = getServicePageBySlug(slug)
  const defaultProjectType = page?.label ?? 'Pedido geral'

  const [mounted, setMounted] = useState(false)
  const [form, setForm] = useState<ContactFormState>(() => createInitialForm(defaultProjectType))
  const [isSending, setIsSending] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const relatedPages = useMemo(() => {
    if (!page) {
      return []
    }

    return page.relatedServices
      .map((relatedSlug) => getServicePageBySlug(relatedSlug))
      .filter((relatedPage): relatedPage is ResolvedServicePage => Boolean(relatedPage))
  }, [page])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!page) {
      return
    }

    document.title = page.seo.title

    updateMeta('description', page.seo.description)
    updateMeta('keywords', page.seo.keywords)
    updateMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')

    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:locale', 'pt_PT')
    updatePropertyMeta('og:site_name', 'MA-Code')
    updatePropertyMeta('og:url', page.seo.canonical)
    updatePropertyMeta('og:title', page.seo.ogTitle)
    updatePropertyMeta('og:description', page.seo.ogDescription)
    updatePropertyMeta('og:image', `${siteUrl}/ma-code.png`)
    updatePropertyMeta('og:image:alt', `${page.label} - MA-Code`)

    updateMeta('twitter:card', 'summary_large_image')
    updateMeta('twitter:url', page.seo.canonical)
    updateMeta('twitter:title', page.seo.ogTitle)
    updateMeta('twitter:description', page.seo.ogDescription)
    updateMeta('twitter:image', `${siteUrl}/ma-code.png`)
    updateMeta('twitter:image:alt', `${page.label} - MA-Code`)

    updateCanonical(page.seo.canonical)
    updateJsonLd('ma-code-service-page-schema', createServiceSchema(page))

    setForm((currentForm) => ({
      ...currentForm,
      projectType: page.label
    }))
  }, [page])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!page) {
      return
    }

    setIsSending(true)
    setSuccessMessage('')
    setErrorMessage('')

    if (form.botcheck) {
      setIsSending(false)
      return
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          projectType: form.projectType,
          hasWebsite: form.hasWebsite,
          pageUrl: page.seo.canonical,
          message: form.message,
          botcheck: form.botcheck
        })
      })

      const data = (await response.json()) as {
        success?: boolean
        message?: string
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erro ao enviar pedido')
      }

      setSuccessMessage('Pedido enviado com sucesso. Entraremos em contacto em breve.')
      setForm(createInitialForm(page.label))
    } catch {
      setErrorMessage('Não foi possível enviar o pedido. Tente novamente.')
    } finally {
      setIsSending(false)
    }
  }

  if (!page) {
    return (
      <main className="site-shell px-5 py-24 text-white sm:px-6 md:px-10">
        <div className="site-bg-orb site-bg-orb-one" />
        <div className="site-bg-orb site-bg-orb-two" />
        <div className="site-grid" />
        <div className="site-noise" />

        <div className="relative z-10 mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/20">
          <a href="/" className="brand-mark mx-auto mb-8" aria-label="Voltar à página inicial da MA-Code">
            <img src="/ma-code.png" alt="MA-Code.pt" loading="eager" decoding="async" />
            <span>MA-Code.pt</span>
          </a>

          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Página não encontrada
          </p>

          <h1 className="mb-4 text-3xl font-semibold tracking-tight md:text-5xl">
            Não encontrámos esta página de serviço.
          </h1>

          <p className="mb-8 text-base leading-8 text-slate-300">
            Volte à página inicial para consultar os serviços disponíveis ou pedir uma proposta.
          </p>

          <a href="/" className="btn-primary hightech-button">
            <span className="btn-shine" />
            <span className="relative z-10">Voltar ao início</span>
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="site-shell">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative z-10 px-5 pb-12 pt-6 sm:px-6 md:px-10 md:pb-16 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex items-center justify-between gap-4 md:mb-12">
            <a href="/" className="brand-mark" aria-label="MA-Code.pt - Página inicial">
              <img src="/ma-code.png" alt="MA-Code.pt" loading="eager" decoding="async" />
              <span>MA-Code.pt</span>
            </a>

            <div className="flex items-center gap-3">
              <a href="/projetos" className="hidden text-sm font-semibold text-slate-300 transition hover:text-white md:inline-flex">
                Projetos
              </a>

              <a href="#pedido" className="btn-ghost text-sm sm:text-base">
                Pedir proposta
              </a>
            </div>
          </header>

          <div className="hero-layout">
            <div className={`hero-copy ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>{page.hero.eyebrow}</span>
              </div>

              <h1 className="hero-title">
                {page.hero.title}{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-transparent">
                  {page.hero.highlightedTitle}
                </span>
                .
              </h1>

              <div className="hero-price-badge">{getServiceOutcome(page.slug)}</div>

              <p className="hero-subtitle">{page.hero.description}</p>

              <div className="hero-actions">
                <a href="#pedido" className="btn-primary hightech-button">
                  <span className="btn-shine" />
                  <span className="relative z-10">{page.hero.primaryCta}</span>
                </a>

                <a href="/projetos" className="btn-secondary hightech-button-secondary">
                  {page.hero.secondaryCta}
                </a>
              </div>

              <ul className="hero-mini-points" aria-label="Resumo do serviço">
                {page.stats.map((stat) => (
                  <li key={`${stat.value}-${stat.label}`}>{stat.value}</li>
                ))}
              </ul>
            </div>

            <div className={`hero-aside ${mounted ? 'animate-fade-in-scale' : 'opacity-0'}`}>
              <div className="hero-panel">
                <div className="hero-panel__glow" />

                <div className="hero-panel__header">
                  <div className="hero-panel__dots">
                    <span />
                    <span />
                    <span />
                  </div>

                  <span className="hero-panel__label">Serviço MA-Code</span>
                </div>

                <div className="hero-panel__content">
                  <div className="hud-card hud-card--wide">
                    <span className="hud-card__label">Serviço</span>
                    <strong>{page.shortLabel}</strong>
                  </div>

                  {page.stats.map((stat) => (
                    <div key={`${stat.value}-${stat.label}`} className="hud-card">
                      <span className="hud-card__label">{stat.value}</span>
                      <strong>{stat.label}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div className="service-card">
              <div className="service-card__line" />

              <div className="relative z-10">
                <span className="section-label">Estratégia</span>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  {page.intro.title}
                </h2>

                <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300 md:text-base">
                  {page.intro.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="service-card">
              <div className="service-card__line" />

              <div className="relative z-10">
                <span className="section-label">Ideal para</span>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {page.idealFor.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-200"
                    >
                      <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-300/15 text-sm font-black text-cyan-200">
                        ✓
                      </span>

                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-3xl">
            <div className="mb-5 section-label-wrap">
              <span className="section-label">Benefícios</span>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              O que este serviço pode melhorar
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {page.benefits.map((benefit, index) => (
              <article
                key={benefit.title}
                className={`service-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="service-card__line" />

                <div className="relative z-10">
                  <div className="service-card__index">
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  <h3 className="service-card__title">{benefit.title}</h3>

                  <p className="service-card__description">{benefit.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-8">
          <div className="mb-8 max-w-3xl">
            <span className="section-label">Incluído</span>

            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              O que pode ficar incluído
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {page.deliverables.map((deliverable) => (
              <article
                key={deliverable.title}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5"
              >
                <h3 className="text-lg font-semibold text-white">{deliverable.title}</h3>

                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {deliverable.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-3xl">
            <div className="mb-5 section-label-wrap">
              <span className="section-label">Processo</span>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Como o projeto avança
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {page.process.map((step, index) => (
              <article
                key={step.title}
                className={`process-card service-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="service-card__line" />

                <div className="relative z-10">
                  <div className="service-card__index">
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>

                  <p className="mt-3 text-sm leading-7 text-slate-300">{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="mb-5 section-label-wrap">
              <span className="section-label">FAQ</span>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Dúvidas comuns antes de avançar
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
              Respostas diretas sobre este tipo de projeto, o que pode incluir e como a solução pode
              evoluir.
            </p>
          </div>

          <div className="space-y-4">
            {page.faq.map((item) => (
              <details
                key={item.question}
                className="group rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-semibold text-white">
                  {item.question}

                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-cyan-200 transition group-open:rotate-45">
                    +
                  </span>
                </summary>

                <p className="mt-4 text-sm leading-7 text-slate-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {relatedPages.length > 0 ? (
        <section className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <div className="mb-5 section-label-wrap">
                <span className="section-label">Serviços relacionados</span>
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Serviços que podem complementar este projeto
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {relatedPages.map((relatedPage) => (
                <a
                  key={relatedPage.slug}
                  href={relatedPage.path}
                  className="service-card group"
                >
                  <div className="service-card__line" />

                  <div className="relative z-10">
                    <span className="mb-4 block text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                      {relatedPage.shortLabel}
                    </span>

                    <h3 className="service-card__title">{relatedPage.label}</h3>

                    <p className="service-card__description text-sm leading-7">
                      {relatedPage.seo.description}
                    </p>

                    <span className="mt-6 inline-flex text-sm font-semibold text-cyan-200 transition group-hover:translate-x-1">
                      Ver serviço →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section id="pedido" className="relative z-10 px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="contact-side-panel">
              <span className="section-label">Pedido de proposta</span>

              <h2 className="contact-side-panel__title">Fale-nos do projeto</h2>

              <p className="contact-side-panel__text">
                Explique o que pretende criar, que problema quer resolver e que funcionalidades são
                importantes. Com esse contexto, conseguimos responder com uma proposta mais ajustada.
              </p>

              <div className="contact-metrics">
                <div className="metric-card">
                  <span className="metric-card__label">Serviço</span>
                  <strong>{page.shortLabel}</strong>
                </div>

                <div className="metric-card">
                  <span className="metric-card__label">Resposta</span>
                  <strong>Proposta ajustada</strong>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-white">Para orientar a proposta:</p>

                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  <li>• Tipo de projeto pretendido</li>
                  <li>• Se já existe site, domínio, alojamento ou conteúdos</li>
                  <li>• Funcionalidades essenciais</li>
                  <li>• Objetivo principal: contactos, vendas, marcações ou organização</li>
                </ul>
              </div>
            </div>

            <div className="form-shell">
              <form onSubmit={handleSubmit} className="space-y-5">
                <input
                  type="text"
                  name="botcheck"
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.botcheck}
                  onChange={(e) => setForm({ ...form, botcheck: e.target.value })}
                />

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="service-name" className="input-label">
                      Nome
                    </label>

                    <input
                      id="service-name"
                      name="name"
                      type="text"
                      className="input-field"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <label htmlFor="service-email" className="input-label">
                      Email
                    </label>

                    <input
                      id="service-email"
                      name="email"
                      type="email"
                      className="input-field"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="service-phone" className="input-label">
                      Telefone / WhatsApp <span className="text-slate-500">(opcional)</span>
                    </label>

                    <input
                      id="service-phone"
                      name="phone"
                      type="tel"
                      className="input-field"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      autoComplete="tel"
                    />
                  </div>

                  <div>
                    <label htmlFor="service-project-type" className="input-label">
                      Tipo de projeto
                    </label>

                    <select
                      id="service-project-type"
                      name="Tipo de projeto"
                      className="input-field"
                      value={form.projectType}
                      onChange={(e) => setForm({ ...form, projectType: e.target.value })}
                      required
                    >
                      {servicePages.map((servicePage) => (
                        <option key={servicePage.slug} value={servicePage.label}>
                          {servicePage.label}
                        </option>
                      ))}

                      <option value="Aplicação web à medida">Aplicação web à medida</option>
                      <option value="Integração avançada">Integração avançada</option>
                      <option value="Ainda não sei">Ainda não sei</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="service-has-website" className="input-label">
                    Já tem site?
                  </label>

                  <select
                    id="service-has-website"
                    name="Já tem site?"
                    className="input-field"
                    value={form.hasWebsite}
                    onChange={(e) => setForm({ ...form, hasWebsite: e.target.value })}
                  >
                    <option value="">Selecione uma opção</option>
                    <option value="Sim, já tenho site">Sim, já tenho site</option>
                    <option value="Não, quero começar do zero">Não, quero começar do zero</option>
                    <option value="Tenho domínio, mas não tenho site">
                      Tenho domínio, mas não tenho site
                    </option>
                    <option value="Não tenho a certeza">Não tenho a certeza</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="service-message" className="input-label">
                    Descreva o projeto
                  </label>

                  <textarea
                    id="service-message"
                    name="message"
                    rows={7}
                    className="input-field input-textarea"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                    placeholder={getServicePlaceholder(page.slug)}
                  />
                </div>

                {successMessage ? (
                  <div
                    className="status-message status-message--success"
                    role="status"
                    aria-live="polite"
                  >
                    {successMessage}
                  </div>
                ) : null}

                {errorMessage ? (
                  <div className="status-message status-message--error" role="alert">
                    {errorMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="btn-primary hightech-button w-full disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSending}
                >
                  <span className="btn-shine" />

                  <span className="relative z-10">
                    {isSending ? 'A enviar...' : 'Receber proposta gratuita'}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-5 py-8 text-center text-sm text-slate-400 sm:px-6 md:px-10">
        <p>
          © {new Date().getFullYear()} MA-Code. Websites, lojas online, marcações, automação e
          soluções digitais.
        </p>
      </footer>
    </main>
  )
}
