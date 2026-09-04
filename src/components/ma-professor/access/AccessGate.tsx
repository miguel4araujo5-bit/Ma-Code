import {
  createContext,
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
  activateMAProfessorAccessPeriod,
  confirmMAProfessorPilotAccess,
  endMAProfessorSession,
  requestMAProfessorAccess,
  requestMAProfessorRenewal,
  verifyMAProfessorAccountSession
} from './accessApi'

import {
  clearMAProfessorAccessSession,
  readMAProfessorAccessSession,
  saveMAProfessorAccessSession
} from './accessStorage'

import FounderAccessOffer from './FounderAccessOffer'

import {
  getLicensePlanLabel,
  getLicenseStatusLabel,
  isLicenseUsable,
  type MAProfessorAccessRequestStatus,
  type MAProfessorAccessSession,
  type MAProfessorLicensedAccessSession,
  type RenewableLicensePlan
} from './accessTypes'

interface AccessContextValue {
  session:
    MAProfessorLicensedAccessSession
  refreshing: boolean
  syncStatus:
    | MAProfessorSyncStatus
    | null
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

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
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

function requestStatusLabel(
  status:
    MAProfessorAccessRequestStatus | null
) {
  switch (status) {
    case 'approved':
      return 'Pedido aprovado'

    case 'rejected':
      return 'Pedido não aprovado'

    case 'pending':
      return 'Pedido em análise'

    default:
      return 'Conta autenticada'
  }
}

function LockedShell({
  children
}: {
  children: ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-900 p-7 shadow-2xl shadow-cyan-950/25 sm:p-10">
        {children}
      </section>
    </main>
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
    error,
    setError
  ] =
    useState('')

  const [
    activationCode,
    setActivationCode
  ] =
    useState('')

  const [
    activating,
    setActivating
  ] =
    useState(false)

  const [
    requestingPlan,
    setRequestingPlan
  ] =
    useState<RenewableLicensePlan | null>(
      null
    )

  const [
    requestStatus,
    setRequestStatus
  ] =
    useState<MAProfessorAccessRequestStatus | null>(
      null
    )

  const [
    requestMessage,
    setRequestMessage
  ] =
    useState('')

  const [
    renewingPlan,
    setRenewingPlan
  ] =
    useState<RenewableLicensePlan | null>(
      null
    )

  const [
    confirmingPilot,
    setConfirmingPilot
  ] =
    useState(false)

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
        if (
          !isLicenseUsable(
            targetSession.license
          )
        ) {
          setSyncStatus(null)
          setSyncError('')
          setSyncChecking(false)
          return
        }

        setSyncChecking(true)
        setSyncError('')

        try {
          const response =
            await getMAProfessorSyncStatus(
              targetSession.token,
              targetSession.deviceId
            )

          setSyncStatus(response)
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

  const loadRequestState =
    useCallback(
      async (
        email: string
      ) => {
        try {
          const response =
            await requestMAProfessorAccess(
              email
            )

          setRequestStatus(
            response.request.status
          )
          setRequestMessage(
            response.message || ''
          )
        } catch {
          setRequestStatus(null)
          setRequestMessage('')
        }
      },
      []
    )

  const applyAccountVerification =
    useCallback(
      async (
        current:
          MAProfessorAccessSession
      ) => {
        const response =
          await verifyMAProfessorAccountSession(
            current.token,
            current.deviceId
          )

        const nextSession:
          MAProfessorAccessSession = {
            ...current,
            email:
              response.email,
            license:
              response.license,
            checkedAt:
              new Date()
                .toISOString()
          }

        persistSession(
          nextSession
        )

        if (
          isLicenseUsable(
            nextSession.license
          )
        ) {
          setRequestStatus(null)
          setRequestMessage('')
          void checkSyncStatus(
            nextSession
          )
        } else {
          setSyncStatus(null)
          setSyncError('')
          void loadRequestState(
            nextSession.email
          )
        }

        return nextSession
      },
      [
        checkSyncStatus,
        loadRequestState,
        persistSession
      ]
    )

  const verifyStoredSession =
    useCallback(
      async () => {
        const stored =
          readMAProfessorAccessSession()

        if (!stored) {
          setSession(null)
          setLoading(false)
          return
        }

        try {
          await applyAccountVerification(
            stored
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
      [applyAccountVerification]
    )

  useEffect(
    () => {
      void verifyStoredSession()
    },
    [verifyStoredSession]
  )

  const refresh =
    useCallback(
      async () => {
        if (!session) {
          return
        }

        setRefreshing(true)
        setError('')

        try {
          await applyAccountVerification(
            session
          )
        } catch (
          refreshError
        ) {
          setError(
            getErrorMessage(
              refreshError
            )
          )
        } finally {
          setRefreshing(false)
        }
      },
      [
        applyAccountVerification,
        session
      ]
    )

  const refreshSyncStatus =
    useCallback(
      async () => {
        if (
          !session ||
          !isLicenseUsable(
            session.license
          )
        ) {
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
        if (
          !session ||
          !session.license
        ) {
          throw new Error(
            'Esta conta ainda não tem uma licença para renovar.'
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
              new Date()
                .toISOString()
          }

        persistSession(
          nextSession
        )

        if (
          isLicenseUsable(
            nextSession.license
          )
        ) {
          void checkSyncStatus(
            nextSession
          )
        }

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
        const current = session

        clearMAProfessorAccessSession()
        setSession(null)
        setSyncStatus(null)
        setSyncError('')
        setRequestStatus(null)
        setRequestMessage('')
        setActivationCode('')

        if (current) {
          try {
            await endMAProfessorSession(
              current.token,
              current.deviceId
            )
          } catch {
            // A sessão local termina mesmo que o servidor esteja indisponível.
          }
        }
      },
      [session]
    )

  const handleActivate =
    async () => {
      if (
        !session ||
        !activationCode.trim() ||
        activating
      ) {
        return
      }

      setActivating(true)
      setError('')

      try {
        const response =
          await activateMAProfessorAccessPeriod(
            session.email,
            activationCode.trim(),
            session.deviceId
          )

        if (!response.license) {
          throw new Error(
            'A ativação foi concluída sem uma licença válida. Contacte a MA-CODE.'
          )
        }

        const nextSession:
          MAProfessorAccessSession = {
            token:
              response.token,
            deviceId:
              session.deviceId,
            email:
              response.email ||
              response.license.email ||
              session.email,
            license:
              response.license,
            checkedAt:
              new Date()
                .toISOString()
          }

        setActivationCode('')
        setRequestStatus(null)
        setRequestMessage('')
        persistSession(
          nextSession
        )

        if (
          isLicenseUsable(
            nextSession.license
          )
        ) {
          void checkSyncStatus(
            nextSession
          )
        }
      } catch (
        activationError
      ) {
        setError(
          getErrorMessage(
            activationError
          )
        )
      } finally {
        setActivating(false)
      }
    }

  const handleInitialPlan =
    async (
      plan:
        RenewableLicensePlan
    ) => {
      if (
        !session ||
        requestingPlan
      ) {
        return
      }

      setRequestingPlan(plan)
      setError('')

      try {
        const response =
          await requestMAProfessorAccess(
            session.email,
            undefined,
            plan
          )

        setRequestStatus(
          response.request.status
        )
        setRequestMessage(
          response.message ||
          'O pedido ficou registado.'
        )
      } catch (
        planError
      ) {
        setError(
          getErrorMessage(
            planError
          )
        )
      } finally {
        setRequestingPlan(null)
      }
    }

  const handleRenewFromGate =
    async (
      plan:
        RenewableLicensePlan
    ) => {
      setError('')
      setRenewingPlan(plan)

      try {
        const message =
          await requestRenewal(plan)

        if (message) {
          setRequestMessage(message)
        }
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

  const handleConfirmPilot =
    async () => {
      if (
        !session?.license ||
        confirmingPilot
      ) {
        return
      }

      setConfirmingPilot(true)
      setError('')

      try {
        const response =
          await confirmMAProfessorPilotAccess(
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
              new Date()
                .toISOString()
          }

        persistSession(
          nextSession
        )

        if (
          isLicenseUsable(
            nextSession.license
          )
        ) {
          void checkSyncStatus(
            nextSession
          )
        }
      } catch (
        confirmationError
      ) {
        setError(
          getErrorMessage(
            confirmationError
          )
        )
      } finally {
        setConfirmingPilot(false)
      }
    }

  const contextValue =
    useMemo<AccessContextValue | null>(
      () => {
        if (
          !session?.license ||
          !isLicenseUsable(
            session.license
          )
        ) {
          return null
        }

        return {
          session:
            session as
              MAProfessorLicensedAccessSession,
          refreshing,
          syncStatus,
          syncChecking,
          syncError,
          refresh,
          refreshSyncStatus,
          requestRenewal,
          signOut
        }
      },
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
            A verificar a conta e o acesso ao MA-Professor…
          </p>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <p className="text-sm font-semibold text-slate-400">
          A terminar a sessão…
        </p>
      </main>
    )
  }

  const license =
    session.license

  const isPilotPhaseLicense =
    license?.plan ===
      'beta_30_days' ||
    license?.plan ===
      'courtesy_30_days' ||
    license?.plan ===
      'courtesy_school_year'

  const requiresPilotConfirmation =
    license?.plan ===
      'beta_30_days' &&
    license.status ===
      'expiring'

  if (requiresPilotConfirmation) {
    return (
      <LockedShell>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          Fase piloto · confirmação mensal
        </p>

        <h1 className="mt-3 text-3xl font-black">
          Confirme que pretende manter a sua vaga.
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          O seu acesso piloto continua ativo até{' '}
          <strong className="text-white">
            {formatDate(
              license.validUntil
            )}
          </strong>.
        </p>

        <div className="mt-7 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5">
          <p className="text-sm font-black text-cyan-100">
            Confirmação gratuita
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Esta confirmação não envolve pagamento e não altera os seus dados. Serve apenas para manter a vaga gratuita atribuída a quem continua a utilizar o serviço.
          </p>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={confirmingPilot}
          onClick={() =>
            void handleConfirmPilot()
          }
          className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
        >
          {confirmingPilot
            ? 'A confirmar…'
            : 'Confirmar e manter a vaga'}
        </button>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={refreshing}
            onClick={() =>
              void refresh()
            }
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            {refreshing
              ? 'A verificar…'
              : 'Verificar novamente'}
          </button>

          <button
            type="button"
            onClick={() =>
              void signOut()
            }
            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-white"
          >
            Terminar sessão
          </button>
        </div>
      </LockedShell>
    )
  }

  if (!license) {
    return (
      <LockedShell>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
          Conta autenticada
        </p>

        <h1 className="mt-3 text-3xl font-black">
          A sua conta está autenticada.
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          Entrou corretamente como{' '}
          <strong className="text-white">
            {session.email}
          </strong>. Ainda não existe um período de acesso ativo, por isso as ferramentas e os dados do MA-Professor permanecem bloqueados.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/55 p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {requestStatusLabel(
              requestStatus
            )}
          </p>

          {requestMessage ? (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {requestMessage}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-400">
              O seu pedido mantém-se na fila de análise. Pode aguardar a decisão ou escolher um acesso Fundador prioritário.
            </p>
          )}
        </div>

        <FounderAccessOffer
          requestStatus={requestStatus}
          activationCode={activationCode}
          activating={activating}
          requestingPlan={requestingPlan}
          onActivationCodeChange={setActivationCode}
          onActivate={() =>
            void handleActivate()
          }
          onSelectPlan={plan =>
            void handleInitialPlan(
              plan
            )
          }
        />

        {error ? (
          <p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={refreshing}
            onClick={() =>
              void refresh()
            }
            className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2.5 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/15 disabled:opacity-50"
          >
            {refreshing
              ? 'A verificar…'
              : 'Verificar novamente'}
          </button>

          <button
            type="button"
            onClick={() =>
              void signOut()
            }
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-white"
          >
            Terminar sessão
          </button>
        </div>
      </LockedShell>
    )
  }

  if (
    !isLicenseUsable(
      license
    )
  ) {
    const isRevoked =
      license.status ===
      'revoked'

    return (
      <LockedShell>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
          Conta autenticada · licença{' '}
          {getLicenseStatusLabel(
            license.status
          )}
        </p>

        <h1 className="mt-3 text-3xl font-black">
          {isRevoked
            ? 'O acesso às ferramentas foi terminado.'
            : isPilotPhaseLicense
              ? 'O acesso piloto está inativo.'
              : 'O período de acesso terminou.'}
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          A conta{' '}
          <strong className="text-white">
            {session.email}
          </strong>{' '}
          continua válida. Apenas o acesso às ferramentas do MA-Professor está bloqueado.
        </p>

        {!isRevoked ? (
          <p className="mt-2 text-sm leading-7 text-slate-400">
            O plano {getLicensePlanLabel(
              license.plan
            )} terminou em{' '}
            <strong className="text-slate-200">
              {formatDate(
                license.validUntil
              )}
            </strong>.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-7 text-slate-400">
            A licença foi revogada, mas a conta e os dados do professor não foram apagados.
          </p>
        )}

        {!isRevoked &&
        !isPilotPhaseLicense ? (
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={Boolean(renewingPlan)}
              onClick={() =>
                void handleRenewFromGate(
                  'paid_30_days'
                )
              }
              className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-4 text-left transition hover:bg-cyan-300/15 disabled:opacity-60"
            >
              <span className="block text-base font-black text-cyan-200">
                3,49 € / 30 dias
              </span>
              <span className="mt-1 block text-xs text-slate-400">
                Renovação manual
              </span>
            </button>

            <button
              type="button"
              disabled={Boolean(renewingPlan)}
              onClick={() =>
                void handleRenewFromGate(
                  'school_year'
                )
              }
              className="rounded-2xl border border-violet-300/30 bg-violet-300/10 px-5 py-4 text-left transition hover:bg-violet-300/15 disabled:opacity-60"
            >
              <span className="block text-base font-black text-violet-200">
                15 €
              </span>
              <span className="mt-1 block text-xs text-slate-400">
                Até ao fim do ano letivo
              </span>
            </button>
          </div>
        ) : null}

        {requestMessage ? (
          <p className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-3 text-sm leading-6 text-cyan-100">
            {requestMessage}
          </p>
        ) : null}

        {error ? (
          <p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={refreshing}
            onClick={() =>
              void refresh()
            }
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            {refreshing
              ? 'A verificar…'
              : 'Verificar novamente'}
          </button>

          <button
            type="button"
            onClick={() =>
              void signOut()
            }
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-white"
          >
            Terminar sessão
          </button>
        </div>
      </LockedShell>
    )
  }

  if (!contextValue) {
    return null
  }

  return (
    <AccessContext.Provider
      value={contextValue}
    >
      {children}
    </AccessContext.Provider>
  )
}
