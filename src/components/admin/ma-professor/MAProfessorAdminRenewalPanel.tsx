import {
  useMemo,
  useState
} from 'react'

type RenewalPlan =
  | 'paid_30_days'
  | 'school_year'

interface RenewalPlanOption {
  id: RenewalPlan
  label: string
  price: string
  amountCents: number
  validity: string
  description: string
  accentClassName: string
}

const renewalPlans:
  RenewalPlanOption[] = [
    {
      id: 'paid_30_days',
      label: 'Plano 30 dias',
      price: '3,49 €',
      amountCents: 349,
      validity: '30 dias',
      description:
        'Renovação manual por mais 30 dias. Não existe renovação automática.',
      accentClassName:
        'border-violet-300/35 bg-violet-300/[0.08] text-violet-200'
    },
    {
      id: 'school_year',
      label: 'Ano letivo',
      price: '15 €',
      amountCents: 1500,
      validity: 'Até 1 de agosto',
      description:
        'Mantém o acesso até 1 de agosto do ano letivo aplicável, sem ativações mensais.',
      accentClassName:
        'border-amber-300/35 bg-amber-300/[0.08] text-amber-200'
    }
  ]

function pad(
  value: number
) {
  return String(
    value
  ).padStart(
    2,
    '0'
  )
}

function toInputDate(
  date: Date
) {
  return [
    date.getFullYear(),
    pad(
      date.getMonth() + 1
    ),
    pad(
      date.getDate()
    )
  ].join('-')
}

function parseInputDate(
  value: string
) {
  const [
    year,
    month,
    day
  ] =
    value
      .split('-')
      .map(Number)

  if (
    !year ||
    !month ||
    !day
  ) {
    return null
  }

  const date =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return date
}

function addDays(
  date: Date,
  days: number
) {
  const result =
    new Date(
      date.getTime()
    )

  result.setDate(
    result.getDate() +
      days
  )

  return result
}

function getSchoolYearEnd(
  startDate: Date
) {
  const startYear =
    startDate.getFullYear()

  const startMonth =
    startDate.getMonth()

  const endYear =
    startMonth >= 7
      ? startYear + 1
      : startYear

  return new Date(
    endYear,
    7,
    1,
    12,
    0,
    0,
    0
  )
}

function formatDate(
  date: Date | null
) {
  if (!date) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  ).format(date)
}

function formatMoney(
  amountCents: number
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR'
    }
  ).format(
    amountCents / 100
  )
}

export default function MAProfessorAdminRenewalPanel() {
  const [
    email,
    setEmail
  ] =
    useState('')

  const [
    selectedPlan,
    setSelectedPlan
  ] =
    useState<RenewalPlan>(
      'paid_30_days'
    )

  const [
    paymentConfirmed,
    setPaymentConfirmed
  ] =
    useState(false)

  const [
    authorizationDate,
    setAuthorizationDate
  ] =
    useState(
      () =>
        toInputDate(
          new Date()
        )
    )

  const normalizedEmail =
    email
      .trim()
      .toLowerCase()

  const selectedPlanOption =
    useMemo(
      () =>
        renewalPlans.find(
          plan =>
            plan.id ===
            selectedPlan
        ) ||
        renewalPlans[0],
      [
        selectedPlan
      ]
    )

  const parsedAuthorizationDate =
    useMemo(
      () =>
        parseInputDate(
          authorizationDate
        ),
      [
        authorizationDate
      ]
    )

  const previewValidUntil =
    useMemo(
      () => {
        if (
          !parsedAuthorizationDate
        ) {
          return null
        }

        if (
          selectedPlan ===
          'paid_30_days'
        ) {
          return addDays(
            parsedAuthorizationDate,
            30
          )
        }

        return getSchoolYearEnd(
          parsedAuthorizationDate
        )
      },
      [
        parsedAuthorizationDate,
        selectedPlan
      ]
    )

  const readyForConfirmation =
    Boolean(
      normalizedEmail &&
      parsedAuthorizationDate &&
      paymentConfirmed
    )

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/55">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
              Renovação e pagamento
            </p>

            <h2 className="mt-2 text-xl font-black sm:text-2xl">
              Confirmar um novo período
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Este painel representa o
              fluxo que será usado quando
              existir um pedido real de
              renovação. O administrador
              confirma o pagamento, revê o
              plano e visualiza a nova
              validade antes de autorizar.
            </p>
          </div>

          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-amber-200">
            Simulação local
          </span>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="p-5 sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              1 · Pedido de renovação
            </p>

            <label className="mt-3 block text-sm font-bold text-slate-300">
              Email da conta

              <input
                type="email"
                value={email}
                onChange={
                  event => {
                    setEmail(
                      event.target.value
                    )

                    setPaymentConfirmed(
                      false
                    )
                  }
                }
                placeholder="professor@escola.pt"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/40 focus:ring-4 focus:ring-violet-300/10"
              />
            </label>

            <p className="mt-2 text-xs leading-5 text-slate-600">
              Nesta fase o email não é
              guardado nem enviado para
              qualquer API.
            </p>
          </div>

          <div className="mt-7">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              2 · Plano solicitado
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {renewalPlans.map(
                plan => {
                  const active =
                    plan.id ===
                    selectedPlan

                  return (
                    <button
                      key={
                        plan.id
                      }
                      type="button"
                      onClick={() => {
                        setSelectedPlan(
                          plan.id
                        )

                        setPaymentConfirmed(
                          false
                        )
                      }}
                      className={[
                        'rounded-2xl border p-4 text-left transition',
                        active
                          ? plan.accentClassName
                          : 'border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20'
                      ].join(
                        ' '
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="block text-sm font-black">
                            {
                              plan.label
                            }
                          </span>

                          <span className="mt-1 block text-xs font-bold text-slate-500">
                            {
                              plan.validity
                            }
                          </span>
                        </div>

                        <span className="text-xl font-black text-white">
                          {
                            plan.price
                          }
                        </span>
                      </div>

                      <p className="mt-4 text-xs leading-5 text-slate-500">
                        {
                          plan.description
                        }
                      </p>
                    </button>
                  )
                }
              )}
            </div>
          </div>

          <div className="mt-7">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              3 · Pagamento
            </p>

            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-white">
                    Valor esperado
                  </p>

                  <p className="mt-1 text-2xl font-black text-violet-200">
                    {formatMoney(
                      selectedPlanOption
                        .amountCents
                    )}
                  </p>

                  <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">
                    Nesta fase o pagamento
                    é confirmado manualmente
                    pela MA-CODE. Nenhuma
                    renovação é automática.
                  </p>
                </div>

                <label
                  className={[
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition',
                    paymentConfirmed
                      ? 'border-emerald-300/30 bg-emerald-300/[0.08]'
                      : 'border-white/10 bg-white/[0.025] hover:border-white/20'
                  ].join(
                    ' '
                  )}
                >
                  <input
                    type="checkbox"
                    checked={
                      paymentConfirmed
                    }
                    onChange={
                      event =>
                        setPaymentConfirmed(
                          event.target.checked
                        )
                    }
                    className="h-4 w-4 accent-emerald-300"
                  />

                  <span>
                    <span
                      className={[
                        'block text-xs font-black',
                        paymentConfirmed
                          ? 'text-emerald-200'
                          : 'text-slate-300'
                      ].join(
                        ' '
                      )}
                    >
                      Pagamento recebido
                    </span>

                    <span className="mt-0.5 block text-[0.68rem] text-slate-600">
                      Confirmação manual
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-7">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              4 · Nova autorização
            </p>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Data de início
                </span>

                <input
                  type="date"
                  value={
                    authorizationDate
                  }
                  onChange={
                    event =>
                      setAuthorizationDate(
                        event.target.value
                      )
                  }
                  className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm font-bold text-slate-200 outline-none focus:border-violet-300/40"
                />

                <span className="mt-2 block text-xs leading-5 text-slate-600">
                  Serve apenas para
                  pré-visualizar o futuro
                  resultado.
                </span>
              </label>

              <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-300">
                  Nova validade estimada
                </p>

                <p className="mt-3 text-lg font-black text-white">
                  {formatDate(
                    previewValidUntil
                  )}
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {selectedPlan ===
                  'paid_30_days'
                    ? 'Pré-visualização de 30 dias a partir da data escolhida.'
                    : 'Pré-visualização até 1 de agosto do ano letivo aplicável.'}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-600">
              Quando o backend estiver
              ligado, a validade definitiva
              será sempre calculada e
              validada pelo servidor antes
              de a licença ser alterada.
            </p>
          </div>
        </div>

        <aside className="border-t border-white/10 bg-slate-950/35 p-5 sm:p-6 xl:border-l xl:border-t-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            Resumo da renovação
          </p>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                Conta
              </p>

              <p className="mt-1 break-all text-xs font-bold text-slate-300">
                {normalizedEmail ||
                  'Nenhuma conta selecionada'}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                Plano
              </p>

              <p className="mt-1 text-xs font-black text-slate-300">
                {
                  selectedPlanOption.label
                }
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {
                  selectedPlanOption.price
                }{' '}
                ·{' '}
                {
                  selectedPlanOption.validity
                }
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                Pagamento
              </p>

              <p
                className={[
                  'mt-1 text-xs font-black',
                  paymentConfirmed
                    ? 'text-emerald-200'
                    : 'text-amber-200'
                ].join(
                  ' '
                )}
              >
                {paymentConfirmed
                  ? 'Confirmado'
                  : 'Por confirmar'}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                Início previsto
              </p>

              <p className="mt-1 text-xs font-bold text-slate-300">
                {formatDate(
                  parsedAuthorizationDate
                )}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                Nova validade
              </p>

              <p className="mt-1 text-xs font-black text-violet-200">
                {formatDate(
                  previewValidUntil
                )}
              </p>
            </div>
          </div>

          <div
            className={[
              'mt-5 rounded-xl border p-4',
              readyForConfirmation
                ? 'border-emerald-300/20 bg-emerald-300/[0.06]'
                : 'border-amber-300/15 bg-amber-300/[0.04]'
            ].join(
              ' '
            )}
          >
            <p
              className={[
                'text-xs font-black',
                readyForConfirmation
                  ? 'text-emerald-200'
                  : 'text-amber-200'
              ].join(
                ' '
              )}
            >
              {readyForConfirmation
                ? 'Pronto para confirmação'
                : 'Faltam dados para confirmar'}
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              {!normalizedEmail
                ? 'Indique primeiro a conta que está a renovar.'
                : !paymentConfirmed
                  ? 'Confirme que o pagamento foi recebido.'
                  : !parsedAuthorizationDate
                    ? 'Escolha uma data válida para a nova autorização.'
                    : 'Na versão com backend, a ação final será validada novamente pelo servidor.'}
            </p>
          </div>

          <button
            type="button"
            disabled
            className={[
              'mt-5 w-full cursor-not-allowed rounded-xl px-4 py-3 text-xs font-black',
              readyForConfirmation
                ? 'bg-emerald-300/15 text-emerald-300/50'
                : 'bg-white/[0.04] text-slate-600'
            ].join(
              ' '
            )}
          >
            Confirmar renovação
          </button>

          <p className="mt-3 text-center text-[0.68rem] leading-5 text-slate-600">
            O botão permanece bloqueado até
            existir autenticação e API
            administrativa segura.
          </p>
        </aside>
      </div>
    </section>
  )
}
