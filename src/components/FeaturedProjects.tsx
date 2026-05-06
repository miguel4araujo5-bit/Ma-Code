import { portfolioProjects } from '../data/projects'

type FeaturedProjectsProps = {
  mounted: boolean
}

type PortfolioProject = (typeof portfolioProjects)[number]

type ProjectProof = {
  label: string
  description: string
  tags: string[]
  outcome: string
}

function getProjectProof(project: PortfolioProject): ProjectProof {
  const value = `${project.slug} ${project.title}`.toLowerCase()

  if (value.includes('rosa')) {
    return {
      label: 'Marcações + Área Admin',
      description:
        'Website com marcações online, agenda privada, gestão de horários, cálculo diário de serviços e contacto rápido com clientes.',
      tags: ['Website', 'Marcações', 'Admin'],
      outcome: 'Menos mensagens soltas. Mais marcações organizadas.'
    }
  }

  if (value.includes('porto') || value.includes('exotico') || value.includes('exótico')) {
    return {
      label: 'Loja Online + IA',
      description:
        'E-commerce com catálogo, carrinho, checkout, consentimento de cookies, analytics, assistente IA e backoffice de encomendas.',
      tags: ['E-commerce', 'IA', 'Backoffice'],
      outcome: 'Loja online preparada para vender, medir e gerir.'
    }
  }

  if (value.includes('reo')) {
    return {
      label: 'Arquivo Digital + PWA',
      description:
        'Plataforma web/PWA para organizar programas, episódios e conteúdos áudio, reaproveitando dados existentes no Google Drive da escola.',
      tags: ['PWA', 'Arquivo', 'Google Drive'],
      outcome: 'Arquivo mais acessível, organizado e fácil de consultar.'
    }
  }

  return {
    label: 'Projeto Digital',
    description:
      'Solução web criada à medida, com foco em apresentação profissional, estrutura clara e utilização simples.',
    tags: ['Website', 'UX', 'Mobile'],
    outcome: 'Uma solução ajustada ao objetivo do projeto.'
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
            <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
              <div>
                <div className="mb-5 section-label-wrap">
                  <span className="section-label">Projetos reais</span>
                </div>

                <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
                  Não mostramos apenas design. Mostramos soluções a funcionar.
                </h2>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                  Websites, lojas online, sistemas de marcação, áreas administrativas e plataformas
                  digitais criadas para resolver necessidades concretas: receber contactos, vender,
                  organizar processos e poupar tempo no dia a dia.
                </p>
              </div>

              <div className="rounded-[2rem] border border-cyan-300/15 bg-cyan-300/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                  Prova de capacidade
                </p>

                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Estes projetos mostram três níveis de trabalho: presença profissional, conversão
                  online e sistemas digitais com gestão interna, arquivo, IA, analytics ou
                  integrações.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {featuredProjects.map((project, index) => {
                const featuredImage = project.images[0]
                const proof = getProjectProof(project)
                const firstBusinessValue = project.businessValue[0]
                const firstHighlight = project.highlights[0]

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

                          <p className="mt-1 text-xs font-medium text-cyan-100">{proof.label}</p>
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 px-2 pb-2 pt-4">
                      <p className="text-sm leading-6 text-slate-300">{proof.description}</p>

                      <div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/5 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
                          Resultado
                        </p>

                        <p className="mt-2 text-sm font-medium leading-6 text-cyan-50">
                          {proof.outcome}
                        </p>
                      </div>

                      <div className="mt-4 space-y-2 text-xs leading-5 text-slate-400">
                        {firstHighlight ? <p>• {firstHighlight}</p> : null}
                        {firstBusinessValue ? <p>• {firstBusinessValue}</p> : null}
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

            <div className="mt-8 grid gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-sm font-semibold text-white">
                  Ver projetos completos com imagens e funcionalidades
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  A página de portefólio mostra cada projeto com mais detalhe: contexto,
                  necessidade do cliente, funcionalidades, valor prático e capturas reais.
                </p>
              </div>

              <span className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-cyan-200/50 group-hover:bg-cyan-300/15">
                Ver página de projetos
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </div>
        </a>
      </div>
    </section>
  )
}
