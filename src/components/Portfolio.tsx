import { portfolioProjects, type PortfolioImage } from '../data/projects'

type PortfolioProps = {
  mounted: boolean
}

type ProjectScreenshot = PortfolioImage

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
  eager = false,
}: {
  image: ProjectScreenshot
  featured?: boolean
  eager?: boolean
}) {
  return (
    <figure
      className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-sky-500/10 via-slate-950 to-violet-500/10 p-2 shadow-2xl shadow-sky-950/20 transition duration-500 hover:-translate-y-1 hover:border-cyan-300/25 ${
        featured ? 'mx-auto w-full max-w-[40rem]' : 'mx-auto w-full max-w-[28rem]'
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
            featured ? 'max-h-[72vh] md:max-h-[50rem]' : 'max-h-[64vh] md:max-h-[40rem]'
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
              Projetos publicados que mostram soluções reais em funcionamento.
            </h2>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Exemplos concretos de websites profissionais, lojas online, sistemas de marcação,
              áreas administrativas, aplicações PWA e plataformas digitais criadas pela MA-Code para
              resolver necessidades reais.
            </p>

            <p className="mt-3 max-w-3xl text-xs leading-6 text-cyan-100/80 md:text-sm">
              Toque num projeto para avançar diretamente para o caso. Nas molduras, deslize para ver
              o ecrã completo ou abra a imagem em tamanho maior.
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
                  Ver projeto
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

                <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
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

                    <h2 id={`${project.slug}-title`} className="service-card__title text-2xl md:text-3xl">
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

                    <div className="mt-6 grid gap-4">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                          Necessidade do cliente
                        </span>
                        <p className="mt-3 text-sm leading-7 text-slate-200">
                          {project.clientNeed}
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                            Solução criada
                          </span>

                          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
                            {project.highlights.map((highlight) => (
                              <li key={highlight} className="flex gap-3">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.65)]" />
                                <span>{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                            Entregue no projeto
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

                      <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                          Valor para o cliente
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
                        href="/#orcamento"
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
                      <div className="grid gap-5 md:grid-cols-2 md:items-start">
                        {galleryImages.map((image) => (
                          <ProjectImageFrame key={image.src} image={image} />
                        ))}
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
          style={{ animationDelay: `${portfolioProjects.length * 120}ms` }}
        >
          <div className="service-card__line" />

          <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                Próximo projeto
              </span>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Quer criar uma solução digital parecida para o seu negócio?
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                A MA-Code cria websites profissionais, lojas online, sistemas de marcações, áreas
                administrativas, aplicações internas, automação e integrações adaptadas à realidade
                de cada negócio.
              </p>
            </div>

            <a
              href="/#orcamento"
              className="btn-primary hightech-button"
              aria-label="Pedir proposta para criar uma solução digital"
            >
              <span className="btn-shine" />
              <span className="relative z-10">Receber proposta</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
