import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FeatureList, SectionHeader } from '../components/DesignSystem'
import FeaturedProjects from '../components/FeaturedProjects'

const proofPoints = [
  {
    value: '19€/mês',
    label: 'website simples',
    description:
      'Uma entrada acessível para negócios que precisam de presença online profissional, domínio e alojamento incluídos.'
  },
  {
    value: 'Mobile-first',
    label: 'pensado para telemóvel',
    description:
      'Estrutura preparada para clientes que chegam pelo smartphone e precisam de perceber rapidamente o que fazer.'
  },
  {
    value: 'Evolutivo',
    label: 'sem refazer tudo',
    description:
      'O projeto pode começar simples e crescer para loja online, marcações, área administrativa, automação, IA ou app.'
  }
]

const serviceCards = [
  {
    title: 'Criação de websites profissionais',
    label: 'Website',
    href: '/criacao-websites',
    cta: 'Ver detalhes',
    description:
      'Websites rápidos, modernos e adaptados a telemóvel para apresentar o negócio, gerar confiança e receber mais contactos.',
    bullets: ['Imagem profissional', 'SEO base', 'Contacto rápido']
  },
  {
    title: 'Lojas online / e-commerce',
    label: 'E-commerce',
    href: '/lojas-online',
    cta: 'Ver detalhes',
    description:
      'Lojas online com catálogo, carrinho, checkout e estrutura preparada para apresentar produtos, receber encomendas e vender mais.',
    bullets: ['Produtos organizados', 'Carrinho de compras', 'Checkout preparado']
  },
  {
    title: 'Sistemas de marcação online',
    label: 'Agenda',
    href: '/sistemas-marcacao',
    cta: 'Ver detalhes',
    description:
      'Sistemas de marcação para salões, clínicas, serviços locais e negócios que precisam de gerir horários, pedidos e disponibilidade.',
    bullets: ['Reservas online', 'Gestão de horários', 'Menos chamadas perdidas']
  },
  {
    title: 'Automação e IA para negócios',
    label: 'Automação',
    href: '/automacao-ia',
    cta: 'Ver detalhes',
    description:
      'Automação de tarefas, integração de IA, formulários inteligentes e fluxos digitais para reduzir trabalho repetitivo e acelerar respostas.',
    bullets: ['Respostas automáticas', 'Formulários inteligentes', 'Fluxos mais rápidos']
  },
  {
    title: 'Áreas administrativas e dashboards',
    label: 'Admin',
    href: '#orcamento',
    cta: 'Pedir proposta',
    description:
      'Aplicações web, painéis privados, dashboards e ferramentas personalizadas para gerir pedidos, contas, registos e processos internos.',
    bullets: ['Painéis privados', 'Contas e registos', 'Gestão diária']
  },
  {
    title: 'Integrações API e sistemas ligados',
    label: 'Integrações',
    href: '#orcamento',
    cta: 'Pedir proposta',
    description:
      'Ligação entre websites, bases de dados, CRM, folhas de cálculo, APIs e ferramentas externas para projetos que precisam de ir além do site.',
    bullets: ['APIs', 'Bases de dados', 'Ferramentas conectadas']
  }
]

const processSteps = [
  {
    title: '1. Percebemos o objetivo',
    description:
      'Identificamos o tipo de negócio, o cliente ideal e o que o projeto precisa de resolver.'
  },
  {
    title: '2. Definimos a estrutura',
    description:
      'Organizamos páginas, conteúdos, funcionalidades e percurso para o utilizador chegar ao contacto.'
  },
  {
    title: '3. Criamos e afinamos',
    description:
      'Desenvolvemos a solução com foco em clareza, performance, mobile e apresentação profissional.'
  },
  {
    title: '4. Publicamos online',
    description:
      'Colocamos tudo a funcionar com domínio, alojamento e uma base preparada para evoluir.'
  }
]

const projectTypes = [
  'Website simples',
  'Website profissional',
  'Redesign de website existente',
  'Loja online',
  'Loja online / Sistema de marcações',
  'Sistema de marcações',
  'Sistema à medida',
  'Aplicação web',
  'Automação / IA',
  'Integração avançada',
  'Ainda não sei'
]

const projectGoals = [
  'Receber mais contactos',
  'Vender online',
  'Receber marcações',
  'Organizar processos internos',
  'Automatizar tarefas',
  'Melhorar imagem e confiança',
  'Ainda não sei'
]

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

type AnalyticsParameters = Record<string, string | number | boolean | undefined>

type AnalyticsWindow = Window & {
  gtag?: (command: 'event', eventName: string, parameters?: AnalyticsParameters) => void
  dataLayer?: unknown[]
}

type AttributionData = {
  traffic_source?: string
  traffic_medium?: string
  traffic_campaign?: string
  traffic_term?: string
  traffic_content?: string
  traffic_referrer?: string
  landing_page?: string
}

const attributionStorageKey = 'ma_code_attribution'

function getReferrerSource(referrer: string) {
  if (!referrer) {
    return 'direct'
  }

  try {
    return new URL(referrer).hostname.replace(/^www\./, '')
  } catch {
    return 'referral'
  }
}

function getTrafficAttribution(): AttributionData {
  if (typeof window === 'undefined') {
    return {}
  }

  const searchParams = new URLSearchParams(window.location.search)
  const hasCampaignParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content'
  ].some((param) => searchParams.has(param))

  try {
    const storedAttribution = window.sessionStorage.getItem(attributionStorageKey)

    if (storedAttribution && !hasCampaignParams) {
      return JSON.parse(storedAttribution) as AttributionData
    }
  } catch {
    return {
      traffic_source: searchParams.get('utm_source') || getReferrerSource(document.referrer),
      traffic_medium: searchParams.get('utm_medium') || (document.referrer ? 'referral' : 'direct'),
      traffic_campaign: searchParams.get('utm_campaign') || undefined,
      traffic_term: searchParams.get('utm_term') || undefined,
      traffic_content: searchParams.get('utm_content') || undefined,
      traffic_referrer: document.referrer || undefined,
      landing_page: window.location.href
    }
  }

  const attribution = {
    traffic_source: searchParams.get('utm_source') || getReferrerSource(document.referrer),
    traffic_medium: searchParams.get('utm_medium') || (document.referrer ? 'referral' : 'direct'),
    traffic_campaign: searchParams.get('utm_campaign') || undefined,
    traffic_term: searchParams.get('utm_term') || undefined,
    traffic_content: searchParams.get('utm_content') || undefined,
    traffic_referrer: document.referrer || undefined,
    landing_page: window.location.href
  }

  try {
    window.sessionStorage.setItem(attributionStorageKey, JSON.stringify(attribution))
  } catch {
    return attribution
  }

  return attribution
}

function trackEvent(eventName: string, parameters: AnalyticsParameters = {}) {
  if (typeof window === 'undefined') {
    return
  }

  const analyticsWindow = window as AnalyticsWindow
  const eventParameters = {
    event_category: 'ma_code_homepage',
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
    ...getTrafficAttribution(),
    ...parameters
  }

  if (typeof analyticsWindow.gtag === 'function') {
    analyticsWindow.gtag('event', eventName, eventParameters)
    return
  }

  analyticsWindow.dataLayer = Array.isArray(analyticsWindow.dataLayer) ? analyticsWindow.dataLayer : []

  analyticsWindow.dataLayer.push({
    event: eventName,
    ...eventParameters
  })
}

function DigitalStackVisual() {
  const stackItems = [
    { label: 'Website', detail: 'Base clara', marker: '01' },
    { label: 'Contactos', detail: 'Pedidos reais', marker: '02' },
    { label: 'Automação', detail: 'Menos manual', marker: '03' },
    { label: 'Sistema', detail: 'Escala digital', marker: '04' }
  ]

  return (
    <div>
      <div className="relative z-10 flex items-center justify-between gap-4">
        <span className="block text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
          Mapa visual
        </span>

        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">
          Modular
        </span>
      </div>

      <div className="relative z-10 mt-5 aspect-[16/10] overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(103,232,249,0.18),transparent_28%),radial-gradient(circle_at_78%_70%,rgba(168,85,247,0.16),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(103,232,249,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.045)_1px,transparent_1px)] bg-[size:28px_28px]" />

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 520 320"
          role="img"
          aria-labelledby="digital-stack-title digital-stack-description"
        >
          <title id="digital-stack-title">Evolução digital MA-Code</title>
          <desc id="digital-stack-description">
            Representação visual da evolução de um website para contactos, automação e sistema digital.
          </desc>

          <defs>
            <linearGradient
              id="digitalStackLine"
              x1="52"
              x2="468"
              y1="182"
              y2="92"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#67e8f9" stopOpacity="0.25" />
              <stop offset="0.5" stopColor="#22d3ee" stopOpacity="0.9" />
              <stop offset="1" stopColor="#a78bfa" stopOpacity="0.75" />
            </linearGradient>

            <linearGradient id="digitalStackCard" x1="0" x2="1" y1="0" y2="1">
              <stop stopColor="#0f172a" stopOpacity="0.94" />
              <stop offset="1" stopColor="#083344" stopOpacity="0.78" />
            </linearGradient>

            <filter id="digitalStackGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="0 0 0 0 0.4 0 0 0 0 0.91 0 0 0 0 0.98 0 0 0 0.55 0"
              />
              <feBlend in="SourceGraphic" />
            </filter>
          </defs>

          <path
            d="M62 226 C146 150 202 215 282 142 C344 86 394 108 462 66"
            fill="none"
            stroke="url(#digitalStackLine)"
            strokeLinecap="round"
            strokeWidth="4"
          />

          <path
            d="M70 250 C150 196 212 246 286 188 C350 138 394 160 456 122"
            fill="none"
            stroke="#67e8f9"
            strokeDasharray="8 14"
            strokeLinecap="round"
            strokeOpacity="0.22"
            strokeWidth="2"
          />

          <g filter="url(#digitalStackGlow)">
            <circle cx="88" cy="204" r="8" fill="#67e8f9" />
            <circle cx="222" cy="168" r="8" fill="#22d3ee" />
            <circle cx="336" cy="112" r="8" fill="#38bdf8" />
            <circle cx="448" cy="74" r="8" fill="#a78bfa" />
          </g>

          <g opacity="0.9">
            <rect
              x="54"
              y="66"
              width="126"
              height="82"
              rx="18"
              fill="url(#digitalStackCard)"
              stroke="#67e8f9"
              strokeOpacity="0.18"
            />
            <rect
              x="202"
              y="34"
              width="126"
              height="82"
              rx="18"
              fill="url(#digitalStackCard)"
              stroke="#67e8f9"
              strokeOpacity="0.18"
            />
            <rect
              x="340"
              y="128"
              width="126"
              height="82"
              rx="18"
              fill="url(#digitalStackCard)"
              stroke="#a78bfa"
              strokeOpacity="0.22"
            />
          </g>

          <g opacity="0.52" stroke="#cffafe" strokeLinecap="round" strokeWidth="3">
            <path d="M78 96 H132" />
            <path d="M78 116 H152" />
            <path d="M226 64 H284" />
            <path d="M226 84 H306" />
            <path d="M364 158 H426" />
            <path d="M364 178 H442" />
          </g>
        </svg>

        <div className="absolute inset-x-4 bottom-4 grid grid-cols-4 gap-2">
          {stackItems.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-slate-950/[0.72] p-3 backdrop-blur"
            >
              <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                {item.marker}
              </span>

              <strong className="mt-1 block text-xs font-semibold text-white">
                {item.label}
              </strong>

              <span className="mt-1 block text-[0.68rem] leading-4 text-slate-400">
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MACode() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    projectType: '',
    projectGoal: '',
    hasWebsite: '',
    message: '',
    botcheck: ''
  })

  const [isSending, setIsSending] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [mounted, setMounted] = useState(false)
  const formStartedRef = useRef(false)

  useEffect(() => {
    setMounted(true)

    document.title = 'Websites que Geram Contactos e Crescem com o Negócio | MA-Code'

    updateMeta(
      'description',
      'Criamos websites profissionais desde 19€/mês para negócios que querem começar simples, gerar contactos, vender online e crescer para marcações, automação, IA ou sistemas digitais à medida.'
    )

    updateMeta(
      'keywords',
      'criação de websites, websites profissionais, websites para negócios, lojas online, desenvolvimento web Portugal, sistema de marcações, aplicações web, automação, integração de IA, CRM, bases de dados, MA-Code'
    )

    updateMeta(
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )

    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:locale', 'pt_PT')
    updatePropertyMeta('og:site_name', 'MA-Code')
    updatePropertyMeta('og:url', 'https://ma-code.pt/')

    updatePropertyMeta(
      'og:title',
      'Websites que Geram Contactos e Crescem com o Negócio | MA-Code'
    )

    updatePropertyMeta(
      'og:description',
      'Comece com um website profissional e evolua sem refazer tudo: contactos, vendas, marcações, automação, IA e sistemas digitais à medida.'
    )

    updatePropertyMeta('og:image', 'https://ma-code.pt/ma-code.png')

    updatePropertyMeta(
      'og:image:alt',
      'MA-Code - criação de websites profissionais, lojas online, automação e IA'
    )

    updateMeta('twitter:card', 'summary_large_image')
    updateMeta('twitter:url', 'https://ma-code.pt/')

    updateMeta(
      'twitter:title',
      'Websites que Geram Contactos e Crescem com o Negócio | MA-Code'
    )

    updateMeta(
      'twitter:description',
      'Websites profissionais desde 19€/mês, preparados para gerar contactos e evoluir para loja online, marcações, automação, IA e sistemas digitais à medida.'
    )

    updateMeta('twitter:image', 'https://ma-code.pt/ma-code.png')

    updateMeta(
      'twitter:image:alt',
      'MA-Code - criação de websites profissionais, lojas online, automação e IA'
    )

    updateCanonical('https://ma-code.pt/')

    trackEvent('homepage_view', {
      page_name: 'homepage',
      page_type: 'landing_page'
    })
  }, [])

  const trackFormStart = () => {
    if (formStartedRef.current) {
      return
    }

    formStartedRef.current = true

    trackEvent('proposal_form_started', {
      form_name: 'pedido_proposta',
      trigger: 'first_form_interaction',
      project_type: form.projectType || 'not_selected',
      project_goal: form.projectGoal || 'not_selected',
      has_website: form.hasWebsite || 'not_selected'
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (isSending) {
      return
    }

    setIsSending(true)
    setSuccessMessage('')
    setErrorMessage('')

    if (form.botcheck) {
      trackEvent('proposal_form_blocked', {
        form_name: 'pedido_proposta',
        reason: 'botcheck'
      })

      setIsSending(false)
      return
    }

    trackEvent('proposal_form_submit_attempt', {
      form_name: 'pedido_proposta',
      project_type: form.projectType || 'not_selected',
      project_goal: form.projectGoal || 'not_selected',
      has_website: form.hasWebsite || 'not_selected'
    })

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
          projectGoal: form.projectGoal,
          hasWebsite: form.hasWebsite,
          pageUrl: 'https://ma-code.pt/',
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

      trackEvent('proposal_form_submit_success', {
        form_name: 'pedido_proposta',
        project_type: form.projectType || 'not_selected',
        project_goal: form.projectGoal || 'not_selected',
        has_website: form.hasWebsite || 'not_selected'
      })

      trackEvent('generate_lead', {
        form_name: 'pedido_proposta',
        lead_type: form.projectType || 'not_selected',
        project_goal: form.projectGoal || 'not_selected'
      })

      setSuccessMessage('Pedido enviado com sucesso. Entraremos em contacto em breve.')
      setForm({
        name: '',
        email: '',
        phone: '',
        projectType: '',
        projectGoal: '',
        hasWebsite: '',
        message: '',
        botcheck: ''
      })
    } catch {
      trackEvent('proposal_form_submit_error', {
        form_name: 'pedido_proposta',
        project_type: form.projectType || 'not_selected',
        project_goal: form.projectGoal || 'not_selected',
        has_website: form.hasWebsite || 'not_selected'
      })

      setErrorMessage('Não foi possível enviar o pedido. Tente novamente.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main>
      <section className="relative overflow-hidden px-5 pb-12 pt-6 sm:px-6 md:px-10 md:pb-16 md:pt-8">
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

            <a
              href="#orcamento"
              className="btn-ghost text-sm sm:text-base"
              onClick={() =>
                trackEvent('cta_click', {
                  cta_text: 'Pedir proposta',
                  cta_location: 'header',
                  destination: '#orcamento'
                })
              }
            >
              Pedir proposta
            </a>
          </header>

          <div className="hero-layout">
            <div className={`hero-copy ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>Começar simples. Crescer sem refazer.</span>
              </div>

              <h1 className="hero-title">
                <span className="sm:hidden">
                  Website profissional hoje. Base digital para crescer amanhã.
                </span>

                <span className="hidden sm:inline">
                  Websites profissionais que geram contactos hoje e crescem com o negócio amanhã.
                </span>
              </h1>

              <div className="hero-price-badge">
                Websites simples desde 19€/mês · domínio + alojamento incluídos
              </div>

              <p className="hero-subtitle">
                <span className="sm:hidden">
                  Comece com presença online profissional desde 19€/mês e evolua para loja,
                  marcações, automação ou IA sem refazer tudo.
                </span>

                <span className="hidden sm:inline">
                  A MA-Code cria websites e sistemas digitais para negócios que querem começar com
                  uma presença online clara, gerar confiança, facilitar o contacto e deixar caminho
                  aberto para loja online, marcações, automação, IA e ferramentas internas à medida.
                </span>
              </p>

              <div className="hero-actions">
                <a
                  href="#orcamento"
                  className="btn-primary hightech-button"
                  onClick={() =>
                    trackEvent('cta_click', {
                      cta_text: 'Receber proposta gratuita',
                      cta_location: 'hero_primary',
                      destination: '#orcamento'
                    })
                  }
                >
                  <span className="btn-shine" />
                  <span className="relative z-10">Receber proposta gratuita</span>
                </a>

                <a
                  href="/projetos"
                  className="btn-secondary hightech-button-secondary"
                  onClick={() =>
                    trackEvent('cta_click', {
                      cta_text: 'Ver projetos reais',
                      cta_location: 'hero_secondary',
                      destination: '/projetos'
                    })
                  }
                >
                  Ver projetos reais
                </a>
              </div>

              <ul className="hero-mini-points" aria-label="Pontos fortes da MA-Code">
                <li>Domínio + alojamento</li>
                <li>Mobile-first</li>
                <li>Foco em contactos</li>
              </ul>
            </div>

            <div
              className={`relative hidden lg:block ${
                mounted ? 'animate-fade-in-scale' : 'opacity-0'
              }`}
            >
              <div className="hero-panel">
                <div className="hero-panel__glow" />

                <div className="hero-panel__header">
                  <div className="hero-panel__dots">
                    <span />
                    <span />
                    <span />
                  </div>

                  <span className="hero-panel__label">Promessa MA-Code</span>
                </div>

                <div className="hero-panel__content">
                  <div className="hud-card hud-card--wide">
                    <span className="hud-card__label">Entrada recomendada</span>
                    <strong>Website que explica, gera confiança e leva ao contacto</strong>
                  </div>

                  <DigitalStackVisual />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="hud-card">
                      <span className="hud-card__label">Inclui</span>
                      <strong>Domínio + alojamento</strong>
                    </div>

                    <div className="hud-card">
                      <span className="hud-card__label">Estratégia</span>
                      <strong>Crescer por fases, sem refazer tudo</strong>
                    </div>
                  </div>

                  <a
                    href="#servicos"
                    className="btn-secondary hightech-button-secondary justify-center"
                    onClick={() =>
                      trackEvent('cta_click', {
                        cta_text: 'Escolher serviço',
                        cta_location: 'hero_panel',
                        destination: '#servicos'
                      })
                    }
                  >
                    Escolher serviço
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 hidden gap-4 md:grid md:grid-cols-3">
            {proofPoints.map((point, index) => (
              <article
                key={point.label}
                className={`rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-5 shadow-xl shadow-cyan-950/10 backdrop-blur ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <strong className="block text-xl font-semibold tracking-tight text-white">
                  {point.value}
                </strong>

                <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                  {point.label}
                </span>

                <p className="mt-3 text-sm leading-6 text-slate-300">{point.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="servicos" className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Serviços"
            title="Escolha o tipo de projeto"
            description="A homepage fica direta. Os detalhes vivem nas páginas próprias de cada serviço, com informação mais completa para quem quiser aprofundar."
          />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {serviceCards.map((card, index) => (
              <a
                key={card.title}
                href={card.href}
                onClick={() =>
                  trackEvent('service_card_click', {
                    service_name: card.title,
                    service_label: card.label,
                    destination: card.href,
                    section: 'services'
                  })
                }
                className={`service-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="service-card__line" />

                <div className="mb-4 flex items-center justify-between gap-4">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                    {card.label}
                  </span>

                  <div className="service-card__index">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>

                <h3 className="service-card__title">{card.title}</h3>
                <p className="service-card__description">{card.description}</p>

                <FeatureList items={card.bullets} className="mt-5" />

                <span className="mt-6 inline-flex text-sm font-semibold text-cyan-200">
                  {card.cta} →
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <FeaturedProjects mounted={mounted} />

      <section className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Processo"
            title="Um processo simples, sem complicar o cliente"
            description="Da ideia à publicação, o objetivo é transformar o projeto numa solução clara, funcional e pronta a ser usada."
          />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {processSteps.map((step, index) => (
              <article
                key={step.title}
                className={`process-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="orcamento" className="px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="contact-side-panel">
              <span className="section-label">Pedido</span>

              <h2 className="contact-side-panel__title">Fale-nos do projeto</h2>

              <p className="contact-side-panel__text">
                Diga-nos em que fase está: começar com um website, vender ou receber marcações,
                ou criar um sistema digital mais completo. Respondemos com uma proposta ajustada
                ao objetivo comercial e ao nível de funcionalidade necessário.
              </p>

              <div className="contact-metrics">
                <div className="metric-card">
                  <span className="metric-card__label">Website simples</span>
                  <strong>Desde 19€/mês</strong>
                </div>

                <div className="metric-card">
                  <span className="metric-card__label">Inclui</span>
                  <strong>Domínio + alojamento</strong>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm leading-7 text-slate-300">
                <p>Para uma resposta mais certeira, indique:</p>

                <ul className="space-y-2 text-slate-200/90">
                  <li>• Que tipo de projeto pretende</li>
                  <li>• Se já tem site ou quer começar do zero</li>
                  <li>• Se precisa de loja, marcações, área administrativa, automação ou IA</li>
                  <li>
                    • Se o objetivo principal é receber contactos, vender, aceitar reservas ou
                    organizar processos
                  </li>
                </ul>
              </div>
            </div>

            <div className="form-shell">
              <form
                onSubmit={handleSubmit}
                onFocus={trackFormStart}
                onChange={trackFormStart}
                className="space-y-5"
                aria-describedby={successMessage || errorMessage ? 'form-status' : undefined}
              >
                <input
                  type="text"
                  name="botcheck"
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.botcheck}
                  onChange={(e) => setForm({ ...form, botcheck: e.target.value })}
                />

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="input-label">
                      Nome
                    </label>

                    <input
                      id="name"
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
                    <label htmlFor="email" className="input-label">
                      Email
                    </label>

                    <input
                      id="email"
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
                    <label htmlFor="phone" className="input-label">
                      Telefone / WhatsApp <span className="text-slate-500">(opcional)</span>
                    </label>

                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      className="input-field"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      autoComplete="tel"
                    />
                  </div>

                  <div>
                    <label htmlFor="projectType" className="input-label">
                      Tipo de projeto
                    </label>

                    <select
                      id="projectType"
                      name="Tipo de projeto"
                      className="input-field"
                      value={form.projectType}
                      onChange={(e) => {
                        trackEvent('form_field_select', {
                          form_name: 'pedido_proposta',
                          field_name: 'projectType',
                          selected_value: e.target.value
                        })

                        setForm({ ...form, projectType: e.target.value })
                      }}
                      required
                    >
                      <option value="" disabled>
                        Selecione uma opção
                      </option>

                      {projectTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="projectGoal" className="input-label">
                    Objetivo principal do projeto
                  </label>

                  <select
                    id="projectGoal"
                    name="Objetivo principal do projeto"
                    className="input-field"
                    value={form.projectGoal}
                    onChange={(e) => {
                      trackEvent('form_field_select', {
                        form_name: 'pedido_proposta',
                        field_name: 'projectGoal',
                        selected_value: e.target.value
                      })

                      setForm({ ...form, projectGoal: e.target.value })
                    }}
                    required
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>

                    {projectGoals.map((goal) => (
                      <option key={goal} value={goal}>
                        {goal}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="hasWebsite" className="input-label">
                    Já tem site?
                  </label>

                  <select
                    id="hasWebsite"
                    name="Já tem site?"
                    className="input-field"
                    value={form.hasWebsite}
                    onChange={(e) => {
                      trackEvent('form_field_select', {
                        form_name: 'pedido_proposta',
                        field_name: 'hasWebsite',
                        selected_value: e.target.value || 'not_selected'
                      })

                      setForm({ ...form, hasWebsite: e.target.value })
                    }}
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
                  <label htmlFor="message" className="input-label">
                    Descreva o projeto
                  </label>

                  <textarea
                    id="message"
                    name="message"
                    rows={6}
                    className="input-field input-textarea"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                    placeholder="Exemplo: preciso de começar com um website para apresentar o meu negócio e receber contactos por WhatsApp. Mais tarde, talvez queira evoluir para marcações online, loja ou área administrativa."
                  />
                </div>

                {successMessage ? (
                  <div
                    id="form-status"
                    className="status-message status-message--success"
                    role="status"
                    aria-live="polite"
                  >
                    {successMessage}
                  </div>
                ) : null}

                {errorMessage ? (
                  <div
                    id="form-status"
                    className="status-message status-message--error"
                    role="alert"
                    aria-live="assertive"
                  >
                    {errorMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="btn-primary hightech-button w-full disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSending}
                  aria-busy={isSending}
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
    </main>
  )
}
