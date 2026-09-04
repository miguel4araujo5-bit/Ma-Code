import {
  useState
} from 'react'

import type {
  MAProfessorAdminAccessRequestSummary
} from '../../../lib/admin/maProfessorAdminApi'

import type {
  MAProfessorApprovalPlan
} from '../../../lib/admin/maProfessorApprovalApi'

interface MAProfessorApprovalQueueProps {
  accessRequests:
    MAProfessorAdminAccessRequestSummary[]
  onApprove: (
    email: string,
    approvalPlan:
      MAProfessorApprovalPlan
  ) => Promise<void>
}

const planLabels:
  Record<
    MAProfessorApprovalPlan,
    string
  > = {
    free:
      'Gratuito',
    paid_30_days:
      '30 dias · 3,49 €',
    school_year:
      'Ano letivo · 15 €'
  }

function confirmationMessage(
  email: string,
  plan: MAProfessorApprovalPlan
) {
  if (plan === 'free') {
    return `Aprovar acesso gratuito para ${email} e enviar o email de ativação?`
  }

  if (plan === 'paid_30_days') {
    return `Confirmar acesso Fundador de 30 dias (3,49 €) para ${email} e enviar o email de ativação?`
  }

  return `Confirmar acesso Fundador até ao fim do ano letivo (15 €) para ${email} e enviar o email de ativação?`
}

export default function MAProfessorApprovalQueue({
  accessRequests,
  onApprove
}: MAProfessorApprovalQueueProps) {
  const [busyKey, setBusyKey] =
    useState('')

  const pending =
    accessRequests.filter(
      request =>
        request.status ===
        'pending'
    )

  if (pending.length === 0) {
    return null
  }

  const approve =
    async (
      email: string,
      plan: MAProfessorApprovalPlan
    ) => {
      if (busyKey) {
        return
      }

      if (
        !window.confirm(
          confirmationMessage(
            email,
            plan
          )
        )
      ) {
        return
      }

      const key =
        `${email}:${plan}`

      setBusyKey(key)

      try {
        await onApprove(
          email,
          plan
        )
      } finally {
        setBusyKey('')
      }
    }

  return (
    <section className="mt-5 rounded-[1.75rem] border border-emerald-300/15 bg-emerald-300/[0.035] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
            Aprovação de acesso
          </p>
          <h3 className="mt-2 text-xl font-black text-white">
            Escolha o acesso antes de aprovar
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Uma única decisão cria a autorização correta, gera a senha de ativação e tenta enviar o email ao professor. Se o email falhar, a senha fica disponível para cópia manual.
          </p>
        </div>

        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-amber-200">
          {pending.length}{' '}
          {pending.length === 1
            ? 'pedido pendente'
            : 'pedidos pendentes'}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {pending.map(
          request => (
            <article
              key={request.email}
              className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">
                    {request.email}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Pedido pendente · escolha a modalidade que pretende autorizar.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[34rem]">
                  {(
                    [
                      'free',
                      'paid_30_days',
                      'school_year'
                    ] as
                      MAProfessorApprovalPlan[]
                  ).map(
                    plan => {
                      const key =
                        `${request.email}:${plan}`

                      const isBusy =
                        busyKey === key

                      const className =
                        plan === 'free'
                          ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15'
                          : plan === 'paid_30_days'
                            ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15'
                            : 'border-violet-300/25 bg-violet-300/10 text-violet-100 hover:bg-violet-300/15'

                      return (
                        <button
                          key={plan}
                          type="button"
                          disabled={Boolean(busyKey)}
                          onClick={() => {
                            void approve(
                              request.email,
                              plan
                            )
                          }}
                          className={[
                            'rounded-xl border px-3 py-3 text-xs font-black transition disabled:cursor-wait disabled:opacity-50',
                            className
                          ].join(' ')}
                        >
                          {isBusy
                            ? 'A aprovar…'
                            : planLabels[plan]}
                        </button>
                      )
                    }
                  )}
                </div>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  )
}
