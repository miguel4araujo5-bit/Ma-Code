import { portfolioProjects } from '../data/projects'

type PortfolioProps = {
  mounted: boolean
}

type ProjectScreenshot = {
  src: string
  alt: string
  caption: string
}

function getProjectDomain(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return href
  }
}

function ProjectImageFrame({
  image,
  featured = false,
  compact = false,
  eager = false,
}: {
  image: ProjectScreenshot
  featured?: boolean
  compact?: boolean
  eager?: boolean
}) {
  const frameHeight = compact
    ? 'h-56 sm:h-64'
    : featured
      ? 'h-[22rem] sm:h-[30rem] lg:h-[34rem]'
      : 'h-72 sm:h-80'

  const frameWidth = compact ? 'w-[82vw] shrink-0 snap-start sm:w-full' : 'w-full'

  return (
    <figure
      className={`group relative ${frameWidth} overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-sky-500/10 via-slate-950 to-violet-500/10 p-2 shadow-2xl shadow-sky-950/20 transition duration-500 hover:border-cyan-300/25`}
    >
      <div
        className={`relative flex ${frameHeight} items-center justify-center overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-black`}
      >
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-1.5 w-14 -translate-x-1/2 rounded-full bg-white/20" />

        <img
          src={image.src}
          alt={image.alt}
          className="h-full w-full object-contain object-top p-2 transition duration-500 group-hover:scale-[1.01]"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 px-3 py-3 text-xs font-medium leading-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <figcaption>{image.caption}</figcaption>

        <a
          href={image.src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100 transition hover:text-white"
          aria-label={`Abrir imagem maior: ${image.caption}`}
        >
          Abrir maior
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </figure>
  )
}

function DetailList({
  title,
  items,
  accent = 'cyan',
}: {
  title: string
  items: string[]
  accent?: 'cyan' | 'violet'
}) {
  const dotClass =
    accent === 'violet'
      ? 'bg-violet-300 shadow-[0_0_14px_rgba(167,139,250,0.65)]'
      : 'bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.65)]'

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
        {title}
      </span>

      <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Portfolio({ mounted }: PortfolioProps) {
  return (
    <section id="projetos" className="px-4 pb-16 sm:px-6 md:px-10 md:pb-24">
      <div className="mx-auto max-w-7xl">
        <div
          className={`mb-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-sky-950/20 sm:p-6 lg:p-8 ${
            mounted ? 'animate-fade-in-up' : 'opacity-0'
          }`}
        >
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <div className="mb-5 section-label-wrap">
                <span className="section-label">Projetos selecionados</span>
              </div>

              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Projetos publicados. Navegação mais simples.
              </h2>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                Exemplos reais de websites, lojas online, sistemas de marcação, aplicações PWA,
                áreas administrativas e soluções digitais criadas pela MA-Code.
              </p>
            </div>

            <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4 sm:p-5">
              <p className="text-sm leading-7 text-cyan-50">
                Agora cada projeto fica mais direto: primeiro vê o resumo, a imagem principal, as
                funcionalidades essenciais e só depois abre os detalhes completos se quiser.
              </p>
            </div>
          </div>
        </div>

        <nav
          className={`mb-8 rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-2 backdrop-blur-xl ${
            mounted ? 'animate-fade-in-up' : 'opacity-0'
          }`}
          style={{ animationDelay: '80ms' }}
          aria-label="Navegação rápida pelos projetos"
        >
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {portfolioProjects.map((project, index) => (
              <a
                key={project.slug}
                href={`#${project.slug}`}
                className="min-w-[13rem] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition duration-300 hover:border-cyan-300/25 hover:bg-cyan-300/[0.06] sm:min-w-0 sm:flex-1"
                aria-label={`Ver projeto ${project.title}`}
              >
                <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                  Projeto {String(index + 1).padStart(2, '0')}
                </span>
                <strong className="mt-1 block text-sm font-semibold text-white">
                  {project.title}
                </strong>
              </a>
            ))}
          </div>
        </nav>

        <div className="grid gap-8">
          {portfolioProjects.map((project, index) => {
            const featuredImage = project.images[0]
            const galleryImages = project.images.slice(1)
            const nextProject = portfolioProjects[index + 1]

            return (
              <article
                id={project.slug}
                key={project.slug}
                className={`service-card scroll-mt-28 overflow-hidden ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 120 + 140}ms` }}
              >
                <div className="service-card__line" />

                <div className="relative z-10 grid gap-7 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-sky-200">
                        {project.category}
                      </span>

                      <a
                        href={project.href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-100"
                      >
                        {getProjectDomain(project.href)}
                      </a>
                    </div>

                    <h2 className="service-card__title text-2xl md:text-3xl">
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

                    <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                        Necessidade do cliente
                      </span>

                      <p className="mt-3 text-sm leading-7 text-slate-200">
                        {project.clientNeed}
                      </p>
                    </div>

                    <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                        Principais funcionalidades
                      </span>

                      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {project.highlights.slice(0, 4).map((highlight) => (
                          <li
                            key={highlight}
                            className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-cyan-50"
                          >
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <details className="group mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white marker:hidden">
                        <span>Ver detalhes do projeto</span>
                        <span
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-cyan-100 transition group-open:rotate-180"
                          aria-hidden="true"
                        >
                          ↓
                        </span>
                      </summary>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <DetailList title="Entregue" items={project.deliverables} />
                        <DetailList
                          title="Valor criado"
                          items={project.businessValue}
                          accent="violet"
                        />
                      </div>
                    </details>

                    <div className="mt-5 flex flex-wrap gap-2">
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
                        rel="noreferrer"
                        className="btn-primary hightech-button"
                      >
                        <span className="btn-shine" />
                        <span className="relative z-10">Ver projeto online</span>
                      </a>

                      <a href="/#orcamento" className="btn-secondary hightech-button-secondary">
                        Quero algo semelhante
                      </a>
                    </div>

                    {nextProject ? (
                      <a
                        href={`#${nextProject.slug}`}
                        className="mt-5 inline-flex text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80 transition hover:text-white"
                      >
                        Próximo projeto: {nextProject.title} ↓
                      </a>
                    ) : null}
                  </div>

                  <div className="space-y-5 xl:sticky xl:top-6">
                    {featuredImage ? (
                      <ProjectImageFrame image={featuredImage} featured eager={index === 0} />
                    ) : null}

                    {galleryImages.length > 0 && (
                      <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                            Mais ecrãs
                          </span>
                          <span className="text-xs text-slate-400 sm:hidden">Deslizar →</span>
                        </div>

                        <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
                          {galleryImages.map((image) => (
                            <ProjectImageFrame key={image.src} image={image} compact />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div
          className={`service-card mt-8 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
          style={{ animationDelay: `${portfolioProjects.length * 120 + 180}ms` }}
        >
          <div className="service-card__line" />

          <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                Próximo projeto
              </span>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Quer criar uma solução parecida para o seu negócio?
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                A MA-Code cria websites profissionais, lojas online, sistemas de marcações, áreas
                administrativas, aplicações internas, automação e integrações adaptadas à realidade
                de cada negócio.
              </p>
            </div>

            <a href="/#orcamento" className="btn-primary hightech-button">
              <span className="btn-shine" />
              <span className="relative z-10">Receber proposta</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
