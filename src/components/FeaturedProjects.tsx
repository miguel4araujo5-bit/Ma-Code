import { portfolioProjects } from '../data/projects'

type FeaturedProjectsProps = {
  mounted: boolean
}

export default function FeaturedProjects({ mounted }: FeaturedProjectsProps) {
  const featuredProjects = portfolioProjects.slice(0, 3)

  return (
    <section id="projetos" className="px-5 pb-16 sm:px-6 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-[3rem]">
            Projetos que{' '}
            <span className="bg-gradient-to-r from-violet-200 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
              geram resultados
            </span>
          </h2>

          <p className="mt-3 text-base text-slate-400">
            Alguns dos negócios que confiaram na MA-Code
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featuredProjects.map((project, index) => {
            const featuredImage = project.images[0]

            return (
              <a
                key={project.slug}
                href={project.href}
                target="_blank"
                rel="noreferrer"
                className={`group relative block overflow-hidden rounded-[1.65rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,22,0.96),rgba(6,9,16,0.98))] shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-violet-300/28 hover:shadow-[0_28px_70px_rgba(91,33,182,0.18)] ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 110}ms` }}
              >
                <div className="relative aspect-[16/10] overflow-hidden">
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

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                </div>

                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {project.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{project.category}</div>
                  </div>

                  <div className="shrink-0 text-sm font-semibold text-slate-200 transition duration-300 group-hover:text-violet-200">
                    Ver projeto →
                  </div>
                </div>
              </a>
            )
          })}

          <a
            href="/projetos"
            className={`group relative flex min-h-[100%] flex-col justify-between overflow-hidden rounded-[1.65rem] border border-violet-300/18 bg-[linear-gradient(180deg,rgba(18,11,34,0.96),rgba(9,10,18,0.98))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-violet-200/35 hover:shadow-[0_28px_70px_rgba(91,33,182,0.22)] ${
              mounted ? 'animate-fade-in-up' : 'opacity-0'
            }`}
            style={{ animationDelay: '330ms' }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_22%,rgba(168,85,247,0.22),transparent_24%),radial-gradient(circle_at_82%_78%,rgba(59,130,246,0.14),transparent_26%)]" />

            <div className="relative z-10">
              <div className="inline-flex rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-violet-100">
                Portefólio
              </div>

              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">
                Ver mais projetos
              </h3>

              <p className="mt-4 text-sm leading-7 text-slate-300">
                Conheça melhor o portefólio da MA-Code e explore mais exemplos de trabalho real.
              </p>
            </div>

            <div className="relative z-10 mt-8 inline-flex items-center gap-2 text-sm font-semibold text-violet-200 transition duration-300 group-hover:text-violet-100">
              Ver portefólio completo
              <span>→</span>
            </div>
          </a>
        </div>
      </div>
    </section>
  )
}
