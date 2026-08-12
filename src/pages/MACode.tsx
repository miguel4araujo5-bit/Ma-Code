import { useEffect, useState } from 'react'
import { FeatureList, SectionHeader } from '../components/DesignSystem'
import FeaturedProjects from '../components/FeaturedProjects'

const marqueeItems = ['Websites desde 19€/mês','Domínio + Alojamento','Sites Mobile-First','Lojas Online','Marcações Online','Áreas Administrativas','Automação e IA','Integrações API','Web3 / Blockchain','Performance e SEO','Integração Blockchain','Projetos Crypto','Apps PWA','Inteligência Artificial','Projetos à Medida']
const marqueeLoopItems = [...marqueeItems, ...marqueeItems, ...marqueeItems]
const pathCards = [{title: 'Quero um website profissional',eyebrow: 'Presença online',href: '/contacto?tipo=website',learnLinks: [{label: 'Ver criação de websites',href: '/criacao-websites'}],projectType: 'Website profissional',projectGoal: 'Receber mais contactos',cta: 'Pedir proposta para website',description:'Para apresentar o negócio, explicar serviços, transmitir confiança e receber contactos de forma simples e profissional.',points: ['Página inicial clara', 'Serviços bem explicados', 'Contactos e WhatsApp']},{title: 'Quero vender ou receber marcações',eyebrow: 'Vendas e reservas',href: '/contacto?tipo=vendas-marcacoes',learnLinks: [{label: 'Ver lojas online',href: '/lojas-online'},{label: 'Ver marcações',href: '/sistemas-marcacao'}],projectType: 'Loja online / Sistema de marcações',projectGoal: 'Vender online',cta: 'Pedir proposta para vendas ou marcações',description:'Para criar uma loja online, receber encomendas, aceitar reservas, gerir pedidos ou facilitar o contacto com clientes.',points: ['Loja online ou marcações', 'Pedido rápido', 'Experiência preparada para telemóvel']},{title: 'Quero automatizar ou criar um sistema',eyebrow: 'Sistema à medida',href: '/contacto?tipo=sistema-medida',learnLinks: [{label: 'Ver automação e IA',href: '/automacao-ia'}],projectType: 'Sistema à medida',projectGoal: 'Automatizar tarefas',cta: 'Pedir proposta para sistema à medida',description:'Para criar uma área administrativa, dashboard, base de dados, automação, integração com IA ou aplicação web personalizada.',points: ['Painel administrativo', 'Automação de tarefas', 'Integrações e dados']}]

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
  const hasCampaignParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].some((param) =>
    searchParams.has(param)
  )

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

  analyticsWindow.dataLayer = Array.isArray(analyticsWindow.dataLayer)
    ? analyticsWindow.dataLayer
    : []

  analyticsWindow.dataLayer.push({
    event: eventName,
    ...eventParameters
  })
}

function ServiceMarquee() {
  return (
    <div className="ma-service-marquee" aria-label="Serviços e soluções da MA-Code">
      <style>{`
.ma-service-marquee {position: relative !important;display: block !important;width: 100% !important;max-width: 100% !important;min-height: 3.8rem !important;margin-top: 1.75rem !important;overflow: hidden !important;border-radius: 1.45rem !important;border: 1px solid rgba(103, 232, 249, 0.16) !important;padding: 0.82rem 0 !important;background:linear-gradient(180deg, rgba(7, 14, 23, 0.72), rgba(8, 15, 25, 0.54)) !important;box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.035),0 0 24px rgba(34, 211, 238, 0.045) !important;backdrop-filter: blur(14px);-webkit-backdrop-filter: blur(14px);opacity: 1 !important;visibility: visible !important;z-index: 30 !important;isolation: isolate !important;transform: translate3d(0, 0, 0) !important;-webkit-transform: translate3d(0, 0, 0) !important;}

.ma-service-marquee::before,
.ma-service-marquee::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4rem;
  z-index: 2;
  pointer-events: none;
}

.ma-service-marquee::before {
  left: 0;
  background: linear-gradient(90deg, rgba(6, 16, 25, 1), transparent);
}

.ma-service-marquee::after {
  right: 0;
  background: linear-gradient(270deg, rgba(6, 16, 25, 1), transparent);
}

.ma-service-marquee__track {
  position: relative !important;
  z-index: 1 !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.75rem !important;
  width: max-content !important;
  min-width: max-content !important;
  white-space: nowrap !important;
  opacity: 1 !important;
  visibility: visible !important;
  transform: translate3d(0, 0, 0);
  -webkit-transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  will-change: transform;
  animation: ma-service-marquee-scroll 28s linear infinite;
  -webkit-animation: ma-service-marquee-scroll 28s linear infinite;
}

.ma-service-marquee__item {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 0 auto !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(103, 232, 249, 0.16) !important;
  padding: 0.68rem 1rem !important;
  background: rgba(15, 23, 42, 0.72) !important;
  color: #cffafe !important;
  font-size: 0.72rem !important;
  font-weight: 700 !important;
  line-height: 1 !important;
  letter-spacing: 0.13em !important;
  text-transform: uppercase !important;
  white-space: nowrap !important;
  opacity: 1 !important;
  visibility: visible !important;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.018),
    0 0 12px rgba(34, 211, 238, 0.035) !important;
}

@keyframes ma-service-marquee-scroll {
  0% {
    transform: translate3d(0, 0, 0);
    -webkit-transform: translate3d(0, 0, 0);
  }

  100% {
    transform: translate3d(-33.333333%, 0, 0);
    -webkit-transform: translate3d(-33.333333%, 0, 0);
  }
}

@-webkit-keyframes ma-service-marquee-scroll {
  0% {
    transform: translate3d(0, 0, 0);
    -webkit-transform: translate3d(0, 0, 0);
  }

  100% {
    transform: translate3d(-33.333333%, 0, 0);
    -webkit-transform: translate3d(-33.333333%, 0, 0);
  }
}

@media (max-width: 768px) {
  .ma-service-marquee {
    min-height: 3.45rem !important;
    margin-top: 1.35rem !important;
    border-radius: 1.2rem !important;
    padding: 0.72rem 0 !important;
  }

  .ma-service-marquee::before,
  .ma-service-marquee::after {
    width: 1.35rem;
  }

  .ma-service-marquee__track {
    gap: 0.62rem !important;
    animation-duration: 20s;
    -webkit-animation-duration: 20s;
  }

  .ma-service-marquee__item {
    padding: 0.62rem 0.78rem !important;
    font-size: 0.58rem !important;
    letter-spacing: 0.08em !important;
  }
}

@media (max-width: 480px) {
  .ma-service-marquee {
    min-height: 3.25rem !important;
    margin-top: 1.15rem !important;
    padding: 0.68rem 0 !important;
  }

  .ma-service-marquee::before,
  .ma-service-marquee::after {
    width: 0.85rem;
  }

  .ma-service-marquee__track {
    gap: 0.55rem !important;
    animation-duration: 17s;
    -webkit-animation-duration: 17s;
  }

  .ma-service-marquee__item {
    padding: 0.58rem 0.72rem !important;
    font-size: 0.54rem !important;
    letter-spacing: 0.07em !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ma-service-marquee__track {
    animation-duration: 55s !important;
    -webkit-animation-duration: 55s !important;
  }
}
      `}</style>

      <span className="sr-only">{marqueeItems.join(', ')}</span>

      <div className="ma-service-marquee__track" aria-hidden="true">
        {marqueeLoopItems.map((item, index) => (
          <span key={`${item}-${index}`} className="ma-service-marquee__item">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function DigitalStackVisual() {
  const stackItems = [
    { label: 'Website', detail: 'Presença clara', marker: '01' },
    { label: 'Contactos', detail: 'Pedidos reais', marker: '02' },
    { label: 'Marcações / vendas', detail: 'Menos atrito', marker: '03' },
    { label: 'Automação', detail: 'Menos trabalho manual', marker: '04' }
  ]

  return (
    <div>
      <div className="relative z-10 flex items-center justify-between gap-4">
        <span className="block text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
          Crescimento digital
        </span>

        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">
          Por etapas
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
          <title id="digital-stack-title">Crescimento digital por etapas MA-Code</title>
          <desc id="digital-stack-description">
            Representação visual da evolução de um website simples para contactos, marcações, vendas e automação.
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    document.title = 'Websites Profissionais desde 19€/mês | MA-Code'

    updateMeta(
      'description',
      'Websites profissionais desde 19€/mês para negócios que querem começar simples, gerar contactos e evoluir para loja online, marcações, automação, IA ou sistemas digitais.'
    )

    updateMeta(
      'keywords',
      'criação de websites, websites profissionais, websites para negócios, lojas online, desenvolvimento web Portugal, sistema de marcações, aplicações web, automação, integração de IA, CRM, bases de dados, manutenção de sites, MA-Code'
    )

    updateMeta(
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1, indexifembedded'
    )

    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:locale', 'pt_PT')
    updatePropertyMeta('og:site_name', 'MA-Code')
    updatePropertyMeta('og:url', 'https://ma-code.pt/')

    updatePropertyMeta(
      'og:title',
      'Websites Profissionais desde 19€/mês | MA-Code'
    )

    updatePropertyMeta(
      'og:description',
      'Comece com um website profissional desde 19€/mês e evolua para loja online, marcações, automação, IA ou sistemas digitais à medida.'
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
      'Websites Profissionais desde 19€/mês | MA-Code'
    )

    updateMeta(
      'twitter:description',
      'Websites profissionais desde 19€/mês, preparados para gerar contactos e evoluir para loja online, marcações, automação, IA e sistemas digitais.'
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
              href="/contacto"
              className="btn-ghost hidden text-sm sm:inline-flex sm:text-base"
              onClick={() =>
                trackEvent('cta_click', {
                  cta_text: 'Pedir proposta gratuita',
                  cta_location: 'header',
                  destination: '/contacto'
                })
              }
            >
              Pedir proposta gratuita
            </a>
          </header>

          <div className="hero-layout">
            <div className={`hero-copy ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>Website hoje. Sistema amanhã.</span>
              </div>

              <h1 className="hero-title">
                Websites profissionais desde 19€/mês para começar simples e crescer depois.
              </h1>

              <div className="hero-price-badge">
                Domínio + alojamento incluídos
              </div>

              <p className="hero-subtitle">
                Criamos websites e sistemas digitais para gerar contactos, vender, receber
                marcações ou automatizar processos — com uma base simples, clara e preparada
                para evoluir.
              </p>

              <div className="hero-actions flex-wrap">
                <a
                  href="/contacto"
                  className="btn-primary hightech-button"
                  onClick={() =>
                    trackEvent('cta_click', {
                      cta_text: 'Pedir proposta gratuita',
                      cta_location: 'hero_primary',
                      destination: '/contacto'
                    })
                  }
                >
                  <span className="btn-shine" />
                  <span className="relative z-10">Pedir proposta gratuita</span>
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

                <a
                  href="/produtos"
                  className="btn-secondary hightech-button-secondary"
                  onClick={() =>
                    trackEvent('cta_click', {
                      cta_text: 'Ver produtos',
                      cta_location: 'hero_products',
                      destination: '/produtos'
                    })
                  }
                >
                  Ver produtos
                </a>
              </div>

              <p className="mt-4 max-w-xl text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70 sm:text-sm">
                Proposta gratuita · Sem compromisso
              </p>

              <ul className="hero-mini-points" aria-label="Pontos fortes da MA-Code">
                <li>Mobile-first</li>
                <li>Performance e SEO</li>
                <li>Pode evoluir por fases</li>
              </ul>

              <ServiceMarquee />
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

                  <span className="hero-panel__label">MA-Code</span>
                </div>

                <div className="hero-panel__content">
                  <div className="hud-card hud-card--wide">
                    <span className="hud-card__label">Comece simples</span>
                    <strong>
                      Website claro, profissional e preparado para gerar contactos
                    </strong>
                  </div>

                  <DigitalStackVisual />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="hud-card">
                      <span className="hud-card__label">Inclui</span>
                      <strong>Domínio + alojamento</strong>
                    </div>

                    <div className="hud-card">
                      <span className="hud-card__label">Pode evoluir para</span>
                      <strong>
                        Loja, marcações, automação ou sistema à medida
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Escolha o caminho"
            title="O que precisa neste momento?"
            description="Escolha o ponto de partida. Pode ver os detalhes nas páginas próprias ou pedir proposta gratuita diretamente."
          />

          <div className="grid gap-6 md:grid-cols-3">
            {pathCards.map((card, index) => (
              <article
                key={card.title}
                className={`service-card group relative flex h-full overflow-hidden rounded-[2rem] border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/20 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-slate-900/80 hover:shadow-cyan-950/35 md:p-6 ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent opacity-70" />
                <span className="pointer-events-none absolute -right-14 -top-16 size-40 rounded-full bg-cyan-300/10 blur-3xl transition duration-500 group-hover:bg-cyan-300/20" />
                <span className="pointer-events-none absolute -bottom-20 left-8 size-32 rounded-full bg-violet-400/10 blur-3xl transition duration-500 group-hover:bg-violet-400/15" />

                <div className="relative z-10 flex h-full w-full flex-col">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                        {card.eyebrow}
                      </span>

                      <h3 className="service-card__title">{card.title}</h3>
                    </div>

                    <div className="flex shrink-0 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center shadow-inner shadow-white/5">
                      <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Opção
                      </span>

                      <strong className="mt-1 text-sm font-semibold text-cyan-100">
                        {String(index + 1).padStart(2, '0')}
                      </strong>
                    </div>
                  </div>

                  <p className="service-card__description">{card.description}</p>

                  <FeatureList items={card.points} className="mt-5" />

                  <div className="mt-5 flex flex-wrap gap-2">
                    {card.learnLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition duration-300 hover:border-cyan-200/35 hover:bg-cyan-300/10 hover:text-cyan-50"
                        onClick={() =>
                          trackEvent('service_page_link_click', {
                            service_name: link.label,
                            destination: link.href,
                            section: 'path_cards'
                          })
                        }
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>

                  <a
                    href={card.href}
                    onClick={() =>
                      trackEvent('project_path_selected', {
                        project_type: card.projectType,
                        project_goal: card.projectGoal,
                        section: 'path_cards',
                        destination: card.href
                      })
                    }
                    aria-label={`${card.cta}. Abre a página de contacto para pedir proposta.`}
                    className="mt-6 inline-flex w-full items-center justify-between gap-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition duration-300 group-hover:border-cyan-200/40 group-hover:bg-cyan-300/15"
                  >
                    <span>{card.cta}</span>

                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-cyan-200 text-slate-950 transition duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FeaturedProjects mounted={mounted} />

      <section className="px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="section-label">Próximo passo</span>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Pronto para perceber o melhor caminho para o seu projeto?
                </h2>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                  Explique o que precisa ou o problema que quer resolver. A proposta é
                  gratuita, sem compromisso, e pode começar por uma solução simples preparada
                  para crescer.
                </p>
              </div>

              <a
                href="/contacto"
                className="btn-primary hightech-button"
                onClick={() =>
                  trackEvent('cta_click', {
                    cta_text: 'Pedir proposta gratuita',
                    cta_location: 'homepage_final_cta',
                    destination: '/contacto'
                  })
                }
              >
                <span className="btn-shine" />
                <span className="relative z-10">Pedir proposta gratuita</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
