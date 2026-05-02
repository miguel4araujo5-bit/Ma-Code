import { useState, type FormEvent } from 'react'
import { portfolioProjects, type PortfolioImage, type PortfolioProject } from '../data/projects'

type PortfolioProps = {
  mounted: boolean
}

type ProjectScreenshot = PortfolioImage

const web3FormsAccessKey = '18547eb2-4deb-4420-b33d-64813f8918e5'

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

function getProjectDomain(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return href
  }
}

function getSuggestedProjectType(project: PortfolioProject) {
  if (project.slug === 'porto-exotico') return 'Loja online'
  if (project.slug === 'rosa-maria') return 'Sistema de marcações'
  if (project.slug === 'reo') return 'Aplicação web'

  return 'Ainda não sei'
}

function getProjectDomainLabel(project: PortfolioProject) {
  return getProjectDomain(project.href)
}

function ProjectImageFrame({
  image,
  featured = false,
  eager = false,
}: {
  image: ProjectScreenshot
  featured?: boolean
  eager?: boolean
}) {
  return (
    <figure
      className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-sky-500/10 via-slate-950 to-violet-500/10 p-2 shadow-2xl shadow-sky-950/20 transition duration-500 hover:-translate-y-1 hover:border-cyan-300/25 ${
        featured ? 'mx-auto w-full max-w-[38rem]' : 'mx-auto w-full max-w-[24rem]'
      }`}
      aria-label={`Imagem do projeto: ${image.caption}`}
    >
      <div className="relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-black">
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/20" />

        <div className="absolute right-3 top-2 z-20 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80 backdrop-blur-md">
          Deslizar
        </div>

        <div
          className={`relative w-full overflow-y-auto overflow-x-hidden scroll-smooth px-2 pb-3 pt-7 overscroll-contain focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${
            featured ? 'max-h-[62vh] md:max-h-[38rem]' : 'max-h-[48vh] md:max-h-[30rem]'
          }`}
          tabIndex={0}
          aria-label={`Percorrer screenshot: ${image.caption}`}
        >
          <img
            src={image.src}
            alt={image.alt}
            className="block w-full rounded-xl object-top transition duration-500 group-hover:scale-[1.01]"
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 bg-black/45 px-4 py-3 text-xs font-medium leading-5 text-white backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <figcaption>{image.caption}</figcaption>

          <a
            href={image.src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            aria-label={`Abrir imagem em tamanho maior: ${image.caption}`}
          >
            Abrir maior
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </figure>
  )
}

export default function Portfolio({ mounted }: PortfolioProps) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    projectType: '',
    hasWebsite: '',
    message: '',
    botcheck: '',
  })

  const [isSending, setIsSending] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleProjectInquiry = (project: PortfolioProject) => {
    setSuccessMessage('')
    setErrorMessage('')

    const suggestedMessage = `Referência: ${project.title} (${getProjectDomainLabel(project)})

Olá, gostava de criar uma solução semelhante a este projeto.

Objetivo principal:
Funcionalidades pretendidas:
Já tenho site ou quero começar do zero:
Observações adicionais:`

    setForm((currentForm) => ({
      ...currentForm,
      projectType: currentForm.projectType || getSuggestedProjectType(project),
      message: currentForm.message || suggestedMessage,
    }))
  }

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
          Accept: 'application/json',
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
          botcheck: form.botcheck,
        }),
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
        botcheck: '',
      })
    } catch {
      setErrorMessage('Não foi possível enviar o pedido. Tente novamente.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section
      id="projetos"
      className="px-5 pb-20 sm:px-6 md:px-10 md:pb-24"
      aria-labelledby="portfolio-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <div className="mb-5 section-label-wrap">
              <span className="section-label">Projetos selecionados</span>
            </div>

            <h2
              id="portfolio-heading"
              className="text-3xl font-semibold tracking-tight text-white md:text-4xl"
            >
              Projetos reais com estratégia, desenvolvimento e funcionalidades à medida.
            </h2>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Aqui não mostramos apenas páginas bonitas. Mostramos sistemas publicados, lojas online,
              aplicações PWA, áreas administrativas, automações, integrações e ferramentas digitais
              criadas para resolver problemas concretos.
            </p>

            <p className="mt-3 max-w-3xl text-xs leading-6 text-cyan-100/80 md:text-sm">
              Escolha um projeto para ver o que foi criado, que funcionalidades foram implementadas e
              que valor prático a solução trouxe ao cliente.
            </p>
          </div>

          <nav className="grid gap-3 sm:grid-cols-3" aria-label="Navegação rápida pelos projetos">
            {portfolioProjects.map((project) => (
              <a
                key={project.slug}
                href={`#${project.slug}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-cyan-300/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                aria-label={`Ver detalhes do projeto ${project.title}`}
              >
                <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                  Ver caso
                </span>
                <strong className="mt-2 block text-sm font-semibold text-white">
                  {project.title}
                </strong>
                <span className="mt-1 block text-xs leading-5 text-slate-400">
                  {project.teaser}
                </span>
              </a>
            ))}
          </nav>
        </div>

        <div className="grid gap-8">
          {portfolioProjects.map((project, index) => {
            const featuredImage = project.images[0]
            const galleryImages = project.images.slice(1)

            return (
              <article
                id={project.slug}
                key={project.slug}
                className={`service-card scroll-mt-28 overflow-hidden ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 120}ms` }}
                aria-labelledby={`${project.slug}-title`}
              >
                <div className="service-card__line" />

                <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,0.98fr)_minmax(22rem,0.82fr)] xl:items-start">
                  <div className="min-w-0">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sky-200">
                        {project.category}
                      </span>

                      <a
                        href={project.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                        aria-label={`Abrir website do projeto ${project.title}`}
                      >
                        {getProjectDomain(project.href)}
                      </a>
                    </div>

                    <h2
                      id={`${project.slug}-title`}
                      className="service-card__title text-2xl md:text-3xl"
                    >
                      {project.title}
                    </h2>

                    <p className="mt-2 text-sm font-medium text-sky-100/90 md:text-base">
                      {project.subtitle}
                    </p>

                    <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300 md:text-base">
                      {project.description.split('\n\n').map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>

                    <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {project.proofPoints.map((point) => (
                        <li
                          key={point}
                          className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-xs font-semibold leading-5 text-cyan-50"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                        Necessidade do cliente
                      </span>
                      <p className="mt-3 text-sm leading-7 text-slate-200">
                        {project.clientNeed}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      {project.featureGroups.map((group) => (
                        <div
                          key={group.title}
                          className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                        >
                          <h3 className="text-sm font-semibold text-white">{group.title}</h3>

                          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                            {group.items.map((item) => (
                              <li key={item} className="flex gap-3">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.65)]" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
                      <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                          Valor prático
                        </span>

                        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                          {project.businessValue.map((value) => (
                            <li
                              key={value}
                              className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-cyan-50"
                            >
                              {value}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                          Entregue
                        </span>

                        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
                          {project.deliverables.map((deliverable) => (
                            <li key={deliverable} className="flex gap-3">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300 shadow-[0_0_14px_rgba(167,139,250,0.65)]" />
                              <span>{deliverable}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2" aria-label="Tecnologias usadas">
                      {project.technologies.map((technology) => (
                        <span
                          key={technology}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300"
                        >
                          {technology}
                        </span>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <a
                        href={project.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary hightech-button"
                        aria-label={`Ver projeto publicado: ${project.title}`}
                      >
                        <span className="btn-shine" />
                        <span className="relative z-10">Ver projeto publicado</span>
                      </a>

                      <a
                        href="#portfolio-contact"
                        onClick={() => handleProjectInquiry(project)}
                        className="btn-secondary hightech-button-secondary"
                        aria-label={`Pedir uma solução semelhante ao projeto ${project.title}`}
                      >
                        Quero uma solução semelhante
                      </a>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-5 xl:sticky xl:top-6">
                    {featuredImage ? (
                      <ProjectImageFrame image={featuredImage} featured eager={index === 0} />
                    ) : null}

                    {galleryImages.length > 0 && (
                      <details className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-cyan-100 transition hover:text-white">
                          Ver mais imagens do projeto
                        </summary>

                        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
                          {galleryImages.map((image) => (
                            <ProjectImageFrame key={image.src} image={image} />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div
          id="portfolio-contact"
          className={`service-card mt-8 scroll-mt-28 ${
            mounted ? 'animate-fade-in-up' : 'opacity-0'
          }`}
          style={{ animationDelay: `${portfolioProjects.length * 120}ms` }}
        >
          <div className="service-card__line" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                Próximo projeto
              </span>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Quer uma solução semelhante para o seu negócio?
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                Diga-nos o que pretende criar e respondemos com uma proposta ajustada ao tipo de
                projeto. Pode usar um dos exemplos acima como referência: loja online, sistema de
                marcações, painel administrativo, PWA, automação, IA ou integração com dados
                existentes.
              </p>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                  Para uma resposta mais certeira, indique:
                </span>

                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  <li>• Que tipo de projeto pretende</li>
                  <li>• Se já tem site ou quer começar do zero</li>
                  <li>• Se precisa de loja, marcações, área admin, automação ou IA</li>
                  <li>• Qual é o principal objetivo: contactos, vendas, reservas ou organização</li>
                </ul>
              </div>
            </div>

            <div className="form-shell">
              <form onSubmit={handleSubmit} className="space-y-5">
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
                    <label htmlFor="portfolio-name" className="input-label">
                      Nome
                    </label>
                    <input
                      id="portfolio-name"
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
                    <label htmlFor="portfolio-email" className="input-label">
                      Email
                    </label>
                    <input
                      id="portfolio-email"
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
                    <label htmlFor="portfolio-phone" className="input-label">
                      Telefone / WhatsApp <span className="text-slate-500">(opcional)</span>
                    </label>
                    <input
                      id="portfolio-phone"
                      name="phone"
                      type="tel"
                      className="input-field"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      autoComplete="tel"
                    />
                  </div>

                  <div>
                    <label htmlFor="portfolio-project-type" className="input-label">
                      Tipo de projeto
                    </label>
                    <select
                      id="portfolio-project-type"
                      name="projectType"
                      className="input-field"
                      value={form.projectType}
                      onChange={(e) => setForm({ ...form, projectType: e.target.value })}
                      required
                    >
                      <option value="">Selecione uma opção</option>
                      {projectTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="portfolio-has-website" className="input-label">
                    Já tem site?
                  </label>
                  <select
                    id="portfolio-has-website"
                    name="hasWebsite"
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
                  <label htmlFor="portfolio-message" className="input-label">
                    Descreva o projeto
                  </label>
                  <textarea
                    id="portfolio-message"
                    name="message"
                    className="input-field min-h-36 resize-y"
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
      </div>
    </section>
  )
}
