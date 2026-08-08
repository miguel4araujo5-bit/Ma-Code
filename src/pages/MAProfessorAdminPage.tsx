import {
  useCallback,
  useEffect,
  useState
} from 'react'

import AdminShell from '../components/admin/AdminShell'
import MAProfessorAdminDecisionPanel from '../components/admin/ma-professor/MAProfessorAdminDecisionPanel'
import MAProfessorAdminRenewalPanel from '../components/admin/ma-professor/MAProfessorAdminRenewalPanel'
import MAProfessorAdminWorkspace from '../components/admin/ma-professor/MAProfessorAdminWorkspace'

import {
  getMAProfessorAdminOverview,
  type MAProfessorAdminOverview
} from '../lib/admin/maProfessorAdminApi'

const workflow = [
  'Pedido',
  'Aprovação',
  'Senha',
  'Ativação',
  'Licença',
  'Renovação'
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
  ] =
    useState(true)

  const [
    error,
    setError
  ] =
    useState('')

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
        } catch (
          loadError
        ) {
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

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  return (
    <>
      <section className="rounded-[1.75rem] border border-emerald-300/15 bg-emerald-300/[0.04] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
              Fluxo aprovado
            </p>

            <h2 className="mt-2 text-xl font-black">
              Do pedido à renovação
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              O administrador acompanha a
              mesma conta desde o pedido
              inicial, passando pela
              aprovação e senha, até à
              ativação da licença e futuras
              renovações.
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
              ? 'Erro na leitura'
              : loading
                ? 'A carregar dados'
                : 'Leitura real ativa'}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {workflow.map(
            (
              item,
              index
            ) => (
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

      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Gestão diária
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Contas e licenças
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
              Não foi possível carregar os
              dados reais
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              {error}
            </p>
          </div>
        ) : null}

        {loading && !overview ? (
          <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-[1.75rem] border border-white/10 bg-slate-900/55 px-6 py-12 text-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-200" />

            <p className="mt-4 text-sm font-black text-slate-300">
              A carregar pedidos, licenças e
              renovações
            </p>

            <p className="mt-2 text-xs text-slate-600">
              Leitura segura do motor atual
              do MA-Professor.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <MAProfessorAdminWorkspace
              accessRequests={
                overview?.accessRequests ||
                []
              }
              licenses={
                overview?.licenses ||
                []
              }
              renewals={
                overview?.renewals ||
                []
              }
              dataConnected={
                Boolean(overview)
              }
            />
          </div>
        )}
      </section>

      <section className="mt-7">
        <MAProfessorAdminDecisionPanel />
      </section>

      <section className="mt-7">
        <MAProfessorAdminRenewalPanel />
      </section>

      <section className="mt-7 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">
            Beta
          </p>

          <p className="mt-3 text-2xl font-black">
            30 dias
          </p>

          <p className="mt-1 text-sm text-slate-400">
            0 € · começa na primeira
            ativação válida
          </p>
        </article>

        <article className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-300">
            Plano 30 dias
          </p>

          <p className="mt-3 text-2xl font-black">
            3,49 €
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Renovação manual · sem
            renovação automática
          </p>
        </article>

        <article className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-amber-300">
            Ano letivo
          </p>

          <p className="mt-3 text-2xl font-black">
            15 €
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Até 1 de agosto · sem
            ativações mensais
          </p>
        </article>
      </section>

      <section className="mt-7 rounded-[1.75rem] border border-cyan-300/15 bg-cyan-300/[0.035] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
          Backend MA-Professor
        </p>

        <h2 className="mt-2 text-xl font-black">
          Dados reais ligados em modo de
          leitura.
        </h2>

        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
          Os pedidos, licenças e renovações
          apresentados acima vêm do motor de
          acesso existente do MA-Professor.
          As operações de aprovação,
          rejeição, geração de senha,
          pagamento, renovação e revogação
          continuam bloqueadas nesta fase.
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
      description="Gestão central do acesso, utilizadores, licenças e renovações do MA-Professor. Os dados reais já podem ser consultados em modo de leitura; as operações de escrita continuam bloqueadas até à próxima fase."
    >
      <MAProfessorAdminContent />
    </AdminShell>
  )
}
