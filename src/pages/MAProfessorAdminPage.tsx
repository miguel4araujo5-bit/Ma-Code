import AdminShell from '../components/admin/AdminShell'

interface AdminArea {
  title: string
  description: string
  items: string[]
}

const adminAreas:
  AdminArea[] = [
    {
      title:
        'Pedidos de acesso',
      description:
        'Fila administrativa dos professores que pediram acesso ao MA-Professor.',
      items: [
        'Email do pedido',
        'Data do pedido',
        'Estado pendente',
        'Aprovar ou rejeitar'
      ]
    },
    {
      title:
        'Utilizadores',
      description:
        'Gestão das contas já conhecidas pelo sistema de acesso.',
      items: [
        'Email da conta',
        'Estado da aprovação',
        'Credencial associada',
        'Estado atual do acesso'
      ]
    },
    {
      title:
        'Licenças',
      description:
        'Consulta e gestão do período de acesso de cada conta.',
      items: [
        'Beta de 30 dias',
        'Plano de 30 dias',
        'Plano até 1 de agosto',
        'Validade e revogação'
      ]
    },
    {
      title:
        'Renovações',
      description:
        'Pedidos de renovação e confirmação manual de pagamento nesta fase.',
      items: [
        'Plano solicitado',
        'Data do pedido',
        'Confirmação de pagamento',
        'Novo período autorizado'
      ]
    },
    {
      title:
        'Histórico',
      description:
        'Registo dos acontecimentos administrativos relevantes de cada conta.',
      items: [
        'Pedido criado',
        'Aprovação ou rejeição',
        'Ativação e renovação',
        'Expiração ou revogação'
      ]
    }
  ]

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
      description="Estrutura preparada para gerir o ciclo completo de acesso, licenciamento e renovação do MA-Professor. Nesta fase ainda não são carregados dados reais."
    >
      <section className="rounded-[1.75rem] border border-emerald-300/15 bg-emerald-300/[0.045] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
              Fluxo aprovado
            </p>

            <h2 className="mt-2 text-xl font-black">
              Do pedido à renovação
            </h2>
          </div>

          <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-amber-200">
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

      <section className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Gestão
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Áreas do módulo
            </h2>
          </div>

          <span className="text-xs font-semibold text-slate-600">
            Sem dados de produção
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {adminAreas.map(
            (
              area,
              index
            ) => (
              <article
                key={
                  area.title
                }
                className="rounded-[1.75rem] border border-white/10 bg-slate-900/55 p-5 sm:p-6"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] text-xs font-black text-emerald-200">
                    {String(
                      index + 1
                    ).padStart(
                      2,
                      '0'
                    )}
                  </span>

                  <div>
                    <h3 className="text-lg font-black">
                      {area.title}
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {
                        area.description
                      }
                    </p>
                  </div>
                </div>

                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {area.items.map(
                    item => (
                      <li
                        key={item}
                        className="rounded-xl border border-white/[0.07] bg-slate-950/40 px-3 py-2.5 text-xs font-semibold text-slate-400"
                      >
                        <span className="mr-2 text-emerald-300/70">
                          ✓
                        </span>

                        {item}
                      </li>
                    )
                  )}
                </ul>

                <button
                  type="button"
                  disabled
                  className="mt-5 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-xs font-black text-slate-600"
                >
                  Disponível quando o
                  backend for ligado
                </button>
              </article>
            )
          )}
        </div>
      </section>

      <section className="mt-9 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">
            Beta
          </p>

          <p className="mt-3 text-2xl font-black">
            30 dias
          </p>

          <p className="mt-1 text-sm text-slate-400">
            0 € · uma vez por conta
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

      <section className="mt-9 rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Próxima ligação
        </p>

        <h2 className="mt-2 text-xl font-black">
          Este módulo vai usar o motor
          existente do MA-Professor.
        </h2>

        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
          Quando ativarmos o backend
          administrativo, esta interface
          será ligada aos pedidos,
          credenciais, licenças e
          renovações já existentes no
          sistema MA-Professor. Não será
          criada uma segunda base paralela.
        </p>
      </section>
    </AdminShell>
  )
}
