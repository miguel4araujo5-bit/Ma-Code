import { useEffect, useState } from 'react'
import { FeatureList, SectionHeader } from '../components/DesignSystem'
import FeaturedProjects from '../components/FeaturedProjects'

const marqueeItems = [
  'Websites desde 19€/mês',
  'Domínio + Alojamento',
  'Sites Mobile-First',
  'Lojas Online',
  'Marcações Online',
  'Áreas Administrativas',
  'Automação e IA',
  'Integrações API',
  'Web3 / Blockchain',
  'Performance e SEO',
  'Integração Blockchain',
  'Projetos Crypto',
  'Apps PWA',
  'Inteligência Artificial',
  'Projetos à Medida'
]

const marqueeLoopItems = [...marqueeItems, ...marqueeItems, ...marqueeItems]

const pathCards = [
  {
    title: 'Website Profissional',
    eyebrow: 'Presença online',
    href: '/contacto?tipo=website',
    learnLinks: [{ label: 'Saber mais', href: '/criacao-websites' }],
    projectType: 'Website profissional',
    projectGoal: 'Receber mais contactos',
    cta: 'Pedir proposta para website',
    description:
      'Transmita confiança e credibilidade com um website moderno, claro e otimizado.',
    points: ['Página inicial clara', 'Serviços bem explicados', 'Contactos e WhatsApp']
  },
  {
    title: 'Vendas / Marcações',
    eyebrow: 'Vendas e reservas',
    href: '/contacto?tipo=vendas-marcacoes',
    learnLinks: [
      { label: 'Saber mais', href: '/lojas-online' },
      { label: 'Ver marcações', href: '/sistemas-marcacao' }
    ],
    projectType: 'Loja online / Sistema de marcações',
    projectGoal: 'Vender online',
    cta: 'Pedir proposta para vendas ou marcações',
    description:
      'Sistemas de marcação e gestão que simplificam o seu dia a dia.',
    points: ['Loja online ou marcações', 'Pedido rápido', 'Experiência mobile']
  },
  {
    title: 'Sistema à Medida',
    eyebrow: 'Solução personalizada',
    href: '/contacto?tipo=sistema-medida',
    learnLinks: [{ label: 'Saber mais', href: '/automacao-ia' }],
    projectType: 'Sistema à medida',
    projectGoal: 'Automatizar tarefas',
    cta: 'Pedir proposta para sistema à medida',
    description:
      'Desenvolvemos soluções personalizadas para processos específicos do seu negócio.',
    points: ['Painel administrativo', 'Automação de tarefas', 'Integrações e dados']
  }
]

const featuredProducts = [
  {
    name: 'MA PDF',
    eyebrow: 'Ferramentas PDF',
    description:
      'Ferramentas avançadas para trabalhar com PDFs de forma rápida.',
    href: '/produtos/mapdf',
    badge: 'PDF',
    badgeClassName:
      'border-red-300/35 bg-red-500/15 text-red-100 shadow-red-950/30'
  },
  {
    name: 'MA-Professor',
    eyebrow: 'Gestão escolar',
    description:
      'Plataforma completa para gestão escolar e professores.',
    href: '/produtos/ma-professor',
    badge: '🎓',
    badgeClassName:
      'border-emerald-300/35 bg-emerald-500/15 text-emerald-100 shadow-emerald-950/30'
  },
  {
    name: 'MA-Quadro',
    eyebrow: 'Editor visual',
    description:
      'Gestão de quadros, horários e recursos de forma inteligente.',
    href: '/produtos/ma-quadro',
    badge: '▣',
    badgeClassName:
      'border-amber-300/35 bg-amber-500/15 text-amber-100 shadow-amber-950/30'
  },
  {
    name: 'MA-Recortes',
    eyebrow: 'Imagem e stickers',
    description:
      'Corta, guarda e organiza recortes de forma simples e automática.',
    href: '/produtos/ma-recortes',
    badge: '✂',
    badgeClassName:
      'border-sky-300/35 bg-sky-500/15 text-sky-100 shadow-sky-950/30'
  }
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

function HeroVisual() {
  return (
    <div className="relative mx-auto hidden w-full max-w-[620px] lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_40%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_72%_72%,rgba(167,139,250,0.12),transparent_32%)] blur-2xl" />

      <div className="relative z-10 pt-3">
        <div className="relative ml-auto w-[540px] rotate-[2deg] overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/95 shadow-[0_40px_120px_rgba(14,165,233,0.15)]">
          <div className="border-b border-white/10 bg-slate-950/90 px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-cyan-300/70" />
                <span className="size-2.5 rounded-full bg-sky-300/35" />
                <span className="size-2.5 rounded-full bg-violet-300/35" />
              </div>

              <div className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                MA-CODE
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                live
              </div>
            </div>
          </div>

          <div className="relative min-h-[355px] overflow-hidden bg-[linear-gradient(180deg,#060b14_0%,#091321_100%)] px-8 py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_22%,rgba(34,211,238,0.15),transparent_28%),radial-gradient(circle_at_82%_76%,rgba(167,139,250,0.12),transparent_30%)]" />

            <div className="absolute inset-y-0 right-0 w-[54%] bg-[linear-gradient(135deg,transparent_25%,rgba(34,211,238,0.06)_60%,rgba(34,211,238,0.18)_100%)]" />

            <div className="absolute bottom-8 right-8 h-1 w-[220px] rotate-[-12deg] rounded-full bg-cyan-300/85 shadow-[0_0_24px_rgba(34,211,238,0.7)]" />

            <div className="relative z-10 max-w-[275px]">
              <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Soluções digitais
              </div>

              <h3 className="mt-5 text-[1.9rem] font-semibold leading-[1.05] tracking-tight text-white">
                Transformamos ideias em soluções digitais que geram resultados.
              </h3>

              <p className="mt-4 text-xs leading-5 text-slate-400">
                Websites profissionais, produtos próprios e sistemas à medida para crescer com base sólida.
              </p>

              <div className="mt-6 flex gap-2">
                <div className="rounded-xl bg-cyan-300 px-4 py-2 text-[0.62rem] font-bold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)]">
                  Pedir proposta
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[0.62rem] font-semibold text-slate-200">
                  Ver produtos
                </div>
              </div>
            </div>

            <div className="absolute right-6 top-12 w-[182px] rounded-[1.6rem] border border-cyan-300/15 bg-slate-950/78 p-4 shadow-2xl shadow-cyan-950/25 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Painel
                </span>

                <span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.75)]" />
              </div>

              <div className="mt-4 space-y-2">
                {['Websites', 'Produtos', 'Automação', 'Integrações'].map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[0.62rem] font-medium text-slate-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-[-18px] left-[120px] z-20 w-[170px] -rotate-[4deg] overflow-hidden rounded-[2rem] border border-cyan-300/18 bg-slate-950 shadow-[0_25px_80px_rgba(8,145,178,0.22)]">
          <div className="border-b border-white/10 bg-slate-950/90 px-4 py-2">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden bg-[linear-gradient(180deg,#060b14_0%,#091321_100%)] px-4 pb-5 pt-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_18%,rgba(34,211,238,0.14),transparent_24%)]" />

            <div className="relative z-10">
              <div className="text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                MA-CODE
              </div>

              <div className="mt-6 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-3">
                <span className="text-[0.45rem] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                  Mobile-first
                </span>

                <strong className="mt-2 block text-sm leading-4 text-white">
                  O seu negócio em qualquer ecrã.
                </strong>
              </div>

              <div className="mt-3 space-y-2">
                <div className="h-2 rounded-full bg-white/[0.08]" />
                <div className="h-2 w-4/5 rounded-full bg-white/[0.06]" />
                <div className="h-2 w-3/5 rounded-full bg-white/[0.06]" />
              </div>

              <div className="mt-4 rounded-lg bg-cyan-300 px-3 py-2 text-center text-[0.55rem] font-bold text-slate-950">
                Pedir proposta
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductsShowcase({ mounted }: { mounted: boolean }) {
  return (
    <section className="px-5 pb-14 pt-2 sm:px-6 md:px-10 md:pb-16">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2.3rem] border border-cyan-300/15 bg-slate-950/78 shadow-2xl shadow-cyan-950/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_80%_74%,rgba(167,139,250,0.10),transparent_26%)]" />
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent" />

          <div className="relative z-10 grid gap-8 p-6 md:p-8 lg:grid-cols-[0.92fr_1.7fr] lg:items-center lg:gap-10 lg:p-10">
            <div>
              <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Produtos próprios
              </span>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Ferramentas MA-Code que{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                  impulsionam
                </span>{' '}
                o teu dia a dia
              </h2>

              <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 md:text-base">
                Além de serviços à medida, desenvolvemos produtos próprios para resolver problemas reais de forma simples e eficaz.
              </p>

              <a
                href="/produtos"
                className="mt-7 inline-flex items-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/15"
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
                  className={`group relative flex min-h-[250px] flex-col overflow-hidden rounded-[1.55rem] border border-white/10 bg-slate-950/85 p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-slate-900/90 ${
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
                  <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-cyan-300/[0.05] blur-2xl transition duration-300 group-hover:bg-cyan-300/[0.09]" />

                  <div
                    className={`relative z-10 flex size-14 items-center justify-center rounded-2xl border text-base font-black shadow-lg ${product.badgeClassName}`}
                  >
                    {product.badge}
                  </div>

                  <span className="relative z-10 mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/65">
                    {product.eyebrow}
                  </span>

                  <h3 className="relative z-10 mt-2 text-lg font-semibold tracking-tight text-white">
                    {product.name}
                  </h3>

                  <p className="relative z-10 mt-3 text-xs leading-5 text-slate-400">
                    {product.description}
                  </p>

                  <div className="relative z-10 mt-auto flex items-center justify-between pt-6 text-xs font-semibold text-cyan-200">
                    <span>Saber mais</span>

                    <span className="flex size-7 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-300/10 transition duration-300 group-hover:translate-x-1 group-hover:bg-cyan-300/20">
                      →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
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
                <span>MA-CODE</span>
              </div>

              <h1 className="hero-title">
                Websites e sistemas à medida que fazem{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                  a diferença.
                </span>
              </h1>

              <p className="hero-subtitle">
                Desenvolvemos websites profissionais, lojas online e sistemas personalizados para automatizar e fazer crescer o teu negócio —{' '}
                <span className="font-semibold text-cyan-200">desde 19€/mês.</span>
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

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-400 sm:text-sm">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-cyan-300" />
                  <span>Domínio + Alojamento incluídos</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-cyan-300" />
                  <span>Suporte dedicado</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-cyan-300" />
                  <span>Sem fidelizações</span>
                </div>
              </div>

              <ServiceMarquee />
            </div>

            <div className={`${mounted ? 'animate-fade-in-scale' : 'opacity-0'}`}>
              <HeroVisual />
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Escolha o caminho"
            title="Escolhe o caminho certo para o teu negócio"
            description="Soluções completas, pensadas para os teus objetivos."
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
                        {link.label} →
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

      <ProductsShowcase mounted={mounted} />

      <FeaturedProjects mounted={mounted} />

      <section className="px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="section-label">Próximo passo</span>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Pronto para dar o próximo passo?
                </h2>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                  Fala connosco e recebe uma proposta gratuita e sem compromisso.
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
