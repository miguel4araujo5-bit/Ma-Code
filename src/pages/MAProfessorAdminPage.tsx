import {
  useCallback,
  useEffect,
  useState
} from 'react'

import AdminShell from '../components/admin/AdminShell'
import MAProfessorAccountMaintenance from '../components/admin/ma-professor/MAProfessorAccountMaintenance'
import MAProfessorAdminWorkspace from '../components/admin/ma-professor/MAProfessorAdminWorkspace'
import MAProfessorApprovalQueue from '../components/admin/ma-professor/MAProfessorApprovalQueue'

import {
  getMAProfessorAdminOverview,
  rejectMAProfessorAccessRequest,
  type MAProfessorAccessDecisionResult,
  type MAProfessorAdminOverview
} from '../lib/admin/maProfessorAdminApi'

import {
  approveMAProfessorAccessPlan,
  type MAProfessorApprovalPlan
} from '../lib/admin/maProfessorApprovalApi'

const workflow = [
  'Pedido',
  'Plano',
  'Decisão',
  'Senha',
  'Email',
  'Acesso'
]

function formatUpdatedAt(
  value: string
) {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'agora'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date)
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

  return 'Não foi possível carregar os dados administrativos do MA-Professor.'
}
function getDecisionFeedbackStyle(
  result: MAProfessorAccessDecisionResult
) {
  if (
    result.emailDelivery ===
    'sent'
  ) {
    return {
      title:
        result.request?.status ===
        'rejected'
          ? 'Pedido rejeitado e professor informado'
          : 'Acesso aprovado e email enviado',
      className:
        'border-emerald-300/20 bg-emerald-300/[0.06]',
      titleClassName:
        'text-emerald-200'
    }
  }
  if (
    result.emailDelivery ===
    'not_configured'
  ) {
    return {
      title:
        result.fallbackCredential
          ? 'Acesso aprovado · copie a senha agora'
          : 'Decisão guardada · envio automático ainda não configurado',
      className:
        'border-amber-300/20 bg-amber-300/[0.06]',
      titleClassName:
        'text-amber-200'
    }
  }
  if (
    result.emailDelivery ===
    'pending'
  ) {
    return {
      title:
        'Decisão guardada · resultado do envio por confirmar',
      className:
        'border-cyan-300/20 bg-cyan-300/[0.06]',
      titleClassName:
        'text-cyan-200'
    }
  }
  if (
    result.emailDelivery ===
    'not_applicable'
  ) {
    return {
      title:
        'Fluxo comercial preservado',
      className:
        'border-violet-300/20 bg-violet-300/[0.06]',
      titleClassName:
        'text-violet-200'
    }
  }
  return {
    title:
      result.fallbackCredential
        ? 'Decisão guardada · envio de email falhou'
        : 'Decisão guardada · ação automática incompleta',
    className:
      'border-rose-300/20 bg-rose-300/[0.06]',
    titleClassName:
      'text-rose-200'
  }
}

function MAProfessorAdminContent() {
  const [
    overview,
    setOverview
  ] =
    useState<MAProfessorAdminOverview | null>(
      null
    )

  const [
    loading,
    setLoading
  ] = useState(true)
  const [
    error,
    setError
  ] = useState('')

  const [
    decisionFeedback,
    setDecisionFeedback
  ] =
    useState<MAProfessorAccessDecisionResult | null>(
      null
    )

  const [
    passwordCopied,
    setPasswordCopied
  ] = useState(false)

  const loadOverview =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const nextOverview =
            await getMAProfessorAdminOverview()
          setOverview(
            nextOverview
          )
        } catch (loadError) {
          setError(
            getErrorMessage(
              loadError
            )
          )
        } finally {
          setLoading(false)
        }
      },
      []
    )

  const applyApproval =
    useCallback(
      async (
        email: string,
        approvalPlan:
          MAProfessorApprovalPlan
      ) => {
        setDecisionFeedback(null)
        setPasswordCopied(false)

        const result =
          await approveMAProfessorAccessPlan(
            email,
            approvalPlan
          )

        setDecisionFeedback(
          result
        )

        await loadOverview()
      },
      [loadOverview]
    )

  const handleApproveRequest =
    useCallback(
      async (
        email: string
      ) => {
        await applyApproval(
          email,
          'free'
        )
      },
      [applyApproval]
    )

  const handleRejectRequest =
    useCallback(
      async (
        email: string
      ) => {
        setDecisionFeedback(null)
        setPasswordCopied(false)

        const result =
          await rejectMAProfessorAccessRequest(
            email
          )
        setDecisionFeedback(
          result
        )

        await loadOverview()
      },
      [loadOverview]
    )

  const handleCopyFallbackPassword =
    useCallback(
      async () => {
        const password =
          decisionFeedback
            ?.fallbackCredential
            ?.password

        if (!password) {
          return
        }

        try {
          await navigator.clipboard.writeText(
            password
          )
          setPasswordCopied(true)
        } catch {
          setPasswordCopied(false)
        }
      },
      [decisionFeedback]
    )

  useEffect(
    () => {
      void loadOverview()
    },
    [loadOverview]
  )

  const feedbackStyle =
    decisionFeedback
      ? getDecisionFeedbackStyle(
          decisionFeedback
        )
      : null
  return (
    <>
      <section className="rounded-[1.75rem] border border-cyan-300/15 bg-cyan-300/[0.04] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
              Aprovação de acessos
            </p>

            <h2 className="mt-2 text-xl font-black">
              Do pedido ao acesso
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Cada pedido é aprovado numa modalidade explícita: gratuito, Fundador por 30 dias ou Fundador até ao fim do ano letivo. A decisão gera a senha antes de tentar enviar o email de ativação.
            </p>
          </div>
          <span
            className={[
              'rounded-full border px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em]',
              error
                ? 'border-rose-300/20 bg-rose-300/10 text-rose-200'
                : loading
                  ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200'
                  : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
            ].join(' ')}
          >
            {error
              ? 'Erro na ligação'
              : loading
                ? 'A carregar dados'
                : 'Dados reais ativos'}
          </span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {workflow.map(
            (item, index) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"
              >
                <span className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-600">
                  {String(
                    index + 1
                  ).padStart(
                    2,
                    '0'
                  )}
                </span>
                <p className="mt-2 text-sm font-black text-slate-200">
                  {item}
                </p>
              </div>
            )
          )}
        </div>
      </section>
      {decisionFeedback &&
      feedbackStyle ? (
        <section
          className={[
            'mt-5 rounded-2xl border p-4 sm:p-5',
            feedbackStyle.className
          ].join(' ')}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                className={[
                  'text-sm font-black',
                  feedbackStyle.titleClassName
                ].join(' ')}
              >
                {feedbackStyle.title}
              </p>
              <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-400">
                {decisionFeedback.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDecisionFeedback(
                  null
                )
                setPasswordCopied(
                  false
                )
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[0.68rem] font-black text-slate-500 transition hover:bg-white/5 hover:text-white"
            >
              Fechar
            </button>
          </div>
          {decisionFeedback
            .fallbackCredential ? (
            <div className="mt-4 rounded-xl border border-amber-300/20 bg-slate-950/50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-200">
                Senha de ativação — copiar agora
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                A senha foi criada, mas o email não chegou a ser enviado. Por segurança, esta é a oportunidade de a copiar e enviar manualmente ao professor.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={
                    decisionFeedback
                      .fallbackCredential
                      .password
                  }
                  aria-label="Senha de fallback do acesso"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-sm font-black text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyFallbackPassword()
                  }}
                  className="rounded-xl bg-amber-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-200"
                >
                  {passwordCopied
                    ? 'Copiada ✓'
                    : 'Copiar senha'}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Gestão diária
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Pedidos e acessos
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {overview ? (
              <span className="text-xs font-semibold text-slate-500">
                Atualizado em{' '}
                {formatUpdatedAt(
                  overview.generatedAt
                )}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void loadOverview()
              }}
              disabled={loading}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? 'A atualizar…'
                : 'Atualizar dados'}
            </button>
          </div>
        </div>
        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 sm:p-5"
          >
            <p className="text-sm font-black text-rose-200">
              Não foi possível carregar os dados reais
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              {error}
            </p>
          </div>
        ) : null}

        {overview ? (
          <MAProfessorApprovalQueue
            accessRequests={
              overview.accessRequests
            }
            onApprove={applyApproval}
          />
        ) : null}

        {loading && !overview ? (
          <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-[1.75rem] border border-white/10 bg-slate-900/55 px-6 py-12 text-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-200" />

            <p className="mt-4 text-sm font-black text-slate-300">
              A carregar pedidos, licenças e renovações
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Ligação segura ao motor atual do MA-Professor.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <MAProfessorAdminWorkspace
              accessRequests={
                overview?.accessRequests || []
              }
              licenses={
                overview?.licenses || []
              }
              renewals={
                overview?.renewals || []
              }
              dataConnected={
                Boolean(overview)
              }
              onApproveRequest={
                handleApproveRequest
              }
              onRejectRequest={
                handleRejectRequest
              }
            />
          </div>
        )}
      </section>

      <MAProfessorAccountMaintenance
        overview={overview}
        loading={loading}
        onChanged={loadOverview}
      />

      <section className="mt-7 rounded-[1.75rem] border border-emerald-300/15 bg-emerald-300/[0.035] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
          Regra de segurança
        </p>

        <h2 className="mt-2 text-xl font-black">
          A senha é criada antes do envio do email.
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
          Em qualquer das três modalidades, uma falha de email não deve deixar a conta num estado impossível. Quando o envio não está disponível, a senha gerada é devolvida ao MA-ADMIN para cópia manual. O período de acesso só começa quando o professor utiliza uma ativação válida.
        </p>
      </section>
    </>
  )
}
export default function MAProfessorAdminPage() {
  return (
    <AdminShell
      activeSection="ma-professor"
      eyebrow="Módulo administrativo"
      title="MA-Professor"
      description="Gestão central de pedidos, modalidade de acesso, credenciais, ativações, licenças, renovações e histórico através do backend protegido da MA-CODE."
    >
      <MAProfessorAdminContent />
    </AdminShell>
  )
}