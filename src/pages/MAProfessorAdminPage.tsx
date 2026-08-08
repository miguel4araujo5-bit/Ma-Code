import AdminShell from '../components/admin/AdminShell'
import MAProfessorAdminDecisionPanel from '../components/admin/ma-professor/MAProfessorAdminDecisionPanel'
import MAProfessorAdminRenewalPanel from '../components/admin/ma-professor/MAProfessorAdminRenewalPanel'
import MAProfessorAdminWorkspace from '../components/admin/ma-professor/MAProfessorAdminWorkspace'

const workflow = [
  'Pedido',
  'Aprovação',
  'Senha',
  'Ativação',
  'Licença',
  'Renovação'
]

export default function MAProfessorAdminPage() {
  return (
    <AdminShell
      activeSection="ma-professor"
      eyebrow="Módulo administrativo"
      title="MA-Professor"
      description="Gestão central do acesso, utilizadores, licenças e renovações do MA-Professor. A interface está a ser preparada antes de ligarmos dados e operações reais ao backend."
    >
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

          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-amber-200">
            Backend por ligar
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

          <span className="text-xs font-semibold text-slate-600">
            Sem dados de produção
          </span>
        </div>

        <div className="mt-5">
          <MAProfessorAdminWorkspace />
        </div>
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

      <section className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Próxima ligação
        </p>

        <h2 className="mt-2 text-xl font-black">
          O frontend fica preparado antes de
          receber dados reais.
        </h2>

        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
          Quando ativarmos o backend do
          MA-ADMIN, as tabelas serão
          alimentadas pelos pedidos,
          credenciais, licenças e renovações
          que já pertencem ao motor do
          MA-Professor. Os painéis de
          aprovação e renovação passarão
          então a executar as ações reais
          através de endpoints
          administrativos protegidos.
        </p>
      </section>
    </AdminShell>
  )
}
