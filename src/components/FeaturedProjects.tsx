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

          <div className="relative z-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="mb-5 section-label-wrap">
                <span className="section-label">Projetos reais</span>
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
                Uma amostra rápida. O detalhe está no portefólio.
              </h2>

              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 md:text-base">
                Veja exemplos reais de soluções já criadas pela MA-Code. Na página de projetos
                encontra as imagens completas, funcionalidades e contexto de cada trabalho.
              </p>

              <div className="mt-7 inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-cyan-200/50 group-hover:bg-cyan-300/15">
                Ver projetos completos
                <span aria-hidden="true">→</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-cyan-300/5 p-3 shadow-2xl shadow-sky-950/20 sm:p-4">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-300/10 via-transparent to-blue-500/10 opacity-70" />

              <div className="relative grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                {featuredProjects.map((project, index) => {
                  const featuredImage = project.images[0]
                  const proof = getProjectProof(project)
                  const isMainProject = index === 0

                  return (
                    <article
                      key={project.slug}
                      className={`relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-black ${
                        isMainProject ? 'md:row-span-2' : ''
                      }`}
                    >
                      <div
                        className={`relative w-full overflow-hidden rounded-[1.45rem] bg-slate-950 ${
                          isMainProject
                            ? 'aspect-[16/11] md:h-full md:min-h-[18rem]'
                            : 'aspect-[16/9] md:min-h-[8.5rem]'
                        }`}
                      >
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

                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/95 via-black/55 to-transparent" />

                        <div className="absolute bottom-3 left-3 right-3 z-20 sm:bottom-4 sm:left-4 sm:right-4">
                          <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80 sm:text-[10px]">
                            Projeto 0{index + 1}
                          </span>

                          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-white sm:text-base">
                            {project.title}
                          </h3>

                          <p className="mt-1 text-xs font-medium text-cyan-100 sm:text-sm">
                            {proof.label}
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="relative mt-3 flex flex-col gap-2 rounded-[1.4rem] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                <span>3 projetos em destaque</span>

                <span className="font-semibold text-cyan-100">
                  Abrir portefólio →
                </span>
              </div>
            </div>
          </div>
        </a>
      </div>
    </section>
  )
}
