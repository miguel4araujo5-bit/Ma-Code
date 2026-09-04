import type {
  MAProfessorApprovalPlan
} from '../../../lib/admin/maProfessorApprovalApi'

interface MAProfessorApprovalChoiceDialogProps {
  email: string | null
  busy: boolean
  onChoose: (
    plan: MAProfessorApprovalPlan
  ) => void
  onCancel: () => void
}

const choices: Array<{
  plan: MAProfessorApprovalPlan
  title: string
  price: string
  description: string
  className: string
}> = [
  {
    plan: 'free',
    title: 'Gratuito',
    price: '0 €',
    description:
      'Vaga gratuita da fase piloto. Gera a senha e envia o email de ativação.',
    className:
      'border-emerald-300/30 bg-emerald-300/[0.08] hover:bg-emerald-300/[0.13] text-emerald-100'
  },
  {
    plan: 'paid_30_days',
    title: 'Fundador · 30 dias',
    price: '3,49 €',
    description:
      'Confirma o acesso de 30 dias, gera a senha e envia o email de ativação.',
    className:
      'border-cyan-300/30 bg-cyan-300/[0.08] hover:bg-cyan-300/[0.13] text-cyan-100'
  },
  {
    plan: 'school_year',
    title: 'Fundador · Ano letivo',
    price: '15 €',
    description:
      'Confirma o acesso até ao fim do ano letivo, gera a senha e envia o email de ativação.',
    className:
      'border-violet-300/30 bg-violet-300/[0.08] hover:bg-violet-300/[0.13] text-violet-100'
  }
]

export default function MAProfessorApprovalChoiceDialog({
  email,
  busy,
  onChoose,
  onCancel
}: MAProfessorApprovalChoiceDialogProps) {
  if (!email) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ma-professor-approval-title"
    >
      <section className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
          Aprovar pedido
        </p>

        <h2
          id="ma-professor-approval-title"
          className="mt-2 text-2xl font-black text-white"
        >
          Que acesso pretende atribuir?
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Conta:{' '}
          <strong className="text-slate-200">
            {email}
          </strong>
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          A escolha fica associada a esta aprovação. A senha de ativação é criada antes do envio e o professor recebe o email com o botão “Ativar acesso”.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {choices.map(choice => (
            <button
              key={choice.plan}
              type="button"
              disabled={busy}
              onClick={() =>
                onChoose(choice.plan)
              }
              className={[
                'rounded-2xl border p-5 text-left transition disabled:cursor-wait disabled:opacity-50',
                choice.className
              ].join(' ')}
            >
              <span className="block text-xs font-black uppercase tracking-[0.11em]">
                {choice.title}
              </span>

              <span className="mt-2 block text-2xl font-black text-white">
                {choice.price}
              </span>

              <span className="mt-3 block text-xs leading-5 text-slate-400">
                {choice.description}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-[0.7rem] leading-5 text-slate-500">
            Se o envio de email falhar, a senha continua disponível como fallback no MA-ADMIN.
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="shrink-0 rounded-xl border border-white/10 px-4 py-2 text-xs font-black text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </section>
    </div>
  )
}
