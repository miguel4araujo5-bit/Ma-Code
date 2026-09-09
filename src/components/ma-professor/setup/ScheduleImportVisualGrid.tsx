import {
  useMemo,
  useState
} from 'react'

import type {
  Weekday
} from '../types'

export type ScheduleImportLessonDraft = {
  id: string
  included: boolean
  weekday: Weekday
  startTime: string
  endTime: string
  periodCount: number
  groupName: string
  courseName?: string
  subjectName: string
  subjectConfirmed: boolean
}

export type ScheduleImportDutyDraft = {
  id: string
  included: boolean
  weekday: Weekday
  startTime: string
  endTime: string
  name: string
}

type Props = {
  lessons: ScheduleImportLessonDraft[]
  duties: ScheduleImportDutyDraft[]
  disabled?: boolean
  onUpdateLesson: (
    id: string,
    changes: Partial<ScheduleImportLessonDraft>
  ) => void
  onUpdateDuty: (
    id: string,
    changes: Partial<ScheduleImportDutyDraft>
  ) => void
}

type Selection =
  | {
      kind: 'lesson'
      id: string
    }
  | {
      kind: 'duty'
      id: string
    }
  | null

type TimeRow = {
  key: string
  startTime: string
  endTime: string
}

const weekdayLabels: Array<{
  value: Weekday
  label: string
}> = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' }
]

const fieldClassName =
  'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50'

function timeValue(value: string) {
  const [hours, minutes] =
    value.split(':').map(Number)

  return (
    (Number.isFinite(hours) ? hours : 0) * 60 +
    (Number.isFinite(minutes) ? minutes : 0)
  )
}

function timeRows(
  lessons: ScheduleImportLessonDraft[],
  duties: ScheduleImportDutyDraft[]
): TimeRow[] {
  const rows =
    new Map<string, TimeRow>()

  for (const item of [...lessons, ...duties]) {
    const startTime = item.startTime.trim()
    const endTime = item.endTime.trim()

    if (!startTime || !endTime) {
      continue
    }

    const key = `${startTime}|${endTime}`

    rows.set(key, {
      key,
      startTime,
      endTime
    })
  }

  return [...rows.values()].sort(
    (left, right) =>
      timeValue(left.startTime) - timeValue(right.startTime) ||
      timeValue(left.endTime) - timeValue(right.endTime)
  )
}

function visibleWeekdays(
  lessons: ScheduleImportLessonDraft[],
  duties: ScheduleImportDutyDraft[]
) {
  const hasWeekend =
    [...lessons, ...duties].some(
      item => item.weekday === 6 || item.weekday === 7
    )

  return weekdayLabels.filter(
    day => hasWeekend || day.value <= 5
  )
}

function sameSlot(
  item: {
    weekday: Weekday
    startTime: string
    endTime: string
  },
  weekday: Weekday,
  row: TimeRow
) {
  return (
    item.weekday === weekday &&
    item.startTime === row.startTime &&
    item.endTime === row.endTime
  )
}

export default function ScheduleImportVisualGrid({
  lessons,
  duties,
  disabled = false,
  onUpdateLesson,
  onUpdateDuty
}: Props) {
  const [selection, setSelection] =
    useState<Selection>(null)

  const rows =
    useMemo(
      () => timeRows(lessons, duties),
      [lessons, duties]
    )

  const days =
    useMemo(
      () => visibleWeekdays(lessons, duties),
      [lessons, duties]
    )

  const selectedLesson =
    selection?.kind === 'lesson'
      ? lessons.find(
          lesson => lesson.id === selection.id
        ) ?? null
      : null

  const selectedDuty =
    selection?.kind === 'duty'
      ? duties.find(
          duty => duty.id === selection.id
        ) ?? null
      : null

  return (
    <section
      aria-label="Revisão visual do horário importado"
      className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">
            Vista de horário
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            Compare esta grelha com o PDF original. Clique num bloco para rever ou corrigir os dados antes de confirmar a importação.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-cyan-100">
            Aula
          </span>
          <span className="rounded-full border border-violet-300/20 bg-violet-300/[0.07] px-3 py-1.5 text-violet-100">
            Cargo
          </span>
          <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-3 py-1.5 text-amber-100">
            Por confirmar
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">
          Ainda não existem blocos para apresentar no horário.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <div
            className="min-w-[860px] bg-slate-950/35"
            style={{
              display: 'grid',
              gridTemplateColumns:
                `minmax(7.5rem, .72fr) repeat(${days.length}, minmax(10.5rem, 1fr))`
            }}
          >
            <div className="border-b border-r border-white/10 bg-white/[0.035] px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              Horas
            </div>

            {days.map(day => (
              <div
                key={`head-${day.value}`}
                className="border-b border-r border-white/10 bg-white/[0.035] px-3 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-slate-400 last:border-r-0"
              >
                {day.label}
              </div>
            ))}

            {rows.flatMap(row => {
              const rowCells = [
                <div
                  key={`time-${row.key}`}
                  className="border-b border-r border-white/10 px-3 py-4 text-sm font-black text-slate-300"
                >
                  <span className="block text-white">
                    {row.startTime}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    até {row.endTime}
                  </span>
                </div>
              ]

              for (const day of days) {
                const cellLessons =
                  lessons.filter(
                    lesson => sameSlot(lesson, day.value, row)
                  )
                const cellDuties =
                  duties.filter(
                    duty => sameSlot(duty, day.value, row)
                  )

                rowCells.push(
                  <div
                    key={`cell-${row.key}-${day.value}`}
                    className="min-h-28 border-b border-r border-white/10 p-2 last:border-r-0"
                  >
                    <div className="space-y-2">
                      {cellLessons.map(lesson => (
                        <button
                          key={lesson.id}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            setSelection({
                              kind: 'lesson',
                              id: lesson.id
                            })
                          }
                          className={`w-full rounded-xl border p-3 text-left transition disabled:cursor-not-allowed ${
                            lesson.subjectConfirmed
                              ? 'border-cyan-300/20 bg-cyan-300/[0.07] hover:border-cyan-300/40 hover:bg-cyan-300/[0.11]'
                              : 'border-amber-300/30 bg-amber-300/[0.08] hover:border-amber-300/50 hover:bg-amber-300/[0.12]'
                          } ${
                            lesson.included
                              ? ''
                              : 'opacity-45'
                          }`}
                        >
                          <span className="block font-black text-white">
                            {lesson.subjectName.trim() ||
                              'Disciplina por indicar'}
                          </span>
                          <span className="mt-1 block text-xs font-bold text-slate-300">
                            {lesson.groupName.trim() ||
                              'Turma por indicar'}
                          </span>
                          {lesson.courseName?.trim() ? (
                            <span className="mt-1 block text-xs text-slate-400">
                              {lesson.courseName}
                            </span>
                          ) : null}
                          {!lesson.subjectConfirmed ? (
                            <span className="mt-2 block text-xs font-bold text-amber-200">
                              Disciplina por confirmar
                            </span>
                          ) : null}
                          {!lesson.included ? (
                            <span className="mt-2 block text-xs font-bold text-slate-500">
                              Excluída da importação
                            </span>
                          ) : null}
                        </button>
                      ))}

                      {cellDuties.map(duty => (
                        <button
                          key={duty.id}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            setSelection({
                              kind: 'duty',
                              id: duty.id
                            })
                          }
                          className={`w-full rounded-xl border border-violet-300/20 bg-violet-300/[0.07] p-3 text-left transition hover:border-violet-300/40 hover:bg-violet-300/[0.11] disabled:cursor-not-allowed ${
                            duty.included
                              ? ''
                              : 'opacity-45'
                          }`}
                        >
                          <span className="block font-black text-white">
                            {duty.name.trim() || 'Cargo por indicar'}
                          </span>
                          <span className="mt-1 block text-xs font-bold text-violet-200">
                            Cargo / atividade
                          </span>
                          {!duty.included ? (
                            <span className="mt-2 block text-xs font-bold text-slate-500">
                              Excluído da importação
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              }

              return rowCells
            })}
          </div>
        </div>
      )}

      {selectedLesson ? (
        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.045] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
                Rever aula
              </p>
              <h3 className="mt-1 text-lg font-black text-white">
                {selectedLesson.subjectName.trim() ||
                  'Aula importada'}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setSelection(null)}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.05]"
            >
              Fechar
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-bold text-slate-300">
              Dia
              <select
                value={selectedLesson.weekday}
                disabled={disabled || !selectedLesson.included}
                onChange={event =>
                  onUpdateLesson(
                    selectedLesson.id,
                    {
                      weekday:
                        Number(event.target.value) as Weekday
                    }
                  )
                }
                className={`${fieldClassName} mt-1.5`}
              >
                {weekdayLabels.map(day => (
                  <option
                    key={day.value}
                    value={day.value}
                  >
                    {day.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold text-slate-300">
              Início
              <input
                type="time"
                value={selectedLesson.startTime}
                disabled={disabled || !selectedLesson.included}
                onChange={event =>
                  onUpdateLesson(
                    selectedLesson.id,
                    {
                      startTime: event.target.value
                    }
                  )
                }
                className={`${fieldClassName} mt-1.5`}
              />
            </label>

            <label className="text-xs font-bold text-slate-300">
              Fim
              <input
                type="time"
                value={selectedLesson.endTime}
                disabled={disabled || !selectedLesson.included}
                onChange={event =>
                  onUpdateLesson(
                    selectedLesson.id,
                    {
                      endTime: event.target.value
                    }
                  )
                }
                className={`${fieldClassName} mt-1.5`}
              />
            </label>

            <label className="text-xs font-bold text-slate-300">
              Tempos
              <input
                type="number"
                min={1}
                max={12}
                value={selectedLesson.periodCount}
                disabled={disabled || !selectedLesson.included}
                onChange={event =>
                  onUpdateLesson(
                    selectedLesson.id,
                    {
                      periodCount:
                        Math.max(
                          1,
                          Number(event.target.value) || 1
                        )
                    }
                  )
                }
                className={`${fieldClassName} mt-1.5`}
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <label className="text-xs font-bold text-slate-300">
              Turma
              <input
                value={selectedLesson.groupName}
                disabled={disabled || !selectedLesson.included}
                onChange={event =>
                  onUpdateLesson(
                    selectedLesson.id,
                    {
                      groupName: event.target.value
                    }
                  )
                }
                className={`${fieldClassName} mt-1.5`}
              />
            </label>

            <label className="text-xs font-bold text-slate-300">
              Disciplina
              <input
                value={selectedLesson.subjectName}
                disabled={disabled || !selectedLesson.included}
                onChange={event =>
                  onUpdateLesson(
                    selectedLesson.id,
                    {
                      subjectName: event.target.value,
                      subjectConfirmed: false
                    }
                  )
                }
                className={`${fieldClassName} mt-1.5`}
              />
            </label>

            <label className="text-xs font-bold text-slate-300">
              Curso
              <input
                value={selectedLesson.courseName ?? ''}
                disabled={disabled || !selectedLesson.included}
                onChange={event =>
                  onUpdateLesson(
                    selectedLesson.id,
                    {
                      courseName: event.target.value
                    }
                  )
                }
                placeholder="Curso, quando aplicável"
                className={`${fieldClassName} mt-1.5`}
              />
            </label>
          </div>

          {!selectedLesson.subjectConfirmed ? (
            <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-3 text-sm text-amber-100">
              <p className="font-bold">
                A disciplina está por confirmar.
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-100/75">
                Confirme apenas depois de verificar que o texto corresponde realmente a uma disciplina e não a um curso, turma ou outro código.
              </p>
              <button
                type="button"
                disabled={disabled || !selectedLesson.included || !selectedLesson.subjectName.trim()}
                onClick={() =>
                  onUpdateLesson(
                    selectedLesson.id,
                    {
                      subjectConfirmed: true
                    }
                  )
                }
                className="mt-3 rounded-xl border border-amber-200/30 bg-amber-200/[0.08] px-3 py-2 text-xs font-black text-amber-50 transition hover:bg-amber-200/[0.13] disabled:opacity-50"
              >
                Confirmar como disciplina
              </button>
            </div>
          ) : null}

          <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-200">
            <input
              type="checkbox"
              checked={selectedLesson.included}
              disabled={disabled}
              onChange={event =>
                onUpdateLesson(
                  selectedLesson.id,
                  {
                    included: event.target.checked
                  }
                )
              }
              className="h-4 w-4 accent-cyan-300"
            />
            Incluir esta aula na importação
          </label>
        </div>
      ) : null}

      {selectedDuty ? (
        <div className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-300/[0.045] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">
                Rever cargo
              </p>
              <h3 className="mt-1 text-lg font-black text-white">
                {selectedDuty.name.trim() || 'Cargo importado'}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setSelection(null)}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.05]"
            >
              Fechar
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-bold text-slate-300">
              Dia
              <select
                value={selectedDuty.weekday}
                disabled={disabled || !selectedDuty.included}
                onChange={event =>
                  onUpdateDuty(
                    selectedDuty.id,
                    {
                      weekday:
                        Number(event.target.value) as Weekday
                    }
                  )
                }
                className={`${fieldClassName} mt-1.5`}
              >
                {weekdayLabels.map(day => (
                  <option
                    key={day.value}
                    value={day.value}
                  >
                    {day.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold text-slate-300">
              Início
              <input
                type="time"
                value={selectedDuty.startTime}
                disabled={disabled || !selectedDuty.included}
                onChange={event =>
                  onUpdateDuty(
                    selectedDuty.id,
                    {
                      startTime: event.target.value
                    }
                  )
                }
                className={`${fieldClassName} mt-1.5`}
              />
            </label>

            <label className="text-xs font-bold text-slate-300">
              Fim
              <input
                type="time"
                value={selectedDuty.endTime}
                disabled={disabled || !selectedDuty.included}
                onChange={event =>
                  onUpdateDuty(
                    selectedDuty.id,
                    {
                      endTime: event.target.value
                    }
                  )
                }
                className={`${fieldClassName} mt-1.5`}
              />
            </label>

            <label className="text-xs font-bold text-slate-300">
              Cargo / atividade
              <input
                value={selectedDuty.name}
                disabled={disabled || !selectedDuty.included}
                onChange={event =>
                  onUpdateDuty(
                    selectedDuty.id,
                    {
                      name: event.target.value
                    }
                  )
                }
                className={`${fieldClassName} mt-1.5`}
              />
            </label>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-200">
            <input
              type="checkbox"
              checked={selectedDuty.included}
              disabled={disabled}
              onChange={event =>
                onUpdateDuty(
                  selectedDuty.id,
                  {
                    included: event.target.checked
                  }
                )
              }
              className="h-4 w-4 accent-violet-300"
            />
            Incluir este cargo na importação
          </label>
        </div>
      ) : null}
    </section>
  )
}
