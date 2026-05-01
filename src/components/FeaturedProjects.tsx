import { portfolioProjects } from '../data/projects'

type FeaturedProjectsProps = {
  mounted: boolean
}

type PortfolioProject = (typeof portfolioProjects)[number]

function getProjectProof(project: PortfolioProject) {
  const value = `${project.slug} ${project.title}`.toLowerCase()

  if (value.includes('rosa')) {
    return {
      label: 'Marcações + Área Admin',
      description:
        'Website profissional com sistema de marcações online, experiência mobile e painel administrativo para gestão do negócio.',
      tags: ['Website', 'Marcações', 'Admin']
    }
  }

  if (value.includes('porto') || value.includes('exotico') || value.includes('exótico')) {
    return {
      label: 'Loja Online + Checkout',
      description:
        'E-commerce com apresentação de produtos, carrinho de compras, checkout e estrutura preparada para venda online.',
      tags: ['E-commerce', 'Carrinho', 'Checkout']
    }
  }

  if (value.includes('reo')) {
    return {
      label: 'Plataforma Digital',
      description:
        'Projeto digital com organização de conteúdos, arquivo, programas e estrutura pensada para utilização por uma instituição.',
      tags: ['Plataforma', 'Arquivo', 'Conteúdos']
    }
  }

  return {
    label: 'Projeto Digital',
    description:
      'Solução web criada à medida, com foco em apresentação profissional, estrutura clara e utilização simples.',
    tags: ['Website', 'UX', 'Mobile']
  }
}

export default function FeaturedProjects({ mounted }: FeaturedProjectsProps) {
  const featuredProjects = portfolioProjects.slice(0, 3)

  return (
    <section id="projetos" className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
      <div className="mx-auto max-w-7xl">
        <div
          className={`service-card overflow-hidden ${
            mounted ? 'animate-fade-in-up' : 'opacity-0'
          }`}
        >
          <div className="service-card__line" />

          <div className="relative z-10">
            <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
              <div>
                <div className="mb-5 section-label-wrap">
                  <span className="section-label">Projetos reais</span>
                </div>

                <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
                  Trabalho publicado, funcional e feito para negócios reais
                </h2>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                  Mais do que páginas bonitas: desenvolvemos websites, lojas online, sistemas de
                  marcação, áreas administrativas e plataformas digitais pensadas para resolver
                  necessidades concretas.
                </p>
              </div>

              <div className="rounded-[2rem] border border-cyan-300/15 bg-cyan-300/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                  O que isto demonstra
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  A MA-Code consegue criar desde um website simples de apresentação até sistemas com
                  carrinho, marcações, painel de administração, conteúdos dinâmicos e funcionalidades
                  personalizadas.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {featuredProjects.map((project, index) => {
                const featuredImage = project.images[0]
                const proof = getProjectProof(project)

                return (
                  <article
                    key={project.slug}
                    className="group/project relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60 p-3 shadow-2xl shadow-sky-950/20 transition duration-500 hover:-translate-y-1 hover:border-cyan-300/25"
                  >
                    <div className="relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-black">
                      <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/20" />

                      <div className="relative aspect-[9/16] w-full overflow-hidden px-2 pb-3 pt-6">
                        {featuredImage ? (
                          <img
                            src={featuredImage.src}
                            alt={featuredImage.alt}
                            className="h-full w-full rounded-xl object-contain object-top transition duration-500 group-hover/project:scale-[1.025]"
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}

                        <div className="pointer-events-none absolute inset-x-2 bottom-3 h-36 rounded-b-xl bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

                        <div className="absolute bottom-5 left-5 right-5 z-20">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
                            Projeto 0{index + 1}
                          </span>
                          <h3 className="mt-1 text-base font-semibold text-white">
                            {project.title}
                          </h3>
                          <p className="mt-1 text-xs font-medium text-cyan-100">{proof.label}</p>
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 px-2 pb-2 pt-4">
                      <p className="text-sm leading-6 text-slate-300">{proof.description}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {proof.tags.map((tag) => (
                          <span
                            key={`${project.slug}-${tag}`}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  Quer ver mais detalhes de cada projeto?
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  A página de projetos mostra melhor as funcionalidades, imagens e tipo de solução
                  criada.
                </p>
              </div>

              <a
                href="/projetos"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/50 hover:bg-cyan-300/15"
                aria-label="Ver página completa de projetos da MA-Code"
              >
                Ver página de projetos
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
