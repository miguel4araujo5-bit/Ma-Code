import {
  useCallback,
  useEffect,
  useState
} from 'react'

import {
  AccessGate
} from '../access/AccessGate'

import {
  AccountIsolationGate
} from '../access/AccountIsolationGate'

import DailyWorkspaceView from '../daily/DailyWorkspaceView'

import {
  maProfessorRepository
} from '../repository'

import {
  CryptoSetupGate
} from '../sync/CryptoSetupGate'

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

const THEME_STORAGE_KEY =
  'ma-professor-theme'

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

  const refreshAcademicYear =
    useCallback(
      async (
        options:
          RefreshAcademicYearOptions = {}
      ) => {
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

          setAcademicYear(
            activeYear ?? null
          )

          return activeYear ?? null
        } catch (error) {
          setAcademicYearError(
            describeAcademicYearError(
              error
            )
          )

          /*
           * Não eliminamos academicYear aqui.
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
      activeYear => {
        if (
          !activeYear
            ?.setupCompletedAt
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

      /*
       * O DailyWorkspaceView já protege o fecho e a atualização do
       * browser quando existem alterações por guardar, mas ainda não
       * comunica esse estado diretamente ao menu principal.
       *
       * Até essa comunicação ser adicionada no DailyWorkspaceView,
       * esta confirmação impede que a mudança de área descarte
       * silenciosamente o trabalho do professor.
       */
      if (
        workspace ===
          'daily' &&
        nextWorkspace !==
          'daily'
      ) {
        const confirmed =
          window.confirm(
            'Vai sair do ecrã da aula. Confirme que carregou em “Guardar tudo”. Pretende continuar?'
          )

        if (!confirmed) {
          return
        }
      }

      setChangingWorkspace(
        true
      )

      try {
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

        /*
         * Não voltamos a consultar a base de dados em todas as
         * mudanças de área. Isso desmontava o DailyWorkspaceView e
         * podia apagar alterações ainda não guardadas.
         *
         * Só atualizamos quando não existe um ano letivo carregado ou
         * quando a configuração ainda não está concluída.
         */
        if (
          !activeYear
            ?.setupCompletedAt
        ) {
          activeYear =
            await refreshAcademicYear({
              showLoading:
                !activeYear
            })
        }

        if (
          !activeYear
            ?.setupCompletedAt
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
      const activeYear =
        await refreshAcademicYear({
          showLoading: true
        })

      if (
        !activeYear
          ?.setupCompletedAt
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

  const showSetupRequired =
    workspace !== 'menu' &&
    !checkingYear &&
    !academicYear &&
    !academicYearError

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
      academicYear
        ?.setupCompletedAt &&
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
        />
      ) : null}

      {workspace ===
        'calendar' &&
      academicYear
        ?.setupCompletedAt &&
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

      {showSetupRequired ? (
        <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-4 py-10 text-white">
          <section className="mx-auto max-w-2xl rounded-3xl border border-amber-300/20 bg-slate-900 p-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
              Configuração necessária
            </p>

            <h1 className="mt-3 text-2xl font-black">
              Termine primeiro a configuração inicial.
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Crie o ano letivo, as turmas, as disciplinas e os módulos antes de abrir esta área.
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
        <CryptoSetupGate>
          <ProductContent />
        </CryptoSetupGate>
      </AccountIsolationGate>
    </AccessGate>
  )
}
