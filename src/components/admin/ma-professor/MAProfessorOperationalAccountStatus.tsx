import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  getMAProfessorAccountsOperationalStatus,
  type MAProfessorAccountOperationalStatus
} from '../../../lib/admin/maProfessorAccountAdminApi'

interface MAProfessorOperationalAccountStatusProps {
  emails: string[]
  loading?: boolean
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(
    date
  )
}

function readinessLabel(
  status:
    MAProfessorAccountOperationalStatus
) {
  if (
    !status.operationalStateReported
  ) {
    return 'Sem sinal ainda'
  }

  return status.operationalReady
    ? 'Pronto para trabalhar'
    : 'Configuração operacional pendente'
}

function readinessClassName(
  status:
    MAProfessorAccountOperationalStatus
) {
  if (
    !status.operationalStateReported
  ) {
    return 'border-white/10 bg-white/[0.04] text-slate-500'
  }

  return status.operationalReady
    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
    : 'border-amber-300/20 bg-amber-300/10 text-amber-200'
}

function setupLabel(
  status:
    MAProfessorAccountOperationalStatus
) {
  if (
    !status.operationalStateReported
  ) {
    return '—'
  }

  return status.fullSetupCompleted
    ? 'Completa'
    : 'Por concluir'
}

function lastContactLabel(
  status:
    MAProfessorAccountOperationalStatus
) {
  if (
    status.hasActiveSession
  ) {
    return formatDate(
      status.lastSeenAt
    )
  }

  if (
    status.operationalStateReported
  ) {
    return `${formatDate(
      status.operationalStateUpdatedAt
    )} · sessão terminada`
  }

  return 'Ainda sem entrada registada'
}

export default function MAProfessorOperationalAccountStatus({
  emails,
  loading = false
}: MAProfessorOperationalAccountStatusProps) {
  const normalizedEmails =
    useMemo(
      () =>
        Array.from(
          new Set(
            emails
              .map(
                email =>
                  email
                    .trim()
                    .toLowerCase()
              )
              .filter(Boolean)
          )
        ).sort(),
      [emails]
    )

  const [
    statuses,
    setStatuses
  ] =
    useState<MAProfessorAccountOperationalStatus[]>(
      []
    )

  const [
    statusLoading,
    setStatusLoading
  ] =
    useState(false)

  const [
    error,
    setError
  ] =
    useState('')

  useEffect(
    () => {
      let cancelled =
        false

      setStatuses([])
      setError('')

      if (
        loading ||
        normalizedEmails.length ===
          0
      ) {
        setStatusLoading(false)
        return () => {
          cancelled =
            true
        }
      }

      setStatusLoading(true)

      void getMAProfessorAccountsOperationalStatus(
        normalizedEmails
      )
        .then(
          nextStatuses => {
            if (!cancelled) {
              setStatuses(
                nextStatuses
              )
            }
          }
        )
        .catch(
          statusError => {
            if (!cancelled) {
              setError(
                statusError instanceof Error
                  ? statusError.message
                  : 'Não foi possível consultar o estado operacional.'
              )
            }
          }
        )
        .finally(
          () => {
            if (!cancelled) {
              setStatusLoading(false)
            }
          }
        )

      return () => {
        cancelled =
          true
      }
    },
    [
      loading,
      normalizedEmails
    ]
  )

  if (
    normalizedEmails.length ===
      0
  ) {
    return null
  }

  return (
    <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">
          Estado real das contas
        </p>

        <span className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1.5 text-[0.68rem] font-black text-slate-400">
          {statusLoading
            ? 'A verificar…'
            : `${statuses.length} conta(s)`}
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3 text-xs font-bold text-rose-200"
        >
          {error}
        </div>
      ) : null}

      {!error &&
      !statusLoading ? (
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left">
            <thead className="bg-slate-950/50 text-[0.65rem] font-black uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-3 py-3">
                  Conta
                </th>
                <th className="px-3 py-3">
                  Último contacto
                </th>
                <th className="px-3 py-3">
                  Onboarding
                </th>
                <th className="px-3 py-3">
                  Configuração
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10 bg-slate-950/20">
              {statuses.map(
                status => (
                  <tr key={status.email}>
                    <td className="whitespace-nowrap px-3 py-3 text-xs font-bold text-slate-300">
                      {status.email}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-400">
                      {lastContactLabel(
                        status
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={[
                          'inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                          readinessClassName(
                            status
                          )
                        ].join(' ')}
                      >
                        {readinessLabel(
                          status
                        )}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 text-xs font-bold text-slate-400">
                      {setupLabel(
                        status
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
