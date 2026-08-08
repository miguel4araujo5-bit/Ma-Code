import {
  useMemo,
  useState
} from 'react'

import type {
  LicensePlan
} from '../../ma-professor/types'

type AdminDecisionPlan =
  Extract<
    LicensePlan,
    | 'beta_30_days'
    | 'paid_30_days'
    | 'school_year'
  >

type DecisionMode =
  | 'approve'
  | 'reject'

interface PlanOption {
  id: AdminDecisionPlan
  label: string
  price: string
  validity: string
  note: string
  accentClassName: string
}

const planOptions:
  PlanOption[] = [
    {
      id: 'beta_30_days',
      label: 'Beta gratuita',
      price: '0 €',
      validity: '30 dias',
      note:
        'Começa apenas na primeira ativação válida com email e senha.',
      accentClassName:
        'border-cyan-300/30 bg-cyan-300/[0.07] text-cyan-200'
    },
    {
      id: 'paid_30_days',
      label: 'Plano 30 dias',
      price: '3,49 €',
      validity: '30 dias',
      note:
        'Renovação manual. Não existe renovação automática.',
      accentClassName:
        'border-violet-300/30 bg-violet-300/[0.07] text-violet-200'
    },
    {
      id: 'school_year',
      label: 'Ano letivo',
      price: '15 €',
      validity: 'Até 1 de agosto',
      note:
        'Não exige nova ativação mensal durante o período válido.',
      accentClassName:
        'border-amber-300/30 bg-amber-300/[0.07] text-amber-200'
    }
  ]

function getPlanLabel(
  plan: AdminDecisionPlan
) {
  return (
    planOptions.find(
      option =>
        option.id === plan
    )?.label || plan
  )
}

export default function MAProfessorAdminDecisionPanel() {
  const [
    email,
    setEmail
  ] =
    useState('')

  const [
    decision,
    setDecision
  ] =
    useState<DecisionMode>(
      'approve'
    )

  const [
    selectedPlan,
    setSelectedPlan
  ] =
    useState<AdminDecisionPlan>(
      'beta_30_days'
    )

  const normalizedEmail =
    email
      .trim()
      .toLowerCase()

  const selectedPlanOption =
    useMemo(
      () =>
        planOptions.find(
          option =>
            option.id ===
            selectedPlan
        ) || planOptions[0],
      [selectedPlan]
    )

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/55">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Pré-visualização operacional
            </p>

            <h2 className="mt-2 text-xl font-black sm:text-2xl">
              Decisão sobre uma conta
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Este painel define o fluxo que
              será usado quando existir um
              pedido real: rever a conta,
              aprovar ou rejeitar, escolher o
              plano e gerar a senha no
              servidor.
            </p>
          </div>

          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-amber-200">
            Simulação local
          </span>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="p-5 sm:p-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Conta

              <input
                type="email"
                value={email}
                onChange={event =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="professor@escola.pt"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
              />
            </label>

            <p className="mt-2 text-xs leading-5 text-slate-600">
              Este email serve apenas para
              visualizar o futuro fluxo. Não
              é guardado nem enviado para o
              servidor nesta fase.
            </p>
          </div>

          <div className="mt-7">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              1 · Decisão do pedido
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setDecision(
                    'approve'
                  )
                }
                className={[
                  'rounded-2xl border p-4 text-left transition',
                  decision === 'approve'
                    ? 'border-emerald-300/35 bg-emerald-300/[0.08]'
                    : 'border-white/10 bg-slate-950/35 hover:border-white/20'
                ].join(' ')}
              >
                <span className="text-sm font-black text-emerald-200">
                  Aprovar
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Permite criar a credencial e
                  preparar a ativação da conta.
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDecision(
                    'reject'
                  )
                }
                className={[
                  'rounded-2xl border p-4 text-left transition',
                  decision === 'reject'
                    ? 'border-rose-300/35 bg-rose-300/[0.08]'
                    : 'border-white/10 bg-slate-950/35 hover:border-white/20'
                ].join(' ')}
              >
                <span className="text-sm font-black text-rose-200">
                  Rejeitar
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Mantém a conta sem acesso e
                  regista a decisão quando o
                  backend existir.
                </span>
              </button>
            </div>
          </div>

          {decision ===
          'approve' ? (
            <>
              <div className="mt-7">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  2 · Plano a preparar
                </p>

                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  {planOptions.map(
                    option => {
                      const active =
                        option.id ===
                        selectedPlan

                      return (
                        <button
                          key={
                            option.id
                          }
                          type="button"
                          onClick={() =>
                            setSelectedPlan(
                              option.id
                            )
                          }
                          className={[
                            'rounded-2xl border p-4 text-left transition',
                            active
                              ? option.accentClassName
                              : 'border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20'
                          ].join(
                            ' '
                          )}
                        >
                          <span className="block text-sm font-black">
                            {
                              option.label
                            }
                          </span>

                          <span className="mt-3 block text-xl font-black text-white">
                            {
                              option.price
                            }
                          </span>

                          <span className="mt-1 block text-xs font-bold text-slate-400">
                            {
                              option.validity
                            }
                          </span>

                          <span className="mt-3 block text-xs leading-5 text-slate-500">
                            {
                              option.note
                            }
                          </span>
                        </button>
                      )
                    }
                  )}
                </div>
              </div>

              <div className="mt-7">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  3 · Senha da conta
                </p>

                <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-white">
                        Senha ainda não gerada
                      </p>

                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                        Na versão ligada ao
                        backend, a senha será
                        gerada no servidor,
                        associada a este email e
                        apresentada ao
                        administrador para copiar
                        e enviar ao professor.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled
                      className="shrink-0 cursor-not-allowed rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] px-4 py-2.5 text-xs font-black text-cyan-300/40"
                    >
                      Gerar senha
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-7 rounded-2xl border border-rose-300/15 bg-rose-300/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-300">
                Pedido rejeitado
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Na versão ligada ao backend,
                esta ação altera apenas o
                estado do pedido e fica
                registada no histórico. Não é
                criada senha nem licença.
              </p>
            </div>
          )}
        </div>

        <aside className="border-t border-white/10 bg-slate-950/35 p-5 sm:p-6 xl:border-l xl:border-t-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            Resumo da decisão
          </p>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                Email
              </p>

              <p className="mt-1 break-all text-xs font-bold text-slate-300">
                {normalizedEmail ||
                  'Nenhuma conta selecionada'}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                Decisão
              </p>

              <p
                className={[
                  'mt-1 text-xs font-black',
                  decision === 'approve'
                    ? 'text-emerald-200'
                    : 'text-rose-200'
                ].join(' ')}
              >
                {decision ===
                'approve'
                  ? 'Aprovar pedido'
                  : 'Rejeitar pedido'}
              </p>
            </div>

            {decision ===
            'approve' ? (
              <>
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
                    Plano
                  </p>

                  <p className="mt-1 text-xs font-black text-slate-300">
                    {getPlanLabel(
                      selectedPlan
                    )}
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
                    Senha
                  </p>

                  <p className="mt-1 text-xs font-bold text-slate-500">
                    A gerar no backend
                  </p>
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-xs font-black text-slate-300">
              O que acontecerá depois
            </p>

            <ol className="mt-3 space-y-3 text-xs leading-5 text-slate-500">
              {decision ===
              'approve' ? (
                <>
                  <li>
                    <span className="mr-2 font-black text-cyan-300/70">
                      1.
                    </span>
                    Pedido fica aprovado.
                  </li>

                  <li>
                    <span className="mr-2 font-black text-cyan-300/70">
                      2.
                    </span>
                    Servidor gera e associa a
                    senha à conta.
                  </li>

                  <li>
                    <span className="mr-2 font-black text-cyan-300/70">
                      3.
                    </span>
                    Administrador copia e envia
                    a senha ao professor.
                  </li>

                  <li>
                    <span className="mr-2 font-black text-cyan-300/70">
                      4.
                    </span>
                    Professor entra com email e
                    senha.
                  </li>

                  <li>
                    <span className="mr-2 font-black text-cyan-300/70">
                      5.
                    </span>
                    O período aplicável começa
                    segundo as regras do plano.
                  </li>
                </>
              ) : (
                <li>
                  <span className="mr-2 font-black text-rose-300/70">
                    1.
                  </span>
                  O pedido fica rejeitado e a
                  decisão é registada no
                  histórico.
                </li>
              )}
            </ol>
          </div>

          <button
            type="button"
            disabled
            className={[
              'mt-6 w-full cursor-not-allowed rounded-xl px-4 py-3 text-xs font-black',
              decision === 'approve'
                ? 'bg-emerald-300/10 text-emerald-300/40'
                : 'bg-rose-300/10 text-rose-300/40'
            ].join(' ')}
          >
            {decision ===
            'approve'
              ? 'Confirmar aprovação'
              : 'Confirmar rejeição'}
          </button>

          <p className="mt-3 text-center text-[0.68rem] leading-5 text-slate-600">
            A confirmação fica bloqueada até
            existir autenticação e backend
            administrativo protegido.
          </p>
        </aside>
      </div>
    </section>
  )
}
