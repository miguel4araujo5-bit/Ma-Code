import AdminShell from '../components/admin/AdminShell'
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
      description="Gestão central do acesso, utilizadores, licenças e renovações do MA-Professor. A interface está preparada, mas os dados reais e as ações permanecem desligados até ativarmos o backend administrativo."
    >
      <section className="rounded-[1.75rem] border border-emerald-300/15 bg-emerald-300/[0.04] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
              Fluxo de acesso
            </p>

            <h2 className="mt-2 text-xl font-black">
              Do pedido à renovação
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              A administração acompanha a
              conta desde o pedido inicial
              até às futuras renovações,
              mantendo cada etapa ligada ao
              mesmo email.
            </p>
          </div>

          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-amber-200">
            Dados ainda desligados
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
        <MAProfessorAdminWorkspace />
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
            Renovação manual
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
            Até 1 de agosto
          </p>
        </article>
      </section>

      <section className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Preparado para a próxima fase
        </p>

        <h2 className="mt-2 text-xl font-black">
          O frontend já fica com o formato
          que o backend vai alimentar.
        </h2>

        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
          Quando ativarmos a Cloudflare,
          ligaremos estas tabelas aos
          pedidos, licenças e renovações já
          existentes no motor atual do
          MA-Professor. Não será necessário
          redesenhar o módulo nem criar uma
          segunda base de dados.
        </p>
      </section>
    </AdminShell>
  )
}
