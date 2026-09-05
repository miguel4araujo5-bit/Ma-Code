import {
  liveQuery
} from 'dexie'

import {
  type ReactNode,
  useEffect,
  useState
} from 'react'

import {
  maProfessorRepository
} from '../repository'

import {
  isSBentoSchoolName
} from '../setup/schoolDutyDatePolicy'

import {
  isMAProfessorOperationallyReady
} from '../setup/setupReadiness'

import {
  ensureInitialSchoolCalendar2026_2027
} from './initialSchoolCalendar2026_2027'

const S_BENTO_SCHOOL_NAME =
  'Agrupamento de Escolas de S. Bento, Vizela'

type SchoolSelectionStage =
  | 'checking'
  | 'selecting'
  | 'other-school'
  | 'ready'
  | 'error'

function protectedWorkspaceIsMounted() {
  return (
    typeof document !== 'undefined' &&
    Boolean(
      document.querySelector(
        '.ma-professor-product'
      )
    )
  )
}

function SelectionShell({
  children
}: {
  children: ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
      <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/95 shadow-2xl shadow-cyan-950/30">
        <div className="h-1.5 bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300" />
        <div className="p-6 sm:p-9">
          {children}
        </div>
      </section>
    </main>
  )
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível guardar a escola deste professor.'
}

export default function InitialSchoolCalendarBootstrap({
  children
}: {
  children: ReactNode
}) {
  const [
    stage,
    setStage
  ] =
    useState<SchoolSelectionStage>(
      'checking'
    )

  const [
    displayName,
    setDisplayName
  ] =
    useState('')

  const [
    otherSchoolName,
    setOtherSchoolName
  ] =
    useState('')

  const [
    error,
    setError
  ] =
    useState('')

  const [
    saving,
    setSaving
  ] =
    useState(false)

  useEffect(() => {
    let disposed = false

    void maProfessorRepository
      .getTeacherProfile()
      .then(profile => {
        if (disposed) {
          return
        }

        setDisplayName(
          profile?.displayName ??
          ''
        )

        const schoolName =
          profile?.schoolName
            ?.trim() ??
          ''

        if (schoolName) {
          setStage('ready')
          return
        }

        setStage('selecting')
      })
      .catch(loadError => {
        if (disposed) {
          return
        }

        setError(
          getErrorMessage(
            loadError
          )
        )
        setStage('error')
      })

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (stage !== 'ready') {
      return
    }

    let disposed = false
    let subscription: {
      unsubscribe: () => void
    } | null = null
    let observer: MutationObserver | null = null

    function start() {
      if (
        disposed ||
        subscription ||
        !protectedWorkspaceIsMounted()
      ) {
        return
      }

      subscription = liveQuery(
        async () => {
          const [
            academicYear,
            profile
          ] = await Promise.all([
            maProfessorRepository.getActiveAcademicYear(),
            maProfessorRepository.getTeacherProfile()
          ])

          if (!academicYear) {
            return null
          }

          const snapshot =
            await maProfessorRepository.getSetupSnapshot(
              academicYear.id
            )

          return {
            snapshot,
            schoolName:
              profile?.schoolName ??
              ''
          }
        }
      ).subscribe({
        next: state => {
          if (
            disposed ||
            !state ||
            !isSBentoSchoolName(
              state.schoolName
            ) ||
            !isMAProfessorOperationallyReady(
              state.snapshot
            )
          ) {
            return
          }

          void ensureInitialSchoolCalendar2026_2027(
            state.snapshot.academicYear.id
          ).catch(calendarError => {
            console.error(
              'Não foi possível preparar automaticamente o calendário escolar inicial de S. Bento no MA-Professor.',
              calendarError
            )
          })
        },
        error: subscriptionError => {
          console.error(
            'Não foi possível acompanhar a configuração operacional do MA-Professor.',
            subscriptionError
          )
        }
      })

      observer?.disconnect()
      observer = null
    }

    start()

    if (
      !subscription &&
      typeof MutationObserver !== 'undefined' &&
      typeof document !== 'undefined'
    ) {
      observer = new MutationObserver(
        start
      )

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      )
    }

    return () => {
      disposed = true
      observer?.disconnect()
      subscription?.unsubscribe()
    }
  }, [stage])

  const saveSchool =
    async (
      schoolName: string
    ) => {
      if (saving) {
        return
      }

      const normalizedSchoolName =
        schoolName.trim()

      if (!normalizedSchoolName) {
        setError(
          'Indique o nome da escola ou agrupamento.'
        )
        return
      }

      setSaving(true)
      setError('')

      try {
        await maProfessorRepository.saveTeacherProfile({
          displayName,
          schoolName:
            normalizedSchoolName
        })

        setStage('ready')
      } catch (saveError) {
        setError(
          getErrorMessage(
            saveError
          )
        )
      } finally {
        setSaving(false)
      }
    }

  if (stage === 'ready') {
    return children
  }

  if (stage === 'checking') {
    return (
      <SelectionShell>
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
          <p className="mt-5 text-sm font-bold text-slate-400">
            A preparar a configuração da escola…
          </p>
        </div>
      </SelectionShell>
    )
  }

  if (stage === 'error') {
    return (
      <SelectionShell>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
          Configuração indisponível
        </p>
        <h1 className="mt-3 text-2xl font-black">
          Não foi possível verificar a escola.
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">
          {error}
        </p>
        <button
          type="button"
          onClick={() =>
            window.location.reload()
          }
          className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950"
        >
          Tentar novamente
        </button>
      </SelectionShell>
    )
  }

  if (stage === 'other-school') {
    return (
      <SelectionShell>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setError('')
            setStage('selecting')
          }}
          className="text-xs font-black uppercase tracking-[0.14em] text-slate-400 transition hover:text-white disabled:opacity-50"
        >
          ← Voltar
        </button>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-violet-300">
          Outra escola
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-tight">
          Indique a sua escola ou agrupamento
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          Nesta opção não são aplicadas regras específicas de S. Bento. O horário e o calendário escolar são configurados manualmente pelo professor.
        </p>

        <label className="mt-6 block">
          <span className="text-xs font-bold text-slate-300">
            Escola ou agrupamento
          </span>
          <input
            type="text"
            value={otherSchoolName}
            disabled={saving}
            onChange={event => {
              setOtherSchoolName(
                event.target.value
              )
              setError('')
            }}
            placeholder="Nome da escola ou agrupamento"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300/50 disabled:opacity-60"
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={
            saving ||
            !otherSchoolName.trim()
          }
          onClick={() =>
            void saveSchool(
              otherSchoolName
            )
          }
          className="mt-6 w-full rounded-2xl bg-violet-300 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-50"
        >
          {saving
            ? 'A guardar…'
            : 'Continuar com configuração manual'}
        </button>
      </SelectionShell>
    )
  }

  return (
    <SelectionShell>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
        Configuração inicial
      </p>
      <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
        Em que escola leciona?
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
        Esta escolha permite aplicar automaticamente o calendário e as regras já preparadas para S. Bento sem afetar professores de outras escolas.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void saveSchool(
              S_BENTO_SCHOOL_NAME
            )
          }
          className="rounded-3xl border border-cyan-300/35 bg-cyan-300/[0.09] p-5 text-left transition hover:border-cyan-200/60 hover:bg-cyan-300/[0.14] disabled:cursor-wait disabled:opacity-60"
        >
          <span className="block text-xs font-black uppercase tracking-[0.14em] text-cyan-300">
            Configuração preparada
          </span>
          <span className="mt-2 block text-lg font-black text-white">
            S. Bento — Vizela
          </span>
          <span className="mt-3 block text-sm leading-6 text-slate-300">
            Usa o calendário 2026/2027 e as regras específicas já preparadas para o agrupamento.
          </span>
          <span className="mt-4 block text-xs font-black text-cyan-200">
            Selecionar S. Bento →
          </span>
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setError('')
            setStage('other-school')
          }}
          className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-left transition hover:border-violet-300/35 hover:bg-violet-300/[0.07] disabled:opacity-60"
        >
          <span className="block text-xs font-black uppercase tracking-[0.14em] text-violet-300">
            Configuração manual
          </span>
          <span className="mt-2 block text-lg font-black text-white">
            Outra escola
          </span>
          <span className="mt-3 block text-sm leading-6 text-slate-400">
            Indique a escola e configure manualmente o horário e o calendário, sem aplicar dados de S. Bento.
          </span>
          <span className="mt-4 block text-xs font-black text-violet-200">
            Indicar outra escola →
          </span>
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100"
        >
          {error}
        </p>
      ) : null}
    </SelectionShell>
  )
}
