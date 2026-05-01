import { portfolioProjects } from '../data/projects'

type PortfolioProps = {
  mounted: boolean
}

function getProjectDomain(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return href
  }
}

export default function Portfolio({ mounted }: PortfolioProps) {
  return (
    <section id="projetos" className="px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <div className="mb-5 section-label-wrap">
              <span className="section-label">Projetos selecionados</span>
            </div>

            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Exemplos claros do que foi criado.
            </h2>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              A página foi organizada para mostrar não só imagens bonitas, mas também o
              objetivo, a solução entregue, as funcionalidades e o valor prático de cada
              projeto.
            </p>
          </div>

          <nav
            className="grid gap-3 sm:grid-cols-3"
            aria-label="Navegação rápida pelos projetos"
          >
            {portfolioProjects.map((project) => (
              <a
                key={project.slug}
                href={`#${project.slug}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-cyan-300/[0.06]"
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
                className={`service-card scroll-mt-24 overflow-hidden ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="service-card__line" />

                <div className="relative z-10 grid gap-8 xl:grid-cols-[0.92fr_1.08fr] xl:items-start">
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sky-200">
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

                    <div className="mt-6 grid gap-4">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                          Objetivo
                        </span>
                        <p className="mt-3 text-sm leading-7 text-slate-200">
                          {project.clientNeed}
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                            Funcionalidades
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
                  </div>

                  <div className="space-y-4">
                    <figure className="group relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-sky-500/10 via-slate-950 to-violet-500/10 p-2 shadow-2xl shadow-sky-950/20">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20">
                        <img
                          src={featuredImage.src}
                          alt={featuredImage.alt}
                          className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.035]"
                          loading={index === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                        <figcaption className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-xs font-medium text-white backdrop-blur-md">
                          {featuredImage.caption}
                        </figcaption>
                      </div>
                    </figure>

                    {galleryImages.length > 0 && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {galleryImages.map((image) => (
                          <figure
                            key={image.src}
                            className="group relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-gradient-to-br from-sky-500/10 via-slate-950 to-violet-500/10 p-2 shadow-2xl shadow-sky-950/20"
                          >
                            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.05rem] border border-white/10 bg-black/20">
                              <img
                                src={image.src}
                                alt={image.alt}
                                className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                                loading="lazy"
                                decoding="async"
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none'
                                }}
                              />

                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                              <figcaption className="absolute bottom-3 left-3 right-3 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs font-medium text-white backdrop-blur-md">
                                {image.caption}
                              </figcaption>
                            </div>
                          </figure>
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
                Tem um negócio, loja ou ideia que precisa de uma solução digital?
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                A MA-Code pode criar um website simples, uma loja online, um sistema de
                marcações, uma aplicação interna, uma área administrativa ou uma integração
                personalizada com IA, bases de dados, APIs ou automação.
              </p>
            </div>

            <a href="/#orcamento" className="btn-primary hightech-button">
              <span className="btn-shine" />
              <span className="relative z-10">Pedir orçamento</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
