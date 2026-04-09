import { useEffect, useState, type FormEvent } from 'react'

const techPills = [
  'Web Design',
  'Web Apps',
  'Automação',
  'IA',
  'E-commerce',
  'Cloud',
  'APIs',
  'Performance',
  'Blockchain',
  'EVM'
]

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
    title: 'Blockchain e EVM',
    description:
      'Criação de tokens, integrações de ações em blockchain EVM e soluções digitais ligadas a smart contracts e ecossistemas on-chain.'
  }
]

const valuePoints = [
  {
    title: 'Mais credibilidade',
    description:
      'Uma presença digital mais forte ajuda a sua marca a parecer mais profissional desde o primeiro contacto.'
  },
  {
    title: 'Mais organização',
    description:
      'Criamos soluções que ajudam a receber pedidos, marcar serviços, automatizar tarefas e organizar operações.'
  },
  {
    title: 'Mais capacidade de crescer',
    description:
      'O objetivo não é apenas “ter um site”, mas criar uma base digital preparada para captar mais oportunidades.'
  }
]

const processSteps = [
  {
    title: '1. Diagnóstico',
    description: 'Percebemos o seu negócio, o objetivo do projeto e o que realmente faz sentido construir.'
  },
  {
    title: '2. Estrutura',
    description:
      'Definimos a solução, a organização da página e a melhor forma de apresentar a sua oferta.'
  },
  {
    title: '3. Desenvolvimento',
    description:
      'Criamos uma solução moderna, rápida e alinhada com a sua imagem, funcionalidades e necessidades.'
  },
  {
    title: '4. Entrega',
    description:
      'Colocamos o projeto online e deixamos a base preparada para operar melhor e crescer com mais confiança.'
  }
]

const faqItems = [
  {
    question: 'Que tipo de projetos desenvolvem?',
    answer:
      'Desenvolvemos websites profissionais, lojas online, sistemas de marcações, aplicações web, automações, integrações de IA e soluções com blockchain EVM, incluindo criação de tokens e ações on-chain.'
  },
  {
    question: 'Fazem projetos simples e também soluções mais avançadas?',
    answer:
      'Sim. Podemos criar desde uma presença digital mais simples até soluções mais completas com gestão, automação, integrações, funcionalidades personalizadas e componentes blockchain.'
  },
  {
    question: 'O site fica adaptado para telemóvel?',
    answer:
      'Sim. Os projetos são pensados para funcionar bem em telemóvel, tablet e desktop, com foco em clareza, velocidade e experiência do utilizador.'
  },
  {
    question: 'Como funciona o pedido de orçamento?',
    answer:
      'Envie-nos o que pretende, analisamos o projeto e respondemos com uma proposta ajustada ao tipo de solução que faz sentido para o seu caso.'
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

      <section className="relative overflow-hidden px-5 pb-14 pt-6 sm:px-6 md:px-10 md:pb-20 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex items-center justify-between md:mb-12">
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

          <div className="hero-layout">
            <div className={`hero-copy ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>Websites • IA • Automação • Blockchain</span>
              </div>

              <h1 className="hero-title">
                Criamos websites, lojas online, aplicações web, automação e soluções blockchain
                para negócios que querem mais credibilidade, eficiência e crescimento.
              </h1>

              <div className="hero-price-badge">Projetos desde 19€/mês</div>

              <p className="hero-subtitle">
                Soluções digitais com visual premium, estrutura clara e foco comercial para ajudar
                a sua marca a transmitir confiança, captar mais contactos e operar melhor.
              </p>

              <div className="hero-actions">
                <a href="#orcamento" className="btn-primary hightech-button">
                  <span className="btn-shine" />
                  <span className="relative z-10">Pedir orçamento</span>
                </a>

                <a href="#servicos" className="btn-secondary hightech-button-secondary">
                  Ver serviços
                </a>
              </div>

              <ul className="hero-mini-points" aria-label="Pontos fortes da MA-Code">
                <li>Visual premium</li>
                <li>Estrutura clara</li>
                <li>Foco em conversão</li>
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
                    <span className="hud-card__label">Performance</span>
                    <strong>Rápido e leve</strong>
                  </div>

                  <div className="hud-card">
                    <span className="hud-card__label">Posicionamento</span>
                    <strong>Profissional</strong>
                  </div>

                  <div className="hud-card hud-card--wide">
                    <span className="hud-card__label">Objetivo</span>
                    <strong>Mais contactos, mais organização, mais confiança</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-marquee" aria-label="Serviços e soluções da MA-Code">
            <div className="hero-marquee__track">
              {[...marqueeItems, ...marqueeItems].map((item, index) => (
                <span key={`${item}-${index}`} className="hero-marquee__item">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="hero-pills-wrap">
            <div className="hero-pills">
              {techPills.map((item) => (
                <span key={item} className="tech-pill">
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
              Soluções digitais pensadas para vender melhor, operar melhor e crescer com mais força
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
              Desenvolvemos soluções para empresas, marcas e projetos que precisam de presença
              digital, automação, organização interna e funcionalidades mais avançadas.
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

      <section className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="highlight-strip">
            <div className="highlight-strip__glow" />
            <div className="highlight-strip__grid" />
            <div className="highlight-strip__content">
              <span className="section-label">Vantagens</span>
              <p>
                Criamos soluções digitais com visual moderno, estrutura clara e foco real em
                confiança, impacto, eficiência e crescimento do negócio.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 section-label-wrap">
            <span className="section-label">Porque escolher a MA-Code</span>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {valuePoints.map((item, index) => (
              <article
                key={item.title}
                className={`service-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="service-card__line" />
                <h2 className="service-card__title">{item.title}</h2>
                <p className="service-card__description">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

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

      <section className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 section-label-wrap">
            <span className="section-label">Perguntas frequentes</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {faqItems.map((item, index) => (
              <article
                key={item.question}
                className={`rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm md:p-6 ${
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

      <section id="orcamento" className="px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="contact-side-panel">
              <span className="section-label">Pedido</span>
              <h2 className="contact-side-panel__title">Pedir Orçamento</h2>
              <p className="contact-side-panel__text">
                Diga-nos o que precisa e entramos em contacto consigo com uma proposta ajustada ao
                seu projeto, ao seu negócio e ao tipo de solução que faz sentido construir.
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
                  <li>• Se precisa de loja online, marcações, automação, IA ou blockchain</li>
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
