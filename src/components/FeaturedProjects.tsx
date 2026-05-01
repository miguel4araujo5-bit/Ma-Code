import { portfolioProjects, type PortfolioProject } from '../data/projects'

type FeaturedProjectsProps = {
  mounted: boolean
}

type ProjectVisualMeta = {
  label: string
  initial: string
  metric: string
  metricLabel: string
  gradient: string
  glow: string
}

const projectVisuals: Record<string, ProjectVisualMeta> = {
  reo: {
    label: 'Arquivo áudio',
    initial: 'REO',
    metric: 'PWA',
    metricLabel: 'Instalável',
    gradient: 'from-cyan-300/25 via-sky-500/10 to-teal-300/20',
    glow: 'bg-cyan-300/20',
  },
  'rosa-maria': {
    label: 'Marcações online',
    initial: 'RM',
    metric: 'Admin',
    metricLabel: 'Painel privado',
    gradient: 'from-fuchsia-300/20 via-rose-500/10 to-cyan-300/15',
    glow: 'bg-fuchsia-300/20',
  },
  'porto-exotico': {
    label: 'Loja online',
    initial: 'PX',
    metric: 'Checkout',
    metricLabel: 'E-commerce',
    gradient: 'from-amber-300/20 via-orange-500/10 to-cyan-300/15',
    glow: 'bg-amber-300/20',
  },
}

function getProjectVisual(project: PortfolioProject): ProjectVisualMeta {
  return (
    projectVisuals[project.slug] ?? {
      label: 'Projeto digital',
      initial: project.title.slice(0, 2).toUpperCase(),
      metric: 'Web',
      metricLabel: 'Projeto online',
      gradient: 'from-cyan-300/20 via-sky-500/10 to-violet-300/15',
      glow: 'bg-cyan-300/20',
    }
  )
}

function ProjectFallbackVisual({
  project,
  index,
}: {
  project: PortfolioProject
  index: number
}) {
  const visual = getProjectVisual(project)

  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-gradient-to-br ${visual.gradient}`}
      aria-hidden="true"
    >
      <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl ${visual.glow}`} />
      <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="absolute inset-4 rounded-[1.35rem] border border-white/10 bg-slate-950/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-300/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-300/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
          </div>

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
            {visual.label}
          </span>
        </div>

        <div className="grid h-[calc(100%-2.75rem)] grid-cols-[0.9fr_1.1fr] gap-4">
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-lg font-black tracking-tight text-white shadow-[0_0_24px_rgba(125,211,252,0.12)]">
              {visual.initial}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Projeto 0{index + 1}
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{visual.metric}</p>
              <p className="text-xs text-slate-300">{visual.metricLabel}</p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="space-y-2.5">
              <span className="block h-2.5 w-3/4 rounded-full bg-white/25" />
              <span className="block h-2.5 w-full rounded-full bg-white/12" />
              <span className="block h-2.5 w-2/3 rounded-full bg-white/12" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="h-12 rounded-xl border border-cyan-200/10 bg-cyan-200/10" />
              <span className="h-12 rounded-xl border border-white/10 bg-white/10" />
              <span className="h-12 rounded-xl border border-sky-200/10 bg-sky-200/10" />
            </div>

            <div className="h-10 rounded-xl border border-cyan-200/20 bg-cyan-200/10" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FeaturedProjects({ mounted }: FeaturedProjectsProps) {
  const featuredProjects = portfolioProjects.slice(0, 3)

  return (
    <section id="projetos" className="relative px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
      <div className="pointer-events-none absolute inset-x-0 top-10 mx-auto h-64 max-w-5xl rounded-full bg-cyan-400/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-6 section-label-wrap">
          <span className="section-label">Projetos</span>
        </div>

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
              Projetos reais, criados para resolver necessidades reais
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              Websites, lojas online e aplicações web com funcionalidades práticas:
              marcações, checkout, painéis privados, PWA, administração e integrações.
            </p>
          </div>

          <a
            href="/projetos"
            className="btn-secondary hightech-button-secondary w-full justify-center md:w-auto"
          >
            Ver portefólio completo
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {featuredProjects.map((project, index) => {
            const featuredImage = project.images[0]
            const technologies = project.technologies.slice(0, 3)
            const extraTechnologies = project.technologies.length - technologies.length

            return (
              <a
                key={project.slug}
                href={`/projetos#${project.slug}`}
                className={`group relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-sky-200/15 bg-slate-950/70 p-4 shadow-[0_0_45px_rgba(56,189,248,0.08)] transition duration-500 hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-slate-950/90 hover:shadow-[0_0_70px_rgba(56,189,248,0.16)] ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 120}ms` }}
                aria-label={`Ver detalhes do projeto ${project.title}`}
              >
                <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
                <span className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-cyan-300/10 blur-3xl transition duration-500 group-hover:bg-cyan-300/20" />

                <div className="relative mb-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/25">
                  <div className="relative aspect-[16/10]">
                    <ProjectFallbackVisual project={project} index={index} />

                    {featuredImage ? (
                      <img
                        src={featuredImage.src}
                        alt={featuredImage.alt}
                        className="absolute inset-0 z-10 h-full w-full object-cover object-top opacity-95 transition duration-500 group-hover:scale-[1.04]"
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : null}

                    <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />

                    <span className="absolute bottom-4 left-4 z-30 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/90 backdrop-blur-md">
                      Caso de estudo
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col">
                  <span className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
                    {project.category}
                  </span>

                  <h3 className="text-xl font-semibold tracking-tight text-white transition duration-300 group-hover:text-cyan-50 md:text-2xl">
                    {project.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {project.teaser}
                  </p>

                  <ul className="mt-5 space-y-2">
                    {project.highlights.slice(0, 2).map((highlight) => (
                      <li
                        key={highlight}
                        className="flex gap-2 text-sm leading-6 text-slate-300"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(125,211,252,0.9)]" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {technologies.map((technology) => (
                      <span
                        key={technology}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300"
                      >
                        {technology}
                      </span>
                    ))}

                    {extraTechnologies > 0 ? (
                      <span className="rounded-full border border-cyan-200/15 bg-cyan-200/[0.06] px-3 py-1 text-xs font-medium text-cyan-100">
                        +{extraTechnologies}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-5">
                    <span className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">
                      Ver detalhes
                    </span>

                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10 text-cyan-100 transition duration-300 group-hover:translate-x-1 group-hover:border-cyan-200/40 group-hover:bg-cyan-200/15">
                      →
                    </span>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
