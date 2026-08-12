import { useEffect, useState } from 'react'
import FeaturedProjects from '../components/FeaturedProjects'

const marqueeItems = [
  'Websites Profissionais',
  'Lojas Online',
  'Sistemas à Medida',
  'Otimização SEO',
  'Manutenção e Suporte',
  'Resultados que Falam',
  'Automação e IA',
  'Integrações API',
  'Apps PWA',
  'Domínio + Alojamento',
  'Marcações Online',
  'Áreas Administrativas'
]

const marqueeLoopItems = [...marqueeItems, ...marqueeItems, ...marqueeItems]

const serviceCards = [
  {
    key: 'website',
    title: 'Website Profissional',
    description:
      'Transmita confiança e credibilidade com um website moderno e otimizado.',
    href: '/criacao-websites',
    contactHref: '/contacto?tipo=website',
    accent: 'from-violet-500/25 to-fuchsia-500/10'
  },
  {
    key: 'booking',
    title: 'Vendas / Marcações',
    description:
      'Sistemas de marcação e gestão que simplificam o dia a dia do seu negócio.',
    href: '/sistemas-marcacao',
    contactHref: '/contacto?tipo=vendas-marcacoes',
    accent: 'from-slate-300/15 to-slate-100/5'
  },
  {
    key: 'system',
    title: 'Sistema à Medida',
    description:
      'Desenvolvemos soluções personalizadas para processos específicos do seu negócio.',
    href: '/automacao-ia',
    contactHref: '/contacto?tipo=sistema-medida',
    accent: 'from-violet-500/20 to-cyan-400/10'
  }
]

const featuredProducts = [
  {
    name: 'MA PDF',
    eyebrow: 'Ferramentas PDF',
    description:
      'Ferramentas avançadas para trabalhar com PDFs de forma rápida e prática.',
    href: '/produtos/mapdf',
    accentClassName:
      'border-red-400/30 bg-red-500/12 text-red-100 shadow-[0_10px_30px_rgba(239,68,68,0.18)]',
    icon: 'pdf'
  },
  {
    name: 'MA-Professor',
    eyebrow: 'Gestão escolar',
    description:
      'Plataforma completa para gestão escolar e apoio ao trabalho docente.',
    href: '/produtos/ma-professor',
    accentClassName:
      'border-emerald-400/30 bg-emerald-500/12 text-emerald-100 shadow-[0_10px_30px_rgba(34,197,94,0.18)]',
    icon: 'professor'
  },
  {
    name: 'MA-Quadro',
    eyebrow: 'Editor visual',
    description:
      'Gestão de quadros, horários e recursos com uma experiência visual simples.',
    href: '/produtos/ma-quadro',
    accentClassName:
      'border-amber-400/30 bg-amber-500/12 text-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.18)]',
    icon: 'quadro'
  },
  {
    name: 'MA-Recortes',
    eyebrow: 'Imagem e stickers',
    description:
      'Corte, guarde e organize recortes de forma simples e rápida.',
    href: '/produtos/ma-recortes',
    accentClassName:
      'border-sky-400/30 bg-sky-500/12 text-sky-100 shadow-[0_10px_30px_rgba(14,165,233,0.18)]',
    icon: 'recortes'
  }
]

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
.ma-service-marquee {position: relative !important;display: block !important;width: 100% !important;max-width: 100% !important;min-height: 3.85rem !important;overflow: hidden !important;border-top: 1px solid rgba(103, 232, 249, 0.12) !important;border-bottom: 1px solid rgba(103, 232, 249, 0.12) !important;padding: 0.82rem 0 !important;background:linear-gradient(180deg, rgba(5, 8, 16, 0.96), rgba(7, 10, 18, 0.98)) !important;box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.02),0 0 24px rgba(34, 211, 238, 0.025) !important;opacity: 1 !important;visibility: visible !important;z-index: 30 !important;isolation: isolate !important;transform: translate3d(0, 0, 0) !important;-webkit-transform: translate3d(0, 0, 0) !important;}
.ma-service-marquee::before,
.ma-service-marquee::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3rem;
  z-index: 2;
  pointer-events: none;
}
.ma-service-marquee::before {
  left: 0;
  background: linear-gradient(90deg, rgba(5, 8, 16, 1), transparent);
}
.ma-service-marquee::after {
  right: 0;
  background: linear-gradient(270deg, rgba(5, 8, 16, 1), transparent);
}
.ma-service-marquee__track {
  position: relative !important;
  z-index: 1 !important;
  display: flex !important;
  align-items: center !important;
  gap: 1rem !important;
  width: max-content !important;
  min-width: max-content !important;
  white-space: nowrap !important;
  transform: translate3d(0, 0, 0);
  -webkit-transform: translate3d(0, 0, 0);
  will-change: transform;
  animation: ma-service-marquee-scroll 26s linear infinite;
  -webkit-animation: ma-service-marquee-scroll 26s linear infinite;
}
.ma-service-marquee__item {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 0 auto !important;
  gap: 0.7rem !important;
  color: #eef6ff !important;
  font-size: 0.84rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  white-space: nowrap !important;
}
.ma-service-marquee__item::before {
  content: '✦';
  color: rgba(192, 132, 252, 0.95);
  font-size: 0.82rem;
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
    min-height: 3.25rem !important;
    padding: 0.72rem 0 !important;
  }
  .ma-service-marquee__track {
    gap: 0.85rem !important;
    animation-duration: 20s;
    -webkit-animation-duration: 20s;
  }
  .ma-service-marquee__item {
    font-size: 0.68rem !important;
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

function ServiceIcon({ type }: { type: 'website' | 'booking' | 'system' }) {
  if (type === 'website') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8.2" />
        <path d="M3.8 12h16.4" />
        <path d="M12 3.8c2.3 2.5 3.5 5.3 3.5 8.2S14.3 17.7 12 20.2c-2.3-2.5-3.5-5.3-3.5-8.2S9.7 6.3 12 3.8Z" />
      </svg>
    )
  }

  if (type === 'booking') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4.2" y="5.3" width="15.6" height="14.5" rx="2.4" />
        <path d="M8 3.8v3.4M16 3.8v3.4M4.2 9.2h15.6" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 8 4.5 12 8 16M16 8l3.5 4-3.5 4M13.5 6.8 10.5 17.2" />
    </svg>
  )
}

function ProductIcon({ type }: { type: 'pdf' | 'professor' | 'quadro' | 'recortes' }) {
  if (type === 'pdf') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 3.8h6.2l3.8 3.8v10.6A2.1 2.1 0 0 1 15.9 20H8a2.1 2.1 0 0 1-2.1-2.1V5.9A2.1 2.1 0 0 1 8 3.8Z" />
        <path d="M14.2 3.8V8h3.8M8.5 15.2h7M8.5 12.2h7" />
      </svg>
    )
  }

  if (type === 'professor') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3.8 9.2 12 5l8.2 4.2L12 13.4 3.8 9.2Z" />
        <path d="M6.5 10.7v4.2c0 1.7 2.6 3.1 5.5 3.1s5.5-1.4 5.5-3.1v-4.2" />
      </svg>
    )
  }

  if (type === 'quadro') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4.5" y="4.5" width="6.2" height="6.2" rx="1.4" />
        <rect x="13.3" y="4.5" width="6.2" height="6.2" rx="1.4" />
        <rect x="4.5" y="13.3" width="6.2" height="6.2" rx="1.4" />
        <rect x="13.3" y="13.3" width="6.2" height="6.2" rx="1.4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7.2 6.2v11.6M16.8 6.2v11.6M6.2 7.2h11.6M6.2 16.8h11.6" />
      <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
    </svg>
  )
}

function HeroVisual() {
  return (
    <div className="relative mx-auto hidden w-full max-w-[640px] lg:block" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_34%,rgba(168,85,247,0.28),transparent_26%),radial-gradient(circle_at_62%_62%,rgba(34,211,238,0.12),transparent_24%)] blur-2xl" />

      <div className="relative h-[460px] w-full">
        <div className="absolute right-0 top-0 w-[560px] rotate-[6deg]">
          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-slate-700/50 to-slate-950/95 p-3 shadow-[0_40px_120px_rgba(93,32,182,0.28)]">
            <div className="overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#090d16]">
              <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-5 py-3">
                <div className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                  MA-CODE
                </div>

                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1 text-[0.5rem] font-medium uppercase tracking-[0.16em] text-slate-400">
                  <span>Home</span>
                  <span>Produtos</span>
                  <span>Projetos</span>
                </div>
              </div>

              <div className="relative min-h-[320px] overflow-hidden bg-[linear-gradient(180deg,#0a0d18_0%,#11142a_100%)] px-8 py-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_20%,rgba(168,85,247,0.32),transparent_24%),radial-gradient(circle_at_84%_74%,rgba(59,130,246,0.20),transparent_26%)]" />
                <div className="absolute bottom-[48px] right-[22px] h-[10px] w-[255px] rotate-[-16deg] rounded-full bg-violet-400/90 shadow-[0_0_30px_rgba(192,132,252,0.85)]" />
                <div className="absolute bottom-[44px] right-[68px] h-[86px] w-[180px] rounded-full bg-violet-500/15 blur-3xl" />

                <div className="relative z-10 max-w-[270px]">
                  <div className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/12 px-3 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-violet-100">
                    Soluções digitais
                  </div>

                  <h3 className="mt-5 text-[1.9rem] font-semibold leading-[1.06] tracking-[-0.04em] text-white">
                    Transformamos ideias em soluções digitais que geram resultados.
                  </h3>

                  <p className="mt-4 text-xs leading-5 text-slate-300">
                    Websites profissionais, produtos próprios e sistemas à medida preparados para crescer.
                  </p>

                  <div className="mt-6 flex gap-2">
                    <div className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-[0.62rem] font-semibold text-white">
                      Pedir proposta
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-[0.62rem] font-semibold text-slate-100">
                      Ver produtos
                    </div>
                  </div>
                </div>

                <div className="absolute right-6 top-11 w-[188px] rounded-[1.5rem] border border-white/10 bg-slate-950/75 p-4 shadow-2xl backdrop-blur">
                  <div className="mb-3 text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Painel
                  </div>

                  <div className="space-y-2.5">
                    {['Websites', 'Produtos', 'Automação', 'Integrações'].map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[0.62rem] font-medium text-slate-200"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-[-2px] h-[16px] w-[93%] rounded-b-[2.2rem] bg-gradient-to-b from-slate-500/35 to-slate-900/90 shadow-[0_20px_60px_rgba(0,0,0,0.45)]" />
        </div>

        <div className="absolute bottom-[28px] left-[68px] z-20 w-[170px] -rotate-[3deg] rounded-[2.2rem] border border-white/10 bg-gradient-to-b from-slate-700/45 to-slate-950/95 p-2 shadow-[0_35px_90px_rgba(94,35,183,0.35)]">
          <div className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#0a0d18]">
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/10" />

            <div className="relative min-h-[275px] overflow-hidden bg-[linear-gradient(180deg,#0a0d18_0%,#11142a_100%)] px-4 pb-5 pt-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(168,85,247,0.22),transparent_24%)]" />

              <div className="relative z-10">
                <div className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                  MA-CODE
                </div>

                <div className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-500/10 p-3">
                  <div className="text-[0.46rem] font-semibold uppercase tracking-[0.18em] text-violet-100">
                    Soluções digitais
                  </div>

                  <div className="mt-2 text-sm font-semibold leading-4 text-white">
                    O melhor do seu negócio, em qualquer ecrã.
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="rounded-xl border border-white/8 bg-white/[0.05] px-3 py-2">
                    <div className="text-[0.48rem] text-slate-400">Websites</div>
                    <div className="mt-1 h-2 rounded-full bg-violet-400/40" />
                  </div>

                  <div className="rounded-xl border border-white/8 bg-white/[0.05] px-3 py-2">
                    <div className="text-[0.48rem] text-slate-400">Produtos</div>
                    <div className="mt-1 h-2 w-[82%] rounded-full bg-sky-400/40" />
                  </div>

                  <div className="rounded-xl border border-white/8 bg-white/[0.05] px-3 py-2">
                    <div className="text-[0.48rem] text-slate-400">Automação</div>
                    <div className="mt-1 h-2 w-[68%] rounded-full bg-cyan-400/40" />
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-2 text-center text-[0.55rem] font-semibold text-white">
                  Pedir proposta
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute right-[112px] top-[36px] h-[110px] w-[110px] rounded-full bg-violet-500/12 blur-3xl" />
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
      'Websites profissionais desde 19€/mês para negócios que pretendem começar de forma simples, gerar contactos e evoluir para loja online, marcações, automação, IA ou sistemas digitais.'
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
    updatePropertyMeta('og:title', 'Websites Profissionais desde 19€/mês | MA-Code')
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
    updateMeta('twitter:title', 'Websites Profissionais desde 19€/mês | MA-Code')
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
      <section className="relative overflow-hidden px-5 pb-10 pt-6 sm:px-6 md:px-10 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex items-center justify-between gap-4 md:mb-10">
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
              className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition duration-300 hover:-translate-y-0.5 hover:border-violet-300/35 hover:bg-white/[0.06] sm:inline-flex"
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

          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(520px,620px)] xl:gap-12">
            <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="inline-flex items-center rounded-full border border-violet-300/25 bg-violet-500/10 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-violet-100">
                MA-CODE
              </div>

              <h1 className="mt-6 max-w-[11ch] text-[clamp(2.65rem,6vw,5.55rem)] font-semibold leading-[0.96] tracking-[-0.065em] text-white">
                Websites e sistemas à medida que fazem{' '}
                <span className="bg-gradient-to-r from-violet-200 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
                  a diferença.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-[1.05rem] leading-8 text-slate-300 md:text-[1.15rem]">
                Desenvolvemos websites profissionais, lojas online e sistemas personalizados para automatizar e fazer crescer o seu negócio —{' '}
                <span className="font-semibold text-violet-300">desde 19€/mês.</span>
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/contacto"
                  className="inline-flex min-h-[3.6rem] items-center justify-center rounded-2xl border border-violet-300/30 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(124,58,237,0.28)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(124,58,237,0.34)]"
                  onClick={() =>
                    trackEvent('cta_click', {
                      cta_text: 'Pedir proposta gratuita',
                      cta_location: 'hero_primary',
                      destination: '/contacto'
                    })
                  }
                >
                  <span className="flex flex-col leading-tight">
                    <span>Pedir proposta gratuita</span>
                    <span className="mt-1 text-[0.68rem] font-medium text-violet-100/90">
                      Resposta em 24h
                    </span>
                  </span>
                </a>

                <a
                  href="/projetos"
                  className="inline-flex min-h-[3.6rem] items-center justify-center rounded-2xl border border-white/12 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-slate-100 transition duration-300 hover:-translate-y-0.5 hover:border-violet-300/30 hover:bg-white/[0.05]"
                  onClick={() =>
                    trackEvent('cta_click', {
                      cta_text: 'Ver projetos reais',
                      cta_location: 'hero_secondary',
                      destination: '/projetos'
                    })
                  }
                >
                  <span className="flex flex-col leading-tight">
                    <span>Ver projetos reais</span>
                    <span className="mt-1 text-[0.68rem] font-medium text-slate-400">
                      Casos de sucesso
                    </span>
                  </span>
                </a>

                <a
                  href="/produtos"
                  className="inline-flex min-h-[3.6rem] items-center justify-center rounded-2xl border border-white/12 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-slate-100 transition duration-300 hover:-translate-y-0.5 hover:border-violet-300/30 hover:bg-white/[0.05]"
                  onClick={() =>
                    trackEvent('cta_click', {
                      cta_text: 'Ver produtos',
                      cta_location: 'hero_products',
                      destination: '/produtos'
                    })
                  }
                >
                  <span className="flex flex-col leading-tight">
                    <span>Ver produtos</span>
                    <span className="mt-1 text-[0.68rem] font-medium text-slate-400">
                      Ferramentas MA-Code
                    </span>
                  </span>
                </a>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-slate-400" />
                  <span>Domínio + Alojamento incluídos</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-slate-400" />
                  <span>Suporte dedicado</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-slate-400" />
                  <span>Sem fidelizações</span>
                </div>
              </div>
            </div>

            <div className={`${mounted ? 'animate-fade-in-scale' : 'opacity-0'}`}>
              <HeroVisual />
            </div>
          </div>
        </div>
      </section>

      <section className="pb-10">
        <div className="relative left-1/2 w-screen -translate-x-1/2">
          <ServiceMarquee />
        </div>
      </section>

      <section className="px-5 pb-14 sm:px-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-[3rem]">
              Escolha o{' '}
              <span className="bg-gradient-to-r from-violet-200 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
                caminho certo
              </span>{' '}
              para o seu negócio
            </h2>

            <p className="mt-3 text-base text-slate-400">
              Soluções completas, pensadas para os seus objetivos
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {serviceCards.map((card, index) => (
              <article
                key={card.title}
                className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,22,0.96),rgba(6,9,16,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-violet-300/28 hover:shadow-[0_28px_70px_rgba(91,33,182,0.20)] ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accent} opacity-70`} />
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                <div className="relative z-10 flex h-full flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-300/18 bg-violet-500/10 text-violet-200 shadow-[0_12px_34px_rgba(124,58,237,0.18)]">
                    <ServiceIcon type={card.key as 'website' | 'booking' | 'system'} />
                  </div>

                  <h3 className="mt-6 text-2xl font-semibold tracking-tight text-white">
                    {card.title}
                  </h3>

                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {card.description}
                  </p>

                  <div className="mt-6 flex flex-col gap-3">
                    <a
                      href={card.href}
                      className="text-sm font-semibold text-violet-300 transition duration-300 hover:text-violet-200"
                      onClick={() =>
                        trackEvent('service_page_link_click', {
                          service_name: card.title,
                          destination: card.href,
                          section: 'service_cards'
                        })
                      }
                    >
                      Saber mais →
                    </a>

                    <a
                      href={card.contactHref}
                      className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400 transition duration-300 hover:text-slate-200"
                      onClick={() =>
                        trackEvent('project_path_selected', {
                          project_type: card.title,
                          section: 'service_cards',
                          destination: card.contactHref
                        })
                      }
                    >
                      Pedir proposta
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-[2.35rem] border border-violet-300/14 bg-[linear-gradient(180deg,rgba(7,10,18,0.98),rgba(9,12,20,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_36%,rgba(124,58,237,0.24),transparent_22%),radial-gradient(circle_at_76%_76%,rgba(59,130,246,0.12),transparent_26%)]" />
            <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/45 to-transparent" />

            <div className="relative z-10 grid gap-8 p-6 lg:grid-cols-[0.92fr_1.65fr] lg:items-center lg:gap-10 lg:p-10">
              <div>
                <span className="inline-flex rounded-full border border-violet-300/22 bg-violet-500/10 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-violet-100">
                  Produtos próprios
                </span>

                <h2 className="mt-5 max-w-[12ch] text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-white">
                  Ferramentas MA-Code que{' '}
                  <span className="bg-gradient-to-r from-violet-200 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
                    impulsionam
                  </span>{' '}
                  o seu dia a dia
                </h2>

                <p className="mt-5 max-w-md text-base leading-8 text-slate-300">
                  Além de serviços à medida, desenvolvemos produtos próprios para resolver problemas reais de forma simples e eficaz.
                </p>

                <a
                  href="/produtos"
                  className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-violet-300/28 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:border-violet-200/40 hover:bg-white/[0.05]"
                  onClick={() =>
                    trackEvent('cta_click', {
                      cta_text: 'Explorar todos os produtos',
                      cta_location: 'products_spotlight',
                      destination: '/produtos'
                    })
                  }
                >
                  Explorar todos os produtos
                  <span>→</span>
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {featuredProducts.map((product, index) => (
                  <a
                    key={product.name}
                    href={product.href}
                    className={`group relative flex min-h-[265px] flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/25 p-5 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-violet-300/25 hover:bg-white/[0.03] ${
                      mounted ? 'animate-fade-in-up' : 'opacity-0'
                    }`}
                    style={{ animationDelay: `${index * 110}ms` }}
                    onClick={() =>
                      trackEvent('product_click', {
                        product_name: product.name,
                        cta_location: 'homepage_products_spotlight',
                        destination: product.href
                      })
                    }
                  >
                    <div
                      className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border ${product.accentClassName}`}
                    >
                      <ProductIcon
                        type={product.icon as 'pdf' | 'professor' | 'quadro' | 'recortes'}
                      />
                    </div>

                    <div className="mt-5 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {product.eyebrow}
                    </div>

                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
                      {product.name}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {product.description}
                    </p>

                    <div className="mt-auto pt-6 text-sm font-semibold text-violet-300 transition duration-300 group-hover:text-violet-200">
                      Saber mais →
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <FeaturedProjects mounted={mounted} />

      <section className="px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[2rem] border border-violet-300/18 bg-[linear-gradient(180deg,rgba(11,15,25,0.96),rgba(8,11,18,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_20px_50px_rgba(124,58,237,0.32)]">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                    <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" />
                  </svg>
                </div>

                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-white">
                    Pronto para dar o{' '}
                    <span className="bg-gradient-to-r from-violet-200 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
                      próximo passo?
                    </span>
                  </h2>

                  <p className="mt-3 max-w-2xl text-base leading-8 text-slate-300">
                    Fale connosco e receba uma proposta gratuita, clara e sem compromisso.
                  </p>
                </div>
              </div>

              <a
                href="/contacto"
                className="inline-flex min-h-[3.8rem] items-center justify-center rounded-2xl border border-violet-300/30 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-7 py-4 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(124,58,237,0.28)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(124,58,237,0.34)]"
                onClick={() =>
                  trackEvent('cta_click', {
                    cta_text: 'Pedir proposta gratuita',
                    cta_location: 'homepage_final_cta',
                    destination: '/contacto'
                  })
                }
              >
                Pedir proposta gratuita
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
