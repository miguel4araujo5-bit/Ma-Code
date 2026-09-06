import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

import {
  AccessGate
} from '../access/AccessGate'

import {
  AccountIsolationGate
} from '../access/AccountIsolationGate'

import InitialSchoolCalendarBootstrap from '../calendar/InitialSchoolCalendarBootstrap'

import DailyWorkspaceView from '../daily/DailyWorkspaceView'
import {
  ensureDailyScheduledLessonsForDate
} from '../daily/dailyScheduledLessonPreparation'

import {
  maProfessorRepository
} from '../repository'

import OperationalReadinessReporter from '../setup/OperationalReadinessReporter'

import {
  isMAProfessorOperationallyReady,
  MA_PROFESSOR_OPEN_DAILY_EVENT
} from '../setup/setupReadiness'

import type {
  AcademicYear,
  EntityId,
  ISODate
} from '../types'

import {
  CalendarProductWorkspace
} from './CalendarProductWorkspace'

import {
  ProductMenuWorkspace
} from './ProductMenuWorkspace'
import {
  ProductNavigation,
  type ProductTheme,
  type ProductWorkspace
} from './ProductNavigation'

import './maProfessorTheme.css'

interface DailyTarget {
  date?: ISODate
  lessonId?: EntityId
}

interface RefreshAcademicYearOptions {
  showLoading?: boolean
}

interface ActiveYearReadiness {
  academicYear: AcademicYear | null
  operationalReady: boolean
  dailyPreparationReady: boolean
}

type DailyNavigationGuard =
  () => Promise<boolean>

const THEME_STORAGE_KEY =
  'ma-professor-theme'

function getTodayISODate(): ISODate {
  const today = new Date()

  return [
    String(
      today.getFullYear()
    ).padStart(
      4,
      '0'
    ),
    String(
      today.getMonth() + 1
    ).padStart(
      2,
      '0'
    ),
    String(
      today.getDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-')
}

function getInitialTheme():
  ProductTheme {
  if (
    typeof window ===
      'undefined'
  ) {
    return 'dark'
  }

  try {
    const savedTheme =
      window.localStorage.getItem(
        THEME_STORAGE_KEY
      )

    if (
      savedTheme === 'light' ||
      savedTheme === 'dark'
    ) {
      return savedTheme
    }
  } catch {
    // O tema continua a funcionar mesmo que o armazenamento esteja bloqueado.
  }

  return typeof window.matchMedia ===
      'function' &&
    window.matchMedia(
      '(prefers-color-scheme: light)'
    ).matches
    ? 'light'
    : 'dark'
}

function describeAcademicYearError(
  error: unknown
) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message
  }

  return 'Não foi possível consultar os dados do ano letivo.'
}

function describeDailyPreparationError(
  error: unknown
) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message
  }

  return 'Não foi possível preparar as aulas de hoje.'
}

function ProductContent() {
  const [
    workspace,
    setWorkspace
  ] =
    useState<ProductWorkspace>(
      'daily'
    )

  const [
    academicYear,
    setAcademicYear
  ] =
    useState<AcademicYear | null>(
      null
    )

  const [
    operationalReady,
    setOperationalReady
  ] =
    useState(false)

  const [
    dailyPreparationReady,
    setDailyPreparationReady
  ] =
    useState(false)

  const [
    checkingYear,
    setCheckingYear
  ] =
    useState(true)

  const [
    changingWorkspace,
    setChangingWorkspace
  ] =
    useState(false)

  const [
    academicYearError,
    setAcademicYearError
  ] =
    useState('')

  const [
    dailyPreparationError,
    setDailyPreparationError
  ] =
    useState('')

  const [
    dailyTarget,
    setDailyTarget
  ] =
    useState<DailyTarget>({})

  const [
    theme,
    setTheme
  ] =
    useState<ProductTheme>(
      getInitialTheme
    )

  const dailyNavigationGuardRef =
    useRef<DailyNavigationGuard | null>(
      null
    )

  const handleDailyNavigationGuardChange =
    useCallback(
      (
        guard:
          DailyNavigationGuard | null
      ) => {
        dailyNavigationGuardRef.current =
          guard
      },
      []
    )

  const refreshAcademicYear =
    useCallback(
      async (
        options:
          RefreshAcademicYearOptions = {}
      ): Promise<ActiveYearReadiness | null> => {
        const {
          showLoading = false
        } = options

        if (showLoading) {
          setCheckingYear(
            true
          )
        }

        setAcademicYearError(
          ''
        )

        try {
          const activeYear =
            await maProfessorRepository
              .getActiveAcademicYear()

          let nextOperationalReady =
            false

          if (activeYear) {
            const setupSnapshot =
              await maProfessorRepository.getSetupSnapshot(
                activeYear.id
              )

            nextOperationalReady =
              isMAProfessorOperationallyReady(
                setupSnapshot
              )
          }

          setAcademicYear(
            activeYear ?? null
          )
          setOperationalReady(
            nextOperationalReady
          )

          let nextDailyPreparationReady =
            false

          if (
            activeYear &&
            nextOperationalReady
          ) {
            setDailyPreparationError(
              ''
            )

            try {
              await ensureDailyScheduledLessonsForDate(
                activeYear.id,
                getTodayISODate()
              )

              nextDailyPreparationReady =
                true
            } catch (
              preparationError
            ) {
              setDailyPreparationError(
                describeDailyPreparationError(
                  preparationError
                )
              )
            }
          } else {
            setDailyPreparationError(
              ''
            )
          }

          setDailyPreparationReady(
            nextDailyPreparationReady
          )

          return {
            academicYear:
              activeYear ?? null,
            operationalReady:
              nextOperationalReady,
            dailyPreparationReady:
              nextDailyPreparationReady
          }
        } catch (error) {
          setAcademicYearError(
            describeAcademicYearError(
              error
            )
          )

          /*
           * Não eliminamos academicYear nem operationalReady aqui.
           *
           * Se já existirem dados carregados e uma atualização de
           * segundo plano falhar, a aplicação deve continuar a mostrar
           * os dados existentes em vez de fingir que a configuração
           * desapareceu.
           */
          return null
        } finally {
          if (showLoading) {
            setCheckingYear(
              false
            )
          }
        }
      },
      []
    )

  useEffect(() => {
    void refreshAcademicYear({
      showLoading: true
    }).then(
      state => {
        if (
          !state?.academicYear ||
          !state.operationalReady
        ) {
          setWorkspace(
            'menu'
          )
        }
      }
    )
  }, [
    refreshAcademicYear
  ])

  useEffect(() => {
    const openDaily =
      () => {
        void refreshAcademicYear()
          .then(state => {
            if (
              !state?.academicYear ||
              !state.operationalReady
            ) {
              setWorkspace(
                'menu'
              )
              return
            }

            setDailyTarget({})
            setWorkspace(
              'daily'
            )
          })
      }

    window.addEventListener(
      MA_PROFESSOR_OPEN_DAILY_EVENT,
      openDaily
    )

    return () => {
      window.removeEventListener(
        MA_PROFESSOR_OPEN_DAILY_EVENT,
        openDaily
      )
    }
  }, [
    refreshAcademicYear
  ])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        theme
      )
    } catch {
      // O seletor mantém-se funcional durante a sessão atual.
    }
  }, [
    theme
  ])

  const handleSelect =
    async (
      nextWorkspace:
        ProductWorkspace
    ) => {
      if (changingWorkspace) {
        return
      }

      if (
        workspace ===
          nextWorkspace &&
        nextWorkspace !==
          'daily'
      ) {
        return
      }

      setChangingWorkspace(
        true
      )

      try {
        if (
          workspace ===
            'daily' &&
          nextWorkspace !==
            'daily'
        ) {
          const canLeave =
            await (
              dailyNavigationGuardRef.current?.() ??
              Promise.resolve(true)
            )

          if (!canLeave) {
            return
          }
        }

        if (
          nextWorkspace ===
          'menu'
        ) {
          setWorkspace(
            'menu'
          )

          return
        }

        let activeYear =
          academicYear
        let ready =
          operationalReady
        let dailyReady =
          dailyPreparationReady

        /*
         * O trabalho diário depende do mínimo operacional, não da
         * configuração pedagógica completa. Se o Daily ainda não tiver
         * sido preparado, repetimos apenas essa preparação sem perder o
         * ano letivo que já está validado.
         */
        if (
          !activeYear ||
          !ready ||
          (
            nextWorkspace ===
              'daily' &&
            !dailyPreparationReady
          )
        ) {
          const refreshed =
            await refreshAcademicYear({
              showLoading:
                !activeYear
            })

          activeYear =
            refreshed?.academicYear ??
            activeYear
          ready =
            refreshed?.operationalReady ??
            false
          dailyReady =
            refreshed?.dailyPreparationReady ??
            false
        }

        if (
          !activeYear ||
          !ready
        ) {
          setWorkspace(
            'menu'
          )

          return
        }

        if (
          nextWorkspace ===
          'daily'
        ) {
          setDailyTarget({})
          setWorkspace(
            'daily'
          )

          if (!dailyReady) {
            return
          }
        }

        setWorkspace(
          nextWorkspace
        )
      } finally {
        setChangingWorkspace(
          false
        )
      }
    }

  const handleDataChanged =
    async () => {
      /*
       * Esta é uma atualização de segundo plano.
       * Não deve desmontar o ecrã que estiver aberto.
       */
      await refreshAcademicYear()
    }

  const openLessonFromCalendar =
    (
      date: ISODate,
      lessonId: EntityId
    ) => {
      setDailyTarget({
        date,
        lessonId
      })

      setWorkspace(
        'daily'
      )
    }

  const retryAcademicYear =
    async () => {
      const state =
        await refreshAcademicYear({
          showLoading: true
        })

      if (
        !state?.academicYear ||
        !state.operationalReady
      ) {
        setWorkspace(
          'menu'
        )
      }
    }

  const retryDailyPreparation =
    async () => {
      const state =
        await refreshAcademicYear()

      if (
        !state?.academicYear ||
        !state.operationalReady
      ) {
        setWorkspace(
          'menu'
        )
      }
    }

  const showLoading =
    workspace !== 'menu' &&
    checkingYear &&
    !academicYear

  const showAcademicYearError =
    workspace !== 'menu' &&
    !checkingYear &&
    !academicYear &&
    Boolean(
      academicYearError
    )

  const showDailyPreparationError =
    workspace === 'daily' &&
    Boolean(
      academicYear
    ) &&
    operationalReady &&
    !dailyPreparationReady &&
    Boolean(
      dailyPreparationError
    ) &&
    !showLoading

  const showSetupRequired =
    workspace !== 'menu' &&
    !checkingYear &&
    !academicYearError &&
    (
      !academicYear ||
      !operationalReady
    )

  return (
    <div
      className={`ma-professor-product min-h-screen ${
        theme === 'dark'
          ? 'bg-slate-950 text-white'
          : 'bg-slate-50 text-slate-950'
      }`}
      data-theme={
        theme
      }
    >
      <ProductNavigation
        workspace={
          workspace
        }
        academicYearName={
          academicYear?.name ??
          null
        }
        theme={
          theme
        }
        onSelect={
          next =>
            void handleSelect(
              next
            )
        }
        onToggleTheme={() =>
          setTheme(
            current =>
              current ===
              'dark'
                ? 'light'
                : 'dark'
          )
        }
      />

      {showLoading ? (
        <main className="flex min-h-[calc(100vh-58px)] items-center justify-center bg-slate-950 px-6 text-white">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

            <p className="mt-4 text-sm font-semibold text-slate-400">
              A preparar o ano letivo…
            </p>
          </div>
        </main>
      ) : null}

      {workspace ===
        'daily' &&
      academicYear &&
      operationalReady &&
      dailyPreparationReady &&
      !showLoading ? (
        <DailyWorkspaceView
          key={`${dailyTarget.date ?? 'today'}-${
            dailyTarget.lessonId ??
            'auto'
          }`}
          academicYearId={
            academicYear.id
          }
          initialDate={
            dailyTarget.date
          }
          initialLessonId={
            dailyTarget.lessonId
          }
          onNavigationGuardChange={
            handleDailyNavigationGuardChange
          }
        />
      ) : null}

      {workspace ===
        'calendar' &&
      academicYear &&
      operationalReady &&
      !showLoading ? (
        <CalendarProductWorkspace
          academicYearId={
            academicYear.id
          }
          onOpenLesson={
            openLessonFromCalendar
          }
        />
      ) : null}

      {workspace ===
      'menu' ? (
        <ProductMenuWorkspace
          academicYear={
            academicYear
          }
          onDataChanged={
            handleDataChanged
          }
          onOpenDaily={() =>
            void handleSelect(
              'daily'
            )
          }
          onOpenCalendar={() =>
            void handleSelect(
              'calendar'
            )
          }
        />
      ) : null}

      {showAcademicYearError ? (
        <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-4 py-10 text-white">
          <section className="mx-auto max-w-2xl rounded-3xl border border-rose-300/20 bg-slate-900 p-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
              Erro ao abrir os dados
            </p>

            <h1 className="mt-3 text-2xl font-black">
              Não foi possível consultar o ano letivo.
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              {academicYearError}
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Os dados existentes não foram eliminados. Tente novamente antes de iniciar uma nova configuração.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void retryAcademicYear()
                }
                className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
              >
                Tentar novamente
              </button>

              <button
                type="button"
                onClick={() =>
                  setWorkspace(
                    'menu'
                  )
                }
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-white"
              >
                Abrir menu
              </button>
            </div>
          </section>
        </main>
      ) : null}

      {showDailyPreparationError ? (
        <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-4 py-10 text-white">
          <section className="mx-auto max-w-2xl rounded-3xl border border-amber-300/20 bg-slate-900 p-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
              Preparação das aulas indisponível
            </p>

            <h1 className="mt-3 text-2xl font-black">
              Não foi possível preparar as aulas de hoje.
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              {dailyPreparationError}
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              O ano letivo e a configuração continuam guardados. Pode tentar novamente ou abrir o menu sem perder dados.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void retryDailyPreparation()
                }
                className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
              >
                Tentar novamente
              </button>

              <button
                type="button"
                onClick={() =>
                  setWorkspace(
                    'menu'
                  )
                }
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-white"
              >
                Abrir menu
              </button>
            </div>
          </section>
        </main>
      ) : null}

      {showSetupRequired ? (
        <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-4 py-10 text-white">
          <section className="mx-auto max-w-2xl rounded-3xl border border-amber-300/20 bg-slate-900 p-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
              Configuração operacional necessária
            </p>

            <h1 className="mt-3 text-2xl font-black">
              Prepare primeiro o mínimo para trabalhar.
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              É necessário ter turma, disciplina, pelo menos uma UFCD ou módulo e horário semanal para abrir as aulas.
            </p>

            <button
              type="button"
              onClick={() =>
                setWorkspace(
                  'menu'
                )
              }
              className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
            >
              Abrir configuração
            </button>
          </section>
        </main>
      ) : null}
    </div>
  )
}

export function MAProfessorProduct() {
  return (
    <AccessGate>
      <AccountIsolationGate>
        <>
          <OperationalReadinessReporter />
          <InitialSchoolCalendarBootstrap>
            <ProductContent />
          </InitialSchoolCalendarBootstrap>
        </>
      </AccountIsolationGate>
    </AccessGate>
  )
}
