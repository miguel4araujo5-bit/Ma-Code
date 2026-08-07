import AdminShell from '../components/admin/AdminShell'

interface ModuleCard {
  name: string
  code: string
  description: string
  href?: string
  status: string
  statusClassName: string
  borderClassName: string
  accentClassName: string
}

const modules:
  ModuleCard[] = [
    {
      name: 'MA-Professor',
      code: 'MP',
      description:
        'Pedidos de acesso, utilizadores, senhas, licenças, renovações, pagamentos e histórico.',
      href:
        '/admin/ma-professor',
      status:
        'Estrutura pronta',
      statusClassName:
        'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
      borderClassName:
        'border-emerald-300/15 hover:border-emerald-300/30',
      accentClassName:
        'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
    },
    {
      name: 'RedeZero',
      code: 'RZ',
      description:
        'Área reservada para a futura administração do jogo RedeZero dentro do mesmo backoffice MA-CODE.',
      href:
        '/admin/redezero',
      status:
        'Planeado',
      statusClassName:
        'border-violet-300/20 bg-violet-300/10 text-violet-200',
      borderClassName:
        'border-violet-300/15 hover:border-violet-300/30',
      accentClassName:
        'border-violet-300/20 bg-violet-300/10 text-violet-200'
    },
    {
      name:
        'Futuros produtos',
      code: '+',
      description:
        'Novos módulos serão acrescentados apenas quando existir uma necessidade administrativa real.',
      status:
        'Sob necessidade',
      statusClassName:
        'border-white/10 bg-white/[0.04] text-slate-400',
      borderClassName:
        'border-white/10',
      accentClassName:
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
              Ecossistema
            </h2>
          </div>

          <p className="max-w-xl text-right text-xs leading-5 text-slate-600">
            Nesta fase o painel contém
            apenas estrutura visual. Não
            existem dados, contas ou ações
            administrativas ligadas.
          </p>
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
                  className={[
                    'rounded-[1.75rem] border bg-slate-900/65 p-5 transition hover:-translate-y-0.5 hover:bg-slate-900',
                    module.borderClassName
                  ].join(' ')}
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
                  className={[
                    'rounded-[1.75rem] border bg-slate-900/40 p-5',
                    module.borderClassName
                  ].join(' ')}
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
          Estado da fundação
        </p>

        <h2 className="mt-1 text-2xl font-black">
          O que estamos a construir
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">
              01 · Agora
            </p>

            <h3 className="mt-2 font-black">
              Estrutura modular
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Dashboard central e uma
              área independente para cada
              produto.
            </p>
          </article>

          <article className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">
              02 · Depois
            </p>

            <h3 className="mt-2 font-black">
              Backend seguro
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Autenticação, sessão e APIs
              administrativas protegidas
              na Cloudflare.
            </p>
          </article>

          <article className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.045] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">
              03 · Evolução
            </p>

            <h3 className="mt-2 font-black">
              Mais produtos
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              RedeZero e outros produtos
              reutilizam a mesma fundação
              administrativa.
            </p>
          </article>
        </div>
      </section>

      <section className="mt-10 rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Regra desta fase
        </p>

        <h2 className="mt-2 text-xl font-black">
          Nada sensível fica aqui antes do
          backend.
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Podemos construir e aperfeiçoar
          toda a experiência administrativa
          agora. Quando começarmos a mostrar
          pedidos reais, contas, licenças,
          jogadores ou executar ações,
          ligamos primeiro a autenticação e
          a proteção no Worker.
        </p>
      </section>
    </AdminShell>
  )
}
