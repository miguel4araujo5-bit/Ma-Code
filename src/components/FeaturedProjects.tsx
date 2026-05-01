import { portfolioProjects } from '../data/projects'

type FeaturedProjectsProps = {
  mounted: boolean
}

export default function FeaturedProjects({ mounted }: FeaturedProjectsProps) {
  const featuredProjects = portfolioProjects.slice(0, 3)

  return (
    <section id="projetos" className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
      <div className="mx-auto max-w-7xl">
        <a
          href="/projetos"
          className={`service-card group block overflow-hidden ${
            mounted ? 'animate-fade-in-up' : 'opacity-0'
          }`}
          aria-label="Ver página completa de projetos da MA-Code"
        >
          <div className="service-card__line" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="mb-5 section-label-wrap">
                <span className="section-label">Projetos</span>
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
                Projetos reais desenvolvidos pela MA-Code
              </h2>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                Websites, lojas online, sistemas de marcação, aplicações PWA, painéis
                administrativos e soluções digitais criadas para necessidades reais de
                negócios e instituições.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  REO
                </span>
                <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-100">
                  Rosa Maria
                </span>
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                  Porto Exótico
                </span>
              </div>

              <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-sky-200 transition duration-300 group-hover:translate-x-1 group-hover:text-cyan-100">
                Ver página de projetos
                <span aria-hidden="true">→</span>
              </span>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-cyan-300/10 blur-3xl transition duration-500 group-hover:bg-cyan-300/16" />

              <div className="relative grid gap-3 sm:grid-cols-3">
                {featuredProjects.map((project, index) => {
                  const featuredImage = project.images[0]

                  return (
                    <figure
                      key={project.slug}
                      className={`relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/25 shadow-2xl shadow-sky-950/20 transition duration-500 group-hover:-translate-y-1 ${
                        index === 1 ? 'sm:mt-8' : ''
                      } ${index === 2 ? 'sm:mt-4' : ''}`}
                    >
                      <div className="relative aspect-[4/5] overflow-hidden">
                        {featuredImage ? (
                          <img
                            src={featuredImage.src}
                            alt={featuredImage.alt}
                            className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        <figcaption className="absolute bottom-3 left-3 right-3">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
                            Projeto 0{index + 1}
                          </span>
                          <strong className="mt-1 block text-sm font-semibold text-white">
                            {project.title}
                          </strong>
                        </figcaption>
                      </div>
                    </figure>
                  )
                })}
              </div>
            </div>
          </div>
        </a>
      </div>
    </section>
  )
}
