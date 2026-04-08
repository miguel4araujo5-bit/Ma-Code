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
    description:
      'Websites rápidos, modernos e otimizados para telemóvel, pensados para transmitir confiança e gerar mais contactos.'
  },
  {
    title: 'Lojas Online',
    description:
      'Lojas online com visual premium, estrutura clara e experiência pensada para vender mais e facilitar a gestão.'
  },
  {
    title: 'Sistemas de Marcação',
    description:
      'Sistemas de reservas online para salões, clínicas e serviços que querem receber pedidos com mais organização.'
  },
  {
    title: 'Aplicações Web',
    description:
      'Plataformas personalizadas para automatizar processos, organizar operações e poupar tempo no dia a dia.'
  },
  {
    title: 'IA e Automação',
    description:
      'Integrações de IA, automações e fluxos inteligentes para reduzir tarefas repetitivas e melhorar a eficiência.'
  },
  {
    title: 'CRM e Gestão',
    description:
      'Soluções digitais para acompanhamento de clientes, bases de dados e organização interna do seu negócio.'
  }
]

const trustPoints = [
  'Visual moderno e profissional',
  'Experiência pensada para mobile',
  'Mais clareza, confiança e impacto comercial'
]

const processSteps = [
  {
    title: '1. Diagnóstico',
    description: 'Percebemos o seu negócio, os seus objetivos e o que é realmente preciso construir.'
  },
  {
    title: '2. Estrutura',
    description: 'Definimos a solução, a organização da página e a melhor forma de apresentar a oferta.'
  },
  {
    title: '3. Desenvolvimento',
    description: 'Criamos uma solução moderna, rápida e alinhada com a sua imagem e necessidades.'
  },
  {
    title: '4. Entrega',
    description:
      'Colocamos o projeto online e deixamos a base preparada para crescer com mais confiança.'
  }
]

const faqItems = [
  {
    question: 'Que tipo de projetos desenvolvem?',
    answer:
      'Desenvolvemos websites profissionais, lojas online, sistemas de marcações, aplicações web, automações, integrações de IA e outras soluções digitais ajustadas ao negócio.'
  },
  {
    question: 'O site fica adaptado para telemóvel?',
    answer:
      'Sim. Os projetos são pensados para funcionar bem em telemóvel, tablet e desktop, com foco em clareza, velocidade e experiência do utilizador.'
  },
  {
    question: 'Podem fazer algo simples ou também projetos mais avançados?',
    answer:
      'Ambas as opções. Podemos criar desde uma presença digital mais simples até soluções mais completas com gestão, automação, integrações e funcionalidades personalizadas.'
  },
  {
    question: 'Como funciona o pedido de orçamento?',
    answer:
      'Envia-nos o que pretende, analisamos o projeto e respondemos com uma proposta ajustada ao que faz sentido para o seu caso.'
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
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_KEY,
          subject: 'Pedido de orçamento - MA-Code',
          from_name: 'MA-Code Website',
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
              <span className="brand-mark__dot" />
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
                  <span>MA-Code</span>
                </div>
              </div>

              <div className="space-y-5">
                <h1 className="hero-title">
                  Criamos websites, lojas online e sistemas digitais para negócios que querem parecer
                  mais profissionais, captar mais clientes e crescer online.{' '}
                  <span className="hero-price">(A partir de 19€/mês)</span>
                </h1>

                <p className="hero-subtitle">
                  Soluções digitais com visual premium, estrutura clara e foco comercial para ajudar a
                  sua marca a transmitir confiança desde o primeiro segundo.
                </p>

                <div className="flex flex-wrap gap-3 pt-1">
                  {trustPoints.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium tracking-[0.14em] text-slate-200/90 uppercase backdrop-blur"
                    >
                      {item}
                    </span>
                  ))}
                </div>
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

              <div className="tech-marquee" aria-label="Tecnologias e áreas de serviço">
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
                    <strong>Premium</strong>
                  </div>

                  <div className="hud-card hud-card--wide">
                    <span className="hud-card__label">Objetivo</span>
                    <strong>Mais confiança, mais impacto, mais pedidos</strong>
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

          <div className="mb-8 max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Soluções digitais pensadas para vender melhor e organizar melhor
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
              Não se trata apenas de “ter um site”. Trata-se de criar uma presença digital credível,
              funcional e preparada para ajudar o seu negócio a crescer.
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

      <section className="px-6 pb-8 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="highlight-strip">
            <div className="highlight-strip__glow" />
            <div className="highlight-strip__grid" />
            <div className="highlight-strip__content">
              <span className="section-label">Diferenciação</span>
              <p>
                A MA-Code combina impacto visual, clareza comercial e desenvolvimento moderno para
                criar soluções digitais que não só parecem melhores, como também ajudam a vender e a
                transmitir mais confiança.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-8 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 section-label-wrap">
            <span className="section-label">Processo</span>
          </div>

          <div className="mb-8 max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Um processo simples, claro e orientado ao resultado
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
              Trabalhamos com uma lógica direta para reduzir confusão, acelerar decisões e transformar
              ideias em soluções digitais mais profissionais.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {processSteps.map((step, index) => (
              <article
                key={step.title}
                className={`service-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="service-card__line" />
                <h3 className="service-card__title">{step.title}</h3>
                <p className="service-card__description">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-8 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 section-label-wrap">
            <span className="section-label">Perguntas frequentes</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {faqItems.map((item, index) => (
              <article
                key={item.question}
                className={`rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <h2 className="text-base font-semibold text-white md:text-lg">{item.question}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="orcamento" className="px-6 pb-20 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="contact-side-panel">
              <span className="section-label">Pedido</span>
              <h2 className="contact-side-panel__title">Pedir orçamento</h2>
              <p className="contact-side-panel__text">
                Diga-nos o que precisa e entramos em contacto consigo com uma proposta ajustada ao
                seu projeto, à sua fase e ao tipo de solução que faz sentido para o seu negócio.
              </p>

              <div className="contact-metrics">
                <div className="metric-card">
                  <span className="metric-card__label">Visual</span>
                  <strong>Premium</strong>
                </div>
                <div className="metric-card">
                  <span className="metric-card__label">Foco</span>
                  <strong>Comercial</strong>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm leading-7 text-slate-300">
                <p>Indique, se possível:</p>
                <ul className="space-y-2 text-slate-200/90">
                  <li>• Que tipo de projeto pretende</li>
                  <li>• Se já tem site ou se vai começar do zero</li>
                  <li>• Que objetivo quer atingir com esta solução</li>
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
                  <div className="status-message status-message--success" role="status" aria-live="polite">
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
