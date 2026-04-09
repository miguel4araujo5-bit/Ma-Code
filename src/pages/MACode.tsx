import { useEffect, useState, type FormEvent } from 'react'

const techPills = [
  'Web Design',
  'Web Apps',
  'Automação',
  'IA',
  'E-commerce',
  'Cloud',
  'APIs',
  'Performance'
]

const serviceCards = [
  {
    title: 'Websites Profissionais',
    description: 'Websites rápidos, modernos e otimizados para telemóvel.'
  },
  {
    title: 'Sistemas de Marcação',
    description: 'Sistemas de reservas online para salões, clínicas e serviços.'
  },
  {
    title: 'Aplicações Web',
    description: 'Plataformas personalizadas para automatizar o seu negócio.'
  }
]

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

      <section className="relative overflow-hidden px-6 pb-16 pt-8 md:px-10 md:pb-24 md:pt-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-10 flex items-center justify-between">
            <a href="/" className="brand-mark" aria-label="MA-Code - Página inicial">
              <img
                src="/logo.svg"
                alt="MA-Code"
                className="h-8 w-8 shrink-0 object-contain"
                loading="eager"
                decoding="async"
              />
              <span>MA-Code</span>
            </a>

            <a href="#orcamento" className="btn-ghost hidden md:inline-flex">
              Pedir orçamento
            </a>
          </header>

          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className={`space-y-8 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="inline-flex">
                <div className="tech-badge">
                  <span className="tech-badge__pulse" />
                  <span>Websites • IA • Automação</span>
                </div>
              </div>

              <div className="space-y-5">
                <h1 className="hero-title">
                  Criamos websites e aplicações modernas para empresas que querem uma presença digital
                  profissional e eficiente. <span className="hero-price">(A partir de 19€/mês)</span>
                </h1>

                <p className="hero-subtitle">
                  Presença digital moderna, visual premium e uma experiência mais impactante desde o
                  primeiro segundo.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <a href="#orcamento" className="btn-primary hightech-button">
                  <span className="btn-shine" />
                  <span className="relative z-10">Pedir orçamento</span>
                </a>

                <a href="#servicos" className="btn-secondary hightech-button-secondary">
                  Ver serviços
                </a>
              </div>

              <div className="tech-marquee">
                <div className="tech-marquee__track">
                  {[...techPills, ...techPills].map((item, index) => (
                    <span key={`${item}-${index}`} className="tech-pill">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className={`relative ${mounted ? 'animate-fade-in-scale' : 'opacity-0'}`}>
              <div className="hero-panel">
                <div className="hero-panel__glow" />
                <div className="hero-panel__scan" />

                <div className="hero-panel__header">
                  <div className="hero-panel__dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="hero-panel__label">Live Interface</span>
                </div>

                <div className="hero-panel__content">
                  <div className="hud-card">
                    <span className="hud-card__label">Performance</span>
                    <strong>Rápido</strong>
                  </div>

                  <div className="hud-card">
                    <span className="hud-card__label">Visual</span>
                    <strong>Moderno</strong>
                  </div>

                  <div className="hud-card hud-card--wide">
                    <span className="hud-card__label">Experiência</span>
                    <strong>Profissional e eficiente</strong>
                  </div>
                </div>

                <div className="floating-chip floating-chip--one">UI</div>
                <div className="floating-chip floating-chip--two">CODE</div>
                <div className="floating-chip floating-chip--three">AI</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="servicos" className="px-6 pb-8 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 section-label-wrap">
            <span className="section-label">Serviços</span>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {serviceCards.map((card, index) => (
              <article
                key={card.title}
                className={`service-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="service-card__line" />
                <div className="service-card__index">0{index + 1}</div>
                <h2 className="service-card__title">{card.title}</h2>
                <p className="service-card__description">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-8 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="highlight-strip">
            <div className="highlight-strip__glow" />
            <div className="highlight-strip__grid" />
            <div className="highlight-strip__content">
              <span className="section-label">Vantagens</span>
              <p>
                Criamos soluções digitais com visual moderno, estrutura clara e foco real em
                confiança, impacto e crescimento do negócio.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="orcamento" className="px-6 pb-20 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="contact-side-panel">
              <span className="section-label">Pedido</span>
              <h2 className="contact-side-panel__title">Pedir Orçamento</h2>
              <p className="contact-side-panel__text">
                Diga-nos o que precisa e entramos em contacto consigo com uma proposta ajustada ao
                seu projeto.
              </p>

              <div className="contact-metrics">
                <div className="metric-card">
                  <span className="metric-card__label">Design</span>
                  <strong>High Tech</strong>
                </div>
                <div className="metric-card">
                  <span className="metric-card__label">Entrega</span>
                  <strong>Moderna</strong>
                </div>
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
