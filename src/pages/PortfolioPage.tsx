import { useEffect, useState } from 'react'
import Portfolio from '../components/Portfolio'

function updateMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
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

  useEffect(() => {
    setMounted(true)

    document.title = 'Projetos Realizados | Websites, Lojas Online e Aplicações Web | MA-Code'
    updateMeta(
      'description',
      'Conheça projetos realizados pela MA-Code: websites profissionais, lojas online, sistemas de marcação, aplicações web, PWA, automação e soluções digitais à medida.'
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

          <div className={`max-w-4xl ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="hero-topline">
              <span className="hero-topline__dot" />
              <span>Portefólio MA-Code</span>
            </div>

            <h1 className="hero-title">
              Projetos reais de websites, lojas online e aplicações web.
            </h1>

            <p className="hero-subtitle">
              Conheça alguns projetos desenvolvidos pela MA-Code, desde websites com marcação
              online até lojas online, aplicações PWA, áreas administrativas e integrações digitais.
            </p>

            <div className="hero-actions">
              <a href="/#orcamento" className="btn-primary hightech-button">
                <span className="btn-shine" />
                <span className="relative z-10">Pedir orçamento</span>
              </a>

              <a href="/" className="btn-secondary hightech-button-secondary">
                Voltar à página inicial
              </a>
            </div>
          </div>
        </div>
      </section>

      <Portfolio mounted={mounted} />
    </main>
  )
}
