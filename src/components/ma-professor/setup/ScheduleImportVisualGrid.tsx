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

export type ScheduleImportUnresolvedDraft = {
  id: string
  weekday: Weekday
  startTime: string
  endTime: string
  periodCount: number
  rawText: string
  reason: string
}

export type ScheduleImportTimeRow = {
  startTime: string
  endTime: string
}

type Props = {
  lessons: ScheduleImportLessonDraft[]
  duties: ScheduleImportDutyDraft[]
  unresolved: ScheduleImportUnresolvedDraft[]
  sourceTimeRows?: ScheduleImportTimeRow[]
  disabled?: boolean
  onUpdateLesson: (
    id: string,
    changes: Partial<ScheduleImportLessonDraft>
  ) => void
  onUpdateDuty: (
    id: string,
    changes: Partial<ScheduleImportDutyDraft>
  ) => void
  onLessonAsDuty: (id: string) => void
  onDutyAsLesson: (id: string) => void
  onUnresolvedAsLesson: (id: string) => void
  onUnresolvedAsDuty: (id: string) => void
  onIgnoreUnresolved: (id: string) => void
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
  | {
      kind: 'unresolved'
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
  'w-full rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-50'

function timeValue(value: string) {
  const [hours, minutes] =
    value.split(':').map(Number)

  return (
    (Number.isFinite(hours) ? hours : 0) * 60 +
    (Number.isFinite(minutes) ? minutes : 0)
  )
}

function timeRows(
  sourceTimeRows: ScheduleImportTimeRow[],
  lessons: ScheduleImportLessonDraft[],
  duties: ScheduleImportDutyDraft[],
  unresolved: ScheduleImportUnresolvedDraft[]
): TimeRow[] {
  const rows = new Map<string, TimeRow>()

  for (const item of [
    ...sourceTimeRows,
    ...lessons,
    ...duties,
    ...unresolved
  ]) {
    const startTime = item.startTime.trim()
    const endTime = item.endTime.trim()

    if (!startTime || !endTime) continue

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
  duties: ScheduleImportDutyDraft[],
  unresolved: ScheduleImportUnresolvedDraft[]
) {
  const hasWeekend = [
    ...lessons,
    ...duties,
    ...unresolved
  ].some(
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

function TypeSwitch({
  value,
  disabled,
  onTeaching,
  onDuty
}: {
  value: 'teaching' | 'duty' | 'unknown'
  disabled: boolean
  onTeaching: () => void
  onDuty: () => void
}) {
  return (
    <div
      className="mt-2 grid grid-cols-2 overflow-hidden rounded-lg border border-white/10 bg-slate-950/55"
      aria-label="Tipo do bloco"
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === 'teaching'}
        onClick={event => {
          event.stopPropagation()
          onTeaching()
        }}
        className={`px-2 py-1.5 text-[10px] font-black leading-4 transition disabled:cursor-not-allowed disabled:opacity-50 ${
          value === 'teaching'
            ? 'bg-cyan-300/18 text-cyan-50'
            : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        Componente letiva
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === 'duty'}
        onClick={event => {
          event.stopPropagation()
          onDuty()
        }}
        className={`border-l border-white/10 px-2 py-1.5 text-[10px] font-black leading-4 transition disabled:cursor-not-allowed disabled:opacity-50 ${
          value === 'duty'
            ? 'bg-violet-300/18 text-violet-50'
            : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        Cargo
      </button>
    </div>
  )
}

export default function ScheduleImportVisualGrid({
  lessons,
  duties,
  unresolved,
  sourceTimeRows = [],
  disabled = false,
  onUpdateLesson,
  onUpdateDuty,
  onLessonAsDuty,
  onDutyAsLesson,
  onUnresolvedAsLesson,
  onUnresolvedAsDuty,
  onIgnoreUnresolved
}: Props) {
  const [selection, setSelection] =
    useState<Selection>(null)

  const rows = useMemo(
    () => timeRows(
      sourceTimeRows,
      lessons,
      duties,
      unresolved
    ),
    [sourceTimeRows, lessons, duties, unresolved]
  )

  const days = useMemo(
    () => visibleWeekdays(
      lessons,
      duties,
      unresolved
    ),
    [lessons, duties, unresolved]
  )

  const selected = (
    kind: Exclude<Selection, null>['kind'],
    id: string
  ) =>
    selection?.kind === kind &&
    selection.id === id

  function toggleSelection(
    kind: Exclude<Selection, null>['kind'],
    id: string
  ) {
    setSelection(current =>
      current?.kind === kind && current.id === id
        ? null
        : { kind, id }
    )
  }

  function lessonEditor(
    lesson: ScheduleImportLessonDraft
  ) {
    if (!selected('lesson', lesson.id)) return null

    return (
      <div
        className="schedule-import-inline-editor mt-3 space-y-2 border-t border-white/10 pt-3"
        onClick={event => event.stopPropagation()}
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] font-bold text-slate-400">
            Dia
            <select
              value={lesson.weekday}
              disabled={disabled || !lesson.included}
              onChange={event =>
                onUpdateLesson(lesson.id, {
                  weekday: Number(event.target.value) as Weekday
                })
              }
              className={`${fieldClassName} mt-1`}
            >
              {weekdayLabels.map(day => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[10px] font-bold text-slate-400">
            Tempos
            <input
              type="number"
              min={1}
              max={12}
              value={lesson.periodCount}
              disabled={disabled || !lesson.included}
              onChange={event =>
                onUpdateLesson(lesson.id, {
                  periodCount: Math.max(
                    1,
                    Number(event.target.value) || 1
                  )
                })
              }
              className={`${fieldClassName} mt-1`}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] font-bold text-slate-400">
            Início
            <input
              type="time"
              value={lesson.startTime}
              disabled={disabled || !lesson.included}
              onChange={event =>
                onUpdateLesson(lesson.id, {
                  startTime: event.target.value
                })
              }
              className={`${fieldClassName} mt-1`}
            />
          </label>

          <label className="text-[10px] font-bold text-slate-400">
            Fim
            <input
              type="time"
              value={lesson.endTime}
              disabled={disabled || !lesson.included}
              onChange={event =>
                onUpdateLesson(lesson.id, {
                  endTime: event.target.value
                })
              }
              className={`${fieldClassName} mt-1`}
            />
          </label>
        </div>

        <label className="block text-[10px] font-bold text-slate-400">
          Turma
          <input
            value={lesson.groupName}
            disabled={disabled || !lesson.included}
            onChange={event =>
              onUpdateLesson(lesson.id, {
                groupName: event.target.value
              })
            }
            className={`${fieldClassName} mt-1`}
          />
        </label>

        <label className="block text-[10px] font-bold text-slate-400">
          Disciplina
          <input
            value={lesson.subjectName}
            disabled={disabled || !lesson.included}
            onChange={event =>
              onUpdateLesson(lesson.id, {
                subjectName: event.target.value,
                subjectConfirmed: false
              })
            }
            className={`${fieldClassName} mt-1`}
          />
        </label>

        <label className="block text-[10px] font-bold text-slate-400">
          Curso
          <input
            value={lesson.courseName ?? ''}
            disabled={disabled || !lesson.included}
            onChange={event =>
              onUpdateLesson(lesson.id, {
                courseName: event.target.value
              })
            }
            placeholder="Curso, quando aplicável"
            className={`${fieldClassName} mt-1`}
          />
        </label>

        {!lesson.subjectConfirmed ? (
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-2.5 text-[11px] leading-5 text-amber-100">
            <p className="font-bold">
              Disciplina por confirmar.
            </p>
            <p className="mt-1 text-amber-100/70">
              Confirme apenas depois de verificar que o texto corresponde realmente à disciplina.
            </p>
            <button
              type="button"
              disabled={
                disabled ||
                !lesson.included ||
                !lesson.subjectName.trim()
              }
              onClick={() =>
                onUpdateLesson(lesson.id, {
                  subjectConfirmed: true
                })
              }
              className="mt-2 rounded-lg border border-amber-200/25 bg-amber-200/[0.08] px-2.5 py-1.5 text-[10px] font-black text-amber-50 disabled:opacity-50"
            >
              Confirmar como disciplina
            </button>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
          <input
            type="checkbox"
            checked={lesson.included}
            disabled={disabled}
            onChange={event =>
              onUpdateLesson(lesson.id, {
                included: event.target.checked
              })
            }
            className="h-4 w-4 accent-cyan-300"
          />
          Incluir este bloco
        </label>
      </div>
    )
  }

  function dutyEditor(
    duty: ScheduleImportDutyDraft
  ) {
    if (!selected('duty', duty.id)) return null

    return (
      <div
        className="schedule-import-inline-editor mt-3 space-y-2 border-t border-white/10 pt-3"
        onClick={event => event.stopPropagation()}
      >
        <label className="block text-[10px] font-bold text-slate-400">
          Cargo / atividade
          <input
            value={duty.name}
            disabled={disabled || !duty.included}
            onChange={event =>
              onUpdateDuty(duty.id, {
                name: event.target.value
              })
            }
            className={`${fieldClassName} mt-1`}
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          <label className="text-[10px] font-bold text-slate-400">
            Dia
            <select
              value={duty.weekday}
              disabled={disabled || !duty.included}
              onChange={event =>
                onUpdateDuty(duty.id, {
                  weekday: Number(event.target.value) as Weekday
                })
              }
              className={`${fieldClassName} mt-1`}
            >
              {weekdayLabels.map(day => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[10px] font-bold text-slate-400">
            Início
            <input
              type="time"
              value={duty.startTime}
              disabled={disabled || !duty.included}
              onChange={event =>
                onUpdateDuty(duty.id, {
                  startTime: event.target.value
                })
              }
              className={`${fieldClassName} mt-1`}
            />
          </label>

          <label className="text-[10px] font-bold text-slate-400">
            Fim
            <input
              type="time"
              value={duty.endTime}
              disabled={disabled || !duty.included}
              onChange={event =>
                onUpdateDuty(duty.id, {
                  endTime: event.target.value
                })
              }
              className={`${fieldClassName} mt-1`}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
          <input
            type="checkbox"
            checked={duty.included}
            disabled={disabled}
            onChange={event =>
              onUpdateDuty(duty.id, {
                included: event.target.checked
              })
            }
            className="h-4 w-4 accent-violet-300"
          />
          Incluir este bloco
        </label>
      </div>
    )
  }

  return (
    <section
      aria-label="Revisão visual do horário importado"
      className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">
            Vista semanal
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            Compare com o PDF e edite diretamente cada célula. O sistema propõe Componente letiva ou Cargo, mas a decisão pode ser corrigida antes de confirmar.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-cyan-100">
            Componente letiva
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
          Ainda não existem linhas horárias para apresentar.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <div
            className="min-w-[920px] bg-slate-950/35"
            style={{
              display: 'grid',
              gridTemplateColumns:
                `minmax(6.75rem, .62fr) repeat(${days.length}, minmax(11rem, 1fr))`
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
                    {row.endTime}
                  </span>
                </div>
              ]

              for (const day of days) {
                const cellLessons = lessons.filter(
                  lesson => sameSlot(lesson, day.value, row)
                )
                const cellDuties = duties.filter(
                  duty => sameSlot(duty, day.value, row)
                )
                const cellUnresolved = unresolved.filter(
                  block => sameSlot(block, day.value, row)
                )

                rowCells.push(
                  <div
                    key={`cell-${row.key}-${day.value}`}
                    data-schedule-cell={`${day.value}-${row.key}`}
                    className="min-h-24 border-b border-r border-white/10 p-2 last:border-r-0"
                  >
                    <div className="space-y-2">
                      {cellLessons.map(lesson => (
                        <article
                          key={lesson.id}
                          data-schedule-block={lesson.id}
                          className={`rounded-xl border p-2.5 transition ${
                            lesson.subjectConfirmed
                              ? 'border-cyan-300/20 bg-cyan-300/[0.07]'
                              : 'border-amber-300/30 bg-amber-300/[0.08]'
                          } ${lesson.included ? '' : 'opacity-45'}`}
                        >
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleSelection('lesson', lesson.id)}
                            className="w-full text-left disabled:cursor-not-allowed"
                            aria-expanded={selected('lesson', lesson.id)}
                          >
                            <span className="block text-xs font-black leading-5 text-white">
                              {lesson.subjectName.trim() || 'Disciplina por indicar'}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-bold text-slate-300">
                              {lesson.groupName.trim() || 'Turma por indicar'}
                            </span>
                            {lesson.courseName?.trim() ? (
                              <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                                {lesson.courseName}
                              </span>
                            ) : null}
                            {!lesson.subjectConfirmed ? (
                              <span className="mt-1.5 block text-[10px] font-bold text-amber-200">
                                Disciplina por confirmar
                              </span>
                            ) : null}
                          </button>

                          <TypeSwitch
                            value="teaching"
                            disabled={disabled}
                            onTeaching={() => undefined}
                            onDuty={() => {
                              onLessonAsDuty(lesson.id)
                              setSelection({ kind: 'duty', id: lesson.id })
                            }}
                          />

                          {lessonEditor(lesson)}
                        </article>
                      ))}

                      {cellDuties.map(duty => (
                        <article
                          key={duty.id}
                          data-schedule-block={duty.id}
                          className={`rounded-xl border border-violet-300/20 bg-violet-300/[0.07] p-2.5 transition ${
                            duty.included ? '' : 'opacity-45'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleSelection('duty', duty.id)}
                            className="w-full text-left disabled:cursor-not-allowed"
                            aria-expanded={selected('duty', duty.id)}
                          >
                            <span className="block text-xs font-black leading-5 text-white">
                              {duty.name.trim() || 'Cargo por indicar'}
                            </span>
                          </button>

                          <TypeSwitch
                            value="duty"
                            disabled={disabled}
                            onTeaching={() => {
                              onDutyAsLesson(duty.id)
                              setSelection({ kind: 'lesson', id: duty.id })
                            }}
                            onDuty={() => undefined}
                          />

                          {dutyEditor(duty)}
                        </article>
                      ))}

                      {cellUnresolved.map(block => (
                        <article
                          key={block.id}
                          data-schedule-block={block.id}
                          className="rounded-xl border border-amber-300/30 bg-amber-300/[0.08] p-2.5"
                        >
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleSelection('unresolved', block.id)}
                            className="w-full text-left disabled:cursor-not-allowed"
                            aria-expanded={selected('unresolved', block.id)}
                          >
                            <span className="block text-xs font-black leading-5 text-white">
                              {block.rawText}
                            </span>
                            <span className="mt-1 block text-[10px] font-bold text-amber-200">
                              Escolha o tipo
                            </span>
                          </button>

                          <TypeSwitch
                            value="unknown"
                            disabled={disabled}
                            onTeaching={() => {
                              onUnresolvedAsLesson(block.id)
                              setSelection({ kind: 'lesson', id: block.id })
                            }}
                            onDuty={() => {
                              onUnresolvedAsDuty(block.id)
                              setSelection({ kind: 'duty', id: block.id })
                            }}
                          />

                          {selected('unresolved', block.id) ? (
                            <div
                              className="schedule-import-inline-editor mt-3 border-t border-white/10 pt-3"
                              onClick={event => event.stopPropagation()}
                            >
                              <p className="text-[10px] leading-4 text-amber-100/70">
                                {block.reason}
                              </p>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  onIgnoreUnresolved(block.id)
                                  setSelection(null)
                                }}
                                className="mt-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-bold text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                              >
                                Ignorar este bloco
                              </button>
                            </div>
                          ) : null}
                        </article>
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
    </section>
  )
}
