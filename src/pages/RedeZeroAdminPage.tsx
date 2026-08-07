import AdminShell from '../components/admin/AdminShell'

const plannedAreas = [
  {
    title: 'Jogadores',
    description:
      'Consulta e operações administrativas relacionadas com jogadores, quando a arquitetura real do jogo estiver ligada.'
  },
  {
    title: 'Contas',
    description:
      'Área reservada para gestão de contas caso o modelo real do RedeZero a necessite.'
  },
  {
    title:
      'Estado dos servidores',
    description:
      'Visão operacional do serviço apenas depois de serem identificadas as fontes e endpoints reais.'
  },
  {
    title: 'Moderação',
    description:
      'Ferramentas de moderação apenas se e quando forem necessárias no funcionamento real do jogo.'
  },
  {
    title: 'Estatísticas',
    description:
      'Indicadores alimentados exclusivamente por dados reais do jogo, sem números fictícios.'
  },
  {
    title: 'Configuração',
    description:
      'Parâmetros administrativos do jogo que sejam efetivamente seguros e adequados para gestão através do MA-ADMIN.'
  }
]

export default function RedeZeroAdminPage() {
  return (
    <AdminShell
      activeSection="redezero"
      eyebrow="Módulo administrativo"
      title="RedeZero"
      description="Espaço reservado para integrar a administração do RedeZero no mesmo backoffice central da MA-CODE. Nenhum dado ou endpoint do jogo está ligado nesta fase."
    >
      <section className="rounded-[1.75rem] border border-violet-300/15 bg-violet-300/[0.045] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
              Segundo módulo previsto
            </p>

            <h2 className="mt-2 text-xl font-black">
              Preparado sem inventar o
              backend do jogo
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              A navegação e o espaço
              administrativo ficam
              preparados agora. As funções
              reais só serão implementadas
              depois de consultarmos a
              arquitetura atual do RedeZero,
              o servidor, os dados e os
              endpoints efetivamente
              existentes.
            </p>
          </div>

          <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-violet-200">
            Planeado
          </span>
        </div>
      </section>

      <section className="mt-9">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Estrutura futura
        </p>

        <h2 className="mt-1 text-2xl font-black">
          Áreas possíveis
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Estas áreas representam apenas a
          direção aprovada para o módulo.
          Não significam que as respetivas
          funções já existam no RedeZero.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plannedAreas.map(
            (
              area,
              index
            ) => (
              <article
                key={
                  area.title
                }
                className="rounded-[1.6rem] border border-white/10 bg-slate-900/55 p-5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-300/[0.06] text-xs font-black text-violet-200">
                  {String(
                    index + 1
                  ).padStart(
                    2,
                    '0'
                  )}
                </span>

                <h3 className="mt-4 text-lg font-black">
                  {area.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {
                    area.description
                  }
                </p>

                <div className="mt-5 rounded-xl border border-white/[0.07] bg-slate-950/40 px-3 py-2.5 text-xs font-bold text-slate-600">
                  Sem integração atual
                </div>
              </article>
            )
          )}
        </div>
      </section>

      <section className="mt-9 rounded-[1.75rem] border border-amber-300/15 bg-amber-300/[0.04] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
          Regra antes de implementar
        </p>

        <h2 className="mt-2 text-xl font-black">
          Primeiro consultamos o projeto
          RedeZero real.
        </h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            'Arquitetura',
            'Servidor / hosting',
            'Dados reais',
            'Endpoints reais'
          ].map(
            item => (
              <div
                key={item}
                className="rounded-xl border border-white/[0.07] bg-slate-950/40 px-4 py-3 text-xs font-bold text-slate-400"
              >
                {item}
              </div>
            )
          )}
        </div>
      </section>
    </AdminShell>
  )
}
