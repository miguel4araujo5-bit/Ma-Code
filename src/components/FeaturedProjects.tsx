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
      problem: 'Gestão de marcações feita de forma manual e pouco organizada.',
      solution:
        'Website profissional com marcações online, experiência mobile e painel administrativo para gerir pedidos.',
      result: 'Menos mensagens soltas, agenda mais organizada e imagem mais profissional.',
      tags: ['Website', 'Marcações', 'Admin']
    }
  }

  if (value.includes('porto') || value.includes('exotico') || value.includes('exótico')) {
    return {
      label: 'Loja Online + Checkout',
      problem: 'Necessidade de apresentar produtos online com uma experiência discreta e credível.',
      solution:
        'Loja online com catálogo, carrinho de compras, checkout, páginas legais e estrutura preparada para venda.',
      result: 'Base digital completa para apresentar produtos, receber encomendas e crescer online.',
      tags: ['E-commerce', 'Carrinho', 'Checkout']
    }
  }

  if (value.includes('reo')) {
    return {
      label: 'Arquivo + Plataforma Digital',
      problem: 'Conteúdos dispersos e necessidade de uma presença digital organizada.',
      solution:
        'Plataforma com programas, arquivo, conteúdos estruturados e navegação simples para utilização institucional.',
      result: 'Conteúdos mais acessíveis, melhor organização e presença digital mais forte.',
      tags: ['Plataforma', 'Arquivo', 'Conteúdos']
    }
  }

  return {
    label: 'Projeto Digital',
    problem: 'Necessidade de transformar uma ideia numa presença digital clara.',
    solution:
      'Solução web criada à medida, com foco em apresentação profissional, estrutura clara e utilização simples.',
    result: 'Projeto publicado, funcional e preparado para utilização real.',
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
                  Projetos publicados, não conceitos.
                </h2>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                  Websites, lojas online e plataformas criadas para negócios reais, com objetivos
                  concretos: apresentar melhor, organizar processos, receber contactos e vender.
                </p>
              </div>

              <div className="rounded-[2rem] border border-cyan-300/15 bg-cyan-300/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                  O que isto prova
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  A MA-Code não cria apenas páginas bonitas. Cria soluções digitais completas:
                  marcações, lojas, áreas administrativas, arquivos, conteúdos dinâmicos e
                  funcionalidades adaptadas ao negócio.
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
                      <div className="space-y-3 text-sm leading-6 text-slate-300">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Problema
                          </p>
                          <p className="mt-1">{proof.problem}</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                            Solução
                          </p>
                          <p className="mt-1">{proof.solution}</p>
                        </div>

                        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                            Resultado
                          </p>
                          <p className="mt-1 text-slate-200">{proof.result}</p>
                        </div>
                      </div>

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
                  Quer criar algo parecido para o seu negócio?
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Veja os projetos com mais detalhe ou peça uma proposta adaptada ao que precisa.
                </p>
              </div>

              <a
                href="/projetos"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/50 hover:bg-cyan-300/15"
                aria-label="Ver página completa de projetos da MA-Code"
              >
                Ver projetos
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
