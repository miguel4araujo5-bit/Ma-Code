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
          aria-label="Ver portefólio completo da MA-Code"
          className={`group relative block overflow-hidden rounded-[2.25rem] border border-cyan-300/15 bg-slate-950/70 p-5 no-underline shadow-2xl shadow-cyan-950/20 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-200/30 hover:bg-slate-950/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 sm:p-6 md:p-7 ${
            mounted ? 'animate-fade-in-up' : 'opacity-0'
          }`}
        >
          <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
            <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-4 section-label-wrap">
                  <span className="section-label">Projetos reais</span>
                </div>

                <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Veja aqui uma amostra do nosso Portefólio.
                </h2>
              </div>

              <div className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-cyan-200/50 group-hover:bg-cyan-300/15">
                Ver projetos
                <span aria-hidden="true">→</span>
              </div>
            </div>

            <div className="relative mt-6 overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-cyan-300/5 p-3 shadow-2xl shadow-sky-950/20 sm:p-4">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-300/10 via-transparent to-blue-500/10 opacity-70" />

              <div className="relative grid gap-3 sm:grid-cols-3">
                {featuredProjects.map((project) => {
                  const featuredImage = project.images[0]

                  return (
                    <article
                      key={project.slug}
                      className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-black"
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[1.35rem] bg-slate-950 sm:aspect-[16/11]">
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

                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                        <div className="absolute bottom-3 left-3 right-3 z-20">
                          <h3 className="line-clamp-1 text-xs font-semibold text-white sm:text-sm">
                            {project.title}
                          </h3>
                        </div>
                      </div>
                    </article>
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
