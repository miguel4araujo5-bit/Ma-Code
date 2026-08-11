import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  getAccessRequestStatusLabel,
  getLicensePlanLabel,
  getLicenseStatusLabel
} from '../../ma-professor/access/accessTypes'

import type {
  LicenseRenewalRequest,
  LicenseSummary
} from '../../ma-professor/types'

import {
  getMAProfessorCommercialStatus,
  type MAProfessorAdminAccessRequestSummary,
  type MAProfessorAdminCommercialStatus,
  type MAProfessorDecisionEmailDelivery
} from '../../../lib/admin/maProfessorAdminApi'

import MAProfessorAdminAccountDetail from './MAProfessorAdminAccountDetail'
import MAProfessorAdminHistory from './MAProfessorAdminHistory'

type WorkspaceTab =
  | 'requests'
  | 'users'
  | 'licenses'
  | 'renewals'
  | 'history'

interface MAProfessorAdminWorkspaceProps {
  accessRequests:
    MAProfessorAdminAccessRequestSummary[]
  licenses:
    LicenseSummary[]
  renewals:
    LicenseRenewalRequest[]
  dataConnected?: boolean
  onApproveRequest: (
    email: string
  ) => Promise<void>
  onRejectRequest: (
    email: string
  ) => Promise<void>
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(value)

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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date)
}

function formatMoney(
  amountCents: number,
  currency: string
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency
    }
  ).format(
    amountCents / 100
  )
}

function getRequestStatusClassName(
  status:
    MAProfessorAdminAccessRequestSummary['status']
) {
  switch (status) {
    case 'approved':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
    case 'rejected':
      return 'border-rose-300/20 bg-rose-300/10 text-rose-200'
    default:
      return 'border-amber-300/20 bg-amber-300/10 text-amber-200'
  }
}

function getLicenseStatusClassName(
  status:
    LicenseSummary['status']
) {
  switch (status) {
    case 'active':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
    case 'expiring':
      return 'border-amber-300/20 bg-amber-300/10 text-amber-200'
    case 'renewal_pending':
      return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200'
    case 'revoked':
      return 'border-rose-300/20 bg-rose-300/10 text-rose-200'
    default:
      return 'border-slate-400/20 bg-slate-400/10 text-slate-300'
  }
}

function getPaymentLabel(
  status:
    MAProfessorAdminCommercialStatus['paymentStatus']
) {
  switch (status) {
    case 'confirmed':
      return 'Confirmado'
    case 'dispensed':
      return 'Dispensado'
    case 'pending':
      return 'Pendente'
    default:
      return '—'
  }
}

function getPaymentClassName(
  status:
    MAProfessorAdminCommercialStatus['paymentStatus']
) {
  switch (status) {
    case 'confirmed':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
    case 'dispensed':
      return 'border-violet-300/20 bg-violet-300/10 text-violet-200'
    case 'pending':
      return 'border-amber-300/20 bg-amber-300/10 text-amber-200'
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-500'
  }
}

function getCommercialPlanLabel(
  plan:
    MAProfessorAdminCommercialStatus['plan']
) {
  switch (plan) {
    case 'paid_30_days':
      return '30 dias'
    case 'school_year':
      return 'Até 1 de agosto'
    default:
      return '—'
  }
}

function getEmailDispatchLabel(
  status:
    MAProfessorDecisionEmailDelivery |
    null
) {
  switch (status) {
    case 'sent':
      return 'Email enviado'
    case 'not_configured':
      return 'Não configurado'
    case 'pending':
      return 'Por confirmar'
    case 'failed':
      return 'Envio falhou'
    case 'not_applicable':
      return 'Fluxo comercial'
    default:
      return '—'
  }
}

function getEmailDispatchClassName(
  status:
    MAProfessorDecisionEmailDelivery |
    null
) {
  switch (status) {
    case 'sent':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
    case 'not_configured':
      return 'border-amber-300/20 bg-amber-300/10 text-amber-200'
    case 'pending':
      return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200'
    case 'failed':
      return 'border-rose-300/20 bg-rose-300/10 text-rose-200'
    case 'not_applicable':
      return 'border-violet-300/20 bg-violet-300/10 text-violet-200'
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-500'
  }
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function EmptyTable({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-slate-500">
        —
      </div>
      <h3 className="mt-4 text-sm font-black text-slate-300">
        {title}
      </h3>
      <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  )
}

function RequestCommerceCells({
  email,
  dataConnected
}: {
  email: string
  dataConnected: boolean
}) {
  const [status, setStatus] =
    useState<MAProfessorAdminCommercialStatus | null>(
      null
    )
  const [loading, setLoading] =
    useState(false)

  useEffect(() => {
    let cancelled = false

    if (!dataConnected) {
      setStatus(null)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)

    void getMAProfessorCommercialStatus(
      email
    )
      .then(nextStatus => {
        if (!cancelled) {
          setStatus(nextStatus)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [dataConnected, email])

  return (
    <>
      <td className="px-4 py-3 text-xs font-bold text-slate-300">
        {loading
          ? 'A verificar…'
          : getCommercialPlanLabel(
              status?.plan ?? null
            )}
      </td>
      <td className="px-4 py-3 text-xs font-bold text-slate-300">
        {loading ||
        status?.amountCents == null
          ? '—'
          : formatMoney(
              status.amountCents,
              status.currency
            )}
      </td>
      <td className="px-4 py-3">
        {loading ? (
          <span className="text-xs font-bold text-slate-500">
            A verificar…
          </span>
        ) : status ? (
          <span
            className={[
              'inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
              getPaymentClassName(
                status.paymentStatus
              )
            ].join(' ')}
          >
            {getPaymentLabel(
              status.paymentStatus
            )}
          </span>
        ) : (
          <span className="text-xs font-bold text-slate-600">
            —
          </span>
        )}
      </td>
    </>
  )
}

export default function MAProfessorAdminWorkspace({
  accessRequests,
  licenses,
  renewals,
  dataConnected = false,
  onApproveRequest,
  onRejectRequest
}: MAProfessorAdminWorkspaceProps) {
  const [activeTab, setActiveTab] =
    useState<WorkspaceTab>('requests')
  const [query, setQuery] =
    useState('')
  const [requestStatus, setRequestStatus] =
    useState<'all' | MAProfessorAdminAccessRequestSummary['status']>('all')
  const [selectedEmail, setSelectedEmail] =
    useState<string | null>(null)
  const [busyEmail, setBusyEmail] =
    useState<string | null>(null)
  const [actionFeedback, setActionFeedback] =
    useState('')

  const normalizedQuery =
    query.trim().toLowerCase()

  const filteredRequests =
    useMemo(
      () =>
        accessRequests.filter(request => {
          const matchesQuery =
            !normalizedQuery ||
            request.email
              .toLowerCase()
              .includes(normalizedQuery)

          const matchesStatus =
            requestStatus === 'all' ||
            request.status === requestStatus

          return matchesQuery && matchesStatus
        }),
      [
        accessRequests,
        normalizedQuery,
        requestStatus
      ]
    )

  const users =
    useMemo(() => {
      const emails =
        new Set<string>()

      for (const request of accessRequests) {
        emails.add(request.email)
      }
      for (const license of licenses) {
        emails.add(license.email)
      }
      for (const renewal of renewals) {
        emails.add(renewal.email)
      }

      return Array.from(emails)
        .filter(email =>
          !normalizedQuery ||
          email
            .toLowerCase()
            .includes(normalizedQuery)
        )
        .sort((left, right) =>
          left.localeCompare(right)
        )
        .map(email => ({
          email,
          request:
            accessRequests.find(
              item => item.email === email
            ) || null,
          license:
            licenses.find(
              item => item.email === email
            ) || null
        }))
    }, [
      accessRequests,
      licenses,
      normalizedQuery,
      renewals
    ])

  const filteredLicenses =
    useMemo(
      () =>
        licenses.filter(license =>
          !normalizedQuery ||
          license.email
            .toLowerCase()
            .includes(normalizedQuery)
        ),
      [licenses, normalizedQuery]
    )

  const filteredRenewals =
    useMemo(
      () =>
        renewals.filter(renewal =>
          !normalizedQuery ||
          renewal.email
            .toLowerCase()
            .includes(normalizedQuery)
        ),
      [renewals, normalizedQuery]
    )

  const selectedRequest =
    selectedEmail
      ? accessRequests.find(
          item => item.email === selectedEmail
        ) || null
      : null

  const selectedLicense =
    selectedEmail
      ? licenses.find(
          item => item.email === selectedEmail
        ) || null
      : null

  const selectedRenewals =
    selectedEmail
      ? renewals.filter(
          item => item.email === selectedEmail
        )
      : []

  const pendingRequests =
    accessRequests.filter(
      item => item.status === 'pending'
    ).length

  const activeLicenses =
    licenses.filter(
      item =>
        item.status === 'active' ||
        item.status === 'expiring' ||
        item.status === 'renewal_pending'
    ).length

  const pendingRenewals =
    renewals.filter(
      item => item.status === 'pending'
    ).length

  const runRequestAction =
    async (
      email: string,
      action: 'approve' | 'reject'
    ) => {
      const verb =
        action === 'approve'
          ? 'aprovar'
          : 'rejeitar'

      const confirmed =
        window.confirm(
          `${action === 'approve' ? 'Aprovar' : 'Rejeitar'} o pedido de acesso de ${email}?`
        )

      if (!confirmed) {
        return
      }

      setBusyEmail(email)
      setActionFeedback('')

      try {
        if (action === 'approve') {
          await onApproveRequest(email)
        } else {
          await onRejectRequest(email)
        }

        setActionFeedback(
          `Pedido de ${email} atualizado com sucesso.`
        )
      } catch (error) {
        setActionFeedback(
          `Não foi possível ${verb} o pedido: ${getErrorMessage(error)}`
        )
      } finally {
        setBusyEmail(null)
      }
    }

  const tabs: Array<{
    id: WorkspaceTab
    label: string
    count?: number
  }> = [
    {
      id: 'requests',
      label: 'Pedidos',
      count: accessRequests.length
    },
    {
      id: 'users',
      label: 'Utilizadores',
      count: users.length
    },
    {
      id: 'licenses',
      label: 'Licenças',
      count: licenses.length
    },
    {
      id: 'renewals',
      label: 'Renovações',
      count: renewals.length
    },
    {
      id: 'history',
      label: 'Histórico'
    }
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">
            Pedidos pendentes
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {pendingRequests}
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">
            Contas conhecidas
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {users.length}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
            Licenças utilizáveis
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {activeLicenses}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">
            Renovações pendentes
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {pendingRenewals}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/55">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setActiveTab(tab.id)
                  }
                  className={[
                    'rounded-xl border px-3 py-2 text-xs font-black transition',
                    activeTab === tab.id
                      ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
                      : 'border-white/10 bg-slate-950/35 text-slate-500 hover:text-white'
                  ].join(' ')}
                >
                  {tab.label}
                  {typeof tab.count === 'number'
                    ? ` · ${tab.count}`
                    : ''}
                </button>
              ))}
            </div>

            <span
              className={[
                'rounded-full border px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em]',
                dataConnected
                  ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
                  : 'border-amber-300/20 bg-amber-300/10 text-amber-200'
              ].join(' ')}
            >
              {dataConnected
                ? 'Backend ligado'
                : 'Sem dados'}
            </span>
          </div>

          {activeTab !== 'history' ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <input
                type="search"
                value={query}
                onChange={event =>
                  setQuery(event.target.value)
                }
                placeholder="Pesquisar por email…"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
              />

              {activeTab === 'requests' ? (
                <select
                  value={requestStatus}
                  onChange={event =>
                    setRequestStatus(
                      event.target.value as typeof requestStatus
                    )
                  }
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-cyan-300/40"
                >
                  <option value="all">
                    Todos os estados
                  </option>
                  <option value="pending">
                    Pendentes
                  </option>
                  <option value="approved">
                    Aprovados
                  </option>
                  <option value="rejected">
                    Rejeitados
                  </option>
                </select>
              ) : null}
            </div>
          ) : null}

          {actionFeedback ? (
            <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs font-semibold text-slate-400">
              {actionFeedback}
            </p>
          ) : null}
        </div>

        {activeTab === 'requests' ? (
          filteredRequests.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full border-collapse text-left">
                <thead className="bg-slate-950/55 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Plano</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Pagamento</th>
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Envio</th>
                    <th className="px-4 py-3">Ativação</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredRequests.map(request => (
                    <tr
                      key={request.email}
                      className="align-top transition hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedEmail(
                              request.email
                            )
                          }
                          className="break-all text-xs font-black text-cyan-200 hover:text-cyan-100"
                        >
                          {request.email}
                        </button>
                      </td>

                      <RequestCommerceCells
                        email={request.email}
                        dataConnected={dataConnected}
                      />

                      <td className="px-4 py-3 text-xs text-slate-400">
                        {formatDate(
                          request.requestedAt
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={[
                            'inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                            getRequestStatusClassName(
                              request.status
                            )
                          ].join(' ')}
                        >
                          {getAccessRequestStatusLabel(
                            request.status
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {request.emailDispatchStatus ? (
                          <div className="min-w-[9rem]">
                            <span
                              className={[
                                'inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                                getEmailDispatchClassName(
                                  request.emailDispatchStatus
                                )
                              ].join(' ')}
                            >
                              {getEmailDispatchLabel(
                                request.emailDispatchStatus
                              )}
                            </span>

                            {request.emailDispatchUpdatedAt ? (
                              <p className="mt-1.5 text-[0.65rem] font-semibold text-slate-600">
                                {formatDate(
                                  request.emailDispatchUpdatedAt
                                )}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-600">
                            —
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-400">
                        {formatDate(
                          request.activatedAt
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedEmail(
                                request.email
                              )
                            }
                            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[0.68rem] font-black text-slate-400 hover:bg-white/5 hover:text-white"
                          >
                            Abrir ficha
                          </button>

                          {request.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                disabled={busyEmail === request.email}
                                onClick={() => {
                                  void runRequestAction(
                                    request.email,
                                    'approve'
                                  )
                                }}
                                className="rounded-lg bg-emerald-300 px-2.5 py-1.5 text-[0.68rem] font-black text-slate-950 hover:bg-emerald-200 disabled:opacity-40"
                              >
                                Aprovar
                              </button>

                              <button
                                type="button"
                                disabled={busyEmail === request.email}
                                onClick={() => {
                                  void runRequestAction(
                                    request.email,
                                    'reject'
                                  )
                                }}
                                className="rounded-lg border border-rose-300/25 bg-rose-300/[0.06] px-2.5 py-1.5 text-[0.68rem] font-black text-rose-200 hover:bg-rose-300/10 disabled:opacity-40"
                              >
                                Rejeitar
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyTable
              title="Sem pedidos para mostrar"
              description="Não existem pedidos que correspondam aos filtros atuais."
            />
          )
        ) : null}

        {activeTab === 'users' ? (
          users.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <thead className="bg-slate-950/55 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Licença</th>
                    <th className="px-4 py-3">Plano ativo</th>
                    <th className="px-4 py-3">Ação</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {users.map(user => (
                    <tr key={user.email}>
                      <td className="px-4 py-3 break-all text-xs font-black text-slate-200">
                        {user.email}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-400">
                        {user.request
                          ? getAccessRequestStatusLabel(
                              user.request.status
                            )
                          : '—'}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-400">
                        {user.license
                          ? getLicenseStatusLabel(
                              user.license.status
                            )
                          : '—'}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-400">
                        {user.license
                          ? getLicensePlanLabel(
                              user.license.plan
                            )
                          : '—'}
                      </td>

                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedEmail(
                              user.email
                            )
                          }
                          className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.05] px-3 py-1.5 text-[0.68rem] font-black text-cyan-200 hover:bg-cyan-300/10"
                        >
                          Abrir ficha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyTable
              title="Sem utilizadores para mostrar"
              description="Ainda não existem contas que correspondam à pesquisa."
            />
          )
        ) : null}

        {activeTab === 'licenses' ? (
          filteredLicenses.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full border-collapse text-left">
                <thead className="bg-slate-950/55 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Plano</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Validade</th>
                    <th className="px-4 py-3">Ação</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {filteredLicenses.map(license => (
                    <tr key={license.email}>
                      <td className="px-4 py-3 break-all text-xs font-black text-slate-200">
                        {license.email}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-400">
                        {getLicensePlanLabel(
                          license.plan
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={[
                            'inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                            getLicenseStatusClassName(
                              license.status
                            )
                          ].join(' ')}
                        >
                          {getLicenseStatusLabel(
                            license.status
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-400">
                        {formatDate(
                          license.validUntil
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedEmail(
                              license.email
                            )
                          }
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-[0.68rem] font-black text-slate-400 hover:bg-white/5 hover:text-white"
                        >
                          Abrir ficha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyTable
              title="Sem licenças para mostrar"
              description="Ainda não existem licenças que correspondam à pesquisa."
            />
          )
        ) : null}

        {activeTab === 'renewals' ? (
          filteredRenewals.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-left">
                <thead className="bg-slate-950/55 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Plano pedido</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Pedido em</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Ação</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {filteredRenewals.map(renewal => (
                    <tr key={renewal.id}>
                      <td className="px-4 py-3 break-all text-xs font-black text-slate-200">
                        {renewal.email}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-400">
                        {getLicensePlanLabel(
                          renewal.requestedPlan
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-400">
                        {formatMoney(
                          renewal.amountCents,
                          renewal.currency
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-400">
                        {formatDate(
                          renewal.requestedAt
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs font-bold text-slate-400">
                        {renewal.status}
                      </td>

                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedEmail(
                              renewal.email
                            )
                          }
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-[0.68rem] font-black text-slate-400 hover:bg-white/5 hover:text-white"
                        >
                          Abrir ficha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyTable
              title="Sem renovações para mostrar"
              description="Ainda não existem pedidos de renovação que correspondam à pesquisa."
            />
          )
        ) : null}

        {activeTab === 'history' ? (
          <MAProfessorAdminHistory
            accessRequests={accessRequests}
            licenses={licenses}
            renewals={renewals}
            dataConnected={dataConnected}
          />
        ) : null}
      </section>

      {selectedEmail ? (
        <MAProfessorAdminAccountDetail
          email={selectedEmail}
          request={selectedRequest}
          license={selectedLicense}
          renewals={selectedRenewals}
          dataConnected={dataConnected}
          onClose={() =>
            setSelectedEmail(null)
          }
        />
      ) : null}
    </div>
  )
}
