import {
  useEffect,
  useRef,
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
  confirmMAProfessorPayment,
  dispenseMAProfessorPayment,
  generateMAProfessorAccessPassword,
  getMAProfessorCommercialStatus,
  getMAProfessorCredentialStatus,
  revokeMAProfessorLicense,
  type MAProfessorAdminAccessRequestSummary,
  type MAProfessorAdminCommercialStatus,
  type MAProfessorAdminCredentialStatus,
  type MAProfessorDecisionEmailDelivery,
  type MAProfessorGeneratedCredential
} from '../../../lib/admin/maProfessorAdminApi'

import MAProfessorAdminHistory from './MAProfessorAdminHistory'

interface MAProfessorAdminAccountDetailProps {
  email: string
  request:
    MAProfessorAdminAccessRequestSummary |
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

    case 'expired':
      return 'border-slate-400/20 bg-slate-400/10 text-slate-300'

    default:
      return 'border-white/10 bg-white/[0.04] text-slate-400'
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

function getCommercialPlanLabel(
  plan:
    MAProfessorAdminCommercialStatus['plan']
) {
  switch (plan) {
    case 'paid_30_days':
      return 'Mensal · 30 dias'

    case 'school_year':
      return 'Ano letivo · até 1 de agosto'

    default:
      return 'Sem plano registado'
  }
}

function getEmailDispatchStatusLabel(
  status:
    MAProfessorDecisionEmailDelivery |
    null
) {
  switch (status) {
    case 'sent':
      return 'Email enviado'

    case 'not_configured':
      return 'Envio não configurado'

    case 'pending':
      return 'Resultado por confirmar'

    case 'failed':
      return 'Envio falhou'

    case 'not_applicable':
      return 'Não aplicável'

    default:
      return 'Sem estado registado'
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

  return 'Não foi possível concluir a operação.'
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
    commercialStatus,
    setCommercialStatus
  ] =
    useState<MAProfessorAdminCommercialStatus | null>(
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
    commercialLoading,
    setCommercialLoading
  ] = useState(false)

  const [
    credentialLoading,
    setCredentialLoading
  ] = useState(false)

  const [
    commercialSaving,
    setCommercialSaving
  ] = useState(false)

  const [
    generatingCredential,
    setGeneratingCredential
  ] = useState(false)

  const [
    commercialError,
    setCommercialError
  ] = useState('')

  const [
    credentialError,
    setCredentialError
  ] = useState('')

  const [
    passwordCopied,
    setPasswordCopied
  ] = useState(false)

  const [
    revokedLicense,
    setRevokedLicense
  ] = useState<LicenseSummary | null>(
    null
  )

  const [
    revokingLicense,
    setRevokingLicense
  ] = useState(false)

  const [
    licenseActionError,
    setLicenseActionError
  ] = useState('')

  const currentLicense =
    revokedLicense ||
    license

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

  const paymentPending =
    commercialStatus
      ?.paymentStatus ===
    'pending'

  const paymentConfirmed =
    commercialStatus
      ?.paymentStatus ===
    'confirmed'

  const paymentDispensed =
    commercialStatus
      ?.paymentStatus ===
    'dispensed'

  const hasAuthorization =
    Boolean(
      commercialStatus
        ?.authorizationId
    )

  const isNonCommercialLicense =
    currentLicense?.plan ===
      'beta_30_days' ||
    currentLicense?.plan ===
      'courtesy_30_days' ||
    currentLicense?.plan ===
      'courtesy_school_year'

  const persistedDecisionMode =
    request?.decisionMode ??
    null

  const isPilotRequest =
    Boolean(
      request &&
      (
        persistedDecisionMode ===
          'pilot' ||
        (
          persistedDecisionMode !==
            'commercial' &&
          commercialStatus &&
          !hasAuthorization &&
          (
            !currentLicense ||
            isNonCommercialLicense
          )
        )
      )
    )

  const pilotEmailDispatchStatus =
    isPilotRequest
      ? request?.emailDispatchStatus ??
        null
      : null

  const authorizationCredentialIssued =
    Boolean(
      commercialStatus
        ?.credentialIssuedAt
    )

  const currentCredentialIssued =
    isPilotRequest
      ? Boolean(
          credentialStatus
            ?.hasCredential
        )
      : authorizationCredentialIssued

  const visibleActivationCode =
    generatedCredential?.password ||
    ''

  const canResolvePayment =
    dataConnected &&
    request?.status ===
      'approved' &&
    paymentPending &&
    hasAuthorization &&
    !commercialLoading &&
    !commercialSaving &&
    !generatingCredential

  const pilotManualCredentialAllowed =
    isPilotRequest &&
    (
      pilotEmailDispatchStatus ===
        'failed' ||
      pilotEmailDispatchStatus ===
        'not_configured' ||
      (
        pilotEmailDispatchStatus ===
          null &&
        !credentialStatus
          ?.hasCredential
      )
    ) &&
    !generatedCredential

  const canGenerateCredential =
    dataConnected &&
    request?.status ===
      'approved' &&
    (
      pilotManualCredentialAllowed ||
      (
        !isPilotRequest &&
        Boolean(
          commercialStatus
            ?.canGenerateCredential
        )
      )
    ) &&
    !commercialLoading &&
    !credentialLoading &&
    !commercialSaving &&
    !generatingCredential

  const canRevokeLicense =
    dataConnected &&
    Boolean(currentLicense) &&
    currentLicense?.status !==
      'revoked' &&
    !revokingLicense

  useEffect(
    () => {
      setRevokedLicense(
        null
      )

      setLicenseActionError(
        ''
      )

      setRevokingLicense(
        false
      )
    },
    [
      email,
      license
    ]
  )

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

      setCommercialStatus(null)
      setCommercialError('')
      setGeneratedCredential(null)
      setPasswordCopied(false)

      if (
        !dataConnected ||
        !request
      ) {
        setCommercialLoading(false)

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
      request
    ]
  )

  useEffect(
    () => {
      let cancelled = false

      setCredentialStatus(null)
      setCredentialError('')

      if (
        !dataConnected ||
        !request
      ) {
        setCredentialLoading(false)

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
      request
    ]
  )

  const reloadCommercialStatus =
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

  const reloadCredentialStatus =
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

  const handleConfirmPayment =
    async () => {
      if (!canResolvePayment) {
        return
      }

      const confirmed =
        window.confirm(
          [
            `Confirmar o pagamento de ${email}?`,
            '',
            `Plano: ${getCommercialPlanLabel(
              commercialStatus?.plan ??
              null
            )}`,
            `Valor: ${
              commercialStatus?.amountCents ==
              null
                ? '—'
                : formatMoney(
                    commercialStatus.amountCents,
                    commercialStatus.currency
                  )
            }`,
            '',
            'Esta ação deve ser usada apenas depois de verificar que o pagamento foi realmente recebido.'
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
      if (!canResolvePayment) {
        return
      }

      const confirmed =
        window.confirm(
          [
            `Dispensar o pagamento de ${email}?`,
            '',
            `Plano: ${getCommercialPlanLabel(
              commercialStatus?.plan ??
              null
            )}`,
            '',
            'Use esta opção apenas quando a MA-CODE decidiu oferecer este acesso. A operação não será registada como pagamento recebido.'
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

      const confirmationLines =
        isPilotRequest
          ? [
              `Gerar uma nova senha de ativação para ${email}?`,
              '',
              'Modalidade: Fase piloto',
              'Custo: Gratuito',
              '',
              'A nova senha substitui a credencial anterior desta conta.',
              'Por segurança, a senha será mostrada apenas agora e não ficará guardada em claro no MA-ADMIN.'
            ]
          : [
              `Gerar uma nova senha de ativação para ${email}?`,
              '',
              `Plano: ${getCommercialPlanLabel(
                commercialStatus?.plan ??
                null
              )}`,
              `Pagamento: ${paymentLabel}`,
              '',
              'A nova senha substitui a credencial anterior desta conta.',
              'Por segurança, a senha será mostrada apenas agora e não ficará guardada em claro no MA-ADMIN.'
            ]

      const confirmed =
        window.confirm(
          confirmationLines.join(
            '\n'
          )
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
          hasCredential:
            true,
          activationCode:
            null,
          createdAt:
            credential.createdAt,
          updatedAt:
            credential.updatedAt
        })

        const status =
          await getMAProfessorCommercialStatus(
            email
          )

        setCommercialStatus(
          status
        )
      } catch (error) {
        setCredentialError(
          getErrorMessage(error)
        )
      } finally {
        setGeneratingCredential(false)
      }
    }

  const handleRevokeLicense =
    async () => {
      if (
        !canRevokeLicense ||
        !currentLicense
      ) {
        return
      }

      const confirmed =
        window.confirm(
          [
            `Revogar a licença de ${email}?`,
            '',
            `Plano: ${getLicensePlanLabel(
              currentLicense.plan
            )}`,
            `Válida até: ${formatDate(
              currentLicense.validUntil
            )}`,
            '',
            'Esta ação bloqueia o acesso e revoga todas as sessões ativas desta conta.',
            'A conta e os dados do professor não são eliminados.'
          ].join('\n')
        )

      if (!confirmed) {
        return
      }

      setRevokingLicense(true)
      setLicenseActionError('')

      try {
        const updatedLicense =
          await revokeMAProfessorLicense(
            email
          )

        setRevokedLicense(
          updatedLicense
        )
      } catch (error) {
        setLicenseActionError(
          getErrorMessage(error)
        )
      } finally {
        setRevokingLicense(false)
      }
    }

  const handleCopyPassword =
    async () => {
      if (!visibleActivationCode) {
        return
      }

      setCredentialError('')

      try {
        await navigator.clipboard.writeText(
          visibleActivationCode
        )

        setPasswordCopied(true)
      } catch {
        setPasswordCopied(false)

        setCredentialError(
          'Não foi possível copiar automaticamente. Selecione a senha e copie-a manualmente.'
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
            Pedido, modalidade de acesso, senha de ativação, licença, renovações e histórico desta conta.
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
              note="A licença inicia apenas depois da primeira ativação válida."
            />
          </div>
        </article>

        <article className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-300">
                {isPilotRequest
                  ? 'Fase piloto'
                  : 'Plano e pagamento'}
              </p>

              <h3 className="mt-1 text-lg font-black text-white">
                {isPilotRequest
                  ? 'Acesso gratuito'
                  : 'Autorização comercial'}
              </h3>
            </div>

            <span
              className={[
                'rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                commercialLoading
                  ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200'
                  : isPilotRequest
                    ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200'
                    : getPaymentStatusClassName(
                        commercialStatus?.paymentStatus
                      )
              ].join(' ')}
            >
              {commercialLoading
                ? 'A verificar'
                : isPilotRequest
                  ? 'Piloto gratuito'
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
                    void reloadCommercialStatus()
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
                A carregar estado do acesso…
              </p>
            </div>
          ) : isPilotRequest ? (
            <div className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailValue
                  label="Modalidade"
                  value="Fase piloto"
                  note="Acesso atribuído durante a fase piloto do MA-Professor."
                />

                <DetailValue
                  label="Custo"
                  value="Gratuito"
                />

                <DetailValue
                  label="Estado do pedido"
                  value={
                    request
                      ? getAccessRequestStatusLabel(
                          request.status
                        )
                      : '—'
                  }
                />

                <DetailValue
                  label="Decisão"
                  value={
                    request?.status ===
                    'approved'
                      ? formatDate(
                          request.approvedAt
                        )
                      : request?.status ===
                          'rejected'
                        ? formatDate(
                            request.rejectedAt
                          )
                        : 'A aguardar análise'
                  }
                />

                <DetailValue
                  label="Estado do envio"
                  value={getEmailDispatchStatusLabel(
                    pilotEmailDispatchStatus
                  )}
                  note="O estado refere-se ao envio pelo sistema, não à entrega confirmada na caixa de correio."
                />

                <DetailValue
                  label="Envio atualizado em"
                  value={formatDate(
                    request?.emailDispatchUpdatedAt ??
                    null
                  )}
                />
              </div>

              {request?.status ===
                'pending' ? (
                <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                  <p className="text-sm font-black text-amber-200">
                    Pedido piloto em análise
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Não existe pagamento para validar. Aprove ou rejeite o pedido na lista de pedidos.
                  </p>
                </div>
              ) : null}

              {request?.status ===
                'approved' ? (
                <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
                  <p className="text-sm font-black text-emerald-200">
                    Pedido piloto aprovado
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    O acesso é gratuito nesta fase. Por segurança, o texto da senha não fica guardado em claro no MA-ADMIN; consulte o estado do envio antes de qualquer nova emissão.
                  </p>
                </div>
              ) : null}

              {request?.status ===
                'rejected' ? (
                <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4">
                  <p className="text-sm font-black text-rose-200">
                    Pedido piloto não aprovado
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Não pode ser emitida uma senha enquanto o pedido estiver rejeitado.
                  </p>
                </div>
              ) : null}
            </div>
          ) : commercialStatus && hasAuthorization ? (
            <div className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailValue
                  label="Plano escolhido"
                  value={getCommercialPlanLabel(
                    commercialStatus.plan
                  )}
                  note="O plano é escolhido pelo professor antes do pedido e é apenas consultado no MA-ADMIN."
                />

                <DetailValue
                  label="Valor"
                  value={
                    commercialStatus.amountCents ==
                    null
                      ? '—'
                      : formatMoney(
                          commercialStatus.amountCents,
                          commercialStatus.currency
                        )
                  }
                />

                <DetailValue
                  label="Autorização criada em"
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

              {paymentPending &&
              request?.status ===
                'approved' ? (
                <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                  <p className="text-sm font-black text-amber-200">
                    Pagamento pendente de verificação
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Confirme apenas quando o recebimento tiver sido verificado. Se a MA-CODE ofereceu o acesso, registe-o como pagamento dispensado.
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleConfirmPayment()
                      }}
                      disabled={!canResolvePayment}
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
                      disabled={!canResolvePayment}
                      className="rounded-xl border border-violet-300/25 bg-violet-300/[0.08] px-4 py-2.5 text-xs font-black text-violet-200 transition hover:bg-violet-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {commercialSaving
                        ? 'A guardar…'
                        : 'Dispensar pagamento'}
                    </button>
                  </div>
                </div>
              ) : null}

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
                    A MA-CODE autorizou este acesso sem registar um pagamento recebido. Dispensa registada em{' '}
                    {formatDate(
                      commercialStatus.paymentDispensedAt
                    )}.
                  </p>
                </div>
              ) : null}

              {request?.status ===
                'pending' ? (
                <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
                  <p className="text-sm font-black text-amber-200">
                    Pedido ainda pendente
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    O plano e o valor já estão registados. Aprove ou rejeite o pedido na lista de pedidos antes de resolver o pagamento.
                  </p>
                </div>
              ) : null}

              {request?.status ===
                'rejected' ? (
                <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-4">
                  <p className="text-sm font-black text-rose-200">
                    Pedido rejeitado
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Esta autorização não pode avançar para emissão de senha enquanto o pedido estiver rejeitado.
                  </p>
                </div>
              ) : null}
            </div>
          ) : request ? (
            <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
              <p className="text-sm font-black text-amber-200">
                Estado do acesso indisponível
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                O pedido existe, mas não foi possível determinar a modalidade de acesso. Atualize a ficha antes de executar uma ação administrativa.
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

            {currentLicense ? (
              <span
                className={[
                  'rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                  getLicenseStatusClassName(
                    currentLicense.status
                  )
                ].join(' ')}
              >
                {getLicenseStatusLabel(
                  currentLicense.status
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
                currentLicense
                  ? getLicensePlanLabel(
                      currentLicense.plan
                    )
                  : '—'
              }
            />

            <DetailValue
              label="Estado"
              value={
                currentLicense
                  ? getLicenseStatusLabel(
                      currentLicense.status
                    )
                  : '—'
              }
            />

            <DetailValue
              label="Início"
              value={formatDate(
                currentLicense?.validFrom ??
                null
              )}
            />

            <DetailValue
              label="Válida até"
              value={formatDate(
                currentLicense?.validUntil ??
                null
              )}
            />

            <DetailValue
              label="Dias restantes"
              value={
                currentLicense?.daysRemaining ==
                null
                  ? '—'
                  : String(
                      currentLicense.daysRemaining
                    )
              }
            />

            <DetailValue
              label="Renovação pedida em"
              value={formatDate(
                currentLicense?.renewalRequestedAt ??
                null
              )}
            />

            <DetailValue
              label="Revogada em"
              value={formatDate(
                currentLicense?.revokedAt ??
                null
              )}
            />
          </div>

          {licenseActionError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3 text-xs font-bold leading-5 text-rose-200"
            >
              {licenseActionError}
            </div>
          ) : null}

          {currentLicense &&
          currentLicense.status !==
            'revoked' ? (
            <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.035] p-4">
              <p className="text-sm font-black text-rose-200">
                Ação administrativa
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Revogar bloqueia o acesso desta licença e invalida as sessões ativas. A conta e os dados do professor são preservados.
              </p>

              <button
                type="button"
                onClick={() => {
                  void handleRevokeLicense()
                }}
                disabled={!canRevokeLicense}
                className="mt-3 rounded-xl border border-rose-300/25 bg-rose-300/[0.08] px-4 py-2.5 text-xs font-black text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {revokingLicense
                  ? 'A revogar…'
                  : 'Revogar licença'}
              </button>
            </div>
          ) : currentLicense?.status ===
            'revoked' ? (
            <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4">
              <p className="text-sm font-black text-rose-200">
                Licença revogada
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                O acesso está bloqueado desde{' '}
                {formatDate(
                  currentLicense.revokedAt ??
                  null
                )}. A conta e os dados permanecem preservados.
              </p>
            </div>
          ) : null}
        </article>

        <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">
                {isPilotRequest
                  ? 'Acesso piloto'
                  : 'Credencial'}
              </p>

              <h3 className="mt-1 text-lg font-black text-white">
                Senha de ativação
              </h3>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-black text-slate-400">
              {credentialLoading
                ? 'A verificar'
                : currentCredentialIssued
                  ? 'Senha emitida'
                  : 'Sem senha'}
            </span>
          </div>

          {credentialError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3"
            >
              <p className="text-xs font-bold leading-5 text-rose-200">
                {credentialError}
              </p>

              {dataConnected && request ? (
                <button
                  type="button"
                  onClick={() => {
                    void reloadCredentialStatus()
                  }}
                  disabled={credentialLoading}
                  className="mt-2 text-xs font-black text-rose-100 underline decoration-rose-300/40 underline-offset-4 disabled:opacity-50"
                >
                  Tentar novamente
                </button>
              ) : null}
            </div>
          ) : null}

          {visibleActivationCode ? (
            <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
              <p className="text-sm font-black text-emerald-200">
                Senha gerada agora
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Copie esta senha agora. Por segurança, o texto da senha não fica guardado em claro no MA-ADMIN e deixará de estar disponível depois de fechar ou atualizar esta ficha.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={visibleActivationCode}
                  aria-label="Senha de ativação gerada agora"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-sm font-black text-white outline-none"
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

              <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
                Os emails automáticos de acesso são enviados por MA-Professor | MA-CODE &lt;acesso@professor.ma-code.pt&gt;.
              </p>
            </div>
          ) : credentialStatus?.hasCredential ? (
            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
              <p className="text-sm font-black text-amber-200">
                Credencial emitida
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Existe uma credencial válida associada a esta conta. O hash necessário para validar o acesso está guardado, mas o texto original da senha não é armazenado em claro e não pode ser recuperado.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailValue
                label="Credencial guardada na conta"
                value="Não"
                note={
                  isPilotRequest
                    ? 'No piloto, a emissão manual depende do estado persistido do envio automático.'
                    : 'A senha pode ser emitida quando a autorização comercial estiver pronta.'
                }
              />

              <DetailValue
                label="Senha de ativação"
                value="Ainda não emitida"
              />

              <DetailValue
                label="Emitida em"
                value="—"
              />

              <DetailValue
                label="Última atualização"
                value="—"
              />
            </div>
          )}

          {credentialStatus?.hasCredential ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailValue
                label="Emitida em"
                value={formatDate(
                  isPilotRequest
                    ? credentialStatus.updatedAt
                    : commercialStatus?.credentialIssuedAt ??
                        credentialStatus.updatedAt
                )}
              />

              <DetailValue
                label="Última atualização"
                value={formatDate(
                  credentialStatus.updatedAt
                )}
              />
            </div>
          ) : null}

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
                ? 'Gerar nova senha de ativação'
                : 'Gerar senha de ativação'}
          </button>

          {isPilotRequest ? (
            request?.status !==
            'approved' ? (
              <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
                No piloto, não pode ser emitida uma senha enquanto o pedido não estiver aprovado.
              </p>
            ) : generatedCredential ? (
              <p className="mt-3 text-[0.68rem] leading-5 text-emerald-300/80">
                A nova senha está visível acima apenas nesta sessão. Copie-a antes de fechar ou atualizar a ficha.
              </p>
            ) : pilotEmailDispatchStatus ===
              'sent' ? (
              <p className="mt-3 text-[0.68rem] leading-5 text-emerald-300/80">
                O envio automático está registado como enviado. Para evitar invalidar uma senha que já pode estar com o professor, a geração manual de outra senha fica bloqueada.
              </p>
            ) : pilotEmailDispatchStatus ===
              'pending' ? (
              <p className="mt-3 text-[0.68rem] leading-5 text-cyan-300/80">
                O resultado do envio automático ainda está por confirmar. Por segurança, não é possível gerar outra senha enquanto este estado permanecer incerto.
              </p>
            ) : pilotEmailDispatchStatus ===
              'failed' ? (
              <p className="mt-3 text-[0.68rem] leading-5 text-rose-300/80">
                O envio automático ficou registado como falhado. Pode gerar explicitamente uma nova senha; a nova senha substituirá qualquer credencial anterior.
              </p>
            ) : pilotEmailDispatchStatus ===
              'not_configured' ? (
              <p className="mt-3 text-[0.68rem] leading-5 text-amber-300/80">
                O envio automático não estava configurado. Pode gerar a senha manualmente; copie-a no momento da geração porque não ficará guardada em claro.
              </p>
            ) : credentialStatus?.hasCredential ? (
              <p className="mt-3 text-[0.68rem] leading-5 text-amber-300/80">
                Este é um pedido anterior sem estado de envio persistido e já existe uma credencial. Por segurança, não é gerada outra senha automaticamente.
              </p>
            ) : (
              <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
                Este é um pedido anterior sem estado de envio persistido e sem credencial conhecida. A geração manual permanece disponível.
              </p>
            )
          ) : !commercialStatus?.canGenerateCredential ? (
            <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
              No fluxo comercial, a geração fica sujeita à autorização correspondente.
            </p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Última renovação conhecida
              </p>

              <h3 className="mt-1 text-lg font-black text-white">
                Pedido de renovação
              </h3>
            </div>

            {latestRenewal ? (
              <span
                className={[
                  'rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                  getRenewalStatusClassName(
                    latestRenewal.status
                  )
                ].join(' ')}
              >
                {getRenewalStatusLabel(
                  latestRenewal.status
                )}
              </span>
            ) : null}
          </div>

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
                value={getRenewalStatusLabel(
                  latestRenewal.status
                )}
                note={
                  latestRenewal.status ===
                  'pending'
                    ? 'Quando esta for a autorização comercial mais recente, o pagamento e a nova senha são tratados nos blocos acima.'
                    : undefined
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
                Não existe nenhum pedido de renovação conhecido para esta conta.
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
            Acontecimentos suportados pelos dados do backend
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
              currentLicense
                ? [currentLicense]
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
    </section>
  )
}
