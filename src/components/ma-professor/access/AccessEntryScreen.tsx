import type {
  FormEvent
} from 'react'

import {
  getAccessRequestStatusLabel,
  type MAProfessorAccessRequestStatus
} from './accessTypes'

export type MAProfessorEntryMode =
  | 'request'
  | 'activate'
  | 'request-sent'

interface AccessEntryScreenProps {
  mode:
    MAProfessorEntryMode

  email:
    string

  password:
    string

  submitting:
    boolean

  error:
    string

  message:
    string

  requestStatus:
    MAProfessorAccessRequestStatus | null

  canActivate:
    boolean

  onEmailChange:
    (value: string) => void

  onPasswordChange:
    (value: string) => void

  onRequest:
    (
      event:
        FormEvent<HTMLFormElement>
    ) => void

  onActivate:
    (
      event:
        FormEvent<HTMLFormElement>
    ) => void

  onShowRequest:
    () => void

  onShowActivation:
    () => void
}

function CheckIcon() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-sm font-black text-cyan-200">
      ✓
    </span>
  )
}

function PlanCard({
  label,
  price,
  detail,
  accent = 'cyan'
}: {
  label: string
  price: string
  detail: string

  accent?:
    | 'cyan'
    | 'violet'
    | 'emerald'
}) {
  const accentClass =
    accent ===
      'violet'
      ? 'border-violet-300/15 bg-violet-300/[0.05] text-violet-200'
      : accent ===
          'emerald'
        ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200'
        : 'border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-200'

  return (
    <div
      className={`rounded-2xl border p-4 ${accentClass}`}
    >
      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] opacity-80">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">
        {price}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-400">
        {detail}
      </p>
    </div>
  )
}

function MarketingPanel() {
  return (
    <div className="border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
        MA-CODE · MA-Professor
      </p>

      <h1 className="mt-4 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
        O seu ano letivo organizado num único lugar.
      </h1>

      <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
        Sumários, aulas, turmas, avaliações, faltas, planificações e horários, com uma experiência simples pensada para o dia a dia do professor.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {[
          'Configuração guiada e simples',
          'Avaliações por UFCD ou módulo',
          'Controlo de faltas e recuperações',
          'Cópias protegidas e restauro'
        ].map(
          item => (
            <div
              key={
                item
              }
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-200"
            >
              <CheckIcon />

              <span>
                {item}
              </span>
            </div>
          )
        )}
      </div>

      <div className="mt-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Condições transparentes desde o início
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <PlanCard
            label="Beta"
            price="30 dias · 0 €"
            detail="Começa apenas quando ativar a conta."
            accent="emerald"
          />

          <PlanCard
            label="Mensal"
            price="3,49 €"
            detail="30 dias de acesso. Renovação manual."
          />

          <PlanCard
            label="Ano letivo"
            price="15 €"
            detail="Acesso até 1 de agosto."
            accent="violet"
          />
        </div>

        <p className="mt-3 text-xs font-semibold text-slate-500">
          Sem renovação automática. O pagamento por MB WAY automático ainda não está disponível.
        </p>
      </div>
    </div>
  )
}

function RequestForm({
  email,
  submitting,
  error,
  onEmailChange,
  onRequest,
  onShowActivation
}: Pick<
  AccessEntryScreenProps,
  | 'email'
  | 'submitting'
  | 'error'
  | 'onEmailChange'
  | 'onRequest'
  | 'onShowActivation'
>) {
  return (
    <form
      className="flex flex-col justify-center p-7 sm:p-10"
      onSubmit={
        onRequest
      }
    >
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
        Pedir acesso
      </p>

      <h2 className="mt-3 text-2xl font-black">
        Experimente o MA-Professor
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        A beta é gratuita durante 30 dias. Primeiro envie o seu pedido. A MA-CODE analisa-o e, depois da aprovação, envia-lhe a senha de ativação por email.
      </p>

      <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
        <p className="text-sm font-black text-cyan-100">
          O pedido não inicia a beta
        </p>

        <p className="mt-1.5 text-xs leading-5 text-slate-400">
          Os 30 dias começam apenas quando utilizar corretamente a senha recebida e ativar a conta.
        </p>
      </div>

      <label className="mt-6 text-sm font-bold text-slate-200">
        Email

        <input
          type="email"
          autoComplete="email"
          value={
            email
          }
          onChange={
            event =>
              onEmailChange(
                event
                  .target
                  .value
              )
          }
          placeholder="professor@escola.pt"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
        />
      </label>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={
          submitting
        }
        className="mt-5 rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
      >
        {submitting
          ? 'A enviar pedido…'
          : 'Pedir acesso'}
      </button>

      <button
        type="button"
        disabled={
          submitting
        }
        onClick={
          onShowActivation
        }
        className="mt-3 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
      >
        Já recebeu a senha? Ativar conta
      </button>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Ao pedir acesso não é criada nem ativada qualquer licença automaticamente.
      </p>
    </form>
  )
}

function ActivationForm({
  email,
  password,
  submitting,
  error,
  message,
  onEmailChange,
  onPasswordChange,
  onActivate,
  onShowRequest
}: Pick<
  AccessEntryScreenProps,
  | 'email'
  | 'password'
  | 'submitting'
  | 'error'
  | 'message'
  | 'onEmailChange'
  | 'onPasswordChange'
  | 'onActivate'
  | 'onShowRequest'
>) {
  return (
    <form
      className="flex flex-col justify-center p-7 sm:p-10"
      onSubmit={
        onActivate
      }
    >
      <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
        Ativação
      </p>

      <h2 className="mt-3 text-2xl font-black">
        Já recebeu a sua senha?
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        Introduza o mesmo email usado no pedido e a senha enviada pela MA-CODE. Na primeira ativação válida começa a sua beta de 30 dias.
      </p>

      {message ? (
        <p className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-3 text-sm leading-6 text-cyan-100">
          {message}
        </p>
      ) : null}

      <label className="mt-6 text-sm font-bold text-slate-200">
        Email

        <input
          type="email"
          autoComplete="email"
          value={
            email
          }
          onChange={
            event =>
              onEmailChange(
                event
                  .target
                  .value
              )
          }
          placeholder="professor@escola.pt"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60 focus:ring-4 focus:ring-violet-300/10"
        />
      </label>

      <label className="mt-4 text-sm font-bold text-slate-200">
        Senha

        <input
          type="password"
          autoComplete="current-password"
          value={
            password
          }
          onChange={
            event =>
              onPasswordChange(
                event
                  .target
                  .value
              )
          }
          placeholder="Senha enviada pela MA-CODE"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60 focus:ring-4 focus:ring-violet-300/10"
        />
      </label>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={
          submitting
        }
        className="mt-5 rounded-2xl bg-gradient-to-r from-violet-300 to-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
      >
        {submitting
          ? 'A validar…'
          : 'Ativar e entrar'}
      </button>

      <button
        type="button"
        disabled={
          submitting
        }
        onClick={
          onShowRequest
        }
        className="mt-3 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
      >
        Ainda não pediu acesso? Fazer pedido
      </button>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        A senha da conta valida o acesso e a licença. A chave de recuperação dos dados é um mecanismo diferente e será apresentada depois da ativação.
      </p>
    </form>
  )
}

function RequestSent({
  email,
  message,
  requestStatus,
  canActivate,
  onShowActivation,
  onShowRequest
}: Pick<
  AccessEntryScreenProps,
  | 'email'
  | 'message'
  | 'requestStatus'
  | 'canActivate'
  | 'onShowActivation'
  | 'onShowRequest'
>) {
  const approved =
    requestStatus ===
      'approved'

  const rejected =
    requestStatus ===
      'rejected'

  return (
    <div className="flex flex-col justify-center p-7 sm:p-10">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-xl font-black ${
          rejected
            ? 'border-rose-300/20 bg-rose-300/10 text-rose-200'
            : approved
              ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
              : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200'
        }`}
      >
        {rejected
          ? '!'
          : '✓'}
      </div>

      <p
        className={`mt-5 text-xs font-black uppercase tracking-[0.2em] ${
          rejected
            ? 'text-rose-300'
            : approved
              ? 'text-emerald-300'
              : 'text-cyan-300'
        }`}
      >
        {requestStatus
          ? getAccessRequestStatusLabel(
              requestStatus
            )
          : 'Pedido recebido'}
      </p>

      <h2 className="mt-3 text-2xl font-black">
        {approved
          ? 'O seu pedido foi aprovado'
          : rejected
            ? 'O pedido não foi aprovado'
            : 'Pedido recebido'}
      </h2>

      <p className="mt-3 text-sm leading-7 text-slate-300">
        {message}
      </p>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Email do pedido
        </p>

        <p className="mt-2 break-all text-sm font-bold text-white">
          {email}
        </p>
      </div>

      {approved &&
      canActivate ? (
        <button
          type="button"
          onClick={
            onShowActivation
          }
          className="mt-5 rounded-2xl bg-gradient-to-r from-violet-300 to-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:brightness-110"
        >
          Introduzir senha e ativar
        </button>
      ) : null}

      {!rejected ? (
        <button
          type="button"
          onClick={
            onShowActivation
          }
          className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-200 transition hover:border-violet-300/25 hover:bg-violet-300/[0.06]"
        >
          Já recebi a senha
        </button>
      ) : null}

      <button
        type="button"
        onClick={
          onShowRequest
        }
        className="mt-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:text-white"
      >
        Usar outro email
      </button>

      {!approved &&
      !rejected ? (
        <p className="mt-4 text-xs leading-5 text-slate-500">
          A beta ainda não começou. Os 30 dias só contam a partir da primeira ativação válida.
        </p>
      ) : null}
    </div>
  )
}

export function AccessEntryScreen(
  props:
    AccessEntryScreenProps
) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-10">
      <section className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-cyan-950/30 lg:grid-cols-[1.08fr_0.92fr]">
        <MarketingPanel />

        {props.mode ===
        'request' ? (
          <RequestForm
            email={
              props.email
            }
            submitting={
              props.submitting
            }
            error={
              props.error
            }
            onEmailChange={
              props.onEmailChange
            }
            onRequest={
              props.onRequest
            }
            onShowActivation={
              props.onShowActivation
            }
          />
        ) : null}

        {props.mode ===
        'activate' ? (
          <ActivationForm
            email={
              props.email
            }
            password={
              props.password
            }
            submitting={
              props.submitting
            }
            error={
              props.error
            }
            message={
              props.message
            }
            onEmailChange={
              props.onEmailChange
            }
            onPasswordChange={
              props.onPasswordChange
            }
            onActivate={
              props.onActivate
            }
            onShowRequest={
              props.onShowRequest
            }
          />
        ) : null}

        {props.mode ===
        'request-sent' ? (
          <RequestSent
            email={
              props.email
            }
            message={
              props.message
            }
            requestStatus={
              props.requestStatus
            }
            canActivate={
              props.canActivate
            }
            onShowActivation={
              props.onShowActivation
            }
            onShowRequest={
              props.onShowRequest
            }
          />
        ) : null}
      </section>
    </main>
  )
}

export default AccessEntryScreen
