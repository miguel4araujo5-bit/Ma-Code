import type {
  Weekday
} from '../types'

export type ScheduleImportUnresolvedDraft = {
  id: string
  weekday: Weekday
  startTime: string
  endTime: string
  rawText: string
  reason: string
}

type Props = {
  unresolved: ScheduleImportUnresolvedDraft[]
  disabled?: boolean
  onAsLesson: (id: string) => void
  onAsDuty: (id: string) => void
  onIgnore: (id: string) => void
}

const weekdayLabels: Record<Weekday, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo'
}

export default function ScheduleImportUnresolvedReview({
  unresolved,
  disabled = false,
  onAsLesson,
  onAsDuty,
  onIgnore
}: Props) {
  if (unresolved.length === 0) {
    return null
  }

  return (
    <section className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.055] p-4 sm:p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">
          Revisão obrigatória
        </p>
        <h2 className="mt-1 text-lg font-black text-white">
          Blocos por resolver
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-100/75">
          Estes blocos estavam ocupados no horário, mas não existem dados suficientes para decidir automaticamente se são aula ou cargo. Nenhum é apagado em silêncio: escolha explicitamente Aula, Cargo ou Ignorar antes de confirmar a importação.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {unresolved.map(block => (
          <article
            key={block.id}
            className="rounded-2xl border border-amber-200/15 bg-slate-950/45 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black text-white">
                  {block.rawText || 'Conteúdo não identificado'}
                </p>
                <p className="mt-1 text-xs font-bold text-amber-100/80">
                  {weekdayLabels[block.weekday]} · {block.startTime}–{block.endTime}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {block.reason}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onAsLesson(block.id)}
                  className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/[0.14] disabled:opacity-50"
                >
                  Tratar como aula
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onAsDuty(block.id)}
                  className="rounded-xl border border-violet-300/25 bg-violet-300/[0.08] px-3 py-2 text-xs font-black text-violet-100 transition hover:bg-violet-300/[0.14] disabled:opacity-50"
                >
                  Tratar como cargo
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onIgnore(block.id)}
                  className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                >
                  Ignorar este bloco
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
