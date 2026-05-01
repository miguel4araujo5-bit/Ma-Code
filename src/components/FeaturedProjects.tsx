import { portfolioProjects } from '../data/projects'

type FeaturedProjectsProps = {
  mounted: boolean
}

export default function FeaturedProjects({ mounted }: FeaturedProjectsProps) {
  return (
    <section id="projetos" className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 section-label-wrap">
          <span className="section-label">Projetos</span>
        </div>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Alguns projetos já desenvolvidos
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
              Websites, lojas online e aplicações web criadas para negócios e instituições com
              necessidades reais.
            </p>
          </div>

          <a href="/projetos" className="btn-secondary hightech-button-secondary">
            Ver portefólio completo
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {portfolioProjects.map((project, index) => {
            const featuredImage = project.images[0]

            return (
              <a
                key={project.slug}
                href={`/projetos#${project.slug}`}
                className={`service-card group block ${
                  mounted ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 120}ms` }}
                aria-label={`Ver detalhes do projeto ${project.title}`}
              >
                <div className="service-card__line" />

                <div className="mb-5 overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20">
                  <div className="relative aspect-[4/3]">
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  </div>
                </div>

                <span className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                  {project.category}
                </span>

                <h3 className="service-card__title">{project.title}</h3>
                <p className="service-card__description">{project.teaser}</p>

                <span className="mt-5 inline-flex text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">
                  Ver detalhes
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
