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

import MAProfessorAdminHistory from './MAProfessorAdminHistory'

interface MAProfessorAdminAccountDetailProps {
  email: string
  request:
    MAProfessorAccessRequestSummary |
    null
  license:
    LicenseSummary |
    null
  renewals:
    LicenseRenewalRequest[]
  dataConnected?: boolean
  onClose: () => void
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

function DetailValue({
  label,
  value,
  note
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
        {label}
      </p>

      <p className="mt-1 break-words text-xs font-bold text-slate-300">
        {value}
      </p>

      {note ? (
        <p className="mt-1 text-[0.68rem] leading-5 text-slate-600">
          {note}
        </p>
      ) : null}
    </div>
  )
}

export default function MAProfessorAdminAccountDetail({
  email,
  request,
  license,
  renewals,
  dataConnected = false,
  onClose
}: MAProfessorAdminAccountDetailProps) {
  const sortedRenewals =
    [...renewals].sort(
      (
        left,
        right
      ) =>
        new Date(
          right.requestedAt
        ).getTime() -
        new Date(
          left.requestedAt
        ).getTime()
    )

  const latestRenewal =
    sortedRenewals[0] ||
    null

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-slate-900/65">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Ficha da conta
          </p>

          <h2 className="mt-2 break-all text-xl font-black text-white sm:text-2xl">
            {email}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Visão consolidada do pedido,
            ativação, licença e renovações
            conhecidas desta conta.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          Fechar ficha
        </button>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Pedido de acesso
              </p>

              <h3 className="mt-1 text-lg font-black text-white">
                Estado do pedido
              </h3>
            </div>

            {request ? (
              <span
                className={[
                  'rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
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
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-black text-slate-500">
                Sem pedido
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailValue
              label="Pedido recebido"
              value={formatDate(
                request?.requestedAt ??
                  null
              )}
            />

            <DetailValue
              label="Aprovado em"
              value={formatDate(
                request?.approvedAt ??
                  null
              )}
            />

            <DetailValue
              label="Rejeitado em"
              value={formatDate(
                request?.rejectedAt ??
                  null
              )}
            />

            <DetailValue
              label="Primeira ativação"
              value={formatDate(
                request?.activatedAt ??
                  null
              )}
              note="A beta de 30 dias começa apenas na primeira ativação válida."
            />
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Licença atual
              </p>

              <h3 className="mt-1 text-lg font-black text-white">
                Período de acesso
              </h3>
            </div>

            {license ? (
              <span
                className={[
                  'rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
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
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-black text-slate-500">
                Sem licença
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailValue
              label="Plano"
              value={
                license
                  ? getLicensePlanLabel(
                      license.plan
                    )
                  : '—'
              }
            />

            <DetailValue
              label="Estado"
              value={
                license
                  ? getLicenseStatusLabel(
                      license.status
                    )
                  : '—'
              }
            />

            <DetailValue
              label="Início"
              value={formatDate(
                license?.validFrom ??
                  null
              )}
            />

            <DetailValue
              label="Válida até"
              value={formatDate(
                license?.validUntil ??
                  null
              )}
            />

            <DetailValue
              label="Dias restantes"
              value={
                license?.daysRemaining ==
                null
                  ? '—'
                  : String(
                      license.daysRemaining
                    )
              }
            />

            <DetailValue
              label="Renovação pedida em"
              value={formatDate(
                license?.renewalRequestedAt ??
                  null
              )}
            />
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
            Credencial
          </p>

          <h3 className="mt-1 text-lg font-black text-white">
            Senha da conta
          </h3>

          <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
            <p className="text-sm font-black text-amber-200">
              Estado ainda não disponível
              neste contrato
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Os dados atualmente expostos
              ao frontend não indicam se a
              conta já possui uma senha
              associada. Esta informação só
              será mostrada quando a API
              administrativa protegida a
              fornecer.
            </p>
          </div>

          <button
            type="button"
            disabled
            className="mt-4 w-full cursor-not-allowed rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] px-4 py-2.5 text-xs font-black text-cyan-300/40"
          >
            Gerar / redefinir senha
          </button>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
            Última renovação conhecida
          </p>

          <h3 className="mt-1 text-lg font-black text-white">
            Pedido de renovação
          </h3>

          {latestRenewal ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailValue
                label="Plano"
                value={getLicensePlanLabel(
                  latestRenewal.requestedPlan
                )}
              />

              <DetailValue
                label="Valor"
                value={formatMoney(
                  latestRenewal.amountCents,
                  latestRenewal.currency
                )}
              />

              <DetailValue
                label="Pedido em"
                value={formatDate(
                  latestRenewal.requestedAt
                )}
              />

              <DetailValue
                label="Resolvido em"
                value={formatDate(
                  latestRenewal.resolvedAt
                )}
              />

              <DetailValue
                label="Estado"
                value={
                  latestRenewal.status
                }
              />

              <DetailValue
                label="Total de pedidos"
                value={String(
                  sortedRenewals.length
                )}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
              <p className="text-sm font-black text-slate-400">
                Sem renovações
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-600">
                Não existe nenhum pedido de
                renovação conhecido para
                esta conta.
              </p>
            </div>
          )}
        </article>
      </div>

      <div className="border-t border-white/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Histórico da conta
            </p>

            <h3 className="mt-1 text-lg font-black text-white">
              Timeline administrativa
            </h3>
          </div>

          <span className="text-xs font-semibold text-slate-600">
            Apenas acontecimentos
            suportados pelos dados atuais
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
          <MAProfessorAdminHistory
            accessRequests={
              request
                ? [request]
                : []
            }
            licenses={
              license
                ? [license]
                : []
            }
            renewals={
              sortedRenewals
            }
            email={email}
            dataConnected={
              dataConnected
            }
            compact
          />
        </div>
      </div>

      <div className="border-t border-white/10 bg-slate-950/35 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl bg-emerald-300/10 px-4 py-2.5 text-xs font-black text-emerald-300/40"
          >
            Aprovar pedido
          </button>

          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl border border-cyan-300/10 px-4 py-2.5 text-xs font-black text-cyan-300/40"
          >
            Gerar senha
          </button>

          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl border border-violet-300/10 px-4 py-2.5 text-xs font-black text-violet-300/40"
          >
            Confirmar renovação
          </button>

          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl border border-rose-300/10 px-4 py-2.5 text-xs font-black text-rose-300/40"
          >
            Rejeitar / revogar
          </button>
        </div>

        <p className="mt-3 text-center text-[0.68rem] leading-5 text-slate-600">
          As operações continuam bloqueadas
          até existir autenticação e API
          administrativa protegida.
        </p>
      </div>
    </section>
  )
}
