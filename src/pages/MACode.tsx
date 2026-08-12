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

const marqueeLoopItems = [
  ...marqueeItems,
  ...marqueeItems,
  ...marqueeItems
]

const pathCards = [
  {
    title: 'Quero um website profissional',
    eyebrow: 'Presença online',
    href: '/contacto?tipo=website',
    learnLinks: [
      {
        label: 'Ver criação de websites',
        href: '/criacao-websites'
      }
    ],
    projectType: 'Website profissional',
    projectGoal: 'Receber mais contactos',
    cta: 'Pedir proposta para website',
    description:
      'Para apresentar o negócio, explicar serviços, transmitir confiança e receber contactos de forma simples e profissional.',
    points: [
      'Página inicial clara',
      'Serviços bem explicados',
      'Contactos e WhatsApp'
    ]
  },
  {
    title: 'Quero vender ou receber marcações',
    eyebrow: 'Vendas e reservas',
    href: '/contacto?tipo=vendas-marcacoes',
    learnLinks: [
      {
        label: 'Ver lojas online',
        href: '/lojas-online'
      },
      {
        label: 'Ver marcações',
        href: '/sistemas-marcacao'
      }
    ],
    projectType: 'Loja online / Sistema de marcações',
    projectGoal: 'Vender online',
    cta: 'Pedir proposta para vendas ou marcações',
    description:
      'Para criar uma loja online, receber encomendas, aceitar reservas, gerir pedidos ou facilitar o contacto com clientes.',
    points: [
      'Loja online ou marcações',
      'Pedido rápido',
      'Experiência preparada para telemóvel'
    ]
  },
  {
    title: 'Quero automatizar ou criar um sistema',
    eyebrow: 'Sistema à medida',
    href: '/contacto?tipo=sistema-medida',
    learnLinks: [
      {
        label: 'Ver automação e IA',
        href: '/automacao-ia'
      }
    ],
    projectType: 'Sistema à medida',
    projectGoal: 'Automatizar tarefas',
    cta: 'Pedir proposta para sistema à medida',
    description:
      'Para criar uma área administrativa, dashboard, base de dados, automação, integração com IA ou aplicação web personalizada.',
    points: [
      'Painel administrativo',
      'Automação de tarefas',
      'Integrações e dados'
    ]
  }
]

const featuredProducts = [
  {
    name: 'MA PDF',
    eyebrow: 'Ferramentas PDF',
    description:
      'Ferramentas simples para juntar, dividir, comprimir, converter, editar e assinar documentos PDF.',
    href: '/produtos/mapdf',
    badge: 'PDF',
    badgeClassName:
      'border-cyan-300/30 bg-cyan-300/10 text-cyan-100 shadow-cyan-950/30'
  },
  {
    name: 'MA-BTC ALERTAS',
    eyebrow: 'Alertas Bitcoin',
    description:
      'Acompanhe movimentos do BTC/USD e receba alertas quando o preço atingir movimentos relevantes.',
    href: '/produtos/ma-btc-alertas',
    badge: '₿',
    badgeClassName:
      'border-sky-300/30 bg-sky-300/10 text-sky-100 shadow-sky-950/30'
  },
  {
    name: 'MA-Recortes',
    eyebrow: 'Criador de stickers',
    description:
      'Remova fundos, faça correções manuais e exporte recortes em PNG transparente ou para WhatsApp.',
    href: '/produtos/ma-recortes',
    badge: '✂',
    badgeClassName:
      'border-violet-300/30 bg-violet-300/10 text-violet-100 shadow-violet-950/30'
  },
  {
    name: 'MA-Quadro',
    eyebrow: 'Editor de design',
    description:
      'Crie publicações, stories, cartazes e outros designs diretamente no dispositivo.',
    href: '/produtos/ma-quadro',
    badge: '▦',
    badgeClassName:
      'border-cyan-300/30 bg-cyan-300/10 text-cyan-100 shadow-cyan-950/30'
  }
]

function updateMeta(
  name: string,
  content: string
) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      `meta[name="${name}"]`
    )

  if (!meta) {
    meta =
      document.createElement('meta')

    meta.name = name

    document.head.appendChild(meta)
  }

  meta.content = content
}

function updatePropertyMeta(
  property: string,
  content: string
) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      `meta[property="${property}"]`
    )

  if (!meta) {
    meta =
      document.createElement('meta')

    meta.setAttribute(
      'property',
      property
    )

    document.head.appendChild(meta)
  }

  meta.content = content
}

function updateCanonical(
  href: string
) {
  let canonical =
    document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )

  if (!canonical) {
    canonical =
      document.createElement('link')

    canonical.rel = 'canonical'

    document.head.appendChild(
      canonical
    )
  }

  canonical.href = href
}

type AnalyticsParameters =
  Record<
    string,
    string | number | boolean | undefined
  >

type AnalyticsWindow =
  Window & {
    gtag?: (
      command: 'event',
      eventName: string,
      parameters?: AnalyticsParameters
    ) => void
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

const attributionStorageKey =
  'ma_code_attribution'

function getReferrerSource(
  referrer: string
) {
  if (!referrer) {
    return 'direct'
  }

  try {
    return new URL(
      referrer
    ).hostname.replace(
      /^www\./,
      ''
    )
  } catch {
    return 'referral'
  }
}

function getTrafficAttribution():
  AttributionData {
  if (
    typeof window === 'undefined'
  ) {
    return {}
  }

  const searchParams =
    new URLSearchParams(
      window.location.search
    )

  const hasCampaignParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content'
  ].some((param) =>
    searchParams.has(param)
  )

  try {
    const storedAttribution =
      window.sessionStorage.getItem(
        attributionStorageKey
      )

    if (
      storedAttribution &&
      !hasCampaignParams
    ) {
      return JSON.parse(
        storedAttribution
      ) as AttributionData
    }
  } catch {
    return {
      traffic_source:
        searchParams.get(
          'utm_source'
        ) ||
        getReferrerSource(
          document.referrer
        ),
      traffic_medium:
        searchParams.get(
          'utm_medium'
        ) ||
        (document.referrer
          ? 'referral'
          : 'direct'),
      traffic_campaign:
        searchParams.get(
          'utm_campaign'
        ) || undefined,
      traffic_term:
        searchParams.get(
          'utm_term'
        ) || undefined,
      traffic_content:
        searchParams.get(
          'utm_content'
        ) || undefined,
      traffic_referrer:
        document.referrer ||
        undefined,
      landing_page:
        window.location.href
    }
  }

  const attribution = {
    traffic_source:
      searchParams.get(
        'utm_source'
      ) ||
      getReferrerSource(
        document.referrer
      ),
    traffic_medium:
      searchParams.get(
        'utm_medium'
      ) ||
      (document.referrer
        ? 'referral'
        : 'direct'),
    traffic_campaign:
      searchParams.get(
        'utm_campaign'
      ) || undefined,
    traffic_term:
      searchParams.get(
        'utm_term'
      ) || undefined,
    traffic_content:
      searchParams.get(
        'utm_content'
      ) || undefined,
    traffic_referrer:
      document.referrer ||
      undefined,
    landing_page:
      window.location.href
  }

  try {
    window.sessionStorage.setItem(
      attributionStorageKey,
      JSON.stringify(
        attribution
      )
    )
  } catch {
    return attribution
  }

  return attribution
}

function trackEvent(
  eventName: string,
  parameters:
    AnalyticsParameters = {}
) {
  if (
    typeof window === 'undefined'
  ) {
    return
  }

  const analyticsWindow =
    window as AnalyticsWindow

  const eventParameters = {
    event_category:
      'ma_code_homepage',
    page_location:
      window.location.href,
    page_path:
      window.location.pathname,
    page_title:
      document.title,
    ...getTrafficAttribution(),
    ...parameters
  }

  if (
    typeof analyticsWindow.gtag ===
    'function'
  ) {
    analyticsWindow.gtag(
      'event',
      eventName,
      eventParameters
    )

    return
  }

  analyticsWindow.dataLayer =
    Array.isArray(
      analyticsWindow.dataLayer
    )
      ? analyticsWindow.dataLayer
      : []

  analyticsWindow.dataLayer.push({
    event: eventName,
    ...eventParameters
  })
}

function ServiceMarquee() {
  return (
    <div
      className="ma-service-marquee"
      aria-label="Serviços e soluções da MA-Code"
    >
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

      <span className="sr-only">
        {marqueeItems.join(', ')}
      </span>

      <div
        className="ma-service-marquee__track"
        aria-hidden="true"
      >
        {marqueeLoopItems.map(
          (item, index) => (
            <span
              key={`${item}-${index}`}
              className="ma-service-marquee__item"
            >
              {item}
            </span>
          )
        )}
      </div>
    </div>
  )
}

function HeroDeviceShowcase() {
  return (
    <div
      className="relative mx-auto w-full max-w-[620px] pb-12 pt-4"
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute -inset-8 bg-[radial-gradient(circle_at_58%_42%,rgba(34,211,238,0.18),transparent_33%),radial-gradient(circle_at_76%_70%,rgba(139,92,246,0.12),transparent_30%)] blur-2xl" />

      <div className="absolute -right-3 top-1 z-30 rounded-full border border-cyan-300/25 bg-slate-950/90 px-4 py-2 shadow-lg shadow-cyan-950/40 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.9)]" />

          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">
            Websites · Produtos · Sistemas
          </span>
        </div>
      </div>

      <div className="relative z-10 origin-center rotate-[1.5deg] overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/95 p-2 shadow-[0_35px_90px_rgba(2,132,199,0.16)]">
        <div className="overflow-hidden rounded-[1.55rem] border border-white/10 bg-[#07111c]">
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/85 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-cyan-300/70" />
              <span className="size-2.5 rounded-full bg-sky-300/35" />
              <span className="size-2.5 rounded-full bg-violet-300/35" />
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
              ma-code.pt
            </div>

            <div className="h-2.5 w-8 rounded-full bg-white/[0.06]" />
          </div>

          <div className="relative min-h-[355px] overflow-hidden px-8 py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_20%_85%,rgba(139,92,246,0.10),transparent_30%)]" />

            <div className="absolute inset-0 bg-[linear-gradient(rgba(103,232,249,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.035)_1px,transparent_1px)] bg-[size:28px_28px]" />

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-5">
                <div className="flex items-center gap-2">
                  <img
                    src="/ma-code.png"
                    alt=""
                    className="size-7 rounded-lg object-contain"
                  />

                  <strong className="text-xs font-semibold tracking-[0.12em] text-white">
                    MA-CODE
                  </strong>
                </div>

                <div className="hidden items-center gap-4 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:flex">
                  <span>Serviços</span>
                  <span>Produtos</span>
                  <span>Projetos</span>
                </div>
              </div>

              <div className="mt-10 max-w-[360px]">
                <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  Soluções digitais
                </span>

                <strong className="mt-5 block text-3xl font-semibold leading-[1.05] tracking-tight text-white">
                  Uma presença digital preparada para{' '}
                  <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                    crescer.
                  </span>
                </strong>

                <p className="mt-4 max-w-xs text-xs leading-5 text-slate-400">
                  Website, vendas, marcações,
                  automação e ferramentas próprias
                  num único ecossistema.
                </p>

                <div className="mt-5 flex gap-2">
                  <span className="rounded-xl bg-cyan-300 px-4 py-2 text-[0.62rem] font-bold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)]">
                    Começar projeto
                  </span>

                  <span className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[0.62rem] font-semibold text-slate-200">
                    Ver produtos
                  </span>
                </div>
              </div>

              <div className="absolute right-5 top-[95px] hidden w-[155px] rounded-[1.4rem] border border-cyan-300/15 bg-slate-950/75 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur md:block">
                <div className="flex items-center justify-between">
                  <span className="text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Ecossistema
                  </span>

                  <span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    'Website',
                    'Produtos',
                    'Automação',
                    'Integrações'
                  ].map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2"
                      >
                        <span className="flex size-5 items-center justify-center rounded-md bg-cyan-300/10 text-[0.48rem] font-bold text-cyan-200">
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            '0'
                          )}
                        </span>

                        <span className="text-[0.58rem] font-medium text-slate-300">
                          {item}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
                  <span className="text-[0.5rem] font-semibold uppercase tracking-[0.15em] text-cyan-200/60">
                    01
                  </span>

                  <strong className="mt-1 block text-[0.65rem] text-white">
                    Websites
                  </strong>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
                  <span className="text-[0.5rem] font-semibold uppercase tracking-[0.15em] text-cyan-200/60">
                    02
                  </span>

                  <strong className="mt-1 block text-[0.65rem] text-white">
                    Produtos
                  </strong>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
                  <span className="text-[0.5rem] font-semibold uppercase tracking-[0.15em] text-cyan-200/60">
                    03
                  </span>

                  <strong className="mt-1 block text-[0.65rem] text-white">
                    Sistemas
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-1 left-1 z-20 w-[178px] -rotate-[4deg] rounded-[2rem] border border-cyan-300/20 bg-slate-950 p-2 shadow-[0_30px_70px_rgba(8,145,178,0.22)]">
        <div className="overflow-hidden rounded-[1.55rem] border border-white/10 bg-[#07111c]">
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-white/10" />

          <div className="px-4 pb-5 pt-4">
            <div className="flex items-center gap-2">
              <img
                src="/ma-code.png"
                alt=""
                className="size-5 rounded-md object-contain"
              />

              <span className="text-[0.52rem] font-semibold tracking-[0.12em] text-white">
                MA-CODE
              </span>
            </div>

            <div className="mt-7 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-3">
              <span className="text-[0.48rem] font-semibold uppercase tracking-[0.15em] text-cyan-200">
                Mobile-first
              </span>

              <strong className="mt-2 block text-sm leading-4 text-white">
                O seu negócio em qualquer ecrã.
              </strong>
            </div>

            <div className="mt-3 space-y-2">
              <div className="h-2 w-full rounded-full bg-white/[0.07]" />
              <div className="h-2 w-4/5 rounded-full bg-white/[0.05]" />
              <div className="h-2 w-3/5 rounded-full bg-white/[0.05]" />
            </div>

            <div className="mt-4 rounded-lg bg-cyan-300 px-3 py-2 text-center text-[0.55rem] font-bold text-slate-950">
              Pedir proposta
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 right-1 z-20 rounded-2xl border border-cyan-300/20 bg-slate-950/90 p-4 shadow-xl shadow-cyan-950/30 backdrop-blur-xl">
        <span className="block text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Base preparada
        </span>

        <div className="mt-2 flex items-center gap-2">
          <span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />

          <strong className="text-xs text-cyan-100">
            para evoluir
          </strong>
        </div>
      </div>
    </div>
  )
}

function ProductsSpotlight({
  mounted
}: {
  mounted: boolean
}) {
  return (
    <section className="px-5 pb-12 sm:px-6 md:px-10 md:pb-16">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2.2rem] border border-cyan-300/15 bg-slate-950/75 shadow-2xl shadow-cyan-950/20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_25%,rgba(34,211,238,0.13),transparent_25%),radial-gradient(circle_at_88%_80%,rgba(139,92,246,0.09),transparent_28%)]" />

          <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent" />

          <div className="relative z-10 grid gap-8 p-6 md:p-8 lg:grid-cols-[0.8fr_1.8fr] lg:gap-10 lg:p-10">
            <div className="flex flex-col justify-center">
              <span className="section-label">
                Produtos próprios
              </span>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Ferramentas MA-Code para o{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                  dia a dia.
                </span>
              </h2>

              <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 md:text-base">
                Além de websites e sistemas à
                medida, desenvolvemos produtos
                próprios para resolver tarefas
                concretas de forma simples,
                rápida e útil.
              </p>

              <a
                href="/produtos"
                className="btn-primary hightech-button mt-7 w-fit"
                onClick={() =>
                  trackEvent(
                    'cta_click',
                    {
                      cta_text:
                        'Explorar todos os produtos',
                      cta_location:
                        'products_spotlight',
                      destination:
                        '/produtos'
                    }
                  )
                }
              >
                <span className="btn-shine" />

                <span className="relative z-10">
                  Explorar todos os produtos
                </span>
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featuredProducts.map(
                (
                  product,
                  index
                ) => (
                  <a
                    key={
                      product.name
                    }
                    href={
                      product.href
                    }
                    className={`group relative flex min-h-[245px] flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-slate-900/90 ${
                      mounted
                        ? 'animate-fade-in-up'
                        : 'opacity-0'
                    }`}
                    style={{
                      animationDelay:
                        `${
                          index *
                          100
                        }ms`
                    }}
                    onClick={() =>
                      trackEvent(
                        'product_click',
                        {
                          product_name:
                            product.name,
                          cta_location:
                            'homepage_products_spotlight',
                          destination:
                            product.href
                        }
                      )
                    }
                  >
                    <span className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-cyan-300/[0.06] blur-2xl transition duration-300 group-hover:bg-cyan-300/10" />

                    <div
                      className={`relative z-10 flex size-12 items-center justify-center rounded-2xl border text-sm font-black shadow-lg ${product.badgeClassName} ${
                        product.badge ===
                          '₿' ||
                        product.badge ===
                          '✂' ||
                        product.badge ===
                          '▦'
                          ? 'text-2xl'
                          : ''
                      }`}
                    >
                      {
                        product.badge
                      }
                    </div>

                    <span className="relative z-10 mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/65">
                      {
                        product.eyebrow
                      }
                    </span>

                    <h3 className="relative z-10 mt-2 text-lg font-semibold tracking-tight text-white">
                      {
                        product.name
                      }
                    </h3>

                    <p className="relative z-10 mt-3 text-xs leading-5 text-slate-400">
                      {
                        product.description
                      }
                    </p>

                    <div className="relative z-10 mt-auto flex items-center justify-between pt-5 text-xs font-semibold text-cyan-200">
                      <span>
                        Conhecer produto
                      </span>

                      <span className="flex size-7 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-300/10 transition duration-300 group-hover:translate-x-1 group-hover:bg-cyan-300/20">
                        →
                      </span>
                    </div>
                  </a>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function MACode() {
  const [
    mounted,
    setMounted
  ] = useState(false)

  useEffect(() => {
    setMounted(true)

    document.title =
      'Websites Profissionais desde 19€/mês | MA-Code'

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
      'https://ma-code.pt/'
    )

    updatePropertyMeta(
      'og:title',
      'Websites Profissionais desde 19€/mês | MA-Code'
    )

    updatePropertyMeta(
      'og:description',
      'Comece com um website profissional desde 19€/mês e evolua para loja online, marcações, automação, IA ou sistemas digitais à medida.'
    )

    updatePropertyMeta(
      'og:image',
      'https://ma-code.pt/ma-code.png'
    )

    updatePropertyMeta(
      'og:image:alt',
      'MA-Code - criação de websites profissionais, lojas online, automação e IA'
    )

    updateMeta(
      'twitter:card',
      'summary_large_image'
    )

    updateMeta(
      'twitter:url',
      'https://ma-code.pt/'
    )

    updateMeta(
      'twitter:title',
      'Websites Profissionais desde 19€/mês | MA-Code'
    )

    updateMeta(
      'twitter:description',
      'Websites profissionais desde 19€/mês, preparados para gerar contactos e evoluir para loja online, marcações, automação, IA e sistemas digitais.'
    )

    updateMeta(
      'twitter:image',
      'https://ma-code.pt/ma-code.png'
    )

    updateMeta(
      'twitter:image:alt',
      'MA-Code - criação de websites profissionais, lojas online, automação e IA'
    )

    updateCanonical(
      'https://ma-code.pt/'
    )

    trackEvent(
      'homepage_view',
      {
        page_name:
          'homepage',
        page_type:
          'landing_page'
      }
    )
  }, [])

  return (
    <main>
      <section className="relative overflow-hidden px-5 pb-12 pt-6 sm:px-6 md:px-10 md:pb-16 md:pt-8">
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

            <a
              href="/contacto"
              className="btn-ghost hidden text-sm sm:inline-flex sm:text-base"
              onClick={() =>
                trackEvent(
                  'cta_click',
                  {
                    cta_text:
                      'Pedir proposta gratuita',
                    cta_location:
                      'header',
                    destination:
                      '/contacto'
                  }
                )
              }
            >
              Pedir proposta gratuita
            </a>
          </header>

          <div className="hero-layout">
            <div
              className={`hero-copy ${
                mounted
                  ? 'animate-fade-in-up'
                  : 'opacity-0'
              }`}
            >
              <div className="hero-topline">
                <span className="hero-topline__dot" />

                <span>
                  Website hoje. Sistema amanhã.
                </span>
              </div>

              <h1 className="hero-title">
                Websites profissionais desde
                19€/mês para começar simples e
                crescer depois.
              </h1>

              <div className="hero-price-badge">
                Domínio + alojamento incluídos
              </div>

              <p className="hero-subtitle">
                Criamos websites e sistemas
                digitais para gerar contactos,
                vender, receber marcações ou
                automatizar processos — com uma
                base simples, clara e preparada
                para evoluir.
              </p>

              <div className="hero-actions flex-wrap">
                <a
                  href="/contacto"
                  className="btn-primary hightech-button"
                  onClick={() =>
                    trackEvent(
                      'cta_click',
                      {
                        cta_text:
                          'Pedir proposta gratuita',
                        cta_location:
                          'hero_primary',
                        destination:
                          '/contacto'
                      }
                    )
                  }
                >
                  <span className="btn-shine" />

                  <span className="relative z-10">
                    Pedir proposta gratuita
                  </span>
                </a>

                <a
                  href="/projetos"
                  className="btn-secondary hightech-button-secondary"
                  onClick={() =>
                    trackEvent(
                      'cta_click',
                      {
                        cta_text:
                          'Ver projetos reais',
                        cta_location:
                          'hero_secondary',
                        destination:
                          '/projetos'
                      }
                    )
                  }
                >
                  Ver projetos reais
                </a>

                <a
                  href="/produtos"
                  className="inline-flex items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 shadow-lg shadow-cyan-950/20 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/15 sm:text-base"
                  onClick={() =>
                    trackEvent(
                      'cta_click',
                      {
                        cta_text:
                          'Ver produtos',
                        cta_location:
                          'hero_products',
                        destination:
                          '/produtos'
                      }
                    )
                  }
                >
                  Ver produtos
                </a>
              </div>

              <p className="mt-4 max-w-xl text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70 sm:text-sm">
                Proposta gratuita · Sem
                compromisso
              </p>

              <ul
                className="hero-mini-points"
                aria-label="Pontos fortes da MA-Code"
              >
                <li>
                  Mobile-first
                </li>

                <li>
                  Performance e SEO
                </li>

                <li>
                  Pode evoluir por fases
                </li>
              </ul>

              <ServiceMarquee />
            </div>

            <div
              className={`relative hidden lg:block ${
                mounted
                  ? 'animate-fade-in-scale'
                  : 'opacity-0'
              }`}
            >
              <HeroDeviceShowcase />
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
            {pathCards.map(
              (
                card,
                index
              ) => (
                <article
                  key={
                    card.title
                  }
                  className={`service-card group relative flex h-full overflow-hidden rounded-[2rem] border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/20 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-slate-900/80 hover:shadow-cyan-950/35 md:p-6 ${
                    mounted
                      ? 'animate-fade-in-up'
                      : 'opacity-0'
                  }`}
                  style={{
                    animationDelay:
                      `${
                        index *
                        120
                      }ms`
                  }}
                >
                  <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent opacity-70" />

                  <span className="pointer-events-none absolute -right-14 -top-16 size-40 rounded-full bg-cyan-300/10 blur-3xl transition duration-500 group-hover:bg-cyan-300/20" />

                  <span className="pointer-events-none absolute -bottom-20 left-8 size-32 rounded-full bg-violet-400/10 blur-3xl transition duration-500 group-hover:bg-violet-400/15" />

                  <div className="relative z-10 flex h-full w-full flex-col">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <span className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                          {
                            card.eyebrow
                          }
                        </span>

                        <h3 className="service-card__title">
                          {
                            card.title
                          }
                        </h3>
                      </div>

                      <div className="flex shrink-0 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center shadow-inner shadow-white/5">
                        <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Opção
                        </span>

                        <strong className="mt-1 text-sm font-semibold text-cyan-100">
                          {String(
                            index +
                              1
                          ).padStart(
                            2,
                            '0'
                          )}
                        </strong>
                      </div>
                    </div>

                    <p className="service-card__description">
                      {
                        card.description
                      }
                    </p>

                    <FeatureList
                      items={
                        card.points
                      }
                      className="mt-5"
                    />

                    <div className="mt-5 flex flex-wrap gap-2">
                      {card.learnLinks.map(
                        (
                          link
                        ) => (
                          <a
                            key={
                              link.href
                            }
                            href={
                              link.href
                            }
                            className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition duration-300 hover:border-cyan-200/35 hover:bg-cyan-300/10 hover:text-cyan-50"
                            onClick={() =>
                              trackEvent(
                                'service_page_link_click',
                                {
                                  service_name:
                                    link.label,
                                  destination:
                                    link.href,
                                  section:
                                    'path_cards'
                                }
                              )
                            }
                          >
                            {
                              link.label
                            }
                          </a>
                        )
                      )}
                    </div>

                    <a
                      href={
                        card.href
                      }
                      onClick={() =>
                        trackEvent(
                          'project_path_selected',
                          {
                            project_type:
                              card.projectType,
                            project_goal:
                              card.projectGoal,
                            section:
                              'path_cards',
                            destination:
                              card.href
                          }
                        )
                      }
                      aria-label={`${card.cta}. Abre a página de contacto para pedir proposta.`}
                      className="mt-6 inline-flex w-full items-center justify-between gap-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition duration-300 group-hover:border-cyan-200/40 group-hover:bg-cyan-300/15"
                    >
                      <span>
                        {
                          card.cta
                        }
                      </span>

                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-cyan-200 text-slate-950 transition duration-300 group-hover:translate-x-1">
                        →
                      </span>
                    </a>
                  </div>
                </article>
              )
            )}
          </div>
        </div>
      </section>

      <ProductsSpotlight
        mounted={mounted}
      />

      <FeaturedProjects
        mounted={mounted}
      />

      <section className="px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="section-label">
                  Próximo passo
                </span>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Pronto para perceber o
                  melhor caminho para o seu
                  projeto?
                </h2>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                  Explique o que precisa ou o
                  problema que quer resolver.
                  A proposta é gratuita, sem
                  compromisso, e pode começar
                  por uma solução simples
                  preparada para crescer.
                </p>
              </div>

              <a
                href="/contacto"
                className="btn-primary hightech-button"
                onClick={() =>
                  trackEvent(
                    'cta_click',
                    {
                      cta_text:
                        'Pedir proposta gratuita',
                      cta_location:
                        'homepage_final_cta',
                      destination:
                        '/contacto'
                    }
                  )
                }
              >
                <span className="btn-shine" />

                <span className="relative z-10">
                  Pedir proposta gratuita
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
