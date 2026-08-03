import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  getMAProfessorSyncStatus,
  type MAProfessorSyncStatus
} from '../sync/syncApi'

import {
  endMAProfessorSession,
  requestMAProfessorRenewal,
  startMAProfessorBeta,
  verifyMAProfessorAccess
} from './accessApi'

import {
  clearMAProfessorAccessSession,
  getOrCreateMAProfessorDeviceId,
  readMAProfessorAccessSession,
  saveMAProfessorAccessSession
} from './accessStorage'

import {
  getLicensePlanLabel,
  getLicenseStatusLabel,
  isLicenseUsable,
  type MAProfessorAccessSession,
  type RenewableLicensePlan
} from './accessTypes'

interface AccessContextValue {
  session: MAProfessorAccessSession
  refreshing: boolean

  syncStatus:
    MAProfessorSyncStatus | null

  syncChecking: boolean
  syncError: string

  refresh: () => Promise<void>

  refreshSyncStatus:
    () => Promise<void>

  requestRenewal: (
    plan: RenewableLicensePlan
  ) => Promise<string>

  signOut: () => Promise<void>
}

const AccessContext =
  createContext<AccessContextValue | null>(
    null
  )

function normalizeEmail(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
}

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  )
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  ).format(
    new Date(value)
  )
}

export function useMAProfessorAccess() {
  const context =
    useContext(
      AccessContext
    )

  if (!context) {
    throw new Error(
      'useMAProfessorAccess deve ser utilizado dentro de AccessGate.'
    )
  }

  return context
}

export function AccessGate({
  children
}: {
  children: ReactNode
}) {
  const [
    session,
    setSession
  ] =
    useState<MAProfessorAccessSession | null>(
      null
    )

  const [
    loading,
    setLoading
  ] =
    useState(true)

  const [
    refreshing,
    setRefreshing
  ] =
    useState(false)

  const [
    email,
    setEmail
  ] =
    useState('')

  const [
    error,
    setError
  ] =
    useState('')

  const [
    submitting,
    setSubmitting
  ] =
    useState(false)

  const [
    renewingPlan,
    setRenewingPlan
  ] =
    useState<RenewableLicensePlan | null>(
      null
    )

  const [
    syncStatus,
    setSyncStatus
  ] =
    useState<MAProfessorSyncStatus | null>(
      null
    )

  const [
    syncChecking,
    setSyncChecking
  ] =
    useState(false)

  const [
    syncError,
    setSyncError
  ] =
    useState('')

  const persistSession =
    useCallback(
      (
        nextSession:
          MAProfessorAccessSession
      ) => {
        setSession(
          nextSession
        )

        saveMAProfessorAccessSession(
          nextSession
        )
      },
      []
    )

  const checkSyncStatus =
    useCallback(
      async (
        targetSession:
          MAProfessorAccessSession
      ) => {
        setSyncChecking(true)
        setSyncError('')

        try {
          const response =
            await getMAProfessorSyncStatus(
              targetSession.token,
              targetSession.deviceId
            )

          setSyncStatus(
            response
          )
        } catch (
          syncStatusError
        ) {
          setSyncStatus(null)

          setSyncError(
            getErrorMessage(
              syncStatusError
            )
          )
        } finally {
          setSyncChecking(false)
        }
      },
      []
    )

  const verifyStoredSession =
    useCallback(
      async () => {
        const stored =
          readMAProfessorAccessSession()

        if (!stored) {
          setSession(null)
          setSyncStatus(null)
          setSyncError('')
          setLoading(false)
          return
        }

        try {
          const response =
            await verifyMAProfessorAccess(
              stored.token,
              stored.deviceId
            )

          const nextSession:
            MAProfessorAccessSession = {
              ...stored,
              email:
                response.license.email,
              license:
                response.license,
              checkedAt:
                new Date().toISOString()
            }

          persistSession(
            nextSession
          )

          void checkSyncStatus(
            nextSession
          )
        } catch {
          clearMAProfessorAccessSession()

          setSession(null)
          setSyncStatus(null)
          setSyncError('')
        } finally {
          setLoading(false)
        }
      },
      [
        checkSyncStatus,
        persistSession
      ]
    )

  useEffect(() => {
    void verifyStoredSession()
  }, [
    verifyStoredSession
  ])

  const refresh =
    useCallback(
      async () => {
        if (!session) {
          return
        }

        setRefreshing(true)

        try {
          const response =
            await verifyMAProfessorAccess(
              session.token,
              session.deviceId
            )

          const nextSession:
            MAProfessorAccessSession = {
              ...session,
              email:
                response.license.email,
              license:
                response.license,
              checkedAt:
                new Date().toISOString()
            }

          persistSession(
            nextSession
          )

          void checkSyncStatus(
            nextSession
          )
        } finally {
          setRefreshing(false)
        }
      },
      [
        checkSyncStatus,
        persistSession,
        session
      ]
    )

  const refreshSyncStatus =
    useCallback(
      async () => {
        if (!session) {
          setSyncStatus(null)
          setSyncError('')
          return
        }

        await checkSyncStatus(
          session
        )
      },
      [
        checkSyncStatus,
        session
      ]
    )

  const requestRenewal =
    useCallback(
      async (
        plan:
          RenewableLicensePlan
      ) => {
        if (!session) {
          throw new Error(
            'A sessão já não está disponível.'
          )
        }

        const response =
          await requestMAProfessorRenewal(
            session.token,
            session.deviceId,
            plan
          )

        const nextSession:
          MAProfessorAccessSession = {
            ...session,
            license:
              response.license,
            checkedAt:
              new Date().toISOString()
          }

        persistSession(
          nextSession
        )

        void checkSyncStatus(
          nextSession
        )

        return response.message
      },
      [
        checkSyncStatus,
        persistSession,
        session
      ]
    )

  const signOut =
    useCallback(
      async () => {
        const current =
          session

        clearMAProfessorAccessSession()

        setSession(null)
        setSyncStatus(null)
        setSyncError('')
        setSyncChecking(false)

        if (current) {
          try {
            await endMAProfessorSession(
              current.token,
              current.deviceId
            )
          } catch {
            // A sessão local fica terminada mesmo que o servidor esteja indisponível.
          }
        }
      },
      [
        session
      ]
    )

  const handleStart =
    async (
      event: FormEvent
    ) => {
      event.preventDefault()
      setError('')

      const normalizedEmail =
        normalizeEmail(
          email
        )

      if (
        !isValidEmail(
          normalizedEmail
        )
      ) {
        setError(
          'Indique um email válido.'
        )
        return
      }

      setSubmitting(true)

      try {
        const deviceId =
          getOrCreateMAProfessorDeviceId()

        const response =
          await startMAProfessorBeta(
            normalizedEmail,
            deviceId
          )

        const nextSession:
          MAProfessorAccessSession = {
            token:
              response.token,
            deviceId,
            email:
              response.license.email,
            license:
              response.license,
            checkedAt:
              new Date().toISOString()
          }

        persistSession(
          nextSession
        )

        void checkSyncStatus(
          nextSession
        )
      } catch (
        startError
      ) {
        setError(
          getErrorMessage(
            startError
          )
        )
      } finally {
        setSubmitting(false)
      }
    }

  const handleRenewFromGate =
    async (
      plan:
        RenewableLicensePlan
    ) => {
      setError('')
      setRenewingPlan(
        plan
      )

      try {
        await requestRenewal(
          plan
        )
      } catch (
        renewalError
      ) {
        setError(
          getErrorMessage(
            renewalError
          )
        )
      } finally {
        setRenewingPlan(null)
      }
    }

  const contextValue =
    useMemo<
      AccessContextValue | null
    >(
      () =>
        session
          ? {
              session,
              refreshing,
              syncStatus,
              syncChecking,
              syncError,
              refresh,
              refreshSyncStatus,
              requestRenewal,
              signOut
            }
          : null,
      [
        refresh,
        refreshing,
        refreshSyncStatus,
        requestRenewal,
        session,
        signOut,
        syncChecking,
        syncError,
        syncStatus
      ]
    )

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

          <p className="mt-4 text-sm font-semibold text-slate-400">
            A verificar o acesso ao
            MA-Professor…
          </p>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
        <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-cyan-950/30 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              MA-CODE · Beta privada
            </p>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              O seu ano letivo num único
              lugar.
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Sumários, aulas, turmas,
              avaliações, faltas,
              planificações e horários,
              com os dados guardados neste
              dispositivo e cópias de
              segurança controladas por si.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                'Configuração guiada e simples',
                'Avaliações por UFCD ou módulo',
                'Controlo de faltas e recuperações',
                'Exportação e restauro de dados'
              ].map(
                item => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-200"
                  >
                    <span className="mr-2 text-cyan-300">
                      ✓
                    </span>

                    {item}
                  </div>
                )
              )}
            </div>
          </div>

          <form
            className="flex flex-col justify-center p-7 sm:p-10"
            onSubmit={
              handleStart
            }
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Começar
            </p>

            <h2 className="mt-3 text-2xl font-black">
              Ativar 30 dias de beta
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Use o email que ficará
              associado à sua licença.
              Não é necessário criar uma
              palavra-passe nesta fase
              beta.
            </p>

            <label className="mt-7 text-sm font-bold text-slate-200">
              Email

              <input
                type="email"
                autoComplete="email"
                value={
                  email
                }
                onChange={
                  event =>
                    setEmail(
                      event.target.value
                    )
                }
                placeholder="professor@escola.pt"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
              />
            </label>

            {error ? (
              <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                submitting
              }
              className="mt-5 rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting
                ? 'A ativar…'
                : 'Começar beta gratuita'}
            </button>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Os dados escolares não são
              enviados para o servidor de
              licenças. Permanecem na base
              de dados local do browser.
            </p>
          </form>
        </section>
      </main>
    )
  }

  if (
    !isLicenseUsable(
      session.license
    )
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
        <section className="w-full max-w-2xl rounded-[2rem] border border-amber-300/20 bg-slate-900 p-7 shadow-2xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
            Licença{' '}
            {getLicenseStatusLabel(
              session.license.status
            )}
          </p>

          <h1 className="mt-3 text-3xl font-black">
            O período de acesso terminou.
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-300">
            O plano{' '}
            {getLicensePlanLabel(
              session.license.plan
            )}{' '}
            terminou em{' '}

            <strong className="text-white">
              {formatDate(
                session.license.validUntil
              )}
            </strong>
            . Os seus dados continuam
            guardados neste dispositivo.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={
                Boolean(
                  renewingPlan
                )
              }
              onClick={() =>
                void handleRenewFromGate(
                  'paid_30_days'
                )
              }
              className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-4 text-left transition hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="block text-base font-black text-cyan-200">
                3,49 € / mês
              </span>

              <span className="mt-1 block text-xs text-slate-400">
                Renovação mensal
              </span>
            </button>

            <button
              type="button"
              disabled={
                Boolean(
                  renewingPlan
                )
              }
              onClick={() =>
                void handleRenewFromGate(
                  'school_year'
                )
              }
              className="rounded-2xl border border-violet-300/30 bg-violet-300/10 px-5 py-4 text-left transition hover:bg-violet-300/15 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="block text-base font-black text-violet-200">
                15 €
              </span>

              <span className="mt-1 block text-xs text-slate-400">
                Até ao final do ano letivo
              </span>
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void refresh()
              }
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/5"
            >
              Verificar novamente
            </button>

            <button
              type="button"
              onClick={() =>
                void signOut()
              }
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-white"
            >
              Usar outro email
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <AccessContext.Provider
      value={
        contextValue
      }
    >
      {children}
    </AccessContext.Provider>
  )
}
