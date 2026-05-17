import { portfolioProjects } from '../data/projects'

type FeaturedProjectsProps = {
  mounted: boolean
}

type PortfolioProject = (typeof portfolioProjects)[number]

type ProjectProof = {
  label: string
}

function getProjectProof(project: PortfolioProject): ProjectProof {
  const value = `${project.slug} ${project.title}`.toLowerCase()

  if (value.includes('rosa')) {
    return {
      label: 'Marcações + Área Admin'
    }
  }

  if (value.includes('porto') || value.includes('exotico') || value.includes('exótico')) {
    return {
      label: 'Loja Online + IA'
    }
  }

  if (value.includes('reo')) {
    return {
      label: 'Arquivo Digital + PWA'
    }
  }

  return {
    label: 'Projeto Digital'
  }
}

export default function FeaturedProjects({ mounted }: FeaturedProjectsProps) {
  const featuredProjects = portfolioProjects.slice(0, 3)

  return (
    <section id="projetos" className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
      <div className="mx-auto max-w-7xl">
        <a
          href="/projetos"
          aria-label="Ver página completa de projetos da MA-Code"
          className={`group relative block overflow-hidden rounded-[2.25rem] border border-cyan-300/15 bg-slate-950/70 p-5 no-underline shadow-2xl shadow-cyan-950/20 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-200/30 hover:bg-slate-950/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 sm:p-6 md:p-8 ${
            mounted ? 'animate-fade-in-up' : 'opacity-0'
          }`}
        >
          <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
            <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div>
                <div className="mb-5 section-label-wrap">
                  <span className="section-label">Projetos reais</span>
                </div>

                <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
                  Veja uma amostra. O detalhe está no portefólio.
                </h2>
              </div>

              <div className="rounded-[2rem] border border-cyan-300/15 bg-cyan-300/5 p-5">
                <p className="text-sm leading-7 text-slate-300">
                  Três exemplos rápidos de soluções já criadas: arquivo digital, marcações online
                  e loja online com IA.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {featuredProjects.map((project, index) => {
                const featuredImage = project.images[0]
                const proof = getProjectProof(project)

                return (
                  <article
                    key={project.slug}
                    className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-3 shadow-2xl shadow-sky-950/20 transition duration-300 group-hover:border-cyan-200/20"
                  >
                    <div className="relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-black">
                      <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/20" />

                      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.45rem] bg-slate-950">
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

                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />

                        <div className="absolute bottom-4 left-4 right-4 z-20">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
                            Projeto 0{index + 1}
                          </span>

                          <h3 className="mt-1 text-base font-semibold text-white">
                            {project.title}
                          </h3>

                          <p className="mt-1 text-sm font-medium text-cyan-100">
                            {proof.label}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="mt-8 grid gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-sm font-semibold text-white">
                  Ver projetos completos
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  No portefólio encontra contexto, funcionalidades, capturas reais e valor prático
                  de cada projeto.
                </p>
              </div>

              <span className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-cyan-200/50 group-hover:bg-cyan-300/15">
                Ver projetos
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </div>
        </a>
      </div>
    </section>
  )
}
