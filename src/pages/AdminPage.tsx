import AdminShell from '../components/admin/AdminShell'

interface ModuleCard {
  name: string
  code: string
  description: string
  href?: string
  status: string
  accentClassName: string
  statusClassName: string
}

const modules:
  ModuleCard[] = [
    {
      name: 'MA-Professor',
      code: 'MP',
      description:
        'Pedidos, utilizadores, senhas, licenças, pagamentos, renovações e histórico.',
      href:
        '/admin/ma-professor',
      status:
        'Leitura real ativa',
      accentClassName:
        'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
      statusClassName:
        'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
    },
    {
      name: 'RedeZero',
      code: 'RZ',
      description:
        'Espaço administrativo reservado para o jogo RedeZero, integrado no mesmo backoffice MA-CODE.',
      href:
        '/admin/redezero',
      status:
        'Planeado',
      accentClassName:
        'border-violet-300/20 bg-violet-300/10 text-violet-200',
      statusClassName:
        'border-violet-300/20 bg-violet-300/10 text-violet-200'
    },
    {
      name:
        'Outros produtos',
      code: '+',
      description:
        'Novos módulos serão acrescentados apenas quando existir uma necessidade administrativa real.',
      status:
        'Sob necessidade',
      accentClassName:
        'border-white/10 bg-white/[0.04] text-slate-500',
      statusClassName:
        'border-white/10 bg-white/[0.04] text-slate-500'
    }
  ]

function ModuleContent({
  module
}: {
  module: ModuleCard
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <span
          className={[
            'flex h-11 w-11 items-center justify-center rounded-2xl border text-xs font-black',
            module.accentClassName
          ].join(' ')}
        >
          {module.code}
        </span>

        <span
          className={[
            'rounded-full border px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em]',
            module.statusClassName
          ].join(' ')}
        >
          {module.status}
        </span>
      </div>

      <h2 className="mt-5 text-xl font-black text-white">
        {module.name}
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        {module.description}
      </p>

      {module.href ? (
        <div className="mt-6 flex items-center justify-between border-t border-white/[0.07] pt-4">
          <span className="text-xs font-bold text-slate-500">
            Abrir módulo
          </span>

          <span className="text-lg text-slate-500">
            →
          </span>
        </div>
      ) : (
        <div className="mt-6 border-t border-white/[0.07] pt-4 text-xs font-bold text-slate-600">
          Sem módulo criado
        </div>
      )}
    </>
  )
}

export default function AdminPage() {
  return (
    <AdminShell
      activeSection="dashboard"
      eyebrow="Painel interno"
      title="Administração MA-CODE"
      description="Backoffice central para gerir progressivamente os produtos, serviços e jogos MA-CODE que necessitem de operações privadas."
    >
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Módulos
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Ecossistema MA-CODE
            </h2>
          </div>

          <div className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-1.5 text-xs font-bold text-emerald-200">
            Autenticação MA-ADMIN ativa
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map(
            module =>
              module.href ? (
                <a
                  key={
                    module.name
                  }
                  href={
                    module.href
                  }
                  className="rounded-[1.75rem] border border-white/10 bg-slate-900/55 p-5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-900"
                >
                  <ModuleContent
                    module={
                      module
                    }
                  />
                </a>
              ) : (
                <article
                  key={
                    module.name
                  }
                  className="rounded-[1.75rem] border border-white/10 bg-slate-900/35 p-5"
                >
                  <ModuleContent
                    module={
                      module
                    }
                  />
                </article>
              )
          )}
        </div>
      </section>

      <section className="mt-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Estado
        </p>

        <h2 className="mt-1 text-2xl font-black">
          Fundação do MA-ADMIN
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
              Ativo
            </p>

            <h3 className="mt-2 font-black">
              Sessão protegida
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Login central, cookie seguro e
              sessão administrativa já estão
              ativos no Worker.
            </p>
          </article>

          <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">
              Agora
            </p>

            <h3 className="mt-2 font-black">
              MA-Professor em leitura
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Pedidos, licenças e renovações
              reais ficam disponíveis para
              consulta no módulo protegido.
            </p>
          </article>

          <article className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">
              A seguir
            </p>

            <h3 className="mt-2 font-black">
              Operações administrativas
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Aprovação, senha, pagamento,
              renovação e revogação serão
              ligados depois de validarmos a
              leitura dos dados reais.
            </p>
          </article>
        </div>
      </section>

      <section className="mt-10 rounded-[1.75rem] border border-emerald-300/15 bg-emerald-300/[0.035] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
          Segurança desta fase
        </p>

        <h2 className="mt-2 text-xl font-black">
          A autenticação administrativa já
          está protegida no servidor.
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Os dados reais do MA-Professor só
          são consultados depois de uma
          sessão MA-ADMIN válida. Nesta fase
          a integração é apenas de leitura:
          nenhuma ação de aprovação,
          rejeição, geração de senha,
          pagamento, renovação ou revogação
          é executada pelo painel.
        </p>
      </section>
    </AdminShell>
  )
}
