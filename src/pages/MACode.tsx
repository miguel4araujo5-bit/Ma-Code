import { useEffect, useState, type FormEvent } from 'react'
import FeaturedProjects from '../components/FeaturedProjects'

const web3FormsAccessKey = '18547eb2-4deb-4420-b33d-64813f8918e5'

const marqueeItems = [
  'Website desde 19€/mês',
  'Domínio + Alojamento',
  'Sites Mobile-First',
  'Lojas Online',
  'Marcações Online',
  'Áreas Administrativas',
  'Automação e IA',
  'Integrações API',
  'Performance e SEO',
  'Projetos à Medida'
]

const marqueeLoopItems = [...marqueeItems, ...marqueeItems, ...marqueeItems]

const pathCards = [
  {
    title: 'Começar simples',
    href: '/criacao-websites',
    cta: 'Ver criação de websites',
    description:
      'Website profissional para apresentar o negócio, transmitir confiança e receber contactos, com domínio e alojamento incluídos.'
  },
  {
    title: 'Vender ou receber marcações',
    href: '/lojas-online',
    cta: 'Ver lojas online',
    description:
      'Loja online, sistema de marcações, formulários, WhatsApp e páginas preparadas para transformar visitas em pedidos reais.'
  },
  {
    title: 'Criar um sistema à medida',
    href: '/automacao-ia',
    cta: 'Ver automação e IA',
    description:
      'Áreas administrativas, bases de dados, automação, IA e integrações para organizar processos e reduzir trabalho manual.'
  }
]

const serviceCards = [
  {
    title: 'Presença profissional',
    href: '/criacao-websites',
    cta: 'Saber mais',
    description:
      'Websites rápidos, modernos e adaptados a telemóvel para negócios que precisam de parecer credíveis desde o primeiro clique.'
  },
  {
    title: 'Venda online',
    href: '/lojas-online',
    cta: 'Saber mais',
    description:
      'Lojas online com catálogo, carrinho, checkout e estrutura preparada para apresentar produtos e receber encomendas.'
  },
  {
    title: 'Marcações automáticas',
    href: '/sistemas-marcacao',
    cta: 'Saber mais',
    description:
      'Sistemas de marcação online para salões, clínicas, serviços locais e negócios que precisam de organizar horários.'
  },
  {
    title: 'Gestão interna',
    href: '#orcamento',
    cta: 'Pedir proposta',
    description:
      'Aplicações web, áreas administrativas, dashboards e ferramentas personalizadas para controlar informação e processos.'
  },
  {
    title: 'Menos trabalho manual',
    href: '/automacao-ia',
    cta: 'Saber mais',
    description:
      'Automação de tarefas, integração de IA, formulários inteligentes e ligação entre ferramentas usadas no dia a dia.'
  },
  {
    title: 'Sistemas ligados',
    href: '#orcamento',
    cta: 'Pedir proposta',
    description:
      'APIs, bases de dados, CRM, integrações externas e soluções técnicas para projetos que precisam de ir além do website.'
  }
]

const processSteps = [
  {
    title: '1. Percebemos o objetivo',
    description: 'Identificamos o tipo de negócio, o cliente ideal e o que o projeto precisa de resolver.'
  },
  {
    title: '2. Definimos a estrutura',
    description: 'Organizamos páginas, conteúdos, funcionalidades e percurso para o utilizador chegar ao contacto.'
  },
  {
    title: '3. Criamos e afinamos',
    description: 'Desenvolvemos a solução com foco em clareza, performance, mobile e apresentação profissional.'
  },
  {
    title: '4. Publicamos online',
    description: 'Colocamos tudo a funcionar com domínio, alojamento e uma base pronta para evoluir.'
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

export default function MACode() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    projectType: '',
    hasWebsite: '',
    message: '',
    botcheck: ''
  })

  const [isSending, setIsSending] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    document.title = 'Criação de Websites Profissionais e Lojas Online | MA-Code'

    updateMeta(
      'description',
      'Criamos websites profissionais, lojas online, sistemas de marcação, aplicações web e automação com IA para negócios em Portugal. Website simples desde 19€/mês com domínio e alojamento.'
    )

    updateMeta(
      'keywords',
      'criação de websites, websites profissionais, websites para negócios, lojas online, desenvolvimento web Portugal, sistema de marcações, aplicações web, automação, integração de IA, CRM, bases de dados, MA-Code'
    )

    updateMeta(
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )

    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:locale', 'pt_PT')
    updatePropertyMeta('og:site_name', 'MA-Code')
    updatePropertyMeta('og:url', 'https://ma-code.pt/')

    updatePropertyMeta(
      'og:title',
      'Criação de Websites Profissionais e Lojas Online | MA-Code'
    )

    updatePropertyMeta(
      'og:description',
      'Websites rápidos, modernos e adaptados a telemóvel. Criamos sites, lojas online, sistemas de marcação, aplicações web e automação com IA para negócios que querem receber mais contactos.'
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
      'Criação de Websites Profissionais e Lojas Online | MA-Code'
    )

    updateMeta(
      'twitter:description',
      'Criamos websites profissionais, lojas online, sistemas de marcação, aplicações web e automação com IA para negócios que querem receber mais contactos e vender melhor.'
    )

    updateMeta('twitter:image', 'https://ma-code.pt/ma-code.png')

    updateMeta(
      'twitter:image:alt',
      'MA-Code - criação de websites profissionais, lojas online, automação e IA'
    )

    updateCanonical('https://ma-code.pt/')
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setIsSending(true)
    setSuccessMessage('')
    setErrorMessage('')

    if (form.botcheck) {
      setIsSending(false)
      return
    }

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          access_key: web3FormsAccessKey,
          subject: 'Pedido de orçamento - MA-Code',
          from_name: 'MA-Code Website',
          name: form.name,
          email: form.email,
          phone: form.phone || 'Não indicado',
          'Tipo de projeto': form.projectType,
          'Já tem site?': form.hasWebsite || 'Não indicado',
          message: form.message,
          botcheck: form.botcheck
        })
      })

      const data = (await response.json()) as {
        success?: boolean
        message?: string
      }

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
        message: '',
        botcheck: ''
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
              Pedir proposta
            </a>
          </header>

          <div className="hero-layout">
            <div className={`hero-copy ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>Website simples desde 19€/mês com domínio e alojamento</span>
              </div>

              <h1 className="hero-title">
                Websites profissionais para negócios que querem receber mais contactos e vender
                melhor.
              </h1>

              <div className="hero-price-badge">
                Website simples desde 19€/mês · domínio + alojamento incluídos
              </div>

              <p className="hero-subtitle">
                Criamos sites rápidos, bonitos e adaptados a telemóvel. Começamos pelo essencial e
                evoluímos quando o negócio precisa de loja online, marcações, automação, IA ou área
                administrativa.
              </p>

              <div className="hero-actions">
                <a href="#orcamento" className="btn-primary hightech-button">
                  <span className="btn-shine" />
                  <span className="relative z-10">Receber proposta gratuita</span>
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
                    <span className="hud-card__label">Incluído</span>
                    <strong>Domínio + alojamento</strong>
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

      <section className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 section-label-wrap">
            <span className="section-label">Ponto de partida</span>
          </div>

          <div className="mb-8 max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Comece simples. Evolua quando precisar.
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
              Nem todos os negócios precisam da mesma solução. A MA-Code ajuda a escolher o caminho
              certo sem complicar.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {pathCards.map((card, index) => (
              <a
                key={card.title}
                href={card.href}
                className={`service-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="service-card__line" />
                <div className="service-card__index">{String(index + 1).padStart(2, '0')}</div>
                <h3 className="service-card__title">{card.title}</h3>
                <p className="service-card__description">{card.description}</p>
                <span className="mt-6 inline-flex text-sm font-semibold text-cyan-200">
                  {card.cta} →
                </span>
              </a>
            ))}
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
              Do website simples à solução à medida: criamos a base digital certa para o negócio
              parecer profissional, receber contactos e crescer com organização.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {serviceCards.map((card, index) => (
              <a
                key={card.title}
                href={card.href}
                className={`service-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="service-card__line" />
                <div className="service-card__index">{String(index + 1).padStart(2, '0')}</div>
                <h3 className="service-card__title">{card.title}</h3>
                <p className="service-card__description">{card.description}</p>
                <span className="mt-6 inline-flex text-sm font-semibold text-cyan-200">
                  {card.cta} →
                </span>
              </a>
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
              O objetivo é transformar a ideia numa solução clara, funcional e pronta a ser usada.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {processSteps.map((step, index) => (
              <article
                key={step.title}
                className={`process-card ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <h3>{step.title}</h3>
                <p>{step.description}</p>
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

              <h2 className="contact-side-panel__title">Conte-nos o que precisa</h2>

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
                  <span className="metric-card__label">Inclui</span>
                  <strong>Domínio + alojamento</strong>
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
              <form
                action="https://api.web3forms.com/submit"
                method="POST"
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <input type="hidden" name="access_key" value={web3FormsAccessKey} />
                <input type="hidden" name="subject" value="Pedido de orçamento - MA-Code" />
                <input type="hidden" name="from_name" value="MA-Code Website" />

                <input
                  type="text"
                  name="botcheck"
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.botcheck}
                  onChange={(e) => setForm({ ...form, botcheck: e.target.value })}
                />

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="input-label">
                      Nome
                    </label>

                    <input
                      id="name"
                      name="name"
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
                      name="email"
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
                      name="phone"
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
                      name="Tipo de projeto"
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
                    name="Já tem site?"
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
                    name="message"
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
                    {isSending ? 'A enviar...' : 'Receber proposta gratuita'}
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
