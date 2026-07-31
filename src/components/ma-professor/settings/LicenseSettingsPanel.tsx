import { useState } from 'react'

import { useMAProfessorAccess } from '../access/AccessGate'
import {
  getLicensePlanLabel,
  getLicenseStatusLabel,
  type RenewableLicensePlan
} from '../access/accessTypes'

function formatDate(value: string | null) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir o pedido.'
}

export function LicenseSettingsPanel() {
  const {
    session,
    refreshing,
    refresh,
    requestRenewal,
    signOut
  } = useMAProfessorAccess()
  const [busyPlan, setBusyPlan] =
    useState<RenewableLicensePlan | null>(null)
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)

  const handleRenewal = async (
    plan: RenewableLicensePlan
  ) => {
    setBusyPlan(plan)
    setFeedback(null)

    try {
      const message = await requestRenewal(plan)
      setFeedback({
        tone: 'success',
        message
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: getErrorMessage(error)
      })
    } finally {
      setBusyPlan(null)
    }
  }

  const handleRefresh = async () => {
    setFeedback(null)

    try {
      await refresh()
      setFeedback({
        tone: 'success',
        message: 'Estado da licença atualizado.'
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: getErrorMessage(error)
      })
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-300/20 bg-slate-900/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              Licença
            </p>
            <h2 className="mt-2 text-xl font-black text-white">
              {getLicensePlanLabel(session.license.plan)}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {session.email}
            </p>
          </div>

          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-black text-emerald-200">
            {getLicenseStatusLabel(session.license.status)}
          </span>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <dt className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
              Início
            </dt>
            <dd className="mt-2 text-sm font-bold text-white">
              {formatDate(session.license.validFrom)}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <dt className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
              Termina
            </dt>
            <dd className="mt-2 text-sm font-bold text-white">
              {formatDate(session.license.validUntil)}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <dt className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
              Dias restantes
            </dt>
            <dd className="mt-2 text-2xl font-black text-white">
              {session.license.daysRemaining ?? '—'}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <dt className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
              Última verificação
            </dt>
            <dd className="mt-2 text-sm font-bold text-white">
              {formatDate(session.checkedAt)}
            </dd>
          </div>
        </dl>

        {session.license.renewalRequestedAt ? (
          <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
            Renovação pedida em{' '}
            {formatDate(session.license.renewalRequestedAt)}. Aguarde até
            24 horas pela confirmação.
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
          Renovação
        </p>
        <h2 className="mt-2 text-xl font-black text-white">
          Escolha o período de acesso
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Nesta fase, o pedido fica registado e é confirmado manualmente
          pela MA-CODE. O botão não efetua cobrança automática.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            disabled={Boolean(busyPlan)}
            onClick={() => void handleRenewal('paid_30_days')}
            className="rounded-3xl border border-cyan-300/25 bg-cyan-300/10 p-5 text-left transition hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="text-xs font-black uppercase tracking-[0.15em] text-cyan-200">
              Mensal
            </span>
            <span className="mt-2 block text-3xl font-black text-white">
              3,49 €
            </span>
            <span className="mt-2 block text-sm text-slate-400">
              30 dias de acesso
            </span>
            <span className="mt-5 block text-sm font-black text-cyan-200">
              {busyPlan === 'paid_30_days'
                ? 'A registar…'
                : 'Pedir renovação'}
            </span>
          </button>

          <button
            type="button"
            disabled={Boolean(busyPlan)}
            onClick={() => void handleRenewal('school_year')}
            className="rounded-3xl border border-violet-300/25 bg-violet-300/10 p-5 text-left transition hover:bg-violet-300/15 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="text-xs font-black uppercase tracking-[0.15em] text-violet-200">
              Ano letivo
            </span>
            <span className="mt-2 block text-3xl font-black text-white">
              15 €
            </span>
            <span className="mt-2 block text-sm text-slate-400">
              Até ao final do ano letivo em curso
            </span>
            <span className="mt-5 block text-sm font-black text-violet-200">
              {busyPlan === 'school_year'
                ? 'A registar…'
                : 'Pedir renovação'}
            </span>
          </button>
        </div>
      </section>

      {feedback ? (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.tone === 'success'
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
              : 'border-rose-400/20 bg-rose-400/10 text-rose-200'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <section className="flex flex-wrap gap-3 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void handleRefresh()}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-200 hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
        >
          {refreshing ? 'A verificar…' : 'Verificar licença'}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-xl px-4 py-2.5 text-sm font-black text-slate-500 hover:text-rose-200"
        >
          Terminar sessão neste dispositivo
        </button>
      </section>
    </div>
  )
}
