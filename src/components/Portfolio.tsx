import { portfolioProjects } from '../data/projects'

type PortfolioProps = {
  mounted: boolean
}

export default function Portfolio({ mounted }: PortfolioProps) {
  return (
    <section id="projetos" className="px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6">
          {portfolioProjects.map((project, index) => (
            <article
              id={project.slug}
              key={project.slug}
              className={`service-card scroll-mt-8 overflow-hidden ${
                mounted ? 'animate-fade-in-up' : 'opacity-0'
              }`}
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="service-card__line" />

              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sky-200">
                      {project.category}
                    </span>
                  </div>

                  <h2 className="service-card__title text-2xl md:text-3xl">{project.title}</h2>
                  <p className="mt-2 text-sm font-medium text-sky-100/90 md:text-base">
                    {project.subtitle}
                  </p>

                  <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
                    {project.description}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {project.highlights.map((highlight) => (
                      <div
                        key={highlight}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-200"
                      >
                        {highlight}
                      </div>
                    ))}
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

                <div className="grid gap-4 sm:grid-cols-2">
                  {project.images.map((image) => (
                    <figure
                      key={image.src}
                      className="group relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-sky-500/10 via-slate-950 to-violet-500/10 p-2 shadow-2xl shadow-sky-950/20"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/20">
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

                        <div className="absolute bottom-3 left-3 right-3">
                          <figcaption className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs font-medium text-white backdrop-blur-md">
                            {image.caption}
                          </figcaption>
                        </div>
                      </div>
                    </figure>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
