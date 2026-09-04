import {
  useEffect,
  useState
} from 'react'

import {
  getLicenseStatusLabel
} from '../../ma-professor/access/accessTypes'

import type {
  LicenseSummary
} from '../../ma-professor/types'

import {
  getMAProfessorCommercialStatus,
  getMAProfessorCredentialStatus,
  type MAProfessorAdminAccessRequestSummary,
  type MAProfessorAdminCommercialStatus,
  type MAProfessorAdminCredentialStatus,
  type MAProfessorDecisionEmailDelivery
} from '../../../lib/admin/maProfessorAdminApi'

interface MAProfessorAdminAccountFlowSummaryProps {
  email: string
  request:
    MAProfessorAdminAccessRequestSummary |
    null
  license:
    LicenseSummary |
    null
  dataConnected?: boolean
}

type FlowTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

interface FlowStep {
  label: string
  value: string
  tone: FlowTone
}

function getToneClassName(
  tone: FlowTone
) {
  switch (tone) {
    case 'success':
      return 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200'
    case 'warning':
      return 'border-amber-300/20 bg-amber-300/[0.07] text-amber-200'
    case 'danger':
      return 'border-rose-300/20 bg-rose-300/[0.07] text-rose-200'
    case 'info':
      return 'border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-200'
    default:
      return 'border-white/10 bg-white/[0.025] text-slate-400'
  }
}

function getCommercialPlanLabel(
  plan:
    MAProfessorAdminCommercialStatus['plan']
) {
  switch (plan) {
    case 'paid_30_days':
      return 'Fundador · 30 dias'
    case 'school_year':
      return 'Fundador · ano letivo'
    default:
      return 'Por determinar'
  }
}

function getEmailStep(
  status:
    MAProfessorDecisionEmailDelivery |
    null
): Pick<FlowStep, 'value' | 'tone'> {
  switch (status) {
    case 'sent':
      return {
        value: 'Enviado',
        tone: 'success'
      }
    case 'failed':
      return {
        value: 'Falhou',
        tone: 'danger'
      }
    case 'not_configured':
      return {
        value: 'Envio manual',
        tone: 'warning'
      }
    case 'pending':
      return {
        value: 'A confirmar',
        tone: 'info'
      }
    case 'not_applicable':
      return {
        value: 'Sem registo persistente',
        tone: 'neutral'
      }
    default:
      return {
        value: '—',
        tone: 'neutral'
      }
  }
}

export default function MAProfessorAdminAccountFlowSummary({
  email,
  request,
  license,
  dataConnected = false
}: MAProfessorAdminAccountFlowSummaryProps) {
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

  const [loading, setLoading] =
    useState(false)

  useEffect(
    () => {
      let cancelled = false

      setCommercialStatus(null)
      setCredentialStatus(null)

      if (
        !dataConnected ||
        !request
      ) {
        setLoading(false)
        return () => {
          cancelled = true
        }
      }

      setLoading(true)

      void Promise.allSettled([
        getMAProfessorCommercialStatus(
          email
        ),
        getMAProfessorCredentialStatus(
          email
        )
      ])
        .then(results => {
          if (cancelled) {
            return
          }

          const [
            commercialResult,
            credentialResult
          ] = results

          if (
            commercialResult.status ===
            'fulfilled'
          ) {
            setCommercialStatus(
              commercialResult.value
            )
          }

          if (
            credentialResult.status ===
            'fulfilled'
          ) {
            setCredentialStatus(
              credentialResult.value
            )
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
    },
    [
      dataConnected,
      email,
      request
    ]
  )

  const requestStep:
    FlowStep =
    !request
      ? {
          label: 'Pedido',
          value: 'Sem pedido',
          tone: 'neutral'
        }
      : request.status ===
          'approved'
        ? {
            label: 'Pedido',
            value: 'Aprovado',
            tone: 'success'
          }
        : request.status ===
            'rejected'
          ? {
              label: 'Pedido',
              value: 'Rejeitado',
              tone: 'danger'
            }
          : {
              label: 'Pedido',
              value: 'Pendente',
              tone: 'warning'
            }

  const modalityStep:
    FlowStep =
    request?.decisionMode === 'pilot'
      ? {
          label: 'Modalidade',
          value: 'Gratuito',
          tone: 'success'
        }
      : request?.decisionMode ===
          'commercial'
        ? loading
          ? {
              label: 'Modalidade',
              value: 'A verificar',
              tone: 'info'
            }
          : commercialStatus?.plan
            ? {
                label: 'Modalidade',
                value:
                  getCommercialPlanLabel(
                    commercialStatus.plan
                  ),
                tone: 'success'
              }
            : {
                label: 'Modalidade',
                value: 'Por determinar',
                tone: 'warning'
              }
        : {
            label: 'Modalidade',
            value:
              request?.status ===
              'pending'
                ? 'Por decidir'
                : '—',
            tone:
              request?.status ===
              'pending'
                ? 'warning'
                : 'neutral'
          }

  const credentialIssued =
    Boolean(
      credentialStatus?.hasCredential ||
      commercialStatus
        ?.credentialIssuedAt
    )

  const credentialStep:
    FlowStep =
    loading
      ? {
          label: 'Senha',
          value: 'A verificar',
          tone: 'info'
        }
      : credentialIssued
        ? {
            label: 'Senha',
            value: 'Emitida',
            tone: 'success'
          }
        : request?.status ===
            'approved'
          ? {
              label: 'Senha',
              value: 'Em falta',
              tone: 'warning'
            }
          : {
              label: 'Senha',
              value: '—',
              tone: 'neutral'
            }

  const emailResult =
    getEmailStep(
      request?.emailDispatchStatus ??
      null
    )

  const emailStep: FlowStep = {
    label: 'Email',
    ...emailResult
  }

  const activated =
    Boolean(
      request?.activatedAt ||
      license?.validFrom
    )

  const activationStep:
    FlowStep =
    activated
      ? {
          label: 'Ativação',
          value: 'Concluída',
          tone: 'success'
        }
      : request?.status ===
          'approved'
        ? {
            label: 'Ativação',
            value: 'Pendente',
            tone: 'warning'
          }
        : {
            label: 'Ativação',
            value: '—',
            tone: 'neutral'
          }

  const licenseStep:
    FlowStep =
    license
      ? {
          label: 'Licença',
          value:
            getLicenseStatusLabel(
              license.status
            ),
          tone:
            license.status ===
              'active' ||
            license.status ===
              'expiring' ||
            license.status ===
              'renewal_pending'
              ? 'success'
              : license.status ===
                  'revoked'
                ? 'danger'
                : 'neutral'
        }
      : {
          label: 'Licença',
          value: 'Sem licença',
          tone:
            request?.status ===
            'approved'
              ? 'warning'
              : 'neutral'
        }

  const steps: FlowStep[] = [
    requestStep,
    modalityStep,
    credentialStep,
    emailStep,
    activationStep,
    licenseStep
  ]

  return (
    <section className="rounded-[1.35rem] border border-cyan-300/15 bg-cyan-300/[0.035] p-3 sm:p-4">
      <div>
        <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan-300">
          Estado do percurso
        </p>
        <h3 className="mt-0.5 text-sm font-black text-white">
          Do pedido ao acesso
        </h3>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        {steps.map(
          (step, index) => (
            <div
              key={step.label}
              className={[
                'min-w-0 rounded-lg border px-2.5 py-2',
                getToneClassName(
                  step.tone
                )
              ].join(' ')}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="flex-none text-[0.55rem] font-black opacity-55">
                  {String(
                    index + 1
                  ).padStart(2, '0')}
                </span>
                <p className="min-w-0 truncate text-[0.58rem] font-black uppercase tracking-[0.08em] opacity-75">
                  {step.label}
                </p>
              </div>
              <p className="mt-1.5 break-words text-[0.7rem] font-black leading-4">
                {step.value}
              </p>
            </div>
          )
        )}
      </div>

      {request?.decisionMode ===
        'commercial' &&
      request.emailDispatchStatus ===
        'not_applicable' ? (
        <p className="mt-2.5 text-[0.68rem] leading-5 text-slate-600">
          Nos acessos Fundador históricos, o resultado do envio de email não ficou persistido no pedido. O resumo não presume que o email foi entregue.
        </p>
      ) : null}
    </section>
  )
}
