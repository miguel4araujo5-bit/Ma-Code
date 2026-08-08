import {
  useMemo,
  useState
} from 'react'

import {
  getAccessRequestStatusLabel,
  getLicensePlanLabel,
  getLicenseStatusLabel,
  type MAProfessorAccessRequestSummary
} from '../../ma-professor/access/accessTypes'

import type {
  LicenseRenewalRequest,
  LicenseSummary
} from '../../ma-professor/types'

import MAProfessorAdminAccountDetail from './MAProfessorAdminAccountDetail'
import MAProfessorAdminHistory from './MAProfessorAdminHistory'

type WorkspaceTab =
  | 'requests'
  | 'users'
  | 'licenses'
  | 'renewals'
  | 'history'

type RequestStatusFilter =
  | 'all'
  | 'pending'
  | 'approved'
  | 'rejected'

type RequestActionFeedback =
  | {
      type:
        'success' |
        'error'

      message:
        string
    }
  | null

interface MAProfessorAdminWorkspaceProps {
  accessRequests?:
    MAProfessorAccessRequestSummary[]

  licenses?:
    LicenseSummary[]

  renewals?:
    LicenseRenewalRequest[]

  dataConnected?:
    boolean

  onApproveRequest?: (
    email: string
  ) => Promise<void>

  onRejectRequest?: (
    email: string
  ) => Promise<void>
}

interface TabDefinition {
  id:
    WorkspaceTab

  label:
    string
}

const tabs:
  TabDefinition[] = [
    {
      id:
        'requests',

      label:
        'Pedidos'
    },
    {
      id:
        'users',

      label:
        'Utilizadores'
    },
    {
      id:
        'licenses',

      label:
        'Licenças'
    },
    {
      id:
        'renewals',

      label:
        'Renovações'
    },
    {
      id:
        'history',

      label:
        'Histórico'
    }
  ]

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
      day:
        '2-digit',

      month:
        '2-digit',

      year:
        'numeric',

      hour:
        '2-digit',

      minute:
        '2-digit'
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
      style:
        'currency',

      currency
    }
  ).format(
    amountCents /
      100
  )
}

function getRequestStatusClassName(
  status:
    MAProfessorAccessRequestSummary['status']
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

    case 'expired':
      return 'border-slate-400/20 bg-slate-400/10 text-slate-300'

    default:
      return 'border-white/10 bg-white/[0.04] text-slate-400'
  }
}

function getRenewalStatusLabel(
  status:
    LicenseRenewalRequest['status']
) {
  switch (status) {
    case 'approved':
      return 'Aprovada'

    case 'rejected':
      return 'Rejeitada'

    case 'cancelled':
      return 'Cancelada'

    default:
      return 'Pendente'
  }
}

function getRenewalStatusClassName(
  status:
    LicenseRenewalRequest['status']
) {
  switch (status) {
    case 'approved':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'

    case 'rejected':
      return 'border-rose-300/20 bg-rose-300/10 text-rose-200'

    case 'cancelled':
      return 'border-slate-400/20 bg-slate-400/10 text-slate-300'

    default:
      return 'border-amber-300/20 bg-amber-300/10 text-amber-200'
  }
}

function EmptyTable({
  title,
  description
}: {
  title:
    string

  description:
    string
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-lg text-slate-500">
        —
      </div>

      <h3 className="mt-4 text-sm font-black text-slate-300">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  description
}: {
  label:
    string

  value:
    string

  description:
    string
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/55 p-4">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </article>
  )
}

function getActionErrorMessage(
  error:
    unknown
) {
  if (
    error instanceof
      Error &&
    error.message
  ) {
    return error.message
  }

  return 'Não foi possível atualizar o pedido.'
}

export default function MAProfessorAdminWorkspace({
  accessRequests = [],
  licenses = [],
  renewals = [],
  dataConnected = false,
  onApproveRequest,
  onRejectRequest
}: MAProfessorAdminWorkspaceProps) {
  const [
    activeTab,
    setActiveTab
  ] =
    useState<WorkspaceTab>(
      'requests'
    )

  const [
    query,
    setQuery
  ] =
    useState('')

  const [
    requestStatus,
    setRequestStatus
  ] =
    useState<RequestStatusFilter>(
      'all'
    )

  const [
    selectedEmail,
    setSelectedEmail
  ] =
    useState<string | null>(
      null
    )

  const [
    requestActionEmail,
    setRequestActionEmail
  ] =
    useState<string | null>(
      null
    )

  const [
    requestActionFeedback,
    setRequestActionFeedback
  ] =
    useState<RequestActionFeedback>(
      null
    )

  const normalizedQuery =
    query
      .trim()
      .toLowerCase()

  const filteredRequests =
    useMemo(
      () =>
        accessRequests.filter(
          request => {
            if (
              normalizedQuery &&
              !request.email
                .toLowerCase()
                .includes(
                  normalizedQuery
                )
            ) {
              return false
            }

            if (
              requestStatus !==
                'all' &&
              request.status !==
                requestStatus
            ) {
              return false
            }

            return true
          }
        ),
      [
        accessRequests,
        normalizedQuery,
        requestStatus
      ]
    )

  const userEmails =
    useMemo(
      () => {
        const emails =
          new Set<string>()

        for (
          const request of
          accessRequests
        ) {
          emails.add(
            request.email
          )
        }

        for (
          const license of
          licenses
        ) {
          emails.add(
            license.email
          )
        }

        for (
          const renewal of
          renewals
        ) {
          emails.add(
            renewal.email
          )
        }

        return Array.from(
          emails
        ).sort(
          (
            left,
            right
          ) =>
            left.localeCompare(
              right
            )
        )
      },
      [
        accessRequests,
        licenses,
        renewals
      ]
    )

  const filteredUsers =
    useMemo(
      () =>
        userEmails.filter(
          email =>
            !normalizedQuery ||
            email
              .toLowerCase()
              .includes(
                normalizedQuery
              )
        ),
      [
        userEmails,
        normalizedQuery
      ]
    )

  const filteredLicenses =
    useMemo(
      () =>
        licenses.filter(
          license =>
            !normalizedQuery ||
            license.email
              .toLowerCase()
              .includes(
                normalizedQuery
              )
        ),
      [
        licenses,
        normalizedQuery
      ]
    )

  const filteredRenewals =
    useMemo(
      () =>
        renewals.filter(
          renewal =>
            !normalizedQuery ||
            renewal.email
              .toLowerCase()
              .includes(
                normalizedQuery
              )
        ),
      [
        renewals,
        normalizedQuery
      ]
    )

  const selectedRequest =
    useMemo(
      () =>
        selectedEmail
          ? accessRequests.find(
              request =>
                request.email ===
                selectedEmail
            ) ||
            null
          : null,
      [
        accessRequests,
        selectedEmail
      ]
    )

  const selectedLicense =
    useMemo(
      () =>
        selectedEmail
          ? licenses.find(
              license =>
                license.email ===
                selectedEmail
            ) ||
            null
          : null,
      [
        licenses,
        selectedEmail
      ]
    )

  const selectedRenewals =
    useMemo(
      () =>
        selectedEmail
          ? renewals.filter(
              renewal =>
                renewal.email ===
                selectedEmail
            )
          : [],
      [
        renewals,
        selectedEmail
      ]
    )

  const pendingRequests =
    accessRequests.filter(
      request =>
        request.status ===
        'pending'
    ).length

  const activeLicenses =
    licenses.filter(
      license =>
        license.status ===
          'active' ||
        license.status ===
          'expiring'
    ).length

  const pendingRenewals =
    renewals.filter(
      renewal =>
        renewal.status ===
        'pending'
    ).length

  const metricValue = (
    value: number
  ) =>
    dataConnected
      ? String(
          value
        )
      : '—'

  const canManageRequests =
    dataConnected &&
    Boolean(
      onApproveRequest
    ) &&
    Boolean(
      onRejectRequest
    )

  const handleRequestDecision =
    async (
      email: string,
      decision:
        'approve' |
        'reject'
    ) => {
      if (
        !canManageRequests ||
        requestActionEmail
      ) {
        return
      }

      const confirmed =
        window.confirm(
          decision ===
          'approve'
            ? `Aprovar o pedido de acesso de ${email}?`
            : `Rejeitar o pedido de acesso de ${email}?`
        )

      if (!confirmed) {
        return
      }

      setRequestActionFeedback(
        null
      )

      setRequestActionEmail(
        email
      )

      try {
        if (
          decision ===
          'approve'
        ) {
          await onApproveRequest?.(
            email
          )

          setRequestActionFeedback({
            type:
              'success',

            message:
              `Pedido de ${email} aprovado.`
          })
        } else {
          await onRejectRequest?.(
            email
          )

          setRequestActionFeedback({
            type:
              'success',

            message:
              `Pedido de ${email} rejeitado.`
          })
        }
      } catch (
        error
      ) {
        setRequestActionFeedback({
          type:
            'error',

          message:
            getActionErrorMessage(
              error
            )
        })
      } finally {
        setRequestActionEmail(
          null
        )
      }
    }

  const renderRequests =
    () => (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] text-left">
          <thead>
            <tr className="border-b border-white/10 text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-600">
              <th className="px-4 py-3">
                Email
              </th>

              <th className="px-4 py-3">
                Pedido
              </th>

              <th className="px-4 py-3">
                Estado
              </th>

              <th className="px-4 py-3">
                Ativação
              </th>

              <th className="px-4 py-3">
                Ações
              </th>

              <th className="px-4 py-3 text-right">
                Detalhe
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredRequests.map(
              request => {
                const pending =
                  request.status ===
                  'pending'

                const busy =
                  requestActionEmail ===
                  request.email

                return (
                  <tr
                    key={
                      request.email
                    }
                    className="border-b border-white/[0.06] text-sm text-slate-300 transition hover:bg-white/[0.025]"
                  >
                    <td className="px-4 py-4 font-bold text-white">
                      {
                        request.email
                      }
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-500">
                      {formatDate(
                        request.requestedAt
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={[
                          'inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                          getRequestStatusClassName(
                            request.status
                          )
                        ].join(
                          ' '
                        )}
                      >
                        {getAccessRequestStatusLabel(
                          request.status
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-500">
                      {formatDate(
                        request.activatedAt
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {pending &&
                      canManageRequests ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={
                              Boolean(
                                requestActionEmail
                              )
                            }
                            onClick={() => {
                              void handleRequestDecision(
                                request.email,
                                'approve'
                              )
                            }}
                            className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-xs font-black text-emerald-200 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy
                              ? 'A processar…'
                              : 'Aprovar'}
                          </button>

                          <button
                            type="button"
                            disabled={
                              Boolean(
                                requestActionEmail
                              )
                            }
                            onClick={() => {
                              void handleRequestDecision(
                                request.email,
                                'reject'
                              )
                            }}
                            className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-1.5 text-xs font-black text-rose-200 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Rejeitar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-600">
                          {pending
                            ? 'Ações indisponíveis'
                            : 'Resolvido'}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedEmail(
                            request.email
                          )
                        }
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
                      >
                        Abrir ficha
                      </button>
                    </td>
                  </tr>
                )
              }
            )}
          </tbody>
        </table>

        {filteredRequests.length ===
        0 ? (
          <EmptyTable
            title={
              dataConnected
                ? 'Sem pedidos'
                : 'Pedidos ainda não ligados'
            }
            description={
              dataConnected
                ? 'Não existem pedidos que correspondam aos filtros atuais.'
                : 'Quando ligarmos o backend, os pedidos reais do MA-Professor aparecerão aqui.'
            }
          />
        ) : null}
      </div>
    )

  const renderUsers =
    () => (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-white/10 text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-600">
              <th className="px-4 py-3">
                Email
              </th>

              <th className="px-4 py-3">
                Pedido
              </th>

              <th className="px-4 py-3">
                Licença
              </th>

              <th className="px-4 py-3 text-right">
                Detalhe
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map(
              email => {
                const request =
                  accessRequests.find(
                    item =>
                      item.email ===
                      email
                  )

                const license =
                  licenses.find(
                    item =>
                      item.email ===
                      email
                  )

                return (
                  <tr
                    key={email}
                    className="border-b border-white/[0.06] text-sm text-slate-300 transition hover:bg-white/[0.025]"
                  >
                    <td className="px-4 py-4 font-bold text-white">
                      {email}
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-500">
                      {request
                        ? getAccessRequestStatusLabel(
                            request.status
                          )
                        : '—'}
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-500">
                      {license
                        ? getLicenseStatusLabel(
                            license.status
                          )
                        : 'Sem licença'}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedEmail(
                            email
                          )
                        }
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
                      >
                        Abrir ficha
                      </button>
                    </td>
                  </tr>
                )
              }
            )}
          </tbody>
        </table>

        {filteredUsers.length ===
        0 ? (
          <EmptyTable
            title={
              dataConnected
                ? 'Sem utilizadores'
                : 'Utilizadores ainda não ligados'
            }
            description={
              dataConnected
                ? 'Ainda não existem contas conhecidas pelo sistema.'
                : 'As contas serão agregadas a partir dos pedidos, licenças e renovações reais.'
            }
          />
        ) : null}
      </div>
    )

  const renderLicenses =
    () => (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-white/10 text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-600">
              <th className="px-4 py-3">
                Email
              </th>

              <th className="px-4 py-3">
                Plano
              </th>

              <th className="px-4 py-3">
                Estado
              </th>

              <th className="px-4 py-3">
                Válida até
              </th>

              <th className="px-4 py-3 text-right">
                Detalhe
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredLicenses.map(
              license => (
                <tr
                  key={
                    license.email
                  }
                  className="border-b border-white/[0.06] text-sm text-slate-300 transition hover:bg-white/[0.025]"
                >
                  <td className="px-4 py-4 font-bold text-white">
                    {
                      license.email
                    }
                  </td>

                  <td className="px-4 py-4 text-xs text-slate-400">
                    {getLicensePlanLabel(
                      license.plan
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={[
                        'inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                        getLicenseStatusClassName(
                          license.status
                        )
                      ].join(
                        ' '
                      )}
                    >
                      {getLicenseStatusLabel(
                        license.status
                      )}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-xs text-slate-500">
                    {formatDate(
                      license.validUntil
                    )}
                  </td>

                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedEmail(
                          license.email
                        )
                      }
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                      Abrir ficha
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>

        {filteredLicenses.length ===
        0 ? (
          <EmptyTable
            title={
              dataConnected
                ? 'Sem licenças'
                : 'Licenças ainda não ligadas'
            }
            description={
              dataConnected
                ? 'Não existem licenças para apresentar.'
                : 'As licenças reais aparecerão aqui quando ligarmos a administração ao Worker.'
            }
          />
        ) : null}
      </div>
    )

  const renderRenewals =
    () => (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-white/10 text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-600">
              <th className="px-4 py-3">
                Email
              </th>

              <th className="px-4 py-3">
                Plano
              </th>

              <th className="px-4 py-3">
                Valor
              </th>

              <th className="px-4 py-3">
                Pedido
              </th>

              <th className="px-4 py-3">
                Estado
              </th>

              <th className="px-4 py-3 text-right">
                Detalhe
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredRenewals.map(
              renewal => (
                <tr
                  key={
                    renewal.id
                  }
                  className="border-b border-white/[0.06] text-sm text-slate-300 transition hover:bg-white/[0.025]"
                >
                  <td className="px-4 py-4 font-bold text-white">
                    {
                      renewal.email
                    }
                  </td>

                  <td className="px-4 py-4 text-xs text-slate-400">
                    {getLicensePlanLabel(
                      renewal.requestedPlan
                    )}
                  </td>

                  <td className="px-4 py-4 text-xs font-bold text-slate-300">
                    {formatMoney(
                      renewal.amountCents,
                      renewal.currency
                    )}
                  </td>

                  <td className="px-4 py-4 text-xs text-slate-500">
                    {formatDate(
                      renewal.requestedAt
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={[
                        'inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                        getRenewalStatusClassName(
                          renewal.status
                        )
                      ].join(
                        ' '
                      )}
                    >
                      {getRenewalStatusLabel(
                        renewal.status
                      )}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedEmail(
                          renewal.email
                        )
                      }
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                      Abrir ficha
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>

        {filteredRenewals.length ===
        0 ? (
          <EmptyTable
            title={
              dataConnected
                ? 'Sem renovações'
                : 'Renovações ainda não ligadas'
            }
            description={
              dataConnected
                ? 'Não existem pedidos de renovação que correspondam aos filtros atuais.'
                : 'Os pedidos de renovação reais aparecerão aqui quando ligarmos o backend.'
            }
          />
        ) : null}
      </div>
    )

  const renderHistory =
    () => (
      <MAProfessorAdminHistory
        accessRequests={
          accessRequests
        }
        licenses={
          licenses
        }
        renewals={
          renewals
        }
        dataConnected={
          dataConnected
        }
      />
    )

  const renderActiveTable =
    () => {
      switch (
        activeTab
      ) {
        case 'users':
          return renderUsers()

        case 'licenses':
          return renderLicenses()

        case 'renewals':
          return renderRenewals()

        case 'history':
          return renderHistory()

        default:
          return renderRequests()
      }
    }

  return (
    <div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pedidos pendentes"
          value={metricValue(
            pendingRequests
          )}
          description="Aguardam decisão administrativa"
        />

        <MetricCard
          label="Contas conhecidas"
          value={metricValue(
            userEmails.length
          )}
          description="Emails existentes no sistema"
        />

        <MetricCard
          label="Licenças ativas"
          value={metricValue(
            activeLicenses
          )}
          description="Ativas ou a terminar"
        />

        <MetricCard
          label="Renovações pendentes"
          value={metricValue(
            pendingRenewals
          )}
          description="Aguardam confirmação"
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/55">
        <div className="border-b border-white/10 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(
              tab => {
                const active =
                  tab.id ===
                  activeTab

                return (
                  <button
                    key={
                      tab.id
                    }
                    type="button"
                    onClick={() => {
                      setActiveTab(
                        tab.id
                      )

                      setSelectedEmail(
                        null
                      )

                      setRequestActionFeedback(
                        null
                      )
                    }}
                    className={[
                      'shrink-0 border-b-2 px-4 py-3 text-xs font-black transition',
                      active
                        ? 'border-cyan-300 text-cyan-200'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    ].join(
                      ' '
                    )}
                  >
                    {
                      tab.label
                    }
                  </button>
                )
              }
            )}
          </div>
        </div>

        <div className="border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="min-w-0 flex-1">
              <span className="sr-only">
                Pesquisar
              </span>

              <input
                type="search"
                value={
                  query
                }
                onChange={
                  event =>
                    setQuery(
                      event.target.value
                    )
                }
                placeholder="Pesquisar por email…"
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
              />
            </label>

            {activeTab ===
            'requests' ? (
              <label className="md:w-48">
                <span className="sr-only">
                  Estado
                </span>

                <select
                  value={
                    requestStatus
                  }
                  onChange={
                    event =>
                      setRequestStatus(
                        event.target
                          .value as
                          RequestStatusFilter
                      )
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-cyan-300/40"
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
              </label>
            ) : null}

            <div
              className={[
                'rounded-xl border px-3 py-2.5 text-xs font-bold',
                dataConnected
                  ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200'
                  : 'border-amber-300/15 bg-amber-300/[0.05] text-amber-200'
              ].join(
                ' '
              )}
            >
              {dataConnected
                ? 'Dados reais ligados'
                : 'Backend desligado'}
            </div>
          </div>

          {requestActionFeedback ? (
            <div
              role={
                requestActionFeedback.type ===
                'error'
                  ? 'alert'
                  : 'status'
              }
              className={[
                'mt-3 rounded-xl border px-4 py-3 text-xs font-bold',
                requestActionFeedback.type ===
                  'success'
                  ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'
                  : 'border-rose-300/20 bg-rose-300/[0.06] text-rose-200'
              ].join(
                ' '
              )}
            >
              {
                requestActionFeedback.message
              }
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          {renderActiveTable()}
        </div>
      </section>

      {selectedEmail ? (
        <div className="mt-6">
          <MAProfessorAdminAccountDetail
            email={
              selectedEmail
            }
            request={
              selectedRequest
            }
            license={
              selectedLicense
            }
            renewals={
              selectedRenewals
            }
            dataConnected={
              dataConnected
            }
            onClose={() =>
              setSelectedEmail(
                null
              )
            }
          />
        </div>
      ) : null}
    </div>
  )
}
