import { useEffect, useState } from 'react'
import { portfolioProjects } from '../data/projects'

const marqueeItems = [
  'Websites Profissionais',
  'Lojas Online',
  'Sistemas à Medida',
  'Otimização SEO',
  'Manutenção e Suporte',
  'Automação e IA',
  'Integrações API',
  'Apps PWA',
  'Domínio + Alojamento',
  'Marcações Online',
  'Áreas Administrativas',
  'Performance e SEO'
]

const marqueeLoopItems = [
  ...marqueeItems,
  ...marqueeItems,
  ...marqueeItems
]

const serviceCards = [
  {
    key: 'website' as const,
    title: 'Website Profissional',
    description:
      'Transmita confiança e credibilidade com um website moderno, claro e otimizado.',
    href: '/criacao-websites'
  },
  {
    key: 'booking' as const,
    title: 'Vendas / Marcações',
    description:
      'Simplifique vendas, reservas e marcações com uma experiência pensada para o seu negócio.',
    href: '/sistemas-marcacao'
  },
  {
    key: 'system' as const,
    title: 'Sistema à Medida',
    description:
      'Automatize processos e centralize informação com uma solução personalizada.',
    href: '/automacao-ia'
  }
]

const featuredProducts = [
  {
    name: 'MA PDF',
    eyebrow: 'Ferramentas PDF',
    description:
      'Junte, divida, comprima, converta, edite e assine documentos PDF.',
    href: '/produtos/mapdf',
    icon: 'pdf' as const,
    accentClassName:
      'border-red-400/30 bg-red-500/[0.15] text-red-100 shadow-[0_12px_34px_rgba(239,68,68,0.16)]'
  },
  {
    name: 'MA-Professor',
    eyebrow: 'Gestão escolar',
    description:
      'Uma plataforma concebida para apoiar o trabalho diário de professores.',
    href: '/produtos/ma-professor',
    icon: 'professor' as const,
    accentClassName:
      'border-emerald-400/30 bg-emerald-500/[0.15] text-emerald-100 shadow-[0_12px_34px_rgba(34,197,94,0.16)]'
  },
  {
    name: 'MA-Quadro',
    eyebrow: 'Editor visual',
    description:
      'Crie conteúdos e designs diretamente no dispositivo, de forma simples e visual.',
    href: '/produtos/ma-quadro',
    icon: 'quadro' as const,
    accentClassName:
      'border-amber-400/30 bg-amber-500/[0.15] text-amber-100 shadow-[0_12px_34px_rgba(245,158,11,0.16)]'
  },
  {
    name: 'MA-Recortes',
    eyebrow: 'Imagem e stickers',
    description:
      'Remova fundos, ajuste recortes e exporte imagens em PNG transparente.',
    href: '/produtos/ma-recortes',
    icon: 'recortes' as const,
    accentClassName:
      'border-sky-400/30 bg-sky-500/[0.15] text-sky-100 shadow-[0_12px_34px_rgba(14,165,233,0.16)]'
  }
]

type AnalyticsParameters = Record<
  string,
  string | number | boolean | undefined
>

type AnalyticsWindow = Window & {
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

const attributionStorageKey = 'ma_code_attribution'

function TechAccentStyles() {
  return (
    <style>{`
.ma-tech-accent {
  background-image:
    linear-gradient(
      110deg,
      transparent 0%,
      transparent 42%,
      rgba(186, 230, 253, 0.12) 46%,
      rgba(240, 249, 255, 0.96) 50%,
      rgba(165, 243, 252, 0.44) 54%,
      transparent 58%,
      transparent 100%
    ),
    linear-gradient(
      90deg,
      #a5f3fc 0%,
      #7dd3fc 34%,
      #818cf8 67%,
      #c4b5fd 100%
    );
  background-size:
    250% 100%,
    100% 100%;
  background-position:
    -220% 50%,
    0% 50%;
  background-repeat: no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  text-shadow:
    0 0 9px rgba(103, 232, 249, 0.11),
    0 0 18px rgba(139, 92, 246, 0.055);
  animation: ma-tech-accent-sweep 10s linear infinite;
  will-change: background-position;
}

.ma-tech-accent--hero {
  animation-duration: 8.8s;
  text-shadow:
    0 0 11px rgba(103, 232, 249, 0.14),
    0 0 22px rgba(139, 92, 246, 0.07);
}

.ma-tech-accent--phase-1 {
  animation-delay: -2s;
}

.ma-tech-accent--phase-2 {
  animation-delay: -4s;
}

.ma-tech-accent--phase-3 {
  animation-delay: -6s;
}

.ma-tech-accent--phase-4 {
  animation-delay: -8s;
}

.ma-tech-price {
  text-shadow:
    0 0 10px rgba(103, 232, 249, 0.18),
    0 0 22px rgba(34, 211, 238, 0.08);
}

@keyframes ma-tech-accent-sweep {
  0%,
  72% {
    background-position:
      -220% 50%,
      0% 50%;
  }

  86% {
    background-position:
      220% 50%,
      0% 50%;
  }

  100% {
    background-position:
      220% 50%,
      0% 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ma-tech-accent {
    animation: none;
    background-position:
      -220% 50%,
      0% 50%;
  }
}
    `}</style>
  )
}

function updateMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`
  )

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updatePropertyMeta(
  property: string,
  content: string
) {
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
  let canonical =
    document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )

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
    return new URL(referrer).hostname.replace(
      /^www\./,
      ''
    )
  } catch {
    return 'referral'
  }
}

function getTrafficAttribution(): AttributionData {
  if (typeof window === 'undefined') {
    return {}
  }

  const searchParams = new URLSearchParams(
    window.location.search
  )

  const hasCampaignParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content'
  ].some((param) => searchParams.has(param))

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
        searchParams.get('utm_source') ||
        getReferrerSource(document.referrer),
      traffic_medium:
        searchParams.get('utm_medium') ||
        (document.referrer
          ? 'referral'
          : 'direct'),
      traffic_campaign:
        searchParams.get('utm_campaign') ||
        undefined,
      traffic_term:
        searchParams.get('utm_term') ||
        undefined,
      traffic_content:
        searchParams.get('utm_content') ||
        undefined,
      traffic_referrer:
        document.referrer || undefined,
      landing_page:
        window.location.href
    }
  }

  const attribution = {
    traffic_source:
      searchParams.get('utm_source') ||
      getReferrerSource(document.referrer),
    traffic_medium:
      searchParams.get('utm_medium') ||
      (document.referrer
        ? 'referral'
        : 'direct'),
    traffic_campaign:
      searchParams.get('utm_campaign') ||
      undefined,
    traffic_term:
      searchParams.get('utm_term') ||
      undefined,
    traffic_content:
      searchParams.get('utm_content') ||
      undefined,
    traffic_referrer:
      document.referrer || undefined,
    landing_page:
      window.location.href
  }

  try {
    window.sessionStorage.setItem(
      attributionStorageKey,
      JSON.stringify(attribution)
    )
  } catch {
    return attribution
  }

  return attribution
}

function trackEvent(
  eventName: string,
  parameters: AnalyticsParameters = {}
) {
  if (typeof window === 'undefined') {
    return
  }

  const analyticsWindow =
    window as AnalyticsWindow

  const eventParameters = {
    event_category: 'ma_code_homepage',
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
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
.ma-service-marquee {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  border-top: 1px solid rgba(103, 232, 249, 0.12);
  border-bottom: 1px solid rgba(103, 232, 249, 0.12);
  padding: 0.9rem 0;
  background: linear-gradient(180deg, rgba(4, 7, 13, 0.98), rgba(7, 10, 18, 0.98));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
  isolation: isolate;
}

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
  background: linear-gradient(90deg, rgba(4, 7, 13, 1), transparent);
}

.ma-service-marquee::after {
  right: 0;
  background: linear-gradient(270deg, rgba(4, 7, 13, 1), transparent);
}

.ma-service-marquee__track {
  display: flex;
  align-items: center;
  gap: 2rem;
  width: max-content;
  min-width: max-content;
  white-space: nowrap;
  will-change: transform;
  animation: ma-service-marquee-scroll 28s linear infinite;
  -webkit-animation: ma-service-marquee-scroll 28s linear infinite;
}

.ma-service-marquee__item {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  flex: 0 0 auto;
  color: #e2e8f0;
  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1;
  white-space: nowrap;
}

.ma-service-marquee__item::before {
  content: '✦';
  color: #67e8f9;
  font-size: 0.72rem;
  filter: drop-shadow(0 0 8px rgba(103, 232, 249, 0.5));
}

@keyframes ma-service-marquee-scroll {
  from {
    transform: translate3d(0, 0, 0);
  }

  to {
    transform: translate3d(-33.333333%, 0, 0);
  }
}

@-webkit-keyframes ma-service-marquee-scroll {
  from {
    -webkit-transform: translate3d(0, 0, 0);
  }

  to {
    -webkit-transform: translate3d(-33.333333%, 0, 0);
  }
}

@media (max-width: 768px) {
  .ma-service-marquee {
    padding: 0.78rem 0;
  }

  .ma-service-marquee__track {
    gap: 1.35rem;
    animation-duration: 20s;
    -webkit-animation-duration: 20s;
  }

  .ma-service-marquee__item {
    font-size: 0.66rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ma-service-marquee__track {
    animation-duration: 55s;
    -webkit-animation-duration: 55s;
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

function ServiceIcon({
  type
}: {
  type:
    | 'website'
    | 'booking'
    | 'system'
}) {
  if (type === 'website') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle
          cx="12"
          cy="12"
          r="8.2"
        />
        <path d="M3.8 12h16.4" />
        <path d="M12 3.8c2.3 2.5 3.5 5.3 3.5 8.2S14.3 17.7 12 20.2c-2.3-2.5-3.5-5.3-3.5-8.2S9.7 6.3 12 3.8Z" />
      </svg>
    )
  }

  if (type === 'booking') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect
          x="4.2"
          y="5.3"
          width="15.6"
          height="14.5"
          rx="2.4"
        />
        <path d="M8 3.8v3.4M16 3.8v3.4M4.2 9.2h15.6" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M8 8 4.5 12 8 16M16 8l3.5 4-3.5 4M13.5 6.8 10.5 17.2" />
    </svg>
  )
}

function ProductIcon({
  type
}: {
  type:
    | 'pdf'
    | 'professor'
    | 'quadro'
    | 'recortes'
}) {
  if (type === 'pdf') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M8 3.8h6.2l3.8 3.8v10.6A2.1 2.1 0 0 1 15.9 20H8a2.1 2.1 0 0 1-2.1-2.1V5.9A2.1 2.1 0 0 1 8 3.8Z" />
        <path d="M14.2 3.8V8H18M8.5 15.2h7M8.5 12.2h7" />
      </svg>
    )
  }

  if (type === 'professor') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M3.8 9.2 12 5l8.2 4.2L12 13.4 3.8 9.2Z" />
        <path d="M6.5 10.7v4.2c0 1.7 2.6 3.1 5.5 3.1s5.5-1.4 5.5-3.1v-4.2" />
      </svg>
    )
  }

  if (type === 'quadro') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect
          x="4.5"
          y="4.5"
          width="6.2"
          height="6.2"
          rx="1.4"
        />
        <rect
          x="13.3"
          y="4.5"
          width="6.2"
          height="6.2"
          rx="1.4"
        />
        <rect
          x="4.5"
          y="13.3"
          width="6.2"
          height="6.2"
          rx="1.4"
        />
        <rect
          x="13.3"
          y="13.3"
          width="6.2"
          height="6.2"
          rx="1.4"
        />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7.2 6.2v11.6M16.8 6.2v11.6M6.2 7.2h11.6M6.2 16.8h11.6" />
      <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
    </svg>
  )
}

function HeroDevices() {
  return (
    <div
      className="relative min-h-[430px]"
      aria-hidden="true"
    >
      <div className="absolute -inset-12 bg-[radial-gradient(circle_at_62%_42%,rgba(34,211,238,0.15),transparent_30%),radial-gradient(circle_at_70%_65%,rgba(139,92,246,0.14),transparent_34%)] blur-3xl" />

      <img
        src="/ma-code-hero-devices.png"
        alt=""
        width={1200}
        height={800}
        className="relative z-10 mx-auto h-auto w-full max-w-none scale-[1.05] object-contain drop-shadow-[0_32px_70px_rgba(2,132,199,0.18)]"
        loading="eager"
        decoding="async"
      />
    </div>
  )
}

function MobileHeroDevices() {
  return (
    <div
      className="relative z-0 min-w-0 translate-y-1 self-center lg:hidden sm:translate-y-2"
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute -inset-6 bg-[radial-gradient(circle_at_62%_42%,rgba(34,211,238,0.13),transparent_32%),radial-gradient(circle_at_70%_65%,rgba(139,92,246,0.11),transparent_36%)] blur-3xl" />

      <img
        src="/ma-code-hero-devices.png"
        alt=""
        width={1200}
        height={800}
        className="relative z-10 ml-auto h-auto w-full max-w-none origin-right scale-[1.12] object-contain drop-shadow-[0_18px_40px_rgba(2,132,199,0.14)]"
        loading="eager"
        decoding="async"
      />
    </div>
  )
}

function ProjectsShowcase({
  mounted
}: {
  mounted: boolean
}) {
  const featuredProjects =
    portfolioProjects.slice(0, 3)

  return (
    <section
      id="projetos"
      className="bg-[#05070d] px-5 py-14 sm:px-6 md:px-10 md:py-16"
    >
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
            Projetos que{' '}
            <span className="ma-tech-accent ma-tech-accent--phase-3">
              geram resultados
            </span>
          </h2>

          <p className="mt-3 text-sm text-slate-400 md:text-base">
            Uma amostra de projetos reais
            desenvolvidos pela MA-Code.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featuredProjects.map(
            (project, index) => {
              const featuredImage =
                project.images[0]

              return (
                <a
                  key={project.slug}
                  href="/projetos"
                  className={`group overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#0a0d14] shadow-[0_20px_50px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25 ${
                    mounted
                      ? 'animate-fade-in-up'
                      : 'opacity-0'
                  }`}
                  style={{
                    animationDelay:
                      `${index * 100}ms`
                  }}
                  onClick={() =>
                    trackEvent(
                      'project_click',
                      {
                        project_name:
                          project.title,
                        cta_location:
                          'homepage_projects',
                        destination:
                          '/projetos'
                      }
                    )
                  }
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-950">
                    {featuredImage ? (
                      <img
                        src={
                          featuredImage.src
                        }
                        alt={
                          featuredImage.alt
                        }
                        className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.035]"
                        loading="lazy"
                        decoding="async"
                        onError={(
                          event
                        ) => {
                          event.currentTarget.style.display =
                            'none'
                        }}
                      />
                    ) : null}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.55] via-transparent to-transparent" />
                  </div>

                  <div className="flex items-center justify-between gap-3 px-4 py-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white">
                        {project.title}
                      </h3>

                      <p className="mt-1 truncate text-[0.7rem] text-slate-500">
                        {project.category}
                      </p>
                    </div>

                    <span className="shrink-0 text-xs font-semibold text-cyan-200">
                      Ver projeto →
                    </span>
                  </div>
                </a>
              )
            }
          )}

          <a
            href="/projetos"
            className={`group relative flex min-h-[245px] flex-col justify-between overflow-hidden rounded-[1.45rem] border border-cyan-300/[0.16] bg-[linear-gradient(145deg,rgba(8,47,73,0.28),rgba(15,23,42,0.84)_52%,rgba(76,29,149,0.18))] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-cyan-200/30 ${
              mounted
                ? 'animate-fade-in-up'
                : 'opacity-0'
            }`}
            style={{
              animationDelay: '300ms'
            }}
            onClick={() =>
              trackEvent(
                'cta_click',
                {
                  cta_text:
                    'Ver portefólio completo',
                  cta_location:
                    'homepage_projects',
                  destination:
                    '/projetos'
                }
              )
            }
          >
            <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-14 left-8 size-36 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative z-10">
              <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-cyan-100">
                Portefólio
              </span>

              <h3 className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-white">
                Veja mais trabalho real.
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Explore projetos,
                desafios e soluções já
                desenvolvidas pela
                MA-Code.
              </p>
            </div>

            <span className="relative z-10 mt-8 text-sm font-semibold text-cyan-200">
              Ver portefólio completo →
            </span>
          </a>
        </div>
      </div>
    </section>
  )
}

export default function MACode() {
  const [mounted, setMounted] =
    useState(false)

  useEffect(() => {
    setMounted(true)

    document.title =
      'Websites Profissionais desde 19€/mês | MA-Code'

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
    <main className="bg-[#05070d]">
      <TechAccentStyles />

      <section className="relative overflow-hidden px-5 pb-8 pt-6 sm:px-6 md:px-10 md:pb-10 md:pt-8">
        <div className="pointer-events-none absolute left-[-12rem] top-[-10rem] size-[28rem] rounded-full bg-cyan-400/[0.05] blur-3xl" />
        <div className="pointer-events-none absolute right-[-10rem] top-[-8rem] size-[32rem] rounded-full bg-violet-500/[0.06] blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <header className="mb-8 flex items-center justify-between gap-4 md:mb-10">
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
              className="hidden rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-slate-100 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.055] sm:inline-flex"
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

          <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(500px,1.05fr)] xl:gap-10">
            <div
              className={
                mounted
                  ? 'relative z-10 animate-fade-in-up'
                  : 'relative z-10 opacity-0'
              }
            >
              <span className="inline-flex rounded-full border border-cyan-300/[0.22] bg-cyan-300/[0.07] px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                MA-CODE
              </span>

              <div
                className="mt-5 grid items-center gap-1 lg:block"
                style={{
                  gridTemplateColumns:
                    'minmax(0, 1fr) clamp(6rem, 34vw, 14rem)'
                }}
              >
                <h1 className="relative z-10 max-w-none text-[clamp(2.15rem,10.8vw,2.7rem)] font-semibold leading-[0.96] tracking-[-0.062em] text-white lg:max-w-[13.8ch] lg:text-[clamp(2.7rem,5.7vw,5.15rem)] xl:max-w-[14.2ch]">
                  Websites e sistemas à
                  medida que fazem{' '}

                  <span className="ma-tech-accent ma-tech-accent--hero">
                    a diferença.
                  </span>
                </h1>

                <MobileHeroDevices />
              </div>

              <p className="mt-6 max-w-2xl text-[1rem] leading-8 text-slate-300 md:text-[1.12rem]">
                Desenvolvemos websites
                profissionais, lojas online
                e sistemas personalizados
                para automatizar e fazer
                crescer o seu negócio —{' '}

                <span className="ma-tech-price font-semibold text-cyan-200">
                  desde 19€/mês.
                </span>
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="/contacto"
                  className="inline-flex min-h-[3.65rem] shrink-0 items-center justify-center rounded-2xl border border-cyan-300/[0.28] bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-500 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_42px_rgba(14,165,233,0.20)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(14,165,233,0.26)]"
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
                  <span className="flex flex-col items-center leading-tight">
                    <span className="whitespace-nowrap">
                      Pedir proposta gratuita
                    </span>

                    <span className="mt-1 whitespace-nowrap text-[0.66rem] font-medium text-cyan-50/80">
                      Sem compromisso
                    </span>
                  </span>
                </a>

                <a
                  href="/projetos"
                  className="inline-flex min-h-[3.65rem] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-3.5 text-sm font-semibold text-slate-100 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/[0.24] hover:bg-white/[0.045]"
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
                  <span className="flex flex-col leading-tight">
                    <span>
                      Ver projetos reais
                    </span>

                    <span className="mt-1 text-[0.66rem] font-medium text-slate-500">
                      Trabalho publicado
                    </span>
                  </span>
                </a>

                <a
                  href="/produtos"
                  className="inline-flex min-h-[3.65rem] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-3.5 text-sm font-semibold text-slate-100 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/[0.24] hover:bg-white/[0.045]"
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
                  <span className="flex flex-col leading-tight">
                    <span>
                      Ver produtos
                    </span>

                    <span className="mt-1 text-[0.66rem] font-medium text-slate-500">
                      Ferramentas MA-Code
                    </span>
                  </span>
                </a>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-400 sm:text-sm">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-cyan-300" />
                  <span>
                    Domínio + Alojamento
                    incluídos
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-cyan-300" />

                  <span>
                    Mobile-first
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-cyan-300" />

                  <span>
                    Proposta gratuita
                  </span>
                </div>
              </div>
            </div>

            <div
              className={
                mounted
                  ? 'hidden animate-fade-in-scale lg:block'
                  : 'hidden opacity-0 lg:block'
              }
            >
              <HeroDevices />
            </div>
          </div>
        </div>
      </section>

      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <ServiceMarquee />
      </div>

      <section className="bg-[#05070d] px-5 py-14 sm:px-6 md:px-10 md:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
              Escolha o{' '}

              <span className="ma-tech-accent ma-tech-accent--phase-1">
                caminho certo
              </span>{' '}

              para o seu negócio
            </h2>

            <p className="mt-3 text-sm text-slate-400 md:text-base">
              Soluções completas,
              pensadas para os seus
              objetivos.
            </p>
          </div>

          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {serviceCards.map(
              (card, index) => (
                <a
                  key={card.title}
                  href={card.href}
                  className={`group relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,15,23,0.98),rgba(7,10,16,0.98))] px-6 py-7 text-center shadow-[0_22px_55px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/[0.24] ${
                    mounted
                      ? 'animate-fade-in-up'
                      : 'opacity-0'
                  }`}
                  style={{
                    animationDelay:
                      `${index * 110}ms`
                  }}
                  onClick={() =>
                    trackEvent(
                      'service_page_link_click',
                      {
                        service_name:
                          card.title,
                        destination:
                          card.href,
                        section:
                          'homepage_service_cards'
                      }
                    )
                  }
                >
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/[0.35] to-transparent" />
                  <div className="pointer-events-none absolute -right-14 -top-14 size-32 rounded-full bg-cyan-300/[0.05] blur-3xl" />

                  <div className="relative z-10 flex flex-col items-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl border border-cyan-300/[0.18] bg-gradient-to-br from-cyan-400/[0.12] to-violet-500/[0.12] text-cyan-100 shadow-[0_10px_30px_rgba(34,211,238,0.10)]">
                      <ServiceIcon
                        type={card.key}
                      />
                    </div>

                    <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-white">
                      {card.title}
                    </h3>

                    <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
                      {card.description}
                    </p>

                    <span className="mt-5 text-sm font-semibold text-cyan-200">
                      Saber mais →
                    </span>
                  </div>
                </a>
              )
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-cyan-300/10 bg-[radial-gradient(circle_at_10%_35%,rgba(34,211,238,0.10),transparent_25%),radial-gradient(circle_at_88%_72%,rgba(139,92,246,0.11),transparent_27%),linear-gradient(180deg,#080a13_0%,#090b16_100%)] px-5 py-12 sm:px-6 md:px-10 md:py-14">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.78fr_1.6fr] lg:items-center lg:gap-10">
          <div className="text-center lg:text-left">
            <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              Produtos próprios
            </span>

            <h2 className="mx-auto mt-5 max-w-[18ch] text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-white md:max-w-[16ch] md:text-4xl lg:mx-0">
              Ferramentas{' '}

              <span className="whitespace-nowrap">
                MA-Code
              </span>{' '}

              que{' '}

              <span className="ma-tech-accent ma-tech-accent--phase-2">
                impulsionam
              </span>{' '}

              o seu dia a dia
            </h2>

            <p className="mx-auto mt-5 max-w-lg text-center text-sm leading-7 text-slate-300 md:text-base lg:mx-0 lg:max-w-md lg:text-left">
              Além de serviços à
              medida, desenvolvemos
              produtos próprios para
              resolver tarefas
              concretas de forma
              simples e eficaz.
            </p>

            <a
              href="/produtos"
              className="mt-7 inline-flex items-center gap-2 rounded-2xl border border-cyan-300/[0.24] bg-cyan-300/[0.07] px-5 py-3 text-sm font-semibold text-cyan-50 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/[0.36] hover:bg-cyan-300/[0.11]"
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
              Explorar todos os
              produtos
              <span>→</span>
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featuredProducts.map(
              (product, index) => (
                <a
                  key={product.name}
                  href={product.href}
                  className={`group relative flex min-h-[245px] flex-col overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#0a0d14]/95 p-5 shadow-[0_18px_44px_rgba(0,0,0,0.25)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/[0.22] ${
                    mounted
                      ? 'animate-fade-in-up'
                      : 'opacity-0'
                  }`}
                  style={{
                    animationDelay:
                      `${index * 100}ms`
                  }}
                  onClick={() =>
                    trackEvent(
                      'product_click',
                      {
                        product_name:
                          product.name,
                        cta_location:
                          'homepage_products',
                        destination:
                          product.href
                      }
                    )
                  }
                >
                  <div
                    className={`relative z-10 flex size-14 items-center justify-center rounded-2xl border ${product.accentClassName}`}
                  >
                    <ProductIcon
                      type={product.icon}
                    />
                  </div>

                  <span className="relative z-10 mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    {product.eyebrow}
                  </span>

                  <h3 className="relative z-10 mt-2 text-lg font-semibold tracking-[-0.025em] text-white">
                    {product.name}
                  </h3>

                  <p className="relative z-10 mt-3 text-xs leading-5 text-slate-400">
                    {product.description}
                  </p>

                  <span className="relative z-10 mt-auto pt-5 text-xs font-semibold text-cyan-200">
                    Saber mais →
                  </span>
                </a>
              )
            )}
          </div>
        </div>
      </section>

      <ProjectsShowcase
        mounted={mounted}
      />

      <section className="bg-[#05070d] px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-[1.7rem] border border-cyan-300/[0.15] bg-[linear-gradient(110deg,rgba(8,47,73,0.22),rgba(10,13,22,0.98)_45%,rgba(76,29,149,0.14))] px-6 py-6 shadow-[0_22px_60px_rgba(0,0,0,0.28)] md:px-8 md:py-7">
            <div className="pointer-events-none absolute -left-10 -top-14 size-36 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-12 -bottom-16 size-40 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500 text-slate-950 shadow-[0_14px_36px_rgba(14,165,233,0.25)]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" />
                  </svg>
                </div>

                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.035em] text-white md:text-3xl">
                    Pronto para dar
                    o{' '}

                    <span className="ma-tech-accent ma-tech-accent--phase-4">
                      próximo passo?
                    </span>
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-300 md:text-base">
                    Fale connosco e
                    receba uma
                    proposta gratuita
                    e sem compromisso.
                  </p>
                </div>
              </div>

              <a
                href="/contacto"
                className="inline-flex min-h-[3.55rem] items-center justify-center rounded-2xl border border-cyan-300/[0.28] bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_16px_42px_rgba(14,165,233,0.20)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(14,165,233,0.26)]"
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
                Pedir proposta
                gratuita →
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
