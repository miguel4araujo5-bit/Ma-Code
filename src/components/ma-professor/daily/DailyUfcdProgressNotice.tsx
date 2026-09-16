import {
  useEffect,
  useState
} from 'react'

import {
  ufcdProgressRepository,
  type UfcdEndingNotice
} from '../lessons/ufcdProgressRepository'
import type {
  EntityId,
  ISODate
} from '../types'

interface DailyUfcdProgressNoticeProps {
  academicYearId: EntityId
  date: ISODate
  lessonId?: EntityId | null
  refreshToken?: number
}

function getModuleLabel(
  notice: UfcdEndingNotice
) {
  return notice.moduleCode.trim()
    ? `${notice.moduleCode.trim()} · ${notice.moduleName}`
    : notice.moduleName
}

export default function DailyUfcdProgressNotice({
  academicYearId,
  date,
  lessonId = null,
  refreshToken = 0
}: DailyUfcdProgressNoticeProps) {
  const [
    notice,
    setNotice
  ] = useState<UfcdEndingNotice | null>(
    null
  )

  useEffect(() => {
    let cancelled = false

    void ufcdProgressRepository
      .getEndingNoticeForDate(
        academicYearId,
        date,
        lessonId
      )
      .then(result => {
        if (!cancelled) {
          setNotice(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotice(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    academicYearId,
    date,
    lessonId,
    refreshToken
  ])

  if (!notice) {
    return null
  }

  const lastLesson =
    notice.lessonsRemaining === 1

  return (
    <div className="px-3 pt-2 sm:px-5 lg:px-7">
      <section
        role="status"
        className={`mx-auto max-w-[1600px] rounded-2xl border px-4 py-4 shadow-lg shadow-black/10 sm:px-5 ${
          lastLesson
            ? 'border-rose-300/25 bg-rose-300/[0.08]'
            : 'border-amber-300/25 bg-amber-300/[0.07]'
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p
              className={`text-xs font-black uppercase tracking-[0.14em] ${
                lastLesson
                  ? 'text-rose-100'
                  : 'text-amber-100'
              }`}
            >
              {lastLesson
                ? 'Última aula da UFCD'
                : `Faltam ${notice.lessonsRemaining} aulas para terminar a UFCD`}
            </p>

            <p className="mt-2 text-sm font-black text-white">
              {getModuleLabel(notice)}
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              {lastLesson
                ? 'Faça a auto e heteroavaliação. Esta UFCD termina nesta aula.'
                : notice.assessmentSufficient
                  ? `Já existem elementos de avaliação suficientes para todos os critérios. Esta UFCD termina em ${notice.lessonsRemaining} aulas.`
                  : `Esta UFCD termina em ${notice.lessonsRemaining} aulas. Confirme se já tem elementos de avaliação suficientes para todos os critérios.`}
            </p>
          </div>

          <span className="shrink-0 rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2 text-xs font-black text-slate-200">
            {notice.periodsTaughtBeforeLesson}/{notice.plannedPeriods} tempos antes desta aula
          </span>
        </div>
      </section>
    </div>
  )
}
