import {
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  isMAProfessorDatabaseSupported
} from './db'

import {
  maProfessorRepository,
  type SetupSnapshot
} from './repository'

import type {
  AcademicYear,
  SetupStepId
} from './types'

type ApplicationState =
  | 'loading'
  | 'ready'
  | 'unsupported'
  | 'error'

type AcademicYearFormState = {
  name: string
  startDate: string
  endDate: string
}

type NavigationItem = {
  id: string
  label: string
  shortLabel: string
}

type SetupStepDefinition = {
  id: SetupStepId
  number: number
  title: string
  description: string
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Painel',
    shortLabel: 'Painel'
  },
  {
    id: 'calendar',
    label: 'Calendário',
    shortLabel: 'Calendário'
  },
  {
    id: 'giae',
    label: 'Sumários / GIAE',
    shortLabel: 'GIAE'
  },
  {
    id: 'planifications',
    label: 'Planificações',
    shortLabel: 'Planos'
  },
  {
    id: 'groups',
    label: 'Turmas e alunos',
    shortLabel: 'Turmas'
  },
  {
    id: 'assessments',
    label: 'Avaliações',
    shortLabel: 'Avaliar'
  },
  {
    id: 'attendance',
    label: 'Faltas e recuperações',
    shortLabel: 'Faltas'
  },
  {
    id: 'schedule',
    label: 'Horários',
    shortLabel: 'Horário'
  },
  {
    id: 'settings',
    label: 'Definições',
    shortLabel: 'Menu'
  }
]

const setupSteps: SetupStepDefinition[] = [
  {
    id: 'academic_year',
    number: 1,
    title: 'Ano letivo',
    description:
      'Defina o período de funcionamento deste ano letivo.'
  },
  {
    id: 'groups',
    number: 2,
    title: 'Turmas',
    description:
      'Adicione as turmas, cursos e anos de escolaridade.'
  },
  {
    id: 'subjects',
    number: 3,
    title: 'Disciplinas',
    description:
      'Crie as disciplinas e associe-as às respetivas turmas.'
  },
  {
    id: 'modules',
    number: 4,
    title: 'UFCD ou módulos',
    description:
      'Introduza os códigos, nomes, ordem e carga horária.'
  },
  {
    id: 'assessment_criteria',
    number: 5,
    title: 'Critérios de avaliação',
    description:
      'Defina os critérios e as ponderações que totalizam 100%.'
  },
  {
    id: 'planifications',
    number: 6,
    title: 'Planificações',
    description:
      'Organize conteúdos, objetivos e atividades de cada UFCD.'
  },
  {
    id: 'weekly_schedule',
    number: 7,
    title: 'Horário semanal',
    description:
      'Indique os dias, horas e tempos letivos de cada turma.'
  },
  {
    id: 'students',
    number: 8,
    title: 'Alunos',
    description:
      'Adicione o número e o nome dos alunos de cada turma.'
  },
  {
    id: 'confirmation',
    number: 9,
    title: 'Confirmação',
    description:
      'Reveja os dados e conclua a configuração inicial.'
  }
]

function toISODate(
  year: number,
  month: number,
  day: number
) {
  return [
    String(year).padStart(
      4,
      '0'
    ),
    String(month).padStart(
      2,
      '0'
    ),
    String(day).padStart(
      2,
      '0'
    )
  ].join('-')
}

function getSuggestedAcademicYear():
  AcademicYearFormState {
  const today =
    new Date()

  const currentYear =
    today.getFullYear()

  const currentMonth =
    today.getMonth() +
    1

  const startYear =
    currentMonth >= 7
      ? currentYear
      : currentYear -
        1

  return {
    name:
      `${startYear}/${startYear + 1}`,
    startDate:
      toISODate(
        startYear,
        9,
        1
      ),
    endDate:
      toISODate(
        startYear +
          1,
        8,
        31
      )
  }
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message
  }

  return 'Ocorreu um erro inesperado.'
}

function formatDate(
  value: string
) {
  if (!value) {
    return '—'
  }

  const [
    year,
    month,
    day
  ] =
    value
      .split('-')
      .map(Number)

  if (
    !year ||
    !month ||
    !day
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  ).format(
    new Date(
      year,
      month -
        1,
      day
    )
  )
}

function LoadingView() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-md rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-8 text-center shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-100/20 border-t-cyan-200" />
        </div>

        <h1 className="mt-6 text-xl font-black text-white">
          A preparar o MA-Professor
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-400">
          Estamos a abrir a base de dados local deste dispositivo.
        </p>
      </div>
    </div>
  )
}

function UnsupportedView() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-xl rounded-[2rem] border border-amber-300/20 bg-slate-950/80 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-2xl">
          !
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
          Browser incompatível
        </p>

        <h1 className="mt-3 text-2xl font-black text-white">
          Não foi possível abrir o armazenamento local.
        </h1>

        <p className="mt-4 text-sm leading-7 text-slate-300">
          O MA-Professor necessita de um browser com suporte para
          IndexedDB. Experimente abrir a aplicação numa versão atualizada
          do Chrome, Edge, Firefox ou Safari.
        </p>

        <a
          href="/"
          className="mt-7 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.09]"
        >
          Voltar à MA-Code
        </a>
      </div>
    </div>
  )
}

function ErrorView({
  message,
  onRetry
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-xl rounded-[2rem] border border-rose-300/20 bg-slate-950/80 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-300/25 bg-rose-300/10 text-2xl text-rose-100">
          ×
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-rose-200">
          Não foi possível iniciar
        </p>

        <h1 className="mt-3 text-2xl font-black text-white">
          O MA-Professor encontrou um problema.
        </h1>

        <p className="mt-4 rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] p-4 text-sm leading-7 text-rose-50/90">
          {message}
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="mt-7 inline-flex items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/15"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}

function AcademicYearSetup({
  onCreated
}: {
  onCreated: (
    academicYear: AcademicYear
  ) => Promise<void>
}) {
  const initialValues =
    useMemo(
      () =>
        getSuggestedAcademicYear(),
      []
    )

  const [
    form,
    setForm
  ] =
    useState<AcademicYearFormState>(
      initialValues
    )

  const [
    submitting,
    setSubmitting
  ] =
    useState(false)

  const [
    error,
    setError
  ] =
    useState('')

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      submitting
    ) {
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const academicYear =
        await maProfessorRepository.createAcademicYear(
          {
            name:
              form.name,
            startDate:
              form.startDate,
            endDate:
              form.endDate,
            active: true
          }
        )

      await onCreated(
        academicYear
      )
    } catch (
      submitError
    ) {
      setError(
        getErrorMessage(
          submitError
        )
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid items-start gap-7 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
          <span className="inline-flex rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-100">
            Primeira configuração
          </span>

          <h1 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Vamos preparar o seu ano letivo.
          </h1>

          <p className="mt-5 text-sm leading-7 text-slate-300 sm:text-base">
            O MA-Professor começa vazio. As suas turmas, alunos,
            planificações, critérios, aulas e classificações serão
            introduzidos por si e guardados neste dispositivo.
          </p>

          <div className="mt-7 space-y-4">
            {[
              'Nenhum dado de demonstração será criado.',
              'Os dados escolares ficam guardados localmente.',
              'Pode alterar a configuração posteriormente.',
              'As cópias de segurança serão adicionadas antes do lançamento.'
            ].map(
              (
                item
              ) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                >
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-xs font-black text-cyan-100">
                    ✓
                  </span>

                  <p className="text-sm leading-6 text-slate-200">
                    {item}
                  </p>
                </div>
              )
            )}
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Passo 1 de 9
          </p>

          <h2 className="mt-3 text-2xl font-black text-white">
            Ano letivo
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-400">
            Confirme o nome e as datas do período que pretende organizar.
          </p>

          <div className="mt-7 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-200">
                Nome do ano letivo
              </span>

              <input
                type="text"
                value={
                  form.name
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      name:
                        event
                          .target
                          .value
                    })
                  )
                }
                placeholder="2026/2027"
                autoComplete="off"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-200">
                  Data de início
                </span>

                <input
                  type="date"
                  value={
                    form.startDate
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        startDate:
                          event
                            .target
                            .value
                      })
                    )
                  }
                  required
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-200">
                  Data de fim
                </span>

                <input
                  type="date"
                  value={
                    form.endDate
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        endDate:
                          event
                            .target
                            .value
                      })
                    )
                  }
                  required
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                />
              </label>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={
              submitting
            }
            className="mt-7 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting
              ? 'A criar o ano letivo...'
              : 'Criar ano letivo e continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function SetupMetric({
  label,
  value
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

function SetupOverview({
  snapshot,
  onRefresh
}: {
  snapshot: SetupSnapshot
  onRefresh: () => void
}) {
  const completedSteps =
    new Set(
      snapshot.progress
        ?.completedSteps ??
        []
    )

  const currentStep =
    setupSteps.find(
      (
        step
      ) =>
        step.id ===
        snapshot.progress
          ?.currentStep
    )

  return (
    <div className="mx-auto max-w-7xl">
      <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              Configuração inicial
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {snapshot.academicYear.name}
            </h1>

            <p className="mt-3 text-sm leading-7 text-slate-400">
              {formatDate(
                snapshot
                  .academicYear
                  .startDate
              )}{' '}
              a{' '}
              {formatDate(
                snapshot
                  .academicYear
                  .endDate
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
          >
            Atualizar dados
          </button>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          <SetupMetric
            label="Turmas"
            value={
              snapshot.groups.length
            }
          />

          <SetupMetric
            label="Disciplinas"
            value={
              snapshot.subjects.length
            }
          />

          <SetupMetric
            label="UFCD"
            value={
              snapshot.modules.length
            }
          />

          <SetupMetric
            label="Critérios"
            value={
              snapshot
                .assessmentCriteria
                .length
            }
          />

          <SetupMetric
            label="Planificações"
            value={
              snapshot
                .planifications
                .length
            }
          />

          <SetupMetric
            label="Horários"
            value={
              snapshot
                .weeklyScheduleSlots
                .length
            }
          />

          <SetupMetric
            label="Alunos"
            value={
              snapshot.students.length
            }
          />
        </div>

        {currentStep ? (
          <div className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-300/[0.07] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
              Próximo passo
            </p>

            <p className="mt-2 text-lg font-black text-white">
              {currentStep.number}.{' '}
              {currentStep.title}
            </p>

            <p className="mt-2 text-sm leading-6 text-violet-100/75">
              {currentStep.description}
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-7">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Preparação do ano
          </p>

          <h2 className="mt-3 text-2xl font-black text-white">
            Complete os nove passos.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {setupSteps.map(
            (
              step
            ) => {
              const completed =
                completedSteps.has(
                  step.id
                )

              const active =
                snapshot
                  .progress
                  ?.currentStep ===
                step.id

              return (
                <article
                  key={step.id}
                  className={`rounded-[1.5rem] border p-5 transition ${
                    completed
                      ? 'border-emerald-300/20 bg-emerald-300/[0.055]'
                      : active
                        ? 'border-cyan-300/35 bg-cyan-300/[0.08] shadow-lg shadow-cyan-950/20'
                        : 'border-white/10 bg-slate-950/65'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${
                        completed
                          ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                          : active
                            ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-50'
                            : 'border-white/10 bg-white/[0.04] text-slate-400'
                      }`}
                    >
                      {completed
                        ? '✓'
                        : step.number}
                    </span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-white">
                          {step.title}
                        </h3>

                        {active &&
                        !completed ? (
                          <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-cyan-100">
                            Atual
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </article>
              )
            }
          )}
        </div>
      </section>
    </div>
  )
}

function DashboardPreview({
  snapshot
}: {
  snapshot: SetupSnapshot
}) {
  const dashboardCards = [
    {
      label:
        'Turmas ativas',
      value:
        snapshot.groups.filter(
          (
            group
          ) =>
            group.active
        ).length
    },
    {
      label:
        'UFCD configuradas',
      value:
        snapshot.modules.filter(
          (
            module
          ) =>
            module.active
        ).length
    },
    {
      label:
        'Alunos',
      value:
        snapshot.students.filter(
          (
            student
          ) =>
            student.active
        ).length
    },
    {
      label:
        'Planificações',
      value:
        snapshot.planifications.filter(
          (
            planification
          ) =>
            planification.active
        ).length
    }
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Painel
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Ano letivo{' '}
            {snapshot
              .academicYear
              .name}
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-400">
            A configuração inicial está concluída.
          </p>
        </div>

        <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
          Configurado
        </span>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map(
          (
            card
          ) => (
            <article
              key={
                card.label
              }
              className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20"
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {card.label}
              </p>

              <p className="mt-3 text-3xl font-black text-white">
                {card.value}
              </p>
            </article>
          )
        )}
      </div>

      <div className="mt-7 rounded-[2rem] border border-violet-300/15 bg-violet-300/[0.055] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
          Próxima fase
        </p>

        <h2 className="mt-3 text-2xl font-black text-white">
          Calendário, aulas e sumários.
        </h2>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          Depois da configuração inicial, o painel apresentará os tempos
          dados, os tempos em falta, a UFCD atual, a previsão de conclusão,
          os sumários pendentes e os alertas de assiduidade.
        </p>
      </div>
    </div>
  )
}

export default function MAProfessorApp() {
  const [
    applicationState,
    setApplicationState
  ] =
    useState<ApplicationState>(
      'loading'
    )

  const [
    snapshot,
    setSnapshot
  ] =
    useState<SetupSnapshot | null>(
      null
    )

  const [
    errorMessage,
    setErrorMessage
  ] =
    useState('')

  const [
    reloadKey,
    setReloadKey
  ] =
    useState(0)

  useEffect(() => {
    let cancelled =
      false

    async function loadApplication() {
      if (
        !isMAProfessorDatabaseSupported()
      ) {
        if (
          !cancelled
        ) {
          setApplicationState(
            'unsupported'
          )
        }

        return
      }

      setApplicationState(
        'loading'
      )
      setErrorMessage('')

      try {
        await maProfessorRepository.initialize()

        const activeAcademicYear =
          await maProfessorRepository.getActiveAcademicYear()

        if (
          cancelled
        ) {
          return
        }

        if (
          !activeAcademicYear
        ) {
          setSnapshot(null)
          setApplicationState(
            'ready'
          )

          return
        }

        const nextSnapshot =
          await maProfessorRepository.getSetupSnapshot(
            activeAcademicYear.id
          )

        if (
          cancelled
        ) {
          return
        }

        setSnapshot(
          nextSnapshot
        )
        setApplicationState(
          'ready'
        )
      } catch (
        loadError
      ) {
        if (
          cancelled
        ) {
          return
        }

        setErrorMessage(
          getErrorMessage(
            loadError
          )
        )

        setApplicationState(
          'error'
        )
      }
    }

    void loadApplication()

    return () => {
      cancelled = true
    }
  }, [
    reloadKey
  ])

  async function handleAcademicYearCreated(
    academicYear: AcademicYear
  ) {
    const nextSnapshot =
      await maProfessorRepository.getSetupSnapshot(
        academicYear.id
      )

    setSnapshot(
      nextSnapshot
    )
  }

  function handleRetry() {
    setReloadKey(
      (
        current
      ) =>
        current +
        1
    )
  }

  const setupCompleted =
    Boolean(
      snapshot
        ?.academicYear
        .setupCompletedAt ||
        snapshot
          ?.progress
          ?.completedAt
    )

  if (
    applicationState ===
    'loading'
  ) {
    return (
      <LoadingView />
    )
  }

  if (
    applicationState ===
    'unsupported'
  ) {
    return (
      <UnsupportedView />
    )
  }

  if (
    applicationState ===
    'error'
  ) {
    return (
      <ErrorView
        message={
          errorMessage
        }
        onRetry={
          handleRetry
        }
      />
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute right-[-8rem] top-[-4rem] h-[30rem] w-[30rem] rounded-full bg-violet-600/10 blur-[140px]" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-sky-500/[0.07] blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.025)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <div className="relative z-10 min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
        <aside className="hidden min-h-screen border-r border-white/10 bg-slate-950/80 p-5 backdrop-blur-xl lg:flex lg:flex-col">
          <a
            href="/"
            className="flex items-center gap-3"
            aria-label="MA-Code.pt"
          >
            <img
              src="/ma-code.png"
              alt="MA-Code.pt"
              className="h-11 w-11 rounded-xl object-contain"
            />

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                MA-Code
              </p>

              <p className="font-black text-white">
                MA-Professor
              </p>
            </div>
          </a>

          <nav
            className="mt-9 space-y-2"
            aria-label="Navegação do MA-Professor"
          >
            {navigationItems.map(
              (
                item,
                index
              ) => (
                <button
                  key={
                    item.id
                  }
                  type="button"
                  disabled={
                    !setupCompleted
                  }
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                    index ===
                    0
                      ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50'
                      : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-[0.65rem] font-black">
                    {String(
                      index +
                        1
                    ).padStart(
                      2,
                      '0'
                    )}
                  </span>

                  <span>
                    {item.label}
                  </span>
                </button>
              )
            )}
          </nav>

          <div className="mt-auto rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
              Dados locais
            </p>

            <p className="mt-2 text-xs leading-6 text-slate-400">
              Os dados escolares estão guardados neste dispositivo.
            </p>
          </div>
        </aside>

        <section className="min-w-0 pb-24 lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 px-5 py-4 backdrop-blur-xl sm:px-7 lg:px-9">
            <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-4">
              <div className="flex items-center gap-3 lg:hidden">
                <img
                  src="/ma-code.png"
                  alt="MA-Code.pt"
                  className="h-10 w-10 rounded-xl object-contain"
                />

                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-slate-500">
                    MA-Code
                  </p>

                  <p className="text-sm font-black text-white">
                    MA-Professor
                  </p>
                </div>
              </div>

              <div className="hidden lg:block">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Área de trabalho
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-200">
                  {snapshot
                    ? snapshot
                        .academicYear
                        .name
                    : 'Configuração inicial'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-violet-100">
                  Beta privada
                </span>

                <a
                  href="/"
                  className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white sm:inline-flex"
                >
                  Sair
                </a>
              </div>
            </div>
          </header>

          <div className="px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
            <div className="mx-auto max-w-[100rem]">
              {!snapshot ? (
                <AcademicYearSetup
                  onCreated={
                    handleAcademicYearCreated
                  }
                />
              ) : setupCompleted ? (
                <DashboardPreview
                  snapshot={
                    snapshot
                  }
                />
              ) : (
                <SetupOverview
                  snapshot={
                    snapshot
                  }
                  onRefresh={
                    handleRetry
                  }
                />
              )}
            </div>
          </div>
        </section>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-slate-950/95 px-2 py-2 backdrop-blur-xl lg:hidden"
        aria-label="Navegação móvel do MA-Professor"
      >
        {navigationItems
          .slice(
            0,
            5
          )
          .map(
            (
              item,
              index
            ) => (
              <button
                key={
                  item.id
                }
                type="button"
                disabled={
                  !setupCompleted
                }
                className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[0.65rem] font-bold transition ${
                  index ===
                  0
                    ? 'bg-cyan-300/10 text-cyan-100'
                    : 'text-slate-500'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-[0.6rem]">
                  {String(
                    index +
                      1
                  ).padStart(
                    2,
                    '0'
                  )}
                </span>

                <span className="max-w-full truncate">
                  {item.shortLabel}
                </span>
              </button>
            )
          )}
      </nav>
    </main>
  )
}
