import {
  formatBtcAlertsDateTime,
  formatPercent,
  formatUsd,
  type BtcAlertsStatus
} from '../lib/maBtcAlerts'

type MABtcAlertsOverviewProps = {
  status:
    BtcAlertsStatus | null
  changeClass: string
}

const steps = [
  [
    '1',
    'Consulta horária',
    'O BTC/USD é consultado uma vez por hora, apenas entre as 07:00 e as 23:00.'
  ],
  [
    '2',
    'Movimento acumulado',
    'O preço é comparado com a referência guardada, mesmo que a variação aconteça ao longo de várias horas.'
  ],
  [
    '3',
    'Notificação aos 1%',
    'Quando a subida ou descida atingir pelo menos 1%, é enviada uma única notificação.'
  ],
  [
    '4',
    'Nova referência',
    'Depois do alerta, o preço atual passa a ser a nova referência para o próximo movimento.'
  ]
]

export default function MABtcAlertsOverview({
  status,
  changeClass
}: MABtcAlertsOverviewProps) {
  return (
    <>
      <section className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-12">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Último preço BTC/USD
            </span>

            <strong className="mt-3 block text-3xl font-semibold text-white">
              {formatUsd(
                status?.currentPrice ??
                  null
              )}
            </strong>

            <span className="mt-2 block text-sm text-slate-400">
              {formatBtcAlertsDateTime(
                status?.lastCheckedAt ||
                  null
              )}
            </span>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Preço de referência
            </span>

            <strong className="mt-3 block text-3xl font-semibold text-white">
              {formatUsd(
                status?.referencePrice ??
                  null
              )}
            </strong>

            <span className="mt-2 block text-sm text-slate-400">
              Atualiza depois de cada alerta
            </span>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Movimento acumulado
            </span>

            <strong
              className={`mt-3 block text-3xl font-semibold ${changeClass}`}
            >
              {formatPercent(
                status?.changePercent ??
                  null
              )}
            </strong>

            <span className="mt-2 block text-sm text-slate-400">
              Alerta ao atingir ±1,00%
            </span>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Horário
            </span>

            <strong className="mt-3 block text-3xl font-semibold text-white">
              07–23h
            </strong>

            <span className="mt-2 block text-sm text-slate-400">
              {status?.activeNow
                ? 'Verificações ativas agora'
                : 'Pausa noturna ativa'}
            </span>
          </article>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/65 p-6 backdrop-blur md:p-8">
            <span className="section-label">
              Como funciona
            </span>

            <h2 className="mt-5 text-2xl font-semibold text-white md:text-3xl">
              Um alerta simples, sem mensagens durante a madrugada.
            </h2>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {steps.map(
                ([
                  number,
                  title,
                  description
                ]) => (
                  <div
                    key={number}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                  >
                    <span className="flex size-8 items-center justify-center rounded-xl bg-orange-300/15 text-sm font-black text-orange-200">
                      {number}
                    </span>

                    <h3 className="mt-4 font-semibold text-white">
                      {title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {description}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-300/20 bg-gradient-to-br from-orange-300/[0.10] to-slate-950/80 p-6 shadow-2xl shadow-orange-950/20 md:p-8">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-orange-200">
              Exemplo de notificação
            </span>

            <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/85 p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#f7931a] text-2xl font-black text-white">
                  ₿
                </span>

                <div>
                  <strong className="block text-sm text-white">
                    MA-BTC ALERTAS
                  </strong>

                  <span className="text-xs text-slate-500">
                    agora
                  </span>
                </div>
              </div>

              <h3 className="mt-5 text-lg font-bold text-white">
                🚨 Bitcoin subiu 1,07%
              </h3>

              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-300">
                {
                  'Preço atual: $102,480\nPreço de referência: $101,395\n\nMA BTC ALERTAS\nWWW.MA-CODE.PT'
                }
              </p>
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-300">
              Ao tocar na notificação, abre apenas esta página da
              MA-BTC ALERTAS. Não existe qualquer ligação à área de
              preços multichain da MA-Carteira nesta fase.
            </p>

            {status?.lastError ? (
              <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.08] px-4 py-3 text-sm leading-6 text-rose-100">
                Última verificação: {status.lastError}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  )
}
