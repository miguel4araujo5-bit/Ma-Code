import {
  useEffect,
  useRef,
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

import {
  confirmMAProfessorPayment,
  dispenseMAProfessorPayment,
  generateMAProfessorAccessPassword,
  getMAProfessorCommercialStatus,
  getMAProfessorCredentialStatus,
  type MAProfessorAdminCommercialStatus,
  type MAProfessorAdminCredentialStatus,
  type MAProfessorCommercialPlan,
  type MAProfessorGeneratedCredential
} from '../../../lib/admin/maProfessorAdminApi'

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

function getCommercialPlanLabel(
  plan:
    MAProfessorCommercialPlan |
    null
) {
  switch (plan) {
    case 'paid_30_days':
      return '30 dias — 3,49 €'
    case 'school_year':
      return 'Até 1 de agosto — 15 €'
    default:
      return 'Sem plano registado'
  }
}

function getCommercialPlanShortLabel(
  plan:
    MAProfessorCommercialPlan |
    null
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

function getPaymentStatusLabel(
  status:
    MAProfessorAdminCommercialStatus['paymentStatus'] |
    undefined
) {
  switch (status) {
    case 'confirmed':
      return 'Pagamento confirmado'
    case 'dispensed':
      return 'Pagamento dispensado'
    case 'pending':
      return 'Pagamento pendente'
    default:
      return 'Sem pagamento'
  }
}

function getPaymentStatusClassName(
  status:
    MAProfessorAdminCommercialStatus['paymentStatus'] |
    undefined
) {
  switch (status) {
    case 'confirmed':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
    case 'dispensed':
      return 'border-violet-300/20 bg-violet-300/10 text-violet-200'
    case 'pending':
      return 'border-amber-300/20 bg-amber-300/10 text-amber-200'
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-400'
  }
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message
  }

  return 'Ocorreu um erro ao gerir esta conta.'
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
  const sectionRef =
    useRef<HTMLElement | null>(
      null
    )

  const [
    credentialStatus,
    setCredentialStatus
  ] =
    useState<MAProfessorAdminCredentialStatus | null>(
      null
    )

  const [
    generatedCredential,
    setGeneratedCredential
  ] =
    useState<MAProfessorGeneratedCredential | null>(
      null
    )

  const [
    credentialLoading,
    setCredentialLoading
  ] = useState(false)

  const [
    generatingCredential,
    setGeneratingCredential
  ] = useState(false)

  const [
    credentialError,
    setCredentialError
  ] = useState('')

  const [
    passwordCopied,
    setPasswordCopied
  ] = useState(false)

  const [
    commercialStatus,
    setCommercialStatus
  ] =
    useState<MAProfessorAdminCommercialStatus | null>(
      null
    )

  const [
    commercialLoading,
    setCommercialLoading
  ] = useState(false)

  const [
    commercialSaving,
    setCommercialSaving
  ] = useState(false)

  const [
    commercialError,
    setCommercialError
  ] = useState('')

  const sortedRenewals =
    [...renewals].sort(
      (left, right) =>
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

  const paymentConfirmed =
    commercialStatus
      ?.paymentStatus ===
      'confirmed'

  const paymentDispensed =
    commercialStatus
      ?.paymentStatus ===
      'dispensed'

  const paymentPending =
    commercialStatus
      ?.paymentStatus ===
      'pending'

  const hasCommercialAuthorization =
    Boolean(
      commercialStatus
        ?.authorizationId
    )

  const canGenerateCredential =
    dataConnected &&
    request?.status ===
      'approved' &&
    Boolean(
      commercialStatus
        ?.canGenerateCredential
    ) &&
    !credentialLoading &&
    !commercialLoading &&
    !commercialSaving &&
    !generatingCredential &&
    !generatedCredential

  useEffect(
    () => {
      const frame =
        window.requestAnimationFrame(
          () => {
            sectionRef.current
              ?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
              })
          }
        )

      return () => {
        window.cancelAnimationFrame(
          frame
        )
      }
    },
    [email]
  )

  useEffect(
    () => {
      let cancelled = false

      setGeneratedCredential(
        null
      )
      setPasswordCopied(false)
      setCredentialError('')
      setCredentialStatus(null)

      if (
        !dataConnected ||
        !request
      ) {
        setCredentialLoading(
          false
        )
        return () => {
          cancelled = true
        }
      }

      setCredentialLoading(true)

      void getMAProfessorCredentialStatus(
        email
      )
        .then(status => {
          if (!cancelled) {
            setCredentialStatus(
              status
            )
          }
        })
        .catch(error => {
          if (!cancelled) {
            setCredentialError(
              getErrorMessage(error)
            )
          }
        })
        .finally(() => {
          if (!cancelled) {
            setCredentialLoading(
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
      email,
      request?.status
    ]
  )

  useEffect(
    () => {
      let cancelled = false

      setCommercialStatus(null)
      setCommercialError('')

      if (
        !dataConnected ||
        !request
      ) {
        setCommercialLoading(
          false
        )
        return () => {
          cancelled = true
        }
      }

      setCommercialLoading(true)

      void getMAProfessorCommercialStatus(
        email
      )
        .then(status => {
          if (!cancelled) {
            setCommercialStatus(
              status
            )
          }
        })
        .catch(error => {
          if (!cancelled) {
            setCommercialError(
              getErrorMessage(error)
            )
          }
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
      email,
      request?.status
    ]
  )

  const handleReloadCredentialStatus =
    async () => {
      if (
        !dataConnected ||
        !request ||
        credentialLoading
      ) {
        return
      }

      setCredentialLoading(true)
      setCredentialError('')

      try {
        const status =
          await getMAProfessorCredentialStatus(
            email
          )

        setCredentialStatus(
          status
        )
      } catch (error) {
        setCredentialError(
          getErrorMessage(error)
        )
      } finally {
        setCredentialLoading(false)
      }
    }

  const handleReloadCommercialStatus =
    async () => {
      if (
        !dataConnected ||
        !request ||
        commercialLoading
      ) {
        return
      }

      setCommercialLoading(true)
      setCommercialError('')

      try {
        const status =
          await getMAProfessorCommercialStatus(
            email
          )

        setCommercialStatus(
          status
        )
      } catch (error) {
        setCommercialError(
          getErrorMessage(error)
        )
      } finally {
        setCommercialLoading(false)
      }
    }

  const handleConfirmPayment =
    async () => {
      if (
        !dataConnected ||
        request?.status !==
          'approved' ||
        commercialSaving ||
        commercialStatus
          ?.paymentStatus !==
          'pending'
      ) {
        return
      }

      const confirmed =
        window.confirm(
          [
            `Confirmar que recebeu o pagamento de ${email}?`,
            '',
            `Plano: ${getCommercialPlanLabel(
              commercialStatus.plan
            )}`,
            '',
            'Esta ação regista um pagamento real como recebido. Depois ficará desbloqueada a geração da nova senha.'
          ].join('\n')
        )

      if (!confirmed) {
        return
      }

      setCommercialSaving(true)
      setCommercialError('')

      try {
        const status =
          await confirmMAProfessorPayment(
            email
          )

        setCommercialStatus(
          status
        )
      } catch (error) {
        setCommercialError(
          getErrorMessage(error)
        )
      } finally {
        setCommercialSaving(false)
      }
    }

  const handleDispensePayment =
    async () => {
      if (
        !dataConnected ||
        request?.status !==
          'approved' ||
        commercialSaving ||
        commercialStatus
          ?.paymentStatus !==
          'pending'
      ) {
        return
      }

      const confirmed =
        window.confirm(
          [
            `Dispensar o pagamento de ${email}?`,
            '',
            `Plano: ${getCommercialPlanLabel(
              commercialStatus.plan
            )}`,
            '',
            'Use esta opção apenas quando a MA-CODE decidiu oferecer o acesso.',
            'Não será registado como pagamento recebido.'
          ].join('\n')
        )

      if (!confirmed) {
        return
      }

      setCommercialSaving(true)
      setCommercialError('')

      try {
        const status =
          await dispenseMAProfessorPayment(
            email
          )

        setCommercialStatus(
          status
        )
      } catch (error) {
        setCommercialError(
          getErrorMessage(error)
        )
      } finally {
        setCommercialSaving(false)
      }
    }

  const handleGenerateCredential =
    async () => {
      if (!canGenerateCredential) {
        return
      }

      const paymentLabel =
        paymentDispensed
          ? 'dispensado pela MA-CODE'
          : 'confirmado'

      const confirmed =
        window.confirm(
          [
            `Gerar a nova senha de acesso para ${email}?`,
            '',
            `Plano: ${getCommercialPlanLabel(
              commercialStatus?.plan ??
              null
            )}`,
            `Pagamento: ${paymentLabel}`,
            '',
            'Se esta conta tiver uma senha anterior, ela será substituída pela nova credencial.',
            'A nova senha será apresentada em texto simples apenas agora.'
          ].join('\n')
        )

      if (!confirmed) {
        return
      }

      setGeneratingCredential(true)
      setCredentialError('')
      setCommercialError('')
      setPasswordCopied(false)

      try {
        const credential =
          await generateMAProfessorAccessPassword(
            email
          )

        setGeneratedCredential(
          credential
        )

        setCredentialStatus({
          email:
            credential.email,
          hasCredential: true,
          createdAt:
            credential.createdAt,
          updatedAt:
            credential.updatedAt
        })

        const nextCommercialStatus =
          await getMAProfessorCommercialStatus(
            email
          )

        setCommercialStatus(
          nextCommercialStatus
        )
      } catch (error) {
        setCredentialError(
          getErrorMessage(error)
        )
      } finally {
        setGeneratingCredential(false)
      }
    }

  const handleCopyPassword =
    async () => {
      const password =
        generatedCredential?.password

      if (!password) {
        return
      }

      setCredentialError('')

      try {
        await navigator.clipboard.writeText(
          password
        )
        setPasswordCopied(true)
      } catch {
        setPasswordCopied(false)
        setCredentialError(
          'Não foi possível copiar automaticamente. Selecione a senha no campo e copie-a manualmente.'
        )
      }
    }

  return (
    <section
      ref={sectionRef}
      className="scroll-mt-6 overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-slate-900/65"
    >
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
            plano escolhido pelo professor,
            pagamento, senha, ativação,
            licença e renovações conhecidas
            desta conta.
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
                ].join(' ')}
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
              note="A ativação usa o plano já associado à autorização comercial."
            />
          </div>
        </article>

        <article className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-300">
                Plano e pagamento
              </p>
              <h3 className="mt-1 text-lg font-black text-white">
                Autorização comercial
              </h3>
            </div>

            <span
              className={[
                'rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                commercialLoading
                  ? 'border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-200'
                  : getPaymentStatusClassName(
                      commercialStatus?.paymentStatus
                    )
              ].join(' ')}
            >
              {commercialLoading
                ? 'A verificar'
                : getPaymentStatusLabel(
                    commercialStatus?.paymentStatus
                  )}
            </span>
          </div>

          {commercialError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3"
            >
              <p className="text-xs font-bold leading-5 text-rose-200">
                {commercialError}
              </p>
              {dataConnected && request ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleReloadCommercialStatus()
                  }}
                  disabled={commercialLoading}
                  className="mt-2 text-xs font-black text-rose-100 underline decoration-rose-300/40 underline-offset-4 disabled:opacity-50"
                >
                  Tentar novamente
                </button>
              ) : null}
            </div>
          ) : null}

          {commercialLoading ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-4">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-300/20 border-t-violet-200" />
              <p className="text-xs font-bold text-slate-400">
                A carregar plano e estado do pagamento…
              </p>
            </div>
          ) : commercialStatus && hasCommercialAuthorization ? (
            <div className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailValue
                  label="Plano escolhido"
                  value={getCommercialPlanShortLabel(
                    commercialStatus.plan
                  )}
                  note="Escolhido pelo professor antes de enviar o pedido."
                />
                <DetailValue
                  label="Valor"
                  value={
                    commercialStatus.amountCents == null
                      ? '—'
                      : formatMoney(
                          commercialStatus.amountCents,
                          commercialStatus.currency
                        )
                  }
                />
                <DetailValue
                  label="Escolhido em"
                  value={formatDate(
                    commercialStatus.selectedAt
                  )}
                />
                <DetailValue
                  label="Estado do pagamento"
                  value={getPaymentStatusLabel(
                    commercialStatus.paymentStatus
                  )}
                />
              </div>

              {paymentConfirmed ? (
                <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
                  <p className="text-sm font-black text-emerald-200">
                    Pagamento confirmado
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Recebimento confirmado em{' '}
                    {formatDate(
                      commercialStatus.paymentConfirmedAt
                    )}.
                  </p>
                </div>
              ) : null}

              {paymentDispensed ? (
                <div className="mt-4 rounded-xl border border-violet-300/20 bg-violet-300/[0.06] p-4">
                  <p className="text-sm font-black text-violet-200">
                    Pagamento dispensado
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    A MA-CODE autorizou este acesso sem registar um pagamento como recebido. Dispensa registada em{' '}
                    {formatDate(
                      commercialStatus.paymentDispensedAt
                    )}.
                  </p>
                </div>
              ) : null}

              {paymentPending && request?.status === 'approved' ? (
                <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                  <p className="text-sm font-black text-amber-200">
                    Pagamento pendente de verificação
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Confirme o recebimento apenas se o pagamento chegou. Se a MA-CODE decidiu oferecer o acesso, use “Dispensar pagamento”.
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleConfirmPayment()
                      }}
                      disabled={commercialSaving}
                      className="rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {commercialSaving
                        ? 'A guardar…'
                        : 'Confirmar pagamento'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleDispensePayment()
                      }}
                      disabled={commercialSaving}
                      className="rounded-xl border border-violet-300/25 bg-violet-300/[0.08] px-4 py-2.5 text-xs font-black text-violet-200 transition hover:bg-violet-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {commercialSaving
                        ? 'A guardar…'
                        : 'Dispensar pagamento'}
                    </button>
                  </div>
                </div>
              ) : null}

              {request?.status === 'pending' ? (
                <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
                  <p className="text-sm font-black text-amber-200">
                    Pedido ainda pendente
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    O plano e o valor já vieram do pedido do professor. Aprove ou rejeite o pedido antes de resolver o pagamento.
                  </p>
                </div>
              ) : null}

              {request?.status === 'rejected' ? (
                <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-4">
                  <p className="text-sm font-black text-rose-200">
                    Pedido rejeitado
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Não é possível validar o pagamento nem gerar uma senha para este pedido rejeitado.
                  </p>
                </div>
              ) : null}
            </div>
          ) : request ? (
            <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
              <p className="text-sm font-black text-amber-200">
                Sem autorização comercial associada
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Pedidos novos devem chegar com o plano escolhido pelo professor. Não escolha um plano no MA-ADMIN. Se este for um pedido histórico anterior ao novo fluxo, mantenha-o para tratamento de compatibilidade.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-sm font-black text-slate-400">
                Sem pedido de acesso
              </p>
            </div>
          )}
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
                ].join(' ')}
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
              label="Validade"
              value={formatDate(
                license?.validUntil ??
                null
              )}
            />
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">
                Senha de acesso
              </p>
              <h3 className="mt-1 text-lg font-black text-white">
                Credencial da autorização
              </h3>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-black text-slate-400">
              {credentialLoading
                ? 'A verificar'
                : credentialStatus?.hasCredential
                  ? 'Senha emitida'
                  : 'Sem senha'}
            </span>
          </div>

          {credentialError ? (
            <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3">
              <p className="text-xs font-bold leading-5 text-rose-200">
                {credentialError}
              </p>
              {dataConnected && request ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleReloadCredentialStatus()
                  }}
                  disabled={credentialLoading}
                  className="mt-2 text-xs font-black text-rose-100 underline decoration-rose-300/40 underline-offset-4 disabled:opacity-50"
                >
                  Tentar novamente
                </button>
              ) : null}
            </div>
          ) : null}

          {generatedCredential ? (
            <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
              <p className="text-sm font-black text-emerald-200">
                Nova senha criada
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Copie agora e envie manualmente através de MA-Professor | MA-CODE &lt;acesso@ma-code.pt&gt;. Esta senha não volta a ser mostrada em texto simples.
              </p>

              <div className="mt-3 flex gap-2">
                <input
                  readOnly
                  value={generatedCredential.password}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-sm font-black text-white outline-none"
                  aria-label="Nova senha de acesso"
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyPassword()
                  }}
                  className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
                >
                  {passwordCopied
                    ? 'Copiada ✓'
                    : 'Copiar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailValue
                label="Estado"
                value={
                  credentialStatus?.hasCredential
                    ? 'Senha já emitida'
                    : 'Sem senha emitida'
                }
              />
              <DetailValue
                label="Última atualização"
                value={formatDate(
                  credentialStatus?.updatedAt ??
                  null
                )}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              void handleGenerateCredential()
            }}
            disabled={!canGenerateCredential}
            className="mt-4 w-full rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generatingCredential
              ? 'A gerar…'
              : credentialStatus?.hasCredential
                ? 'Gerar nova senha para esta autorização'
                : 'Gerar nova senha'}
          </button>

          {!commercialStatus?.canGenerateCredential ? (
            <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
              A senha só fica disponível depois de pedido aprovado + plano associado + pagamento confirmado ou dispensado.
            </p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 sm:p-5 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Renovações
              </p>
              <h3 className="mt-1 text-lg font-black text-white">
                Pedidos de novo período
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-black text-slate-400">
              {renewals.length}
            </span>
          </div>

          {latestRenewal ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailValue
                label="Último plano pedido"
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
                label="Estado"
                value={latestRenewal.status}
              />
            </div>
          ) : (
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Ainda não existem renovações registadas para esta conta.
            </p>
          )}
        </article>

        <article className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35 xl:col-span-2">
          <div className="border-b border-white/10 p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Histórico
            </p>
            <h3 className="mt-1 text-lg font-black text-white">
              Linha temporal da conta
            </h3>
          </div>

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
            renewals={renewals}
            email={email}
            dataConnected={dataConnected}
            compact
          />
        </article>
      </div>
    </section>
  )
}
