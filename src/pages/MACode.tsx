import { useEffect, useState, type FormEvent } from 'react'
import FeaturedProjects from '../components/FeaturedProjects'

const marqueeItems = [
  'Websites Profissionais',
  'Lojas Online',
  'Aplicações Web',
  'Sistemas de Marcação',
  'IA e Automação',
  'Integrações API',
  'CRM e Gestão',
  'Bases de Dados',
  'Blockchain EVM',
  'Performance e Otimização'
]

const marqueeLoopItems = [...marqueeItems, ...marqueeItems, ...marqueeItems]

const serviceCards = [
  {
    title: 'Websites Profissionais',
    description: 'Sites rápidos, modernos e preparados para gerar contactos.'
  },
  {
    title: 'Lojas Online',
    description: 'E-commerce com catálogo, carrinho, checkout e estrutura preparada para vender.'
  },
  {
    title: 'Sistemas de Marcação',
    description: 'Marcações online para salões, clínicas, serviços locais e negócios com agenda.'
  },
  {
    title: 'Aplicações Web',
    description: 'Ferramentas personalizadas para organizar processos e poupar tempo.'
  },
  {
    title: 'IA e Automação',
    description: 'Automação, integrações e IA para reduzir tarefas repetitivas.'
  },
  {
    title: 'Blockchain e EVM',
    description: 'Tokens, integrações EVM e funcionalidades digitais ligadas a smart contracts.'
  }
]

const processSteps = [
  {
    title: '1. Diagnóstico',
    description: 'Percebemos o objetivo, o negócio e o tipo de solução necessária.'
  },
  {
    title: '2. Estrutura',
    description: 'Organizamos páginas, conteúdo, funcionalidades e percurso do utilizador.'
  },
  {
    title: '3. Desenvolvimento',
    description: 'Criamos o site, loja ou sistema com foco em performance, mobile e clareza.'
  },
  {
    title: '4. Publicação',
    description: 'Colocamos tudo online e deixamos a base preparada para funcionar.'
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

function updateCanonical(href: string) {
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }

  canonical.href = href
}

export default function MACode() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [isSending, setIsSending] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    document.title = 'Criação de Websites, Lojas Online, Automação e IA | MA-Code'
    updateMeta(
      'description',
      'Criação de websites profissionais, lojas online, sistemas de marcação, aplicações web, automação, IA e soluções blockchain EVM para negócios em Portugal.'
    )
    updateCanonical('https://ma-code.pt/')
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSending(true)
    setSuccessMessage('')
    setErrorMessage('')

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
          message: form.message
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erro ao enviar pedido')
      }

      setSuccessMessage('Pedido enviado com sucesso. Entraremos em contacto em breve.')
      setForm({
        name: '',
        email: '',
        message: ''
      })
    } catch {
      setErrorMessage('Não foi possível enviar o pedido. Tente novamente.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="site-shell">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative overflow-hidden px-5 pb-14 pt-6 sm:px-6 md:px-10 md:pb-20 md:pt-8">
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

            <a href="#orcamento" className="btn-ghost text-sm sm:text-base">
              Pedir orçamento
            </a>
          </header>

          <div className="hero-layout">
            <div className={`hero-copy ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>Websites • Lojas Online • Apps • IA • Automação</span>
              </div>

              <h1 className="hero-title">
                Criamos websites, lojas online e sistemas digitais para negócios que querem vender
                melhor.
              </h1>

              <div className="hero-price-badge">Projetos desde 19€/mês</div>

              <p className="hero-subtitle">
                Sites modernos, rápidos e adaptados a telemóvel, com possibilidade de loja online,
                marcações, automação, IA e integrações avançadas.
              </p>

              <div className="hero-actions">
                <a href="#orcamento" className="btn-primary hightech-button">
                  <span className="btn-shine" />
                  <span className="relative z-10">Pedir orçamento</span>
                </a>

                <a href="/projetos" className="btn-secondary hightech-button-secondary">
                  Ver projetos
                </a>
              </div>

              <ul className="hero-mini-points" aria-label="Pontos fortes da MA-Code">
                <li>Desde 19€/mês</li>
                <li>Mobile-first</li>
                <li>Foco em contactos</li>
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
                  <span className="hero-panel__label">MA-Code Interface</span>
                </div>

                <div className="hero-panel__content">
                  <div className="hud-card">
                    <span className="hud-card__label">Websites</span>
                    <strong>Rápidos e profissionais</strong>
                  </div>

                  <div className="hud-card">
                    <span className="hud-card__label">Objetivo</span>
                    <strong>Mais contactos</strong>
                  </div>

                  <div className="hud-card hud-card--wide">
                    <span className="hud-card__label">Soluções</span>
                    <strong>Marcações, lojas online, automação, IA e integração de sistemas</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-marquee" aria-label="Serviços e soluções da MA-Code">
            <span className="sr-only">{marqueeItems.join(', ')}</span>

            <div className="hero-marquee__track" aria-hidden="true">
              {marqueeLoopItems.map((item, index) => (
                <span key={`${item}-${index}`} className="hero-marquee__item">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="servicos" className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 section-label-wrap">
            <span className="section-label">Serviços</span>
          </div>

          <div className="mb-8 max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              O que podemos criar
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
              Do site simples ao sistema digital completo, criamos soluções ajustadas ao objetivo do
              negócio.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {serviceCards.map((card, index) => (
              <article
                key={card.title}
                className={`service-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="service-card__line" />
                <div className="service-card__index">{String(index + 1).padStart(2, '0')}</div>
                <h3 className="service-card__title">{card.title}</h3>
                <p className="service-card__description">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FeaturedProjects mounted={mounted} />

      <section className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 section-label-wrap">
            <span className="section-label">Processo</span>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {processSteps.map((step, index) => (
              <article
                key={step.title}
                className={`service-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="service-card__line" />
                <h2 className="service-card__title">{step.title}</h2>
                <p className="service-card__description">{step.description}</p>
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
              <h2 className="contact-side-panel__title">Pedir Orçamento</h2>
              <p className="contact-side-panel__text">
                Diga-nos o que pretende criar e respondemos com uma proposta ajustada ao projeto.
              </p>

              <div className="contact-metrics">
                <div className="metric-card">
                  <span className="metric-card__label">Projetos</span>
                  <strong>Desde 19€/mês</strong>
                </div>
                <div className="metric-card">
                  <span className="metric-card__label">Foco</span>
                  <strong>Contactos</strong>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm leading-7 text-slate-300">
                <p>Indique, se possível:</p>
                <ul className="space-y-2 text-slate-200/90">
                  <li>• Que tipo de projeto pretende</li>
                  <li>• Se já tem site ou quer começar do zero</li>
                  <li>• Se precisa de loja, marcações, automação, IA ou blockchain</li>
                  <li>• Qual é o principal objetivo do projeto</li>
                </ul>
              </div>
            </div>

            <div className="form-shell">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="input-label">
                    Nome
                  </label>
                  <input
                    id="name"
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
                    type="email"
                    className="input-field"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="input-label">
                    Descreva o projeto
                  </label>
                  <textarea
                    id="message"
                    rows={6}
                    className="input-field input-textarea"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
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
                    {isSending ? 'A enviar...' : 'Pedir orçamento'}
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
