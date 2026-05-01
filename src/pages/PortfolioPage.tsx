import { useEffect, useMemo, useState } from 'react'

import Portfolio from '../components/Portfolio'
import { portfolioProjects } from '../data/projects'

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

export default function PortfolioPage() {
  const [mounted, setMounted] = useState(false)

  const totalScreens = useMemo(
    () => portfolioProjects.reduce((total, project) => total + project.images.length, 0),
    []
  )

  useEffect(() => {
    setMounted(true)

    document.title =
      'Projetos Realizados | Websites, Lojas Online, PWA e Aplicações Web | MA-Code'

    updateMeta(
      'description',
      'Conheça projetos reais desenvolvidos pela MA-Code: websites profissionais, lojas online, sistemas de marcação, aplicações PWA, áreas administrativas, automação e soluções digitais à medida.'
    )

    updateMeta(
      'keywords',
      'projetos MA-Code, portefólio websites, criação de websites Portugal, lojas online, sistemas de marcação, aplicações web, PWA, automação, IA, desenvolvimento web'
    )

    updateMeta('robots', 'index, follow')
    updatePropertyMeta(
      'og:title',
      'Projetos Realizados | Websites, Lojas Online e Aplicações Web | MA-Code'
    )
    updatePropertyMeta(
      'og:description',
      'Veja exemplos reais de websites, lojas online, sistemas de marcação, PWA, áreas administrativas e soluções digitais desenvolvidas pela MA-Code.'
    )
    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:url', 'https://ma-code.pt/projetos')
    updatePropertyMeta('og:image', 'https://ma-code.pt/ma-code.png')
    updateMeta('twitter:card', 'summary_large_image')
    updateMeta(
      'twitter:title',
      'Projetos Realizados | Websites, Lojas Online e Aplicações Web | MA-Code'
    )
    updateMeta(
      'twitter:description',
      'Portefólio MA-Code com projetos reais de websites, lojas online, marcações, PWA e aplicações web.'
    )

    updateCanonical('https://ma-code.pt/projetos')
  }, [])

  return (
    <main className="site-shell">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative overflow-hidden px-5 pb-10 pt-6 sm:px-6 md:px-10 md:pb-14 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex items-center justify-between gap-4 md:mb-12">
            <a href="/" className="brand-mark" aria-label="MA-Code - Página inicial">
              <img
                src="/logo.svg"
                srcSet="/logo.svg 1x, /ma-code.png 2x"
                alt="MA-Code"
                className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16 md:h-20 md:w-20"
                loading="eager"
                decoding="async"
              />
              <span>MA-Code</span>
            </a>

            <a href="/#orcamento" className="btn-ghost text-sm sm:text-base">
              Pedir orçamento
            </a>
          </header>

          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className={`max-w-5xl ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>Portefólio MA-Code</span>
              </div>

              <h1 className="hero-title">
                Projetos reais que mostram o que a MA-Code consegue construir.
              </h1>

              <p className="hero-subtitle">
                Websites profissionais, lojas online, sistemas de marcação, aplicações PWA,
                áreas administrativas e soluções digitais criadas para resolver problemas reais
                de negócios, escolas e marcas.
              </p>

              <ul className="hero-mini-points" aria-label="Tipos de projetos desenvolvidos">
                <li>Websites profissionais</li>
                <li>Lojas online</li>
                <li>Marcações online</li>
                <li>Aplicações PWA</li>
                <li>Áreas administrativas</li>
              </ul>

              <div className="hero-actions">
                <a href="#projetos" className="btn-primary hightech-button">
                  <span className="btn-shine" />
                  <span className="relative z-10">Ver projetos</span>
                </a>

                <a href="/#orcamento" className="btn-secondary hightech-button-secondary">
                  Quero um projeto semelhante
                </a>
              </div>
            </div>

            <aside
              className={`service-card hidden lg:block ${
                mounted ? 'animate-fade-in-up' : 'opacity-0'
              }`}
              style={{ animationDelay: '120ms' }}
              aria-label="Resumo do portefólio MA-Code"
            >
              <div className="service-card__line" />

              <div className="relative z-10">
                <span className="mb-4 inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
                  Prova de trabalho
                </span>

                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  Não é só design. São sistemas funcionais.
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Cada projeto abaixo mostra uma combinação de design, estrutura técnica,
                  experiência mobile, funcionalidades reais e publicação online.
                </p>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <strong className="block text-2xl font-semibold text-white">
                      {portfolioProjects.length}
                    </strong>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">
                      projetos em destaque
                    </span>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <strong className="block text-2xl font-semibold text-white">
                      {totalScreens}+
                    </strong>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">
                      ecrãs demonstrados
                    </span>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <strong className="block text-2xl font-semibold text-white">100%</strong>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">
                      focado em mobile
                    </span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4 text-sm leading-6 text-cyan-50">
                  Ideal para clientes que querem perceber, antes de pedir orçamento, que tipo
                  de solução pode ser criada para o seu negócio.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Portfolio mounted={mounted} />
    </main>
  )
}
