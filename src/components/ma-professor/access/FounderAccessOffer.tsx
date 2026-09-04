import MBWayLogo from './MBWayLogo'

import type {
  MAProfessorAccessRequestStatus,
  RenewableLicensePlan
} from './accessTypes'

interface FounderAccessOfferProps {
  requestStatus:
    MAProfessorAccessRequestStatus | null
  activationCode: string
  activating: boolean
  requestingPlan:
    RenewableLicensePlan | null
  onActivationCodeChange: (
    value: string
  ) => void
  onActivate: () => void
  onSelectPlan: (
    plan: RenewableLicensePlan
  ) => void
}

const MBWAY_NUMBER =
  '936 840 619'

function FounderBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.08em] text-emerald-200">
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m13.2 2.5-7.4 11h5.5l-.5 8 7.4-11h-5.5l.5-8Z"
          fill="currentColor"
        />
      </svg>
      Acesso prioritário
    </span>
  )
}

function FounderMark() {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-lg shadow-cyan-950/20"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
      >
        <path
          d="m4 8 4.2 3.1L12 5l3.8 6.1L20 8l-1.6 9H5.6L4 8Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M7 20h10"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

export default function FounderAccessOffer({
  requestStatus,
  activationCode,
  activating,
  requestingPlan,
  onActivationCodeChange,
  onActivate,
  onSelectPlan
}: FounderAccessOfferProps) {
  const requestIsApproved =
    requestStatus === 'approved'

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-cyan-300/[0.08] via-slate-950/35 to-violet-300/[0.09] p-5 shadow-xl shadow-cyan-950/15 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <FounderMark />

            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                {requestIsApproved
                  ? 'Quer ativar um acesso Fundador?'
                  : 'Quer abolir a espera?'}
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Selecione um dos acessos Fundador e{' '}
                <strong className="text-emerald-200">
                  passe à frente na fila de espera.
                </strong>
              </p>
            </div>
          </div>

          <FounderBadge />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={Boolean(requestingPlan)}
            onClick={() =>
              onSelectPlan(
                'paid_30_days'
              )
            }
            className="group rounded-2xl border border-cyan-300/35 bg-cyan-300/[0.09] p-5 text-left transition hover:border-cyan-200/60 hover:bg-cyan-300/[0.14] disabled:cursor-wait disabled:opacity-60"
          >
            <span className="block text-xs font-black uppercase tracking-[0.12em] text-cyan-300">
              Fundador · 30 dias
            </span>

            <span className="mt-2 block text-2xl font-black text-cyan-100">
              3,49 €
            </span>

            <span className="mt-3 block text-xs leading-5 text-slate-400">
              Sem renovação automática. O pedido de acesso prioritário fica registado para confirmação pela MA-CODE.
            </span>

            <span className="mt-4 inline-flex text-xs font-black text-cyan-200 transition group-hover:text-cyan-100">
              {requestingPlan ===
              'paid_30_days'
                ? 'A registar…'
                : 'Selecionar 30 dias →'}
            </span>
          </button>

          <button
            type="button"
            disabled={Boolean(requestingPlan)}
            onClick={() =>
              onSelectPlan(
                'school_year'
              )
            }
            className="group rounded-2xl border border-violet-300/35 bg-violet-300/[0.09] p-5 text-left transition hover:border-violet-200/60 hover:bg-violet-300/[0.14] disabled:cursor-wait disabled:opacity-60"
          >
            <span className="block text-xs font-black uppercase tracking-[0.12em] text-violet-300">
              Fundador · Ano letivo
            </span>

            <span className="mt-2 block text-2xl font-black text-violet-100">
              15 €
            </span>

            <span className="mt-3 block text-xs leading-5 text-slate-400">
              Acesso até ao fim do ano letivo. O pedido de acesso prioritário fica registado para confirmação pela MA-CODE.
            </span>

            <span className="mt-4 inline-flex text-xs font-black text-violet-200 transition group-hover:text-violet-100">
              {requestingPlan ===
              'school_year'
                ? 'A registar…'
                : 'Selecionar ano letivo →'}
            </span>
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-400">
          Após confirmação do pagamento pela MA-CODE, o acesso é ativado com prioridade.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-white">
            <MBWayLogo className="h-12 w-auto sm:h-14" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white">
              Pagamento por MB WAY
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              Depois de selecionar o acesso Fundador, efetue o pagamento para este número:
            </p>

            <p className="mt-3 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-xl font-black tracking-[0.14em] text-slate-100">
              {MBWAY_NUMBER}
            </p>

            <p className="mt-2 text-[0.7rem] leading-5 text-slate-500">
              Depois do pagamento, aguarde a confirmação pela MA-CODE e utilize “Verificar novamente”.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-300/[0.035] p-5">
        <p className="text-sm font-black text-violet-100">
          Já tenho uma senha de ativação
        </p>

        <p className="mt-2 text-xs leading-5 text-slate-400">
          Se já recebeu uma senha MP-..., pode utilizá-la aqui. A sua password pessoal continua a ser utilizada apenas para entrar na conta.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={activationCode}
            onChange={event =>
              onActivationCodeChange(
                event.target.value
                  .toUpperCase()
              )
            }
            placeholder="MP-XXXX-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-sm uppercase tracking-wide text-white outline-none focus:border-violet-300/50"
          />

          <button
            type="button"
            disabled={
              activating ||
              !activationCode.trim()
            }
            onClick={onActivate}
            className="rounded-xl bg-violet-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-50"
          >
            {activating
              ? 'A ativar…'
              : 'Ativar período'}
          </button>
        </div>
      </section>
    </>
  )
}
