import { useEffect } from 'react'

const siteUrl = 'https://ma-code.pt'
const productPath = '/produtos/ma-professor'

type FeatureCardProps = {
  eyebrow: string
  title: string
  description: string
  items: string[]
}

function updateMeta(
  name: string,
  content: string
) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      `meta[name="${name}"]`
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.name = name

    document.head.appendChild(
      meta
    )
  }

  meta.content = content
}

function updatePropertyMeta(
  property: string,
  content: string
) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      `meta[property="${property}"]`
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.setAttribute(
      'property',
      property
    )

    document.head.appendChild(
      meta
    )
  }

  meta.content = content
}

function updateCanonical(
  href: string
) {
  let canonical =
    document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )

  if (!canonical) {
    canonical =
      document.createElement(
        'link'
      )

    canonical.rel = 'canonical'

    document.head.appendChild(
      canonical
    )
  }

  canonical.href = href
}

function FeatureCard({
  eyebrow,
  title,
  description,
  items
}: FeatureCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">
        {title}
      </h2>

      <p className="mt-3 text-sm leading-7 text-slate-300">
        {description}
      </p>

      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 text-sm leading-6 text-slate-200"
          >
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.75)]" />

            <span>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}

export default function MAProfessorPage() {
  useEffect(() => {
    document.title =
      'MA-Professor | Gestão de sumários, UFCD e avaliações'

    updateMeta(
      'description',
      'MA-Professor é uma aplicação da MA-Code para planificar aulas, criar sumários, controlar UFCD, registar avaliações, faltas e recuperações de aprendizagens.'
    )

    updateMeta(
      'keywords',
      'MA-Professor, gestão de sumários, UFCD, cursos profissionais, planificação de aulas, avaliações de alunos, faltas, recuperação de aprendizagens'
    )

    updateMeta(
      'robots',
      'noindex, nofollow, noarchive, nosnippet, noimageindex'
    )

    updatePropertyMeta(
      'og:type',
      'website'
    )

    updatePropertyMeta(
      'og:locale',
      'pt_PT'
    )

    updatePropertyMeta(
      'og:site_name',
      'MA-Code'
    )

    updatePropertyMeta(
      'og:url',
      `${siteUrl}${productPath}`
    )

    updatePropertyMeta(
      'og:title',
      'MA-Professor | Versão Beta'
    )

    updatePropertyMeta(
      'og:description',
      'Aplicação para gestão de sumários, UFCD, avaliações, faltas e recuperações de aprendizagens.'
    )

    updatePropertyMeta(
      'og:image',
      `${siteUrl}/ma-code.png`
    )

    updateMeta(
      'twitter:card',
      'summary_large_image'
    )

    updateMeta(
      'twitter:title',
      'MA-Professor | Versão Beta'
    )

    updateMeta(
      'twitter:description',
      'Gestão de sumários, UFCD, avaliações e faltas para professores.'
    )

    updateMeta(
      'twitter:image',
      `${siteUrl}/ma-code.png`
    )

    updateCanonical(
      `${siteUrl}${productPath}`
    )
  }, [])

  const features: FeatureCardProps[] = [
    {
      eyebrow:
        'Planificação e sumários',
      title:
        'Prepare a aula e receba uma sugestão de sumário.',
      description:
        'A planificação deixa de ser apenas um documento arquivado e passa a ajudar diretamente na preparação de cada aula.',
      items: [
        'Planificações organizadas por turma, disciplina e UFCD.',
        'Indicação simples do que será realizado na aula.',
        'Sugestão de sumário baseada na planificação e nas aulas anteriores.',
        'Texto sempre revisto e confirmado pelo professor.'
      ]
    },
    {
      eyebrow:
        'Avaliação',
      title:
        'Avalie os alunos dentro da própria aula.',
      description:
        'A avaliação fica associada ao sumário, à data, à turma e à UFCD correspondente.',
      items: [
        'Lista de alunos com número e nome.',
        'Estados Avaliado, Faltou e Dispensado.',
        'Falta com classificação automática de 0 valores.',
        'Dispensa com classificação automática de 10 valores.'
      ]
    },
    {
      eyebrow:
        'UFCD e classificações',
      title:
        'Acompanhe o progresso e a média de cada aluno.',
      description:
        'Todas as avaliações da UFCD contribuem para uma média transparente, que o professor pode rever antes de confirmar a nota final.',
      items: [
        'Contagem dos tempos realizados e ainda em falta.',
        'Média automática das avaliações da UFCD.',
        'Sugestão de classificação final.',
        'Decisão final sempre confirmada pelo professor.'
      ]
    },
    {
      eyebrow:
        'Assiduidade',
      title:
        'Identifique rapidamente quem precisa de recuperação.',
      description:
        'O MA-Professor acompanha as faltas e avisa quando um aluno ultrapassa 10% das aulas realizadas.',
      items: [
        'Percentagem de faltas por aluno e UFCD.',
        'Aviso preventivo quando se aproxima do limite.',
        'Alerta de recuperação de aprendizagens.',
        'Registo da atividade de recuperação e respetivo estado.'
      ]
    }
  ]

  return (
    <main className="site-shell min-h-screen">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative z-10 px-5 pb-12 pt-6 sm:px-6 md:px-10 md:pb-16 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <a
              href="/"
              className="brand-mark"
              aria-label="MA-Code.pt - Página inicial"
            >
              <img
                src="/ma-code.png"
                alt="MA-Code.pt"
                className="shrink-0 object-contain"
                loading="eager"
                decoding="async"
              />

              <span>
                MA-Code.pt
              </span>
            </a>

            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-100">
              <span className="h-2 w-2 rounded-full bg-violet-300 shadow-[0_0_16px_rgba(196,181,253,0.9)]" />

              Beta privada
            </div>
          </header>

          <div className="grid items-start gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
            <div className="pt-3 lg:pt-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.85)]" />

                Produto MA-Code para professores
              </div>

              <div className="mt-7 flex items-center gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 text-3xl font-black text-cyan-100 shadow-[0_24px_70px_rgba(8,145,178,0.18)] sm:h-24 sm:w-24 sm:text-4xl">
                  MP
                </div>

                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
                    MA-Code
                  </p>

                  <h1 className="mt-1 text-4xl font-black tracking-tight text-white sm:text-6xl">
                    MA-Professor
                  </h1>
                </div>
              </div>

              <p className="mt-8 max-w-3xl text-xl font-semibold leading-9 text-slate-100 sm:text-2xl">
                Planifique, registe e avalie sem perder o controlo das suas{' '}
                <span className="text-cyan-200">
                  turmas e UFCD
                </span>
                .
              </p>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Uma aplicação preparada para apoiar o trabalho diário dos
                professores, desde a planificação da aula até ao sumário,
                avaliação dos alunos, controlo das faltas e classificação
                final de cada UFCD.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {[
                  'Sumários inteligentes',
                  'Planificações',
                  'UFCD',
                  'Avaliações',
                  'Faltas',
                  'Recuperações'
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-9 rounded-[1.75rem] border border-amber-300/20 bg-amber-300/[0.07] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
                  Desenvolvimento reservado
                </p>

                <p className="mt-3 text-sm leading-7 text-amber-50/90">
                  Esta versão está a ser preparada para testes privados. A
                  página não está divulgada no catálogo público e não deve
                  ser indexada pelos motores de pesquisa.
                </p>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
                    Acesso ao produto
                  </p>

                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                    Beta em preparação
                  </h2>
                </div>

                <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-violet-100">
                  Privada
                </span>
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-300">
                O acesso será feito através de uma conta criada com o email
                do professor e uma password definida pelo próprio.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Conta
                  </p>

                  <p className="mt-2 text-sm font-semibold text-white">
                    Email e password pessoal
                  </p>

                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    A password será escolhida pelo professor e só poderá ser
                    redefinida através do email registado.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Licença
                  </p>

                  <p className="mt-2 text-sm font-semibold text-white">
                    Senha exclusiva associada ao email
                  </p>

                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    A senha de licença servirá apenas para ativar ou renovar
                    o período de utilização do MA-Professor.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Dados escolares
                  </p>

                  <p className="mt-2 text-sm font-semibold text-white">
                    Guardados localmente no dispositivo
                  </p>

                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    Turmas, alunos, avaliações, faltas, sumários e
                    planificações não serão incluídos inicialmente no
                    servidor da MA-Code.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
                <p className="text-sm font-semibold text-cyan-50">
                  Nenhum dado de demonstração será carregado por defeito.
                </p>

                <p className="mt-2 text-xs leading-6 text-cyan-100/70">
                  Cada professor começará com uma área vazia e configurará
                  as próprias turmas, disciplinas, UFCD e alunos.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-4xl">
            <span className="section-label">
              Estrutura do produto
            </span>

            <h2 className="mt-5 text-3xl font-black tracking-tight text-white md:text-4xl">
              O trabalho diário do professor num único fluxo.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
              A aplicação será construída de forma progressiva, mantendo
              cada função ligada à respetiva turma, aula e UFCD.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <FeatureCard
                key={feature.title}
                {...feature}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
