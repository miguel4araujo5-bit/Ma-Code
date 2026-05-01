import { useEffect, useState, type FormEvent } from 'react'
import FeaturedProjects from '../components/FeaturedProjects'

const marqueeItems = [
  'Websites Profissionais',
  'Lojas Online',
  'Sistemas de Marcação',
  'Aplicações Web',
  'IA e Automação',
  'Integrações API',
  'CRM e Gestão',
  'Bases de Dados',
  'Performance e Otimização',
  'Soluções Digitais Avançadas'
]

const marqueeLoopItems = [...marqueeItems, ...marqueeItems, ...marqueeItems]

const serviceCards = [
  {
    title: 'Websites Profissionais',
    description:
      'Sites rápidos, modernos e preparados para transmitir confiança, funcionar bem no telemóvel e gerar contactos.'
  },
  {
    title: 'Lojas Online',
    description:
      'E-commerce com catálogo, carrinho, checkout e estrutura preparada para apresentar produtos e receber encomendas.'
  },
  {
    title: 'Sistemas de Marcação',
    description:
      'Agendas online para salões, clínicas, serviços locais e negócios que precisam de organizar marcações.'
  },
  {
    title: 'Aplicações Web e Gestão',
    description:
      'Ferramentas personalizadas, áreas administrativas, dashboards e sistemas internos para organizar processos.'
  },
  {
    title: 'IA e Automação',
    description:
      'Automação de tarefas, integração de IA, formulários inteligentes e ligação entre ferramentas do negócio.'
  },
  {
    title: 'Integrações Avançadas',
    description:
      'APIs, bases de dados, CRM, integrações externas e soluções blockchain EVM quando o projeto precisa de algo mais técnico.'
  }
]

const processSteps = [
  {
    title: '1. Diagnóstico',
    description: 'Percebemos o objetivo, o tipo de negócio e o que o projeto precisa de resolver.'
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
    description: 'Colocamos tudo online com domínio, alojamento e uma base pronta a funcionar.'
  }
]

const projectTypes = [
  'Website simples',
  'Website profissional',
  'Loja online',
  'Sistema de marcações',
  'Aplicação web',
  'Automação / IA',
  'Integração avançada',
  'Ainda não sei'
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
    phone: '',
    projectType: '',
    hasWebsite: '',
    message: ''
  })
  const [isSending, setIsSending] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    document.title = 'Criação de Websites Profissionais, Lojas Online e IA | MA-Code'
    updateMeta(
      'description',
      'Criação de websites profissionais, lojas online, sistemas de marcação, aplicações web, automação e integração de IA para negócios em Portugal. Websites simples desde 19€/mês.'
    )
    updateCanonical('https://ma-code.pt/')
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSending(true)
    setSuccessMessage('')
    setErrorMessage('')

    const enrichedMessage = [
      `Tipo de projeto: ${form.projectType || 'Não indicado'}`,
      `Já tem site: ${form.hasWebsite || 'Não indicado'}`,
      `Telefone/WhatsApp: ${form.phone || 'Não indicado'}`,
      '',
      'Mensagem:',
      form.message
    ].join('\n')

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
          message: enrichedMessage
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
        phone: '',
        projectType: '',
        hasWebsite: '',
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
                <span>Websites profissionais para negócios que querem crescer</span>
              </div>

              <h1 className="hero-title">
                Websites modernos para negócios que querem parecer mais profissionais, receber mais
                contactos e vender melhor.
              </h1>

              <div className="hero-price-badge">Website simples desde 19€/mês</div>

              <p className="hero-subtitle">
                Criamos sites rápidos, adaptados a telemóvel e preparados para transmitir confiança.
                Quando o projeto precisa de mais, também desenvolvemos lojas online, marcações,
                aplicações web, automação e integração de IA.
              </p>

              <div className="hero-actions">
                <a href="#orcamento" className="btn-primary hightech-button">
                  <span className="btn-shine" />
                  <span className="relative z-10">Pedir proposta gratuita</span>
                </a>

                <a href="/projetos" className="btn-secondary hightech-button-secondary">
                  Ver projetos
                </a>
              </div>

              <ul className="hero-mini-points" aria-label="Pontos fortes da MA-Code">
                <li>Domínio + alojamento</li>
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
                    <span className="hud-card__label">Entrada</span>
                    <strong>Website profissional</strong>
                  </div>

                  <div className="hud-card">
                    <span className="hud-card__label">Objetivo</span>
                    <strong>Mais contactos</strong>
                  </div>

                  <div className="hud-card hud-card--wide">
                    <span className="hud-card__label">Evolução</span>
                    <strong>Loja online, marcações, área admin, automação e IA</strong>
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

      <FeaturedProjects mounted={mounted} />

      <section id="servicos" className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 section-label-wrap">
            <span className="section-label">Serviços</span>
          </div>

          <div className="mb-8 max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Soluções para lançar, vender e automatizar
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
              Começamos pelo essencial: uma presença online profissional. Depois, se o negócio
              precisar, evoluímos para loja online, marcações, sistemas internos, automação ou IA.
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
          <div className="mb-6 section-label-wrap">
            <span className="section-label">Processo</span>
          </div>

          <div className="mb-8 max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Um processo simples, sem complicar o cliente
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
              O objetivo é transformar a ideia numa solução funcional, clara e pronta a ser usada.
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
              <h2 className="contact-side-panel__title">Pedir Proposta</h2>
              <p className="contact-side-panel__text">
                Diga-nos o que pretende criar e respondemos com uma proposta ajustada ao tipo de
                projeto.
              </p>

              <div className="contact-metrics">
                <div className="metric-card">
                  <span className="metric-card__label">Website simples</span>
                  <strong>Desde 19€/mês</strong>
                </div>
                <div className="metric-card">
                  <span className="metric-card__label">Foco</span>
                  <strong>Contactos</strong>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm leading-7 text-slate-300">
                <p>Para uma resposta mais certeira, indique:</p>
                <ul className="space-y-2 text-slate-200/90">
                  <li>• Que tipo de projeto pretende</li>
                  <li>• Se já tem site ou quer começar do zero</li>
                  <li>• Se precisa de loja, marcações, área admin, automação ou IA</li>
                  <li>• Qual é o principal objetivo: contactos, vendas, reservas ou organização</li>
                </ul>
              </div>
            </div>

            <div className="form-shell">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
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
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="phone" className="input-label">
                      Telefone / WhatsApp <span className="text-slate-500">(opcional)</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      className="input-field"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      autoComplete="tel"
                    />
                  </div>

                  <div>
                    <label htmlFor="projectType" className="input-label">
                      Tipo de projeto
                    </label>
                    <select
                      id="projectType"
                      className="input-field"
                      value={form.projectType}
                      onChange={(e) => setForm({ ...form, projectType: e.target.value })}
                      required
                    >
                      <option value="" disabled>
                        Selecione uma opção
                      </option>
                      {projectTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="hasWebsite" className="input-label">
                    Já tem site?
                  </label>
                  <select
                    id="hasWebsite"
                    className="input-field"
                    value={form.hasWebsite}
                    onChange={(e) => setForm({ ...form, hasWebsite: e.target.value })}
                  >
                    <option value="">Selecione uma opção</option>
                    <option value="Sim, já tenho site">Sim, já tenho site</option>
                    <option value="Não, quero começar do zero">Não, quero começar do zero</option>
                    <option value="Tenho domínio, mas não tenho site">
                      Tenho domínio, mas não tenho site
                    </option>
                    <option value="Não tenho a certeza">Não tenho a certeza</option>
                  </select>
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
                    placeholder="Exemplo: preciso de um website para o meu negócio, com apresentação dos serviços, contactos, botão de WhatsApp e possibilidade de evoluir para marcações online."
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
                    {isSending ? 'A enviar...' : 'Pedir proposta gratuita'}
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
