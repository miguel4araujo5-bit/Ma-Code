import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  getServicePageBySlug,
  servicePages,
  siteUrl,
  type ServicePageSlug,
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
    botcheck: '',
  }
}

function createServiceSchema(page: NonNullable<ReturnType<typeof getServicePageBySlug>>) {
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
          url: siteUrl,
        },
        breadcrumb: {
          '@id': `${page.seo.canonical}#breadcrumb`,
        },
      },
      {
        '@type': 'Service',
        '@id': `${page.seo.canonical}#service`,
        name: page.label,
        description: page.hero.description,
        provider: {
          '@type': 'Organization',
          name: 'MA-Code',
          url: siteUrl,
        },
        areaServed: {
          '@type': 'Country',
          name: 'Portugal',
        },
        serviceType: page.label,
        url: page.seo.canonical,
      },
      {
        '@type': 'FAQPage',
        '@id': `${page.seo.canonical}#faq`,
        mainEntity: page.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${page.seo.canonical}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Início',
            item: `${siteUrl}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: page.label,
            item: page.seo.canonical,
          },
        ],
      },
    ],
  }
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
      .filter((relatedPage): relatedPage is NonNullable<typeof relatedPage> => Boolean(relatedPage))
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
      projectType: page.label,
    }))
  }, [page])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!page) {
      return
    }

    setIsSending(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          projectType: form.projectType,
          hasWebsite: form.hasWebsite,
          message: `Página de origem: ${page.label}\nURL: ${page.seo.canonical}\n\n${form.message}`,
          botcheck: form.botcheck,
        }),
      })

      const data = await response.json()

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
      <main className="min-h-screen bg-[#061019] px-5 py-24 text-white sm:px-6 md:px-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/20">
          <a href="/" className="mb-8 inline-flex items-center gap-3 text-sm font-semibold text-cyan-200">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
              M
            </span>
            MA-Code
          </a>

          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
            Página não encontrada
          </p>

          <h1 className="mb-4 text-3xl font-semibold tracking-tight md:text-5xl">
            Esta página de serviço não existe.
          </h1>

          <p className="mb-8 text-base leading-8 text-slate-300">
            Volte à página inicial para consultar os serviços disponíveis ou pedir uma proposta.
          </p>

          <a
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          >
            Voltar ao início
          </a>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#061019] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#061019]/82 px-5 py-4 backdrop-blur-xl sm:px-6 md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
          <a href="/" className="group inline-flex items-center gap-3" aria-label="Voltar à página inicial da MA-Code">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-300 text-base font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition group-hover:scale-105">
              M
            </span>
            <span>
              <span className="block text-sm font-bold leading-none tracking-tight">MA-Code</span>
              <span className="block text-xs text-slate-400">Websites, lojas e automação</span>
            </span>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 md:flex">
            <a href="/#servicos" className="transition hover:text-white">
              Serviços
            </a>
            <a href="/projetos" className="transition hover:text-white">
              Projetos
            </a>
            <a href="#faq" className="transition hover:text-white">
              FAQ
            </a>
          </nav>

          <a
            href="#pedido"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 text-sm font-bold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/20"
          >
            Pedir orçamento
          </a>
        </div>
      </header>

      <main className="pt-24">
        <section className="relative px-5 pb-16 pt-12 sm:px-6 md:px-10 md:pb-24 md:pt-20">
          <div className="absolute inset-0 -z-10">
            <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute right-[-10%] top-[10%] h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="absolute bottom-0 left-[35%] h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
          </div>

          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div
              className={`transition duration-700 ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
              }`}
            >
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-100">
                {page.hero.eyebrow}
              </div>

              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
                {page.hero.title}{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-transparent">
                  {page.hero.highlightedTitle}
                </span>
                .
              </h1>

              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300 md:text-xl md:leading-9">
                {page.hero.description}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#pedido"
                  className="relative inline-flex min-h-12 items-center justify-center overflow-hidden rounded-full bg-cyan-300 px-7 text-sm font-black text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-200"
                >
                  <span className="relative z-10">{page.hero.primaryCta}</span>
                </a>

                <a
                  href="/projetos"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-7 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:border-cyan-200/70 hover:bg-white/5"
                >
                  {page.hero.secondaryCta}
                </a>
              </div>
            </div>

            <div
              className={`transition delay-150 duration-700 ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
              }`}
            >
              <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 backdrop-blur">
                <div className="absolute -inset-1 -z-10 rounded-[2.2rem] bg-gradient-to-br from-cyan-300/20 via-transparent to-violet-400/20 blur-xl" />

                <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/70 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                        Serviço MA-Code
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold">{page.shortLabel}</h2>
                    </div>

                    <div className="flex gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-red-300/80" />
                      <span className="h-3 w-3 rounded-full bg-yellow-300/80" />
                      <span className="h-3 w-3 rounded-full bg-emerald-300/80" />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {page.stats.map((stat) => (
                      <div
                        key={`${stat.value}-${stat.label}`}
                        className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                      >
                        <p className="text-2xl font-black text-cyan-200">{stat.value}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5">
                    <p className="text-sm font-semibold text-cyan-100">Objetivo principal</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Criar uma presença digital clara, rápida e preparada para transformar visitantes em pedidos reais.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
                Estratégia
              </p>

              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {page.intro.title}
              </h2>
            </div>

            <div className="space-y-5 text-base leading-8 text-slate-300 md:text-lg">
              {page.intro.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
                Ideal para
              </p>

              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Quando este serviço faz sentido
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {page.idealFor.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 text-sm leading-7 text-slate-200 shadow-lg shadow-black/10"
                >
                  <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-200">
                    ✓
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
                Benefícios
              </p>

              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                O que o seu negócio ganha
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {page.benefits.map((benefit, index) => (
                <article
                  key={benefit.title}
                  className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-6 shadow-xl shadow-black/10"
                >
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-cyan-200">
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  <h3 className="text-xl font-semibold">{benefit.title}</h3>

                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {benefit.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 md:p-8">
            <div className="mb-8 max-w-3xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
                Incluído no projeto
              </p>

              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Funcionalidades e entregáveis
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {page.deliverables.map((deliverable) => (
                <article
                  key={deliverable.title}
                  className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-5"
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

        <section className="px-5 py-14 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
                Processo
              </p>

              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Como trabalhamos
              </h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-4">
              {page.process.map((step, index) => (
                <article
                  key={step.title}
                  className="relative rounded-[2rem] border border-white/10 bg-white/[0.04] p-6"
                >
                  <span className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300 text-sm font-black text-slate-950">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <h3 className="text-lg font-semibold">{step.title}</h3>

                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="px-5 py-14 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
                Perguntas frequentes
              </p>

              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Dúvidas comuns antes de avançar
              </h2>
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

                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
                Serviços relacionados
              </p>

              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Outras soluções que podem complementar este projeto
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {relatedPages.map((relatedPage) => (
                <a
                  key={relatedPage.slug}
                  href={relatedPage.path}
                  className="group rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.07]"
                >
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                    {relatedPage.shortLabel}
                  </p>

                  <h3 className="text-xl font-semibold text-white">{relatedPage.label}</h3>

                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {relatedPage.seo.description}
                  </p>

                  <span className="mt-6 inline-flex text-sm font-bold text-cyan-200 transition group-hover:translate-x-1">
                    Ver serviço →
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="pedido" className="px-5 py-14 sm:px-6 md:px-10 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 via-white/[0.04] to-violet-400/10 p-6 shadow-2xl shadow-black/25 md:p-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
                Pedido de proposta
              </p>

              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Conte-nos o que precisa para {page.shortLabel.toLowerCase()}
              </h2>

              <p className="mt-5 text-base leading-8 text-slate-300">
                Descreva o objetivo, o tipo de negócio e o que pretende incluir. Quanto mais contexto enviar,
                mais certeira será a resposta.
              </p>

              <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-5">
                <p className="text-sm font-semibold text-white">Para uma resposta mais útil, indique:</p>

                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  <li>• Que tipo de projeto pretende criar</li>
                  <li>• Se já tem website, domínio ou alojamento</li>
                  <li>• Que funcionalidades são essenciais</li>
                  <li>• Qual é o objetivo principal: contactos, vendas, marcações ou organização</li>
                </ul>
              </div>
            </div>

            <form className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-5" onSubmit={handleSubmit}>
              <div className="hidden" aria-hidden="true">
                <label>
                  Não preencher
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.botcheck}
                    onChange={(e) => setForm({ ...form, botcheck: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Nome
                  <input
                    className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    autoComplete="name"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Email
                  <input
                    className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    autoComplete="email"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Telefone / WhatsApp
                  <input
                    className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    autoComplete="tel"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Tipo de projeto
                  <select
                    className="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 text-base text-white outline-none transition focus:border-cyan-300/60"
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
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Já tem website?
                  <select
                    className="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 text-base text-white outline-none transition focus:border-cyan-300/60"
                    value={form.hasWebsite}
                    onChange={(e) => setForm({ ...form, hasWebsite: e.target.value })}
                  >
                    <option value="">Selecione uma opção</option>
                    <option value="Sim, já tenho website">Sim, já tenho website</option>
                    <option value="Não, quero começar do zero">Não, quero começar do zero</option>
                    <option value="Tenho domínio, mas não tenho website">Tenho domínio, mas não tenho website</option>
                    <option value="Não tenho a certeza">Não tenho a certeza</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Descreva o projeto
                  <textarea
                    className="min-h-36 resize-y rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base leading-7 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                    placeholder="Exemplo: preciso de uma página para apresentar os meus serviços, receber contactos e preparar o site para aparecer melhor no Google."
                  />
                </label>
              </div>

              {successMessage ? (
                <div
                  className="mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-100"
                  role="status"
                  aria-live="polite"
                >
                  {successMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div
                  className="mt-5 rounded-2xl border border-red-300/30 bg-red-300/10 p-4 text-sm leading-6 text-red-100"
                  role="alert"
                >
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-cyan-300 px-7 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSending}
              >
                {isSending ? 'A enviar...' : 'Receber proposta gratuita'}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-slate-400 sm:px-6 md:px-10">
        <p>© {new Date().getFullYear()} MA-Code. Websites, lojas online, marcações, automação e soluções digitais.</p>
      </footer>
    </div>
  )
}
