import { useEffect, useState, type FormEvent } from 'react'
import FeaturedProjects from '../components/FeaturedProjects'

const web3FormsAccessKey = '18547eb2-4deb-4420-b33d-64813f8918e5'

const marqueeItems = [
  'Websites desde 19€/mês',
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

const proofPoints = [
  {
    value: '19€/mês',
    label: 'plano de entrada',
    description: 'Para websites simples com domínio e alojamento incluídos.'
  },
  {
    value: 'Mobile-first',
    label: 'pensado para telemóvel',
    description: 'Experiência rápida, clara e preparada para quem chega pelo smartphone.'
  },
  {
    value: 'Evolutivo',
    label: 'cresce com o negócio',
    description: 'Pode começar com um website e evoluir para loja, marcações, admin, IA ou app.'
  }
]

const pathCards = [
  {
    title: 'Criar presença profissional',
    eyebrow: 'Website',
    href: '/criacao-websites',
    cta: 'Ver criação de websites',
    description:
      'Website profissional para apresentar o negócio, explicar serviços, transmitir confiança e receber contactos com uma imagem cuidada.',
    points: ['Página inicial forte', 'Serviços bem explicados', 'Contactos e WhatsApp'],
    outcome: 'Ideal para negócios que precisam de parecer profissionais desde o primeiro clique.'
  },
  {
    title: 'Transformar visitas em pedidos',
    eyebrow: 'Conversão',
    href: '#servicos',
    cta: 'Ver soluções de conversão',
    description:
      'Páginas, formulários, WhatsApp, loja online ou marcações para transformar visitantes em pedidos, reservas, encomendas ou contactos reais.',
    points: ['Pedido simples', 'Percurso claro', 'Experiência preparada para telemóvel'],
    outcome: 'Ideal para quem já tem procura ou quer tornar o site mais útil para vender e captar clientes.'
  },
  {
    title: 'Criar um sistema à medida',
    eyebrow: 'Automação e gestão',
    href: '/automacao-ia',
    cta: 'Ver automação e IA',
    description:
      'Áreas administrativas, bases de dados, automações, IA e integrações para organizar processos e reduzir trabalho manual.',
    points: ['Painel administrativo', 'Automação de tarefas', 'Integrações e dados'],
    outcome: 'Ideal para negócios que precisam de mais organização, escala e controlo no dia a dia.'
  }
]

const serviceCards = [
  {
    title: 'Criação de websites profissionais',
    label: 'Website',
    href: '/criacao-websites',
    cta: 'Saber mais',
    description:
      'Websites rápidos, modernos e adaptados a telemóvel para negócios que precisam de apresentar serviços, gerar confiança e receber contactos.',
    bullets: ['Imagem profissional', 'SEO base', 'Contacto rápido']
  },
  {
    title: 'Lojas online / e-commerce',
    label: 'E-commerce',
    href: '/lojas-online',
    cta: 'Saber mais',
    description:
      'Lojas online com catálogo, carrinho, checkout e estrutura preparada para apresentar produtos, receber encomendas e vender com mais clareza.',
    bullets: ['Produtos organizados', 'Carrinho de compras', 'Checkout preparado']
  },
  {
    title: 'Sistemas de marcação online',
    label: 'Agenda',
    href: '/sistemas-marcacao',
    cta: 'Saber mais',
    description:
      'Sistemas de marcação para salões, clínicas, serviços locais e negócios que precisam de organizar horários, pedidos e disponibilidade.',
    bullets: ['Reservas online', 'Gestão de horários', 'Menos chamadas perdidas']
  },
  {
    title: 'Áreas administrativas e dashboards',
    label: 'Admin',
    href: '#orcamento',
    cta: 'Pedir proposta',
    description:
      'Aplicações web, painéis privados, dashboards e ferramentas personalizadas para gerir informação, pedidos, contas e processos internos.',
    bullets: ['Painéis privados', 'Contas e registos', 'Gestão diária']
  },
  {
    title: 'Automação e IA para negócios',
    label: 'Automação',
    href: '/automacao-ia',
    cta: 'Saber mais',
    description:
      'Automação de tarefas, integração de IA, formulários inteligentes e fluxos digitais para reduzir trabalho repetitivo e acelerar respostas.',
    bullets: ['Respostas automáticas', 'Formulários inteligentes', 'Fluxos mais rápidos']
  },
  {
    title: 'Integrações API e sistemas ligados',
    label: 'Integrações',
    href: '#orcamento',
    cta: 'Pedir proposta',
    description:
      'Ligação entre websites, bases de dados, CRM, folhas de cálculo, APIs e ferramentas externas para projetos que precisam de ir além do site.',
    bullets: ['APIs', 'Bases de dados', 'Ferramentas conectadas']
  }
]

const evolutionSteps = [
  {
    title: 'Primeiro: presença',
    description: 'Um website claro, rápido e credível para explicar o negócio e receber contactos.'
  },
  {
    title: 'Depois: conversão',
    description: 'Formulários, WhatsApp, marcações, loja online ou páginas específicas para campanhas.'
  },
  {
    title: 'Quando fizer sentido: sistema',
    description: 'Área administrativa, automação, IA, integrações e ferramentas para gerir processos.'
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
    description: 'Colocamos tudo a funcionar com domínio, alojamento e uma base preparada para evoluir.'
  }
]

const projectTypes = [
  'Website simples',
  'Website profissional',
  'Redesign de website existente',
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

    document.title = 'Criação de Websites Profissionais, Lojas Online e Apps | MA-Code'

    updateMeta(
      'description',
      'Criamos websites profissionais, lojas online, sistemas de marcação, aplicações web, áreas administrativas, automação e IA para negócios em Portugal. Planos de entrada desde 19€/mês.'
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
      'Criação de Websites Profissionais, Lojas Online e Apps | MA-Code'
    )

    updatePropertyMeta(
      'og:description',
      'Criamos websites, lojas online, sistemas de marcação, aplicações web, áreas administrativas, automação e IA para negócios que querem vender, receber contactos e trabalhar com mais organização.'
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
      'Criação de Websites Profissionais, Lojas Online e Apps | MA-Code'
    )

    updateMeta(
      'twitter:description',
      'Websites, lojas online, sistemas de marcação, aplicações web, automação e IA para negócios que querem vender, receber contactos e trabalhar com mais organização.'
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

      <section className="relative overflow-hidden px-5 pb-12 pt-6 sm:px-6 md:px-10 md:pb-16 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex items-center justify-between gap-4 md:mb-12">
            <a href="/" className="brand-mark" aria-label="MA-Code.pt - Página inicial">
              <img
                src="/ma-code.png"
                alt="MA-Code.pt"
                className="shrink-0 object-contain"
                loading="eager"
                decoding="async"
              />
              <span>MA-Code.pt</span>
            </a>

            <a href="#orcamento" className="btn-ghost text-sm sm:text-base">
              Pedir proposta
            </a>
          </header>

          <div className="hero-layout">
            <div className={`hero-copy ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>Websites, lojas online, marcações, automação e aplicações web</span>
              </div>

              <h1 className="hero-title">
                Criamos soluções digitais que ajudam negócios reais a vender, receber contactos e
                trabalhar com mais organização.
              </h1>

              <div className="hero-price-badge">
                Planos de entrada desde 19€/mês · domínio + alojamento incluídos
              </div>

              <p className="hero-subtitle">
                A MA-Code desenvolve websites profissionais, lojas online, sistemas de marcação,
                áreas administrativas, automações e soluções com IA. Pode começar com uma presença
                simples e evoluir para uma plataforma mais completa quando o negócio precisar.
              </p>

              <div className="hero-actions">
                <a href="#orcamento" className="btn-primary hightech-button">
                  <span className="btn-shine" />
                  <span className="relative z-10">Receber proposta gratuita</span>
                </a>

                <a href="/projetos" className="btn-secondary hightech-button-secondary">
                  Ver projetos reais
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

                  <span className="hero-panel__label">Plano MA-Code</span>
                </div>

                <div className="hero-panel__content">
                  <div className="hud-card hud-card--wide">
                    <span className="hud-card__label">Entrada recomendada</span>
                    <strong>Website profissional pronto para receber contactos</strong>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="hud-card">
                      <span className="hud-card__label">Inclui</span>
                      <strong>Domínio + alojamento</strong>
                    </div>

                    <div className="hud-card">
                      <span className="hud-card__label">Foco</span>
                      <strong>Mobile, clareza e conversão</strong>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5">
                    <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                      Evolução possível
                    </span>

                    <div className="grid gap-3 text-sm text-slate-200">
                      <span>→ Loja online e checkout</span>
                      <span>→ Sistema de marcações</span>
                      <span>→ Área administrativa</span>
                      <span>→ Automação, IA e integrações</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {proofPoints.map((point, index) => (
              <article
                key={point.label}
                className={`rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-5 shadow-xl shadow-cyan-950/10 backdrop-blur ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <strong className="block text-xl font-semibold tracking-tight text-white">
                  {point.value}
                </strong>

                <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                  {point.label}
                </span>

                <p className="mt-3 text-sm leading-6 text-slate-300">{point.description}</p>
              </article>
            ))}
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
              Comece com o que o negócio precisa agora. Evolua quando fizer sentido.
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
              Nem todos os projetos precisam de nascer complexos. A MA-Code ajuda a escolher a
              solução certa: presença profissional, conversão ou sistema digital à medida.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {pathCards.map((card, index) => (
              <a
                key={card.title}
                href={card.href}
                className={`service-card group ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="service-card__line" />

                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                      {card.eyebrow}
                    </span>

                    <h3 className="service-card__title">{card.title}</h3>
                  </div>

                  <div className="service-card__index">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>

                <p className="service-card__description">{card.description}</p>

                <ul className="mt-5 space-y-2 text-sm text-slate-200/90">
                  {card.points.map((point) => (
                    <li key={point}>• {point}</li>
                  ))}
                </ul>

                <p className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-300/5 p-4 text-sm leading-6 text-cyan-50/90">
                  {card.outcome}
                </p>

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
          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <span className="section-label">Do site ao sistema</span>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  A ideia não é entregar “mais um site”. É criar uma base digital que possa crescer
                  com o negócio.
                </h2>

                <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
                  Muitos negócios começam por precisar apenas de uma presença profissional. Depois
                  surgem pedidos, marcações, vendas, gestão interna, automação ou integrações. A
                  estrutura é pensada para não fechar portas a essa evolução.
                </p>
              </div>

              <div className="grid gap-4">
                {evolutionSteps.map((step, index) => (
                  <article
                    key={step.title}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-sm font-bold text-cyan-100">
                        {index + 1}
                      </span>

                      <h3 className="font-semibold text-white">{step.title}</h3>
                    </div>

                    <p className="text-sm leading-6 text-slate-300">{step.description}</p>
                  </article>
                ))}
              </div>
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
              Escolha pelo problema que quer resolver
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
              Do website simples à solução à medida: criamos a base digital certa para apresentar o
              negócio, receber contactos, vender online, organizar marcações ou automatizar
              processos.
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

                <div className="mb-4 flex items-center justify-between gap-4">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                    {card.label}
                  </span>

                  <div className="service-card__index">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>

                <h3 className="service-card__title">{card.title}</h3>
                <p className="service-card__description">{card.description}</p>

                <ul className="mt-5 grid gap-2 text-sm text-slate-200/90">
                  {card.bullets.map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>

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
              O objetivo é transformar a ideia numa solução clara, funcional e pronta a ser usada,
              sem linguagem técnica desnecessária nem decisões confusas.
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
                projeto, ao estado atual do negócio e ao nível de funcionalidade necessário.
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
                    placeholder="Exemplo: preciso de um website para apresentar o meu negócio, receber contactos por WhatsApp e, mais tarde, talvez evoluir para marcações online ou loja."
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
