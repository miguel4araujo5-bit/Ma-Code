import {
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from 'react'

import CalendarWorkspaceView from './calendar/CalendarWorkspaceView'
import ExtraLessonDialog from './calendar/ExtraLessonDialog'
import LessonEditorDialog from './calendar/LessonEditorDialog'

import {
  calendarWorkspaceRepository,
  type CalendarLessonEditorContext,
  type CalendarViewMode,
  type CalendarWorkspaceFilters,
  type CalendarWorkspaceSnapshot
} from './calendar/calendarWorkspaceRepository'

import {
  extraLessonRepository,
  type ExtraLessonCreateContext
} from './calendar/extraLessonRepository'

import DashboardView from './dashboard/DashboardView'

import {
  dashboardRepository,
  type DashboardSnapshot
} from './dashboard/dashboardRepository'

import {
  isMAProfessorDatabaseSupported
} from './db'

import {
  maProfessorRepository,
  type SetupSnapshot
} from './repository'

import SetupWizard from './setup/SetupWizard'

import type {
  AcademicYear,
  EntityId,
  ISODate,
  Lesson
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

type WorkspaceView =
  | 'dashboard'
  | 'calendar'

type NavigationItem = {
  id: string
  label: string
  shortLabel: string
  workspace?: WorkspaceView
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Painel',
    shortLabel: 'Painel',
    workspace: 'dashboard'
  },
  {
    id: 'calendar',
    label: 'Calendário',
    shortLabel: 'Calendário',
    workspace: 'calendar'
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

function getTodayISODate(): ISODate {
  const today =
    new Date()

  return toISODate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  )
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
          onClick={
            onRetry
          }
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
                  key={
                    item
                  }
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
          onSubmit={
            handleSubmit
          }
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

  const [
    activeWorkspace,
    setActiveWorkspace
  ] =
    useState<WorkspaceView>(
      'dashboard'
    )

  const [
    dashboardSnapshot,
    setDashboardSnapshot
  ] =
    useState<DashboardSnapshot | null>(
      null
    )

  const [
    dashboardLoading,
    setDashboardLoading
  ] =
    useState(false)

  const [
    dashboardError,
    setDashboardError
  ] =
    useState('')

  const [
    dashboardReloadKey,
    setDashboardReloadKey
  ] =
    useState(0)

  const [
    calendarSnapshot,
    setCalendarSnapshot
  ] =
    useState<CalendarWorkspaceSnapshot | null>(
      null
    )

  const [
    calendarMode,
    setCalendarMode
  ] =
    useState<CalendarViewMode>(
      'week'
    )

  const [
    calendarAnchorDate,
    setCalendarAnchorDate
  ] =
    useState<ISODate | undefined>(
      undefined
    )

  const [
    calendarFilters,
    setCalendarFilters
  ] =
    useState<CalendarWorkspaceFilters>({
      groupId: null,
      teachingAssignmentId: null,
      lessonStatus: null
    })

  const [
    calendarLoading,
    setCalendarLoading
  ] =
    useState(false)

  const [
    calendarError,
    setCalendarError
  ] =
    useState('')

  const [
    calendarReloadKey,
    setCalendarReloadKey
  ] =
    useState(0)

  const [
    lessonEditorContext,
    setLessonEditorContext
  ] =
    useState<CalendarLessonEditorContext | null>(
      null
    )

  const [
    lessonEditorLoading,
    setLessonEditorLoading
  ] =
    useState(false)

  const [
    lessonEditorError,
    setLessonEditorError
  ] =
    useState('')

  const [
    extraLessonContext,
    setExtraLessonContext
  ] =
    useState<ExtraLessonCreateContext | null>(
      null
    )

  const [
    extraLessonLoading,
    setExtraLessonLoading
  ] =
    useState(false)

  const [
    extraLessonError,
    setExtraLessonError
  ] =
    useState('')

  const setupCompleted =
    Boolean(
      snapshot
        ?.academicYear
        .setupCompletedAt ||
        snapshot
          ?.progress
          ?.completedAt
    )

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

  useEffect(() => {
    let cancelled =
      false

    if (
      !snapshot ||
      !setupCompleted
    ) {
      setDashboardSnapshot(
        null
      )
      setDashboardLoading(
        false
      )
      setDashboardError('')

      return () => {
        cancelled = true
      }
    }

    const academicYearId =
      snapshot.academicYear.id

    setDashboardLoading(
      true
    )
    setDashboardError('')

    async function loadDashboard() {
      try {
        const nextDashboardSnapshot =
          await dashboardRepository.getDashboard(
            academicYearId
          )

        if (
          cancelled
        ) {
          return
        }

        setDashboardSnapshot(
          nextDashboardSnapshot
        )
      } catch (
        loadError
      ) {
        if (
          cancelled
        ) {
          return
        }

        setDashboardError(
          getErrorMessage(
            loadError
          )
        )
      } finally {
        if (
          !cancelled
        ) {
          setDashboardLoading(
            false
          )
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [
    dashboardReloadKey,
    setupCompleted,
    snapshot?.academicYear.id
  ])

  useEffect(() => {
    let cancelled =
      false

    if (
      !snapshot ||
      !setupCompleted ||
      activeWorkspace !==
        'calendar'
    ) {
      if (
        !snapshot ||
        !setupCompleted
      ) {
        setCalendarSnapshot(
          null
        )
        setCalendarError('')

        setLessonEditorContext(
          null
        )
        setLessonEditorError('')

        setExtraLessonContext(
          null
        )
        setExtraLessonError('')
      }

      setCalendarLoading(
        false
      )

      return () => {
        cancelled = true
      }
    }

    const academicYearId =
      snapshot.academicYear.id

    setCalendarLoading(
      true
    )
    setCalendarError('')

    async function loadCalendar() {
      try {
        const nextCalendarSnapshot =
          await calendarWorkspaceRepository.getWorkspace(
            academicYearId,
            calendarMode,
            calendarAnchorDate,
            calendarFilters
          )

        if (
          cancelled
        ) {
          return
        }

        setCalendarSnapshot(
          nextCalendarSnapshot
        )
      } catch (
        loadError
      ) {
        if (
          cancelled
        ) {
          return
        }

        setCalendarError(
          getErrorMessage(
            loadError
          )
        )
      } finally {
        if (
          !cancelled
        ) {
          setCalendarLoading(
            false
          )
        }
      }
    }

    void loadCalendar()

    return () => {
      cancelled = true
    }
  }, [
    activeWorkspace,
    calendarAnchorDate,
    calendarFilters,
    calendarMode,
    calendarReloadKey,
    setupCompleted,
    snapshot?.academicYear.id
  ])

  async function handleAcademicYearCreated(
    academicYear: AcademicYear
  ) {
    const nextSnapshot =
      await maProfessorRepository.getSetupSnapshot(
        academicYear.id
      )

    setActiveWorkspace(
      'dashboard'
    )

    setDashboardSnapshot(
      null
    )
    setDashboardError('')

    setCalendarSnapshot(
      null
    )
    setCalendarError('')
    setCalendarAnchorDate(
      undefined
    )

    setLessonEditorContext(
      null
    )
    setLessonEditorError('')

    setExtraLessonContext(
      null
    )
    setExtraLessonError('')

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

  function handleDashboardRefresh() {
    setDashboardReloadKey(
      (
        current
      ) =>
        current +
        1
    )
  }

  function handleCalendarRefresh() {
    setCalendarReloadKey(
      (
        current
      ) =>
        current +
        1
    )
  }

  function handleWorkspaceChange(
    workspace: WorkspaceView
  ) {
    if (
      workspace !==
      'calendar'
    ) {
      setLessonEditorContext(
        null
      )
      setLessonEditorError('')

      setExtraLessonContext(
        null
      )
      setExtraLessonError('')
    }

    setActiveWorkspace(
      workspace
    )
  }

  function handleCalendarModeChange(
    mode: CalendarViewMode
  ) {
    setCalendarMode(
      mode
    )

    if (
      calendarSnapshot
    ) {
      setCalendarAnchorDate(
        calendarSnapshot.anchorDate
      )
    }
  }

  function handleCalendarNavigate(
    anchorDate: ISODate
  ) {
    setCalendarAnchorDate(
      anchorDate
    )
  }

  function handleCalendarGoToday() {
    setCalendarAnchorDate(
      getTodayISODate()
    )
  }

  function handleCalendarFiltersChange(
    filters: CalendarWorkspaceFilters
  ) {
    setCalendarFilters(
      filters
    )
  }

  async function handleCalendarLessonSelect(
    lessonId: EntityId
  ) {
    if (
      lessonEditorLoading ||
      extraLessonLoading
    ) {
      return
    }

    setExtraLessonContext(
      null
    )
    setExtraLessonError('')

    setLessonEditorLoading(
      true
    )
    setLessonEditorError('')

    try {
      const editorContext =
        await calendarWorkspaceRepository.getLessonEditorContext(
          lessonId
        )

      setLessonEditorContext(
        editorContext
      )
    } catch (
      loadError
    ) {
      setLessonEditorError(
        getErrorMessage(
          loadError
        )
      )
    } finally {
      setLessonEditorLoading(
        false
      )
    }
  }

  function handleLessonEditorClose() {
    if (
      lessonEditorLoading
    ) {
      return
    }

    setLessonEditorContext(
      null
    )
    setLessonEditorError('')
  }

  function handleLessonEditorSaved() {
    setLessonEditorContext(
      null
    )
    setLessonEditorError('')

    setCalendarReloadKey(
      (
        current
      ) =>
        current +
        1
    )

    setDashboardReloadKey(
      (
        current
      ) =>
        current +
        1
    )
  }

  async function handleExtraLessonCreate(
    requestedDate?: ISODate
  ) {
    if (
      !snapshot ||
      extraLessonLoading ||
      lessonEditorLoading
    ) {
      return
    }

    setLessonEditorContext(
      null
    )
    setLessonEditorError('')

    setExtraLessonLoading(
      true
    )
    setExtraLessonError('')

    try {
      const nextContext =
        await extraLessonRepository.getCreateContext(
          snapshot.academicYear.id,
          requestedDate ??
            calendarSnapshot?.anchorDate,
          calendarFilters.teachingAssignmentId ??
            null
        )

      setExtraLessonContext(
        nextContext
      )
    } catch (
      loadError
    ) {
      setExtraLessonError(
        getErrorMessage(
          loadError
        )
      )
    } finally {
      setExtraLessonLoading(
        false
      )
    }
  }

  function handleExtraLessonClose() {
    if (
      extraLessonLoading
    ) {
      return
    }

    setExtraLessonContext(
      null
    )
    setExtraLessonError('')
  }

  function handleExtraLessonCreated(
    lesson: Lesson
  ) {
    setExtraLessonContext(
      null
    )
    setExtraLessonError('')

    setCalendarAnchorDate(
      lesson.date
    )

    setCalendarReloadKey(
      (
        current
      ) =>
        current +
        1
    )

    setDashboardReloadKey(
      (
        current
      ) =>
        current +
        1
    )
  }

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
                  onClick={() => {
                    if (
                      item.workspace
                    ) {
                      handleWorkspaceChange(
                        item.workspace
                      )
                    }
                  }}
                  disabled={
                    !setupCompleted ||
                    !item.workspace
                  }
                  title={
                    item.workspace
                      ? undefined
                      : 'Em breve'
                  }
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                    item.workspace ===
                    activeWorkspace
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
                activeWorkspace ===
                'calendar' ? (
                  calendarSnapshot ? (
                    <div>
                      {lessonEditorError ? (
                        <div
                          role="alert"
                          className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-50"
                        >
                          <p className="leading-6">
                            Não foi possível abrir a aula: {lessonEditorError}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              setLessonEditorError('')
                            }
                            className="rounded-xl border border-rose-200/20 bg-rose-200/10 px-3 py-2 text-xs font-bold text-rose-50 transition hover:bg-rose-200/15"
                          >
                            Fechar aviso
                          </button>
                        </div>
                      ) : null}

                      {extraLessonError ? (
                        <div
                          role="alert"
                          className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-50"
                        >
                          <p className="leading-6">
                            Não foi possível preparar a aula extra: {extraLessonError}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              setExtraLessonError('')
                            }
                            className="rounded-xl border border-rose-200/20 bg-rose-200/10 px-3 py-2 text-xs font-bold text-rose-50 transition hover:bg-rose-200/15"
                          >
                            Fechar aviso
                          </button>
                        </div>
                      ) : null}

                      <CalendarWorkspaceView
                        snapshot={
                          calendarSnapshot
                        }
                        loading={
                          calendarLoading
                        }
                        error={
                          calendarError
                        }
                        onRefresh={
                          handleCalendarRefresh
                        }
                        onModeChange={
                          handleCalendarModeChange
                        }
                        onNavigate={
                          handleCalendarNavigate
                        }
                        onGoToday={
                          handleCalendarGoToday
                        }
                        onFiltersChange={
                          handleCalendarFiltersChange
                        }
                        onLessonSelect={
                          handleCalendarLessonSelect
                        }
                        onCreateLesson={
                          handleExtraLessonCreate
                        }
                      />
                    </div>
                  ) : calendarError ? (
                    <ErrorView
                      message={
                        calendarError
                      }
                      onRetry={
                        handleCalendarRefresh
                      }
                    />
                  ) : (
                    <LoadingView />
                  )
                ) : dashboardSnapshot ? (
                  <div>
                    {dashboardError ? (
                      <div
                        role="alert"
                        className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm text-amber-50"
                      >
                        <p className="leading-6">
                          Não foi possível atualizar o painel: {dashboardError}
                        </p>

                        <button
                          type="button"
                          onClick={
                            handleDashboardRefresh
                          }
                          className="rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-bold text-amber-50 transition hover:bg-amber-200/15"
                        >
                          Tentar novamente
                        </button>
                      </div>
                    ) : null}

                    <DashboardView
                      snapshot={
                        dashboardSnapshot
                      }
                      refreshing={
                        dashboardLoading
                      }
                      onRefresh={
                        handleDashboardRefresh
                      }
                    />
                  </div>
                ) : dashboardError ? (
                  <ErrorView
                    message={
                      dashboardError
                    }
                    onRetry={
                      handleDashboardRefresh
                    }
                  />
                ) : (
                  <LoadingView />
                )
              ) : (
                <SetupWizard
                  snapshot={
                    snapshot
                  }
                  onSnapshotChange={
                    setSnapshot
                  }
                  onCompleted={
                    setSnapshot
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
                onClick={() => {
                  if (
                    item.workspace
                  ) {
                    handleWorkspaceChange(
                      item.workspace
                    )
                  }
                }}
                disabled={
                  !setupCompleted ||
                  !item.workspace
                }
                title={
                  item.workspace
                    ? undefined
                    : 'Em breve'
                }
                className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[0.65rem] font-bold transition ${
                  item.workspace ===
                  activeWorkspace
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

      {lessonEditorLoading ||
      extraLessonLoading ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-5 backdrop-blur-sm">
          <div className="rounded-[1.75rem] border border-cyan-300/20 bg-slate-950/95 p-7 text-center shadow-2xl shadow-black/50">
            <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-cyan-100/20 border-t-cyan-200" />

            <p className="mt-4 text-sm font-black text-white">
              {extraLessonLoading
                ? 'A preparar a aula extra...'
                : 'A abrir a aula...'}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              {extraLessonLoading
                ? 'A carregar turmas, UFCD e sugestões.'
                : 'A carregar o sumário e a planificação.'}
            </p>
          </div>
        </div>
      ) : null}

      {lessonEditorContext ? (
        <LessonEditorDialog
          context={
            lessonEditorContext
          }
          onClose={
            handleLessonEditorClose
          }
          onSaved={
            handleLessonEditorSaved
          }
        />
      ) : null}

      {extraLessonContext ? (
        <ExtraLessonDialog
          context={
            extraLessonContext
          }
          onClose={
            handleExtraLessonClose
          }
          onCreated={
            handleExtraLessonCreated
          }
        />
      ) : null}
    </main>
  )
}
