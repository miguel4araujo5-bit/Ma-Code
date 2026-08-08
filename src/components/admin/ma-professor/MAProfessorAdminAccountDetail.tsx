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
  generateMAProfessorAccessPassword,
  getMAProfessorCommercialStatus,
  getMAProfessorCredentialStatus,
  selectMAProfessorCommercialPlan,
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
  ] =
    useState(false)

  const [
    generatingCredential,
    setGeneratingCredential
  ] =
    useState(false)

  const [
    credentialError,
    setCredentialError
  ] =
    useState('')

  const [
    passwordCopied,
    setPasswordCopied
  ] =
    useState(false)

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
  ] =
    useState(false)

  const [
    commercialSaving,
    setCommercialSaving
  ] =
    useState(false)

  const [
    commercialError,
    setCommercialError
  ] =
    useState('')

  const [
    selectedPlan,
    setSelectedPlan
  ] =
    useState<MAProfessorCommercialPlan>(
      'paid_30_days'
    )

  const sortedRenewals =
    [
      ...renewals
    ].sort(
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
    [
      email
    ]
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
        .then(
          status => {
            if (cancelled) {
              return
            }

            setCredentialStatus(
              status
            )
          }
        )
        .catch(
          error => {
            if (cancelled) {
              return
            }

            setCredentialError(
              getErrorMessage(error)
            )
          }
        )
        .finally(
          () => {
            if (!cancelled) {
              setCredentialLoading(
                false
              )
            }
          }
        )

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
      setSelectedPlan(
        'paid_30_days'
      )

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
        .then(
          status => {
            if (cancelled) {
              return
            }

            setCommercialStatus(
              status
            )

            if (status.plan) {
              setSelectedPlan(
                status.plan
              )
            }
          }
        )
        .catch(
          error => {
            if (cancelled) {
              return
            }

            setCommercialError(
              getErrorMessage(error)
            )
          }
        )
        .finally(
          () => {
            if (!cancelled) {
              setCommercialLoading(
                false
              )
            }
          }
        )

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

        if (status.plan) {
          setSelectedPlan(
            status.plan
          )
        }
      } catch (error) {
        setCommercialError(
          getErrorMessage(error)
        )
      } finally {
        setCommercialLoading(false)
      }
    }

  const handleSavePlan =
    async () => {
      if (
        !dataConnected ||
        request?.status !==
          'approved' ||
        commercialSaving ||
        commercialStatus
          ?.paymentStatus ===
          'confirmed'
      ) {
        return
      }

      setCommercialSaving(true)
      setCommercialError('')

      try {
        const status =
          await selectMAProfessorCommercialPlan(
            email,
            selectedPlan
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

      const planLabel =
        getCommercialPlanLabel(
          commercialStatus.plan
        )

      const confirmed =
        window.confirm(
          [
            `Confirmar que recebeu o pagamento de ${email}?`,
            '',
            `Plano: ${planLabel}`,
            '',
            'Depois de confirmar, o plano já não pode ser alterado nesta autorização e ficará desbloqueada a geração da nova senha.'
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

  const handleGenerateCredential =
    async () => {
      if (!canGenerateCredential) {
        return
      }

      const confirmed =
        window.confirm(
          [
            `Gerar a nova senha de acesso para ${email}?`,
            '',
            `Plano: ${getCommercialPlanLabel(
              commercialStatus?.plan ??
              null
            )}`,
            'Pagamento: confirmado',
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

  const paymentConfirmed =
    commercialStatus
      ?.paymentStatus ===
      'confirmed'

  const paymentPending =
    commercialStatus
      ?.paymentStatus ===
      'pending'

  const hasCommercialAuthorization =
    Boolean(
      commercialStatus
        ?.authorizationId
    )

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
            plano, pagamento, senha,
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
              note="A ativação não deve conceder um plano diferente daquele que foi pago e autorizado."
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

            {commercialLoading ? (
              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-2.5 py-1 text-[0.65rem] font-black text-cyan-200">
                A verificar
              </span>
            ) : (
              <span
                className={[
                  'rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                  getPaymentStatusClassName(
                    commercialStatus
                      ?.paymentStatus
                  )
                ].join(' ')}
              >
                {getPaymentStatusLabel(
                  commercialStatus
                    ?.paymentStatus
                )}
              </span>
            )}
          </div>

          {commercialError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3"
            >
              <p className="text-xs font-bold leading-5 text-rose-200">
                {commercialError}
              </p>

              {dataConnected &&
              request ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleReloadCommercialStatus()
                  }}
                  disabled={
                    commercialLoading
                  }
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
                A carregar plano e estado do
                pagamento…
              </p>
            </div>
          ) : request?.status ===
            'approved' ? (
            <div className="mt-4">
              {paymentConfirmed ? (
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
                  <p className="text-sm font-black text-emerald-200">
                    Pagamento confirmado
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {getCommercialPlanLabel(
                      commercialStatus
                        ?.plan ??
                        null
                    )}
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <DetailValue
                      label="Plano"
                      value={getCommercialPlanShortLabel(
                        commercialStatus
                          ?.plan ??
                          null
                      )}
                    />

                    <DetailValue
                      label="Valor"
                      value={
                        commercialStatus
                          ?.amountCents ==
                        null
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
                        commercialStatus
                          ?.selectedAt ??
                          null
                      )}
                    />

                    <DetailValue
                      label="Pagamento confirmado"
                      value={formatDate(
                        commercialStatus
                          ?.paymentConfirmedAt ??
                          null
                      )}
                    />
                  </div>

                  <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
                    A nova senha só pode ser
                    emitida para esta
                    autorização confirmada.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-bold leading-5 text-slate-400">
                    Registe a escolha do
                    utilizador. No próximo
                    bloco esta escolha passará
                    a chegar automaticamente
                    da página pública do
                    MA-Professor.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPlan(
                          'paid_30_days'
                        )
                      }
                      disabled={
                        commercialSaving
                      }
                      className={[
                        'rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                        selectedPlan ===
                        'paid_30_days'
                          ? 'border-violet-300/35 bg-violet-300/[0.08]'
                          : 'border-white/10 bg-slate-950/45 hover:border-white/20'
                      ].join(' ')}
                    >
                      <p className="text-sm font-black text-white">
                        3,49 €
                      </p>

                      <p className="mt-1 text-xs font-bold text-violet-200">
                        30 dias
                      </p>

                      <p className="mt-2 text-[0.68rem] leading-5 text-slate-500">
                        Renovação manual. Um
                        novo pagamento dará
                        origem a uma nova
                        autorização e senha.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPlan(
                          'school_year'
                        )
                      }
                      disabled={
                        commercialSaving
                      }
                      className={[
                        'rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                        selectedPlan ===
                        'school_year'
                          ? 'border-violet-300/35 bg-violet-300/[0.08]'
                          : 'border-white/10 bg-slate-950/45 hover:border-white/20'
                      ].join(' ')}
                    >
                      <p className="text-sm font-black text-white">
                        15 €
                      </p>

                      <p className="mt-1 text-xs font-bold text-violet-200">
                        Até 1 de agosto
                      </p>

                      <p className="mt-2 text-[0.68rem] leading-5 text-slate-500">
                        Sem mensalidades
                        enquanto esta licença
                        estiver válida.
                      </p>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void handleSavePlan()
                    }}
                    disabled={
                      commercialSaving
                    }
                    className="mt-3 w-full rounded-xl border border-violet-300/25 bg-violet-300/[0.08] px-4 py-2.5 text-xs font-black text-violet-200 transition hover:bg-violet-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {commercialSaving
                      ? 'A guardar…'
                      : hasCommercialAuthorization
                        ? 'Atualizar plano escolhido'
                        : 'Registar plano escolhido'}
                  </button>

                  {paymentPending ? (
                    <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                      <p className="text-sm font-black text-amber-200">
                        Pagamento pendente
                      </p>

                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Plano registado:{' '}
                        {getCommercialPlanLabel(
                          commercialStatus
                            ?.plan ??
                            null
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Escolhido em:{' '}
                        {formatDate(
                          commercialStatus
                            ?.selectedAt ??
                            null
                        )}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          void handleConfirmPayment()
                        }}
                        disabled={
                          commercialSaving
                        }
                        className="mt-3 w-full rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {commercialSaving
                          ? 'A confirmar…'
                          : 'Confirmar pagamento recebido'}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : request?.status ===
            'pending' ? (
            <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
              <p className="text-sm font-black text-amber-200">
                Pedido ainda pendente
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                O plano só entra no fluxo
                comercial depois de o pedido
                ser aprovado.
              </p>
            </div>
          ) : request?.status ===
            'rejected' ? (
            <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-4">
              <p className="text-sm font-black text-rose-200">
                Pedido rejeitado
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Não é possível associar um
                pagamento a este pedido.
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
              label="Válida até"
              value={formatDate(
                license?.validUntil ??
                null
              )}
            />

            <DetailValue
              label="Dias restantes"
              value={
                license
                  ?.daysRemaining ==
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
                license
                  ?.renewalRequestedAt ??
                  null
              )}
            />
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">
                Credencial
              </p>

              <h3 className="mt-1 text-lg font-black text-white">
                Senha da autorização
              </h3>
            </div>

            {credentialLoading ||
            commercialLoading ? (
              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-2.5 py-1 text-[0.65rem] font-black text-cyan-200">
                A verificar
              </span>
            ) : commercialStatus
                ?.canGenerateCredential ? (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[0.65rem] font-black text-amber-200">
                Nova senha pendente
              </span>
            ) : credentialStatus
                ?.hasCredential ? (
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[0.65rem] font-black text-emerald-200">
                Senha emitida
              </span>
            ) : (
              <span className="rounded-full border border-slate-400/20 bg-slate-400/10 px-2.5 py-1 text-[0.65rem] font-black text-slate-400">
                Bloqueada
              </span>
            )}
          </div>

          {credentialError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3"
            >
              <p className="text-xs font-bold leading-5 text-rose-200">
                {credentialError}
              </p>

              {dataConnected &&
              request ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleReloadCredentialStatus()
                  }}
                  disabled={
                    credentialLoading
                  }
                  className="mt-2 text-xs font-black text-rose-100 underline decoration-rose-300/40 underline-offset-4 disabled:opacity-50"
                >
                  Tentar novamente
                </button>
              ) : null}
            </div>
          ) : null}

          {generatedCredential ? (
            <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.07] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                Nova senha gerada
              </p>

              <p className="mt-2 text-sm font-black text-white">
                Copie esta senha agora
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Esta senha corresponde ao
                pagamento e plano confirmados.
                Depois de fechar a ficha ou
                atualizar a página deixa de
                poder ser recuperada em texto
                simples.
              </p>

              <input
                type="text"
                readOnly
                value={
                  generatedCredential.password
                }
                onFocus={
                  event =>
                    event.currentTarget.select()
                }
                className="mt-4 w-full rounded-xl border border-emerald-300/25 bg-slate-950 px-4 py-3 font-mono text-base font-black tracking-wider text-emerald-200 outline-none"
                aria-label="Senha gerada"
              />

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyPassword()
                  }}
                  className="rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-200"
                >
                  {passwordCopied
                    ? 'Senha copiada ✓'
                    : 'Copiar senha'}
                </button>

                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-xl border border-cyan-300/10 bg-transparent px-4 py-2.5 text-xs font-black text-cyan-300/40"
                >
                  Envio no próximo bloco
                </button>
              </div>

              <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
                Não envie ainda esta senha a
                um utilizador real. A
                ativação paga será ligada no
                próximo bloco; até lá esta
                credencial serve apenas para
                validar o fluxo
                administrativo.
              </p>
            </div>
          ) : credentialLoading ||
            commercialLoading ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-4">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-200" />

              <p className="text-xs font-bold text-slate-400">
                A verificar a autorização e a
                credencial desta conta…
              </p>
            </div>
          ) : commercialStatus
              ?.canGenerateCredential ? (
            <div className="mt-4">
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
                <p className="text-sm font-black text-emerald-200">
                  Pagamento confirmado. Pode
                  gerar a nova senha.
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {getCommercialPlanLabel(
                    commercialStatus.plan
                  )}
                </p>

                {credentialStatus
                  ?.hasCredential ? (
                  <p className="mt-2 text-xs leading-5 text-amber-200">
                    Esta conta possui uma senha
                    anterior. A nova senha irá
                    substituí-la, conforme a
                    nova autorização paga.
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleGenerateCredential()
                }}
                disabled={
                  !canGenerateCredential
                }
                className="mt-3 w-full rounded-xl bg-cyan-300 px-4 py-3 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generatingCredential
                  ? 'A gerar nova senha…'
                  : 'Gerar nova senha'}
              </button>
            </div>
          ) : credentialStatus
              ?.hasCredential ? (
            <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4">
              <p className="text-sm font-black text-emerald-200">
                Esta conta já tem uma senha
                associada.
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Por segurança, a senha
                original não é armazenada em
                texto simples e não pode ser
                mostrada novamente.
              </p>

              <p className="mt-3 text-xs font-bold text-slate-400">
                Emitida em:{' '}
                {formatDate(
                  credentialStatus.createdAt
                )}
              </p>

              {!hasCommercialAuthorization ? (
                <p className="mt-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-[0.68rem] leading-5 text-amber-200">
                  Esta credencial é anterior ao
                  novo fluxo plano → pagamento
                  → senha. Não deve ser tratada
                  como prova de um pagamento
                  confirmado.
                </p>
              ) : null}
            </div>
          ) : request?.status ===
            'approved' ? (
            <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
              <p className="text-sm font-black text-amber-200">
                Senha bloqueada
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Primeiro registe o plano
                escolhido e confirme o
                pagamento. Só depois o backend
                permite gerar a senha.
              </p>
            </div>
          ) : request?.status ===
            'pending' ? (
            <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
              <p className="text-sm font-black text-amber-200">
                O pedido ainda está pendente.
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Aprove primeiro o pedido de
                acesso.
              </p>
            </div>
          ) : request?.status ===
            'rejected' ? (
            <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-4">
              <p className="text-sm font-black text-rose-200">
                Pedido rejeitado.
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Não é possível emitir uma
                senha para esta conta enquanto
                o pedido estiver rejeitado.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-sm font-black text-slate-400">
                Sem pedido de acesso
                disponível.
              </p>
            </div>
          )}
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
                renovação conhecido para esta
                conta.
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
            Apenas acontecimentos suportados
            pelos dados atuais
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
            {request?.status ===
            'approved'
              ? 'Pedido aprovado'
              : 'Aprovar pedido'}
          </button>

          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl border border-violet-300/10 px-4 py-2.5 text-xs font-black text-violet-300/40"
          >
            {paymentConfirmed
              ? 'Pagamento confirmado'
              : paymentPending
                ? 'Pagamento pendente'
                : 'Escolher plano'}
          </button>

          <button
            type="button"
            onClick={() => {
              void handleGenerateCredential()
            }}
            disabled={
              !canGenerateCredential
            }
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] px-4 py-2.5 text-xs font-black text-cyan-200 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:border-cyan-300/10 disabled:bg-transparent disabled:text-cyan-300/40"
          >
            {generatedCredential
              ? 'Nova senha emitida'
              : generatingCredential
                ? 'A gerar senha…'
                : commercialStatus
                    ?.canGenerateCredential
                  ? 'Gerar nova senha'
                  : credentialStatus
                      ?.hasCredential
                    ? 'Senha anterior emitida'
                    : 'Gerar senha'}
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
          A senha só fica desbloqueada depois
          de pedido aprovado + plano registado
          + pagamento confirmado. Ativação,
          criação da licença paga e renovações
          completas serão ligadas nos blocos
          seguintes.
        </p>
      </div>
    </section>
  )
}
