import { useEffect, useRef, useState, type FormEvent } from 'react'
import FormPrivacyNotice from '../components/FormPrivacyNotice'

const projectTypes = [
  'Website simples',
  'Website profissional',
  'Redesign de website existente',
  'Loja online',
  'Loja online / Sistema de marcações',
  'Sistema de marcações',
  'Sistema à medida',
  'Aplicação web',
  'Automação / IA',
  'Integração avançada',
  'Ainda não sei'
]

const projectGoals = [
  'Receber mais contactos',
  'Vender online',
  'Receber marcações',
  'Organizar processos internos',
  'Automatizar tarefas',
  'Melhorar imagem e confiança',
  'Ainda não sei'
]

const contactHighlights = [
  {
    title: 'Proposta gratuita',
    description: 'O primeiro contacto serve para perceber o projeto e indicar o caminho mais adequado.'
  },
  {
    title: 'Pode começar simples',
    description: 'Não precisa de pedir tudo de uma vez. A solução pode crescer por fases.'
  },
  {
    title: 'Resposta mais certeira',
    description: 'Quanto melhor explicar o objetivo, mais clara fica a proposta.'
  }
]

const projectPaths = [
  {
    title: 'Website profissional',
    description: 'Para apresentar o negócio, transmitir confiança e receber contactos.',
    href: '/criacao-websites'
  },
  {
    title: 'Loja online',
    description: 'Para vender produtos com catálogo, carrinho e checkout.',
    href: '/lojas-online'
  },
  {
    title: 'Sistema de marcações',
    description: 'Para receber pedidos, organizar horários e gerir agenda.',
    href: '/sistemas-marcacao'
  },
  {
    title: 'Automação e IA',
    description: 'Para reduzir tarefas repetitivas e ligar ferramentas.',
    href: '/automacao-ia'
  }
]

type ContactFormState = {
  name: string
  email: string
  phone: string
  projectType: string
  projectGoal: string
  hasWebsite: string
  message: string
  botcheck: string
}

type ProjectPrefill = {
  slug: string
  label: string
  projectType: string
  projectGoal: string
  description: string
  message: string
}

const emptyForm: ContactFormState = {
  name: '',
  email: '',
  phone: '',
  projectType: '',
  projectGoal: '',
  hasWebsite: '',
  message: '',
  botcheck: ''
}

const projectPrefills: Record<string, ProjectPrefill> = {
  website: {
    slug: 'website',
    label: 'Website profissional',
    projectType: 'Website profissional',
    projectGoal: 'Receber mais contactos',
    description: 'Pré-selecionámos o formulário para um website profissional focado em presença online, confiança e contactos.',
    message: 'Pretendo pedir proposta para um website profissional.\n\nObjetivo principal: apresentar o negócio, explicar serviços e receber mais contactos.\n\nGostava que o website fosse claro, profissional, preparado para telemóvel e com contacto fácil por WhatsApp, email ou formulário.\n\nDetalhes adicionais: '
  },
  'website-profissional': {
    slug: 'website',
    label: 'Website profissional',
    projectType: 'Website profissional',
    projectGoal: 'Receber mais contactos',
    description: 'Pré-selecionámos o formulário para um website profissional focado em presença online, confiança e contactos.',
    message: 'Pretendo pedir proposta para um website profissional.\n\nObjetivo principal: apresentar o negócio, explicar serviços e receber mais contactos.\n\nGostava que o website fosse claro, profissional, preparado para telemóvel e com contacto fácil por WhatsApp, email ou formulário.\n\nDetalhes adicionais: '
  },
  'criacao-websites': {
    slug: 'website',
    label: 'Website profissional',
    projectType: 'Website profissional',
    projectGoal: 'Receber mais contactos',
    description: 'Pré-selecionámos o formulário para um website profissional focado em presença online, confiança e contactos.',
    message: 'Pretendo pedir proposta para um website profissional.\n\nObjetivo principal: apresentar o negócio, explicar serviços e receber mais contactos.\n\nGostava que o website fosse claro, profissional, preparado para telemóvel e com contacto fácil por WhatsApp, email ou formulário.\n\nDetalhes adicionais: '
  },
  'vendas-marcacoes': {
    slug: 'vendas-marcacoes',
    label: 'Vendas ou marcações',
    projectType: 'Loja online / Sistema de marcações',
    projectGoal: 'Vender online',
    description: 'Pré-selecionámos o formulário para loja online, reservas, pedidos ou sistema de marcações.',
    message: 'Pretendo pedir proposta para uma solução de vendas ou marcações online.\n\nObjetivo principal: vender online, receber encomendas, aceitar reservas ou organizar marcações através do site.\n\nGostava que a solução fosse simples para o cliente usar no telemóvel e fácil de gerir no dia a dia.\n\nDetalhes adicionais: '
  },
  'loja-marcacoes': {
    slug: 'vendas-marcacoes',
    label: 'Vendas ou marcações',
    projectType: 'Loja online / Sistema de marcações',
    projectGoal: 'Vender online',
    description: 'Pré-selecionámos o formulário para loja online, reservas, pedidos ou sistema de marcações.',
    message: 'Pretendo pedir proposta para uma solução de vendas ou marcações online.\n\nObjetivo principal: vender online, receber encomendas, aceitar reservas ou organizar marcações através do site.\n\nGostava que a solução fosse simples para o cliente usar no telemóvel e fácil de gerir no dia a dia.\n\nDetalhes adicionais: '
  },
  'lojas-online': {
    slug: 'vendas-marcacoes',
    label: 'Vendas ou marcações',
    projectType: 'Loja online / Sistema de marcações',
    projectGoal: 'Vender online',
    description: 'Pré-selecionámos o formulário para loja online, reservas, pedidos ou sistema de marcações.',
    message: 'Pretendo pedir proposta para uma loja online.\n\nObjetivo principal: vender produtos online com catálogo, carrinho, checkout e uma experiência simples para o cliente.\n\nGostava que a loja fosse preparada para telemóvel e fácil de gerir.\n\nDetalhes adicionais: '
  },
  'sistemas-marcacao': {
    slug: 'vendas-marcacoes',
    label: 'Vendas ou marcações',
    projectType: 'Loja online / Sistema de marcações',
    projectGoal: 'Receber marcações',
    description: 'Pré-selecionámos o formulário para loja online, reservas, pedidos ou sistema de marcações.',
    message: 'Pretendo pedir proposta para um sistema de marcações online.\n\nObjetivo principal: receber marcações, organizar horários e facilitar pedidos de clientes através do site.\n\nGostava que o processo fosse simples para o cliente e fácil de gerir internamente.\n\nDetalhes adicionais: '
  },
  'sistema-medida': {
    slug: 'sistema-medida',
    label: 'Sistema à medida',
    projectType: 'Sistema à medida',
    projectGoal: 'Automatizar tarefas',
    description: 'Pré-selecionámos o formulário para sistema à medida, área administrativa, automação, IA ou integração avançada.',
    message: 'Pretendo pedir proposta para um sistema à medida.\n\nObjetivo principal: reduzir trabalho manual, organizar processos internos ou criar uma ferramenta própria para o negócio.\n\nGostava de perceber a melhor solução para uma área administrativa, dashboard, base de dados, automação, integração com IA ou aplicação web personalizada.\n\nDetalhes adicionais: '
  },
  'sistema-a-medida': {
    slug: 'sistema-medida',
    label: 'Sistema à medida',
    projectType: 'Sistema à medida',
    projectGoal: 'Automatizar tarefas',
    description: 'Pré-selecionámos o formulário para sistema à medida, área administrativa, automação, IA ou integração avançada.',
    message: 'Pretendo pedir proposta para um sistema à medida.\n\nObjetivo principal: reduzir trabalho manual, organizar processos internos ou criar uma ferramenta própria para o negócio.\n\nGostava de perceber a melhor solução para uma área administrativa, dashboard, base de dados, automação, integração com IA ou aplicação web personalizada.\n\nDetalhes adicionais: '
  },
  'automacao-ia': {
    slug: 'sistema-medida',
    label: 'Sistema à medida',
    projectType: 'Sistema à medida',
    projectGoal: 'Automatizar tarefas',
    description: 'Pré-selecionámos o formulário para sistema à medida, área administrativa, automação, IA ou integração avançada.',
    message: 'Pretendo pedir proposta para automação, IA ou sistema à medida.\n\nObjetivo principal: automatizar tarefas, ligar ferramentas, reduzir trabalho manual ou criar uma solução digital personalizada.\n\nGostava de perceber a melhor forma de usar automação, integração com IA, dashboard, base de dados ou aplicação web no meu negócio.\n\nDetalhes adicionais: '
  }
}

function getProjectPrefillFromUrl() {
  if (typeof window === 'undefined') {
    return null
  }

  const searchParams = new URLSearchParams(window.location.search)
  const selectedType = searchParams.get('tipo') || searchParams.get('project') || searchParams.get('servico')

  if (!selectedType) {
    return null
  }

  return projectPrefills[selectedType.trim().toLowerCase()] || null
}

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

type AnalyticsParameters = Record<string, string | number | boolean | undefined>

type AnalyticsWindow = Window & {
  gtag?: (command: 'event', eventName: string, parameters?: AnalyticsParameters) => void
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

function getReferrerSource(referrer: string) {
  if (!referrer) {
    return 'direct'
  }

  try {
    return new URL(referrer).hostname.replace(/^www\./, '')
  } catch {
    return 'referral'
  }
}

function getTrafficAttribution(): AttributionData {
  if (typeof window === 'undefined') {
    return {}
  }

  const searchParams = new URLSearchParams(window.location.search)
  const hasCampaignParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].some((param) =>
    searchParams.has(param)
  )

  try {
    const storedAttribution = window.sessionStorage.getItem(attributionStorageKey)

    if (storedAttribution && !hasCampaignParams) {
      return JSON.parse(storedAttribution) as AttributionData
    }
  } catch {
    return {
      traffic_source: searchParams.get('utm_source') || getReferrerSource(document.referrer),
      traffic_medium: searchParams.get('utm_medium') || (document.referrer ? 'referral' : 'direct'),
      traffic_campaign: searchParams.get('utm_campaign') || undefined,
      traffic_term: searchParams.get('utm_term') || undefined,
      traffic_content: searchParams.get('utm_content') || undefined,
      traffic_referrer: document.referrer || undefined,
      landing_page: window.location.href
    }
  }

  const attribution = {
    traffic_source: searchParams.get('utm_source') || getReferrerSource(document.referrer),
    traffic_medium: searchParams.get('utm_medium') || (document.referrer ? 'referral' : 'direct'),
    traffic_campaign: searchParams.get('utm_campaign') || undefined,
    traffic_term: searchParams.get('utm_term') || undefined,
    traffic_content: searchParams.get('utm_content') || undefined,
    traffic_referrer: document.referrer || undefined,
    landing_page: window.location.href
  }

  try {
    window.sessionStorage.setItem(attributionStorageKey, JSON.stringify(attribution))
  } catch {
    return attribution
  }

  return attribution
}

function trackEvent(eventName: string, parameters: AnalyticsParameters = {}) {
  if (typeof window === 'undefined') {
    return
  }

  const analyticsWindow = window as AnalyticsWindow
  const eventParameters = {
    event_category: 'ma_code_contact_page',
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
    ...getTrafficAttribution(),
    ...parameters
  }

  if (typeof analyticsWindow.gtag === 'function') {
    analyticsWindow.gtag('event', eventName, eventParameters)
    return
  }

  analyticsWindow.dataLayer = Array.isArray(analyticsWindow.dataLayer) ? analyticsWindow.dataLayer : []

  analyticsWindow.dataLayer.push({
    event: eventName,
    ...eventParameters
  })
}

export default function ContactPage() {
  const [form, setForm] = useState<ContactFormState>(emptyForm)
  const [selectedProject, setSelectedProject] = useState<ProjectPrefill | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [mounted, setMounted] = useState(false)
  const formStartedRef = useRef(false)

  useEffect(() => {
    setMounted(true)

    const projectPrefill = getProjectPrefillFromUrl()

    if (projectPrefill) {
      setSelectedProject(projectPrefill)

      setForm((currentForm) => ({
        ...currentForm,
        projectType: projectPrefill.projectType,
        projectGoal: projectPrefill.projectGoal,
        message: currentForm.message || projectPrefill.message
      }))
    }

    document.title = 'Pedir Proposta Gratuita | Contacto | MA-Code'

    updateMeta(
      'description',
      'Peça uma proposta gratuita para website, loja online, sistema de marcações, automação, IA ou aplicação web à medida. Conte à MA-Code o que precisa.'
    )

    updateMeta(
      'keywords',
      'contacto MA-Code, pedir proposta website, orçamento website, orçamento loja online, sistema de marcações, automação IA, desenvolvimento web Portugal'
    )

    updateMeta(
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )

    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:locale', 'pt_PT')
    updatePropertyMeta('og:site_name', 'MA-Code')
    updatePropertyMeta('og:url', 'https://ma-code.pt/contacto')

    updatePropertyMeta(
      'og:title',
      'Pedir Proposta Gratuita | Contacto | MA-Code'
    )

    updatePropertyMeta(
      'og:description',
      'Explique o projeto em 1 minuto e receba uma proposta ajustada para website, loja online, marcações, automação ou sistema à medida.'
    )

    updatePropertyMeta('og:image', 'https://ma-code.pt/ma-code.png')

    updatePropertyMeta(
      'og:image:alt',
      'MA-Code - criação de websites profissionais, lojas online, automação e IA'
    )

    updateMeta('twitter:card', 'summary_large_image')
    updateMeta('twitter:url', 'https://ma-code.pt/contacto')

    updateMeta(
      'twitter:title',
      'Pedir Proposta Gratuita | Contacto | MA-Code'
    )

    updateMeta(
      'twitter:description',
      'Explique o projeto em 1 minuto e receba uma proposta ajustada para website, loja online, marcações, automação ou sistema à medida.'
    )

    updateMeta('twitter:image', 'https://ma-code.pt/ma-code.png')

    updateMeta(
      'twitter:image:alt',
      'MA-Code - criação de websites profissionais, lojas online, automação e IA'
    )

    updateCanonical('https://ma-code.pt/contacto')

    trackEvent('contact_page_view', {
      page_name: 'contacto',
      page_type: 'lead_capture',
      prefilled_project_type: projectPrefill?.projectType || 'not_selected',
      prefilled_project_goal: projectPrefill?.projectGoal || 'not_selected',
      prefilled_project_source: projectPrefill?.slug || 'not_selected'
    })
  }, [])

  const trackFormStart = () => {
    if (formStartedRef.current) {
      return
    }

    formStartedRef.current = true

    trackEvent('proposal_form_started', {
      form_name: 'pedido_proposta',
      trigger: 'first_form_interaction',
      project_type: form.projectType || 'not_selected',
      project_goal: form.projectGoal || 'not_selected',
      has_website: form.hasWebsite || 'not_selected',
      prefilled_project_source: selectedProject?.slug || 'not_selected'
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (isSending) {
      return
    }

    setIsSending(true)
    setSuccessMessage('')
    setErrorMessage('')

    if (form.botcheck) {
      trackEvent('proposal_form_blocked', {
        form_name: 'pedido_proposta',
        reason: 'botcheck'
      })

      setIsSending(false)
      return
    }

    trackEvent('proposal_form_submit_attempt', {
      form_name: 'pedido_proposta',
      project_type: form.projectType || 'not_selected',
      project_goal: form.projectGoal || 'not_selected',
      has_website: form.hasWebsite || 'not_selected',
      prefilled_project_source: selectedProject?.slug || 'not_selected'
    })

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
          phone: form.phone,
          projectType: form.projectType,
          projectGoal: form.projectGoal,
          hasWebsite: form.hasWebsite,
          pageUrl: typeof window !== 'undefined' ? window.location.href : 'https://ma-code.pt/contacto',
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

      trackEvent('proposal_form_submit_success', {
        form_name: 'pedido_proposta',
        project_type: form.projectType || 'not_selected',
        project_goal: form.projectGoal || 'not_selected',
        has_website: form.hasWebsite || 'not_selected',
        prefilled_project_source: selectedProject?.slug || 'not_selected'
      })

      trackEvent('generate_lead', {
        form_name: 'pedido_proposta',
        lead_type: form.projectType || 'not_selected',
        project_goal: form.projectGoal || 'not_selected',
        prefilled_project_source: selectedProject?.slug || 'not_selected'
      })

      setSuccessMessage('Pedido enviado com sucesso. Entraremos em contacto em breve.')
      setForm(emptyForm)
      setSelectedProject(null)
    } catch {
      trackEvent('proposal_form_submit_error', {
        form_name: 'pedido_proposta',
        project_type: form.projectType || 'not_selected',
        project_goal: form.projectGoal || 'not_selected',
        has_website: form.hasWebsite || 'not_selected',
        prefilled_project_source: selectedProject?.slug || 'not_selected'
      })

      setErrorMessage('Não foi possível enviar o pedido. Tente novamente.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main>
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

            <a
              href="/projetos"
              className="btn-ghost hidden text-sm sm:inline-flex sm:text-base"
              onClick={() => trackEvent('cta_click', {
                cta_text: 'Ver projetos',
                cta_location: 'contact_header',
                destination: '/projetos'
              })}
            >
              Ver projetos
            </a>
          </header>

          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>Proposta gratuita, sem compromisso.</span>
              </div>

              <h1 className="hero-title">
                Explique o projeto em 1 minuto.
              </h1>

              <p className="hero-subtitle">
                Diga-nos se precisa de um website, loja online, sistema de marcações,
                automação, IA ou uma solução à medida. Respondemos com uma proposta ajustada
                ao objetivo e ao nível de funcionalidade necessário.
              </p>

              <div className="mt-8 grid gap-3">
                {contactHighlights.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-5 shadow-xl shadow-cyan-950/10 backdrop-blur"
                  >
                    <strong className="block text-sm font-semibold text-white">
                      {item.title}
                    </strong>

                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {item.description}
                    </p>
                  </article>
                ))}
              </div>

              <div className="mt-8 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-5">
                <span className="section-label">Antes de enviar</span>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  Não precisa de ter tudo fechado. Basta indicar o objetivo, o tipo de projeto
                  e o que gostaria que a solução resolvesse.
                </p>

                <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-200/90">
                  <li>• Que tipo de projeto pretende</li>
                  <li>• Se já tem site ou quer começar do zero</li>
                  <li>• Se precisa de loja, marcações, automação, IA ou área administrativa</li>
                  <li>• Qual é o principal resultado esperado</li>
                </ul>
              </div>
            </div>

            <div className={`form-shell ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <div className="mb-5 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4 text-sm leading-6 text-slate-200">
                <strong className="block text-white">Pedido de proposta</strong>

                <span className="mt-1 block text-slate-300">
                  Preencha o formulário e explique a ideia. Quanto mais contexto enviar, mais
                  certeira será a resposta.
                </span>
              </div>

              {selectedProject ? (
                <div className="mb-5 rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-4 shadow-inner shadow-cyan-950/20">
                  <span className="section-label">Pedido selecionado</span>

                  <strong className="mt-3 block text-base font-semibold text-white">
                    {selectedProject.label}
                  </strong>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {selectedProject.description}
                  </p>
                </div>
              ) : null}

              <form
                onSubmit={handleSubmit}
                onFocus={trackFormStart}
                onChange={trackFormStart}
                className="space-y-5"
                aria-describedby={successMessage || errorMessage ? 'form-status' : undefined}
              >
                <input
                  type="text"
                  name="botcheck"
                  className="hidden"
                  aria-hidden="true"
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
                      onChange={(e) => {
                        trackEvent('form_field_select', {
                          form_name: 'pedido_proposta',
                          field_name: 'projectType',
                          selected_value: e.target.value
                        })

                        setForm({ ...form, projectType: e.target.value })
                      }}
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
                  <label htmlFor="projectGoal" className="input-label">
                    Objetivo principal do projeto
                  </label>

                  <select
                    id="projectGoal"
                    name="Objetivo principal do projeto"
                    className="input-field"
                    value={form.projectGoal}
                    onChange={(e) => {
                      trackEvent('form_field_select', {
                        form_name: 'pedido_proposta',
                        field_name: 'projectGoal',
                        selected_value: e.target.value
                      })

                      setForm({ ...form, projectGoal: e.target.value })
                    }}
                    required
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>

                    {projectGoals.map((goal) => (
                      <option key={goal} value={goal}>
                        {goal}
                      </option>
                    ))}
                  </select>
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
                    onChange={(e) => {
                      trackEvent('form_field_select', {
                        form_name: 'pedido_proposta',
                        field_name: 'hasWebsite',
                        selected_value: e.target.value || 'not_selected'
                      })

                      setForm({ ...form, hasWebsite: e.target.value })
                    }}
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
                    placeholder="Exemplo: preciso de começar com um website para apresentar o meu negócio e receber contactos por WhatsApp. Mais tarde, talvez queira evoluir para marcações online, loja ou área administrativa."
                  />
                </div>

                {successMessage ? (
                  <div
                    id="form-status"
                    className="status-message status-message--success"
                    role="status"
                    aria-live="polite"
                  >
                    {successMessage}
                  </div>
                ) : null}

                {errorMessage ? (
                  <div
                    id="form-status"
                    className="status-message status-message--error"
                    role="alert"
                    aria-live="assertive"
                  >
                    {errorMessage}
                  </div>
                ) : null}

                <FormPrivacyNotice />

                <button
                  type="submit"
                  className="btn-primary hightech-button w-full disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSending}
                  aria-busy={isSending}
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

      <section className="px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <span className="section-label">Ainda a decidir?</span>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Veja primeiro a solução mais próxima do que precisa.
                </h2>

                <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
                  A página de contacto serve para pedir proposta. Se ainda quiser perceber melhor
                  cada área, pode visitar as páginas específicas antes de enviar o pedido.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {projectPaths.map((path) => (
                  <a
                    key={path.href}
                    href={path.href}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/30 hover:bg-cyan-300/[0.06]"
                    onClick={() => trackEvent('contact_service_link_click', {
                      service_name: path.title,
                      destination: path.href,
                      section: 'contact_related_services'
                    })}
                  >
                    <h3 className="font-semibold text-white">{path.title}</h3>

                    <p className="mt-2 text-sm leading-6 text-slate-300">{path.description}</p>

                    <span className="mt-4 inline-flex text-sm font-semibold text-cyan-200">
                      Saber mais →
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
