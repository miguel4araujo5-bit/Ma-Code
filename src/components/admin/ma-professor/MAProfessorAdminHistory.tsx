import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  getLicensePlanLabel,
  type MAProfessorAccessRequestSummary
} from '../../ma-professor/access/accessTypes'

import type {
  LicenseRenewalRequest,
  LicenseSummary
} from '../../ma-professor/types'

import {
  getMAProfessorCommercialStatus,
  type MAProfessorAdminCommercialStatus
} from '../../../lib/admin/maProfessorAdminApi'

interface MAProfessorCommercialAuthorizationHistory {
  authorizationId: string
  email: string
  plan:
    NonNullable<MAProfessorAdminCommercialStatus['plan']>
  amountCents: number
  currency: 'EUR'
  paymentStatus:
    Exclude<
      MAProfessorAdminCommercialStatus['paymentStatus'],
      'not_started'
    >
  selectedAt: string
  paymentConfirmedAt: string | null
  paymentDispensedAt: string | null
  credentialIssuedAt: string | null
  activatedAt: string | null
  renewalId: string | null
  createdAt: string
  updatedAt: string
}

type MAProfessorCommercialStatusWithHistory =
  MAProfessorAdminCommercialStatus & {
    authorizations?:
      MAProfessorCommercialAuthorizationHistory[]
  }

type HistoryTone =
  | 'neutral'
  | 'positive'
  | 'warning'
  | 'negative'
  | 'info'
  | 'commercial'

interface MAProfessorAdminHistoryEvent {
  id: string
  email: string
  occurredAt: string
  title: string
  description: string
  result: string
  tone: HistoryTone
}

interface MAProfessorAdminHistoryProps {
  accessRequests?:
    MAProfessorAccessRequestSummary[]
  licenses?:
    LicenseSummary[]
  renewals?:
    LicenseRenewalRequest[]
  email?: string | null
  dataConnected?: boolean
  compact?: boolean
}

function formatDate(
  value: string
) {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Data inválida'
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

function getRenewalResultLabel(
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

function getRenewalTone(
  status:
    LicenseRenewalRequest['status']
): HistoryTone {
  switch (status) {
    case 'approved':
      return 'positive'

    case 'rejected':
      return 'negative'

    case 'cancelled':
      return 'neutral'

    default:
      return 'warning'
  }
}

function getToneClasses(
  tone: HistoryTone
) {
  switch (tone) {
    case 'positive':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'

    case 'warning':
      return 'border-amber-300/20 bg-amber-300/10 text-amber-200'

    case 'negative':
      return 'border-rose-300/20 bg-rose-300/10 text-rose-200'

    case 'info':
      return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200'

    case 'commercial':
      return 'border-violet-300/20 bg-violet-300/10 text-violet-200'

    default:
      return 'border-white/10 bg-white/[0.04] text-slate-400'
  }
}

function getCommercialPlanLabel(
  authorization:
    MAProfessorCommercialAuthorizationHistory
) {
  return getLicensePlanLabel(
    authorization.plan
  )
}

function getCommercialValueLabel(
  authorization:
    MAProfessorCommercialAuthorizationHistory
) {
  return formatMoney(
    authorization.amountCents,
    authorization.currency
  )
}

function buildCommercialEvents(
  authorizations:
    MAProfessorCommercialAuthorizationHistory[]
) {
  const events:
    MAProfessorAdminHistoryEvent[] =
      []

  for (
    const authorization of
    authorizations
  ) {
    const planLabel =
      getCommercialPlanLabel(
        authorization
      )

    const valueLabel =
      getCommercialValueLabel(
        authorization
      )

    events.push({
      id:
        `${authorization.authorizationId}:selected`,
      email:
        authorization.email,
      occurredAt:
        authorization.selectedAt,
      title:
        authorization.renewalId
          ? 'Autorização de renovação criada'
          : 'Autorização comercial registada',
      description:
        authorization.renewalId
          ? `${planLabel} · ${valueLabel}. O novo pedido de renovação ficou associado a uma autorização comercial própria.`
          : `${planLabel} · ${valueLabel}. O plano escolhido pelo professor ficou associado à autorização inicial desta conta.`,
      result:
        'Pagamento pendente',
      tone:
        'commercial'
    })

    if (
      authorization.paymentConfirmedAt
    ) {
      events.push({
        id:
          `${authorization.authorizationId}:payment-confirmed`,
        email:
          authorization.email,
        occurredAt:
          authorization.paymentConfirmedAt,
        title:
          'Pagamento confirmado',
        description:
          `${planLabel} · ${valueLabel}. A MA-CODE confirmou o recebimento do pagamento desta autorização.`,
        result:
          'Confirmado',
        tone:
          'positive'
      })
    }

    if (
      authorization.paymentDispensedAt
    ) {
      events.push({
        id:
          `${authorization.authorizationId}:payment-dispensed`,
        email:
          authorization.email,
        occurredAt:
          authorization.paymentDispensedAt,
        title:
          'Pagamento dispensado',
        description:
          `${planLabel} · ${valueLabel}. A MA-CODE autorizou este período sem registar um pagamento como recebido.`,
        result:
          'Dispensado',
        tone:
          'commercial'
      })
    }

    if (
      authorization.credentialIssuedAt
    ) {
      events.push({
        id:
          `${authorization.authorizationId}:credential-issued`,
        email:
          authorization.email,
        occurredAt:
          authorization.credentialIssuedAt,
        title:
          'Nova senha emitida',
        description:
          `${planLabel}. Foi criada uma nova credencial específica para esta autorização comercial.`,
        result:
          'Senha emitida',
        tone:
          'info'
      })
    }

    if (
      authorization.activatedAt
    ) {
      events.push({
        id:
          `${authorization.authorizationId}:activated`,
        email:
          authorization.email,
        occurredAt:
          authorization.activatedAt,
        title:
          authorization.renewalId
            ? 'Renovação ativada'
            : 'Autorização comercial ativada',
        description:
          authorization.renewalId
            ? `${planLabel}. A nova senha foi utilizada com sucesso e o novo período de licença foi aplicado.`
            : `${planLabel}. A senha desta autorização foi utilizada com sucesso e o período inicial foi aplicado.`,
        result:
          'Ativada',
        tone:
          'positive'
      })
    }
  }

  return events
}

function buildHistoryEvents(
  accessRequests:
    MAProfessorAccessRequestSummary[],
  licenses:
    LicenseSummary[],
  renewals:
    LicenseRenewalRequest[],
  commercialAuthorizations:
    MAProfessorCommercialAuthorizationHistory[]
) {
  const events:
    MAProfessorAdminHistoryEvent[] = [
      ...buildCommercialEvents(
        commercialAuthorizations
      )
    ]

  for (
    const request of
    accessRequests
  ) {
    if (
      request.requestedAt
    ) {
      events.push({
        id:
          `${request.email}:request:${request.requestedAt}`,
        email:
          request.email,
        occurredAt:
          request.requestedAt,
        title:
          'Pedido recebido',
        description:
          'A conta enviou um pedido de acesso ao MA-Professor.',
        result:
          'Pedido criado',
        tone:
          'info'
      })
    }

    if (
      request.approvedAt
    ) {
      events.push({
        id:
          `${request.email}:approved:${request.approvedAt}`,
        email:
          request.email,
        occurredAt:
          request.approvedAt,
        title:
          'Pedido aprovado',
        description:
          'A MA-CODE marcou o pedido de acesso como aprovado.',
        result:
          'Aprovado',
        tone:
          'positive'
      })
    }

    if (
      request.rejectedAt
    ) {
      events.push({
        id:
          `${request.email}:rejected:${request.rejectedAt}`,
        email:
          request.email,
        occurredAt:
          request.rejectedAt,
        title:
          'Pedido rejeitado',
        description:
          'A MA-CODE marcou o pedido de acesso como rejeitado.',
        result:
          'Rejeitado',
        tone:
          'negative'
      })
    }

    if (
      request.activatedAt
    ) {
      events.push({
        id:
          `${request.email}:activated:${request.activatedAt}`,
        email:
          request.email,
        occurredAt:
          request.activatedAt,
        title:
          'Primeira ativação registada',
        description:
          'A conta concluiu a primeira ativação válida com a credencial autorizada.',
        result:
          'Ativada',
        tone:
          'positive'
      })
    }
  }

  for (
    const license of
    licenses
  ) {
    if (
      !license.validFrom
    ) {
      continue
    }

    const request =
      accessRequests.find(
        item =>
          item.email ===
          license.email
      )

    if (
      request?.activatedAt ===
      license.validFrom
    ) {
      continue
    }

    events.push({
      id:
        `${license.email}:license:${license.validFrom}:${license.plan ?? 'none'}`,
      email:
        license.email,
      occurredAt:
        license.validFrom,
      title:
        'Novo período de licença iniciado',
      description:
        `Plano: ${getLicensePlanLabel(
          license.plan
        )}.`,
      result:
        license.validUntil
          ? `Válida até ${formatDate(
              license.validUntil
            )}`
          : 'Sem data final registada',
      tone:
        'positive'
    })
  }

  for (
    const renewal of
    renewals
  ) {
    events.push({
      id:
        `${renewal.id}:requested`,
      email:
        renewal.email,
      occurredAt:
        renewal.requestedAt,
      title:
        'Renovação solicitada',
      description:
        `${getLicensePlanLabel(
          renewal.requestedPlan
        )} · ${formatMoney(
          renewal.amountCents,
          renewal.currency
        )}.`,
      result:
        'Pedido criado',
      tone:
        'info'
    })

    if (
      renewal.resolvedAt
    ) {
      events.push({
        id:
          `${renewal.id}:resolved`,
        email:
          renewal.email,
        occurredAt:
          renewal.resolvedAt,
        title:
          'Renovação resolvida',
        description:
          `${getLicensePlanLabel(
            renewal.requestedPlan
          )} · ${formatMoney(
            renewal.amountCents,
            renewal.currency
          )}.`,
        result:
          getRenewalResultLabel(
            renewal.status
          ),
        tone:
          getRenewalTone(
            renewal.status
          )
      })
    }
  }

  return events.sort(
    (
      left,
      right
    ) =>
      new Date(
        right.occurredAt
      ).getTime() -
      new Date(
        left.occurredAt
      ).getTime()
  )
}

export default function MAProfessorAdminHistory({
  accessRequests = [],
  licenses = [],
  renewals = [],
  email = null,
  dataConnected = false,
  compact = false
}: MAProfessorAdminHistoryProps) {
  const [
    commercialAuthorizations,
    setCommercialAuthorizations
  ] =
    useState<
      MAProfessorCommercialAuthorizationHistory[]
    >([])

  const [
    commercialLoading,
    setCommercialLoading
  ] =
    useState(false)

  const targetEmails =
    useMemo(
      () => {
        if (email) {
          return [email]
        }

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
        ).sort()
      },
      [
        accessRequests,
        email,
        licenses,
        renewals
      ]
    )

  useEffect(
    () => {
      let cancelled =
        false

      setCommercialAuthorizations(
        []
      )

      if (
        !dataConnected ||
        targetEmails.length ===
          0
      ) {
        setCommercialLoading(
          false
        )

        return () => {
          cancelled = true
        }
      }

      setCommercialLoading(
        true
      )

      void Promise.allSettled(
        targetEmails.map(
          targetEmail =>
            getMAProfessorCommercialStatus(
              targetEmail
            )
        )
      )
        .then(results => {
          if (cancelled) {
            return
          }

          const byAuthorizationId =
            new Map<
              string,
              MAProfessorCommercialAuthorizationHistory
            >()

          for (
            const result of
            results
          ) {
            if (
              result.status !==
              'fulfilled'
            ) {
              continue
            }

            const status =
              result.value as
                MAProfessorCommercialStatusWithHistory

            for (
              const authorization of
              status.authorizations ||
              []
            ) {
              byAuthorizationId.set(
                authorization.authorizationId,
                authorization
              )
            }
          }

          setCommercialAuthorizations(
            Array.from(
              byAuthorizationId.values()
            )
          )
        })
        .finally(() => {
          if (!cancelled) {
            setCommercialLoading(
              false
            )
          }
        })

      return () => {
        cancelled = true
      }
    },
    [
      dataConnected,
      targetEmails
    ]
  )

  const events =
    useMemo(
      () => {
        const allEvents =
          buildHistoryEvents(
            accessRequests,
            licenses,
            renewals,
            commercialAuthorizations
          )

        if (!email) {
          return allEvents
        }

        return allEvents.filter(
          event =>
            event.email ===
            email
        )
      },
      [
        accessRequests,
        commercialAuthorizations,
        email,
        licenses,
        renewals
      ]
    )

  if (
    events.length === 0 &&
    commercialLoading
  ) {
    return (
      <div
        className={[
          'flex flex-col items-center justify-center text-center',
          compact
            ? 'min-h-40 px-4 py-8'
            : 'min-h-64 px-6 py-12'
        ].join(' ')}
      >
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-200" />

        <p className="mt-4 text-sm font-black text-slate-300">
          A carregar histórico comercial
        </p>

        <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">
          A consultar os estados reais de plano, pagamento e credencial.
        </p>
      </div>
    )
  }

  if (
    events.length === 0
  ) {
    return (
      <div
        className={[
          'flex flex-col items-center justify-center text-center',
          compact
            ? 'min-h-40 px-4 py-8'
            : 'min-h-64 px-6 py-12'
        ].join(' ')}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-slate-500">
          —
        </div>

        <h3 className="mt-4 text-sm font-black text-slate-300">
          {dataConnected
            ? 'Sem acontecimentos registados'
            : 'Histórico ainda não ligado'}
        </h3>

        <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">
          {dataConnected
            ? 'Os dados atuais não contêm acontecimentos administrativos para apresentar.'
            : 'A timeline é construída apenas a partir de datas e estados reais fornecidos pelo backend. Não são criados eventos fictícios.'}
        </p>
      </div>
    )
  }

  return (
    <div
      className={
        compact
          ? 'py-1'
          : 'p-4 sm:p-5'
      }
    >
      {commercialLoading ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] px-3 py-2 text-[0.68rem] font-bold text-cyan-200">
          <span className="h-3 w-3 animate-spin rounded-full border border-cyan-300/20 border-t-cyan-200" />
          A atualizar acontecimentos comerciais…
        </div>
      ) : null}

      <ol className="space-y-4">
        {events.map(
          event => (
            <li
              key={event.id}
              className="relative grid gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]"
            >
              <time className="pt-1 text-xs font-bold text-slate-500">
                {formatDate(
                  event.occurredAt
                )}
              </time>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">
                      {event.title}
                    </p>

                    <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                      {event.email}
                    </p>
                  </div>

                  <span
                    className={[
                      'rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                      getToneClasses(
                        event.tone
                      )
                    ].join(' ')}
                  >
                    {event.result}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-400">
                  {event.description}
                </p>
              </div>
            </li>
          )
        )}
      </ol>
    </div>
  )
}
