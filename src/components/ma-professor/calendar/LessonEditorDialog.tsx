import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import LessonAssessmentSection from '../assessments/LessonAssessmentSection'

import {
  lessonRepository
} from '../lessons/lessonRepository'

import type {
  EntityId,
  GIAEStatus,
  Lesson,
  LessonStatus,
  SummarySource
} from '../types'

import {
  getCalendarLessonStatusLabel,
  type CalendarLessonEditorContext
} from './calendarWorkspaceRepository'

import LessonAttendanceSection, {
  type LessonAttendanceSectionHandle
} from './LessonAttendanceSection'

interface LessonEditorDialogProps {
  context: CalendarLessonEditorContext
  onClose: () => void
  onSaved: (lesson: Lesson) => void | Promise<void>
}

interface LessonEditorFormState {
  moduleId: EntityId
  status: LessonStatus
  date: string
  startTime: string
  endTime: string
  periodCount: string
  countTowardProgress: boolean
  plannedActivity: string
  summary: string
  summarySource: SummarySource
  planificationItemIds: EntityId[]
  notes: string
  giaeStatus: GIAEStatus
}

const statusOptions: Array<{
  value: LessonStatus
  label: string
  description: string
}> = [
  {
    value: 'planned',
    label: 'Planeada',
    description:
      'A aula mantém-se agendada e ainda não conta como dada.'
  },
  {
    value: 'taught',
    label: 'Dada',
    description:
      'A aula conta para o progresso e exige um sumário.'
  },
  {
    value: 'cancelled',
    label: 'Cancelada',
    description:
      'A aula fica registada, mas não conta para o progresso.'
  }
]

const statusClasses: Record<LessonStatus, string> = {
  planned:
    'border-cyan-300/20 bg-cyan-300/[0.055] text-cyan-50',

  taught:
    'border-emerald-300/20 bg-emerald-300/[0.055] text-emerald-50',

  cancelled:
    'border-rose-300/20 bg-rose-300/[0.055] text-rose-50'
}

const fieldClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60'

const textAreaClassName =
  'w-full resize-y rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60'

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function formatDate(
  value: string
) {
  const [
    year,
    month,
    day
  ] = value
    .split('-')
    .map(Number)

  if (
    !year ||
    !month ||
    !day
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  ).format(
    new Date(
      year,
      month - 1,
      day
    )
  )
}

function getModuleLabel(
  code: string,
  name: string
) {
  return code.trim()
    ? `${code.trim()} · ${name}`
    : name
}

function buildInitialForm(
  context: CalendarLessonEditorContext
): LessonEditorFormState {
  const lesson =
    context.lessonRow.lesson

  return {
    moduleId:
      lesson.moduleId,

    status:
      lesson.status,

    date:
      lesson.date,

    startTime:
      lesson.startTime,

    endTime:
      lesson.endTime,

    periodCount:
      String(
        lesson.periodCount
      ),

    countTowardProgress:
      lesson.countTowardProgress,

    plannedActivity:
      lesson.plannedActivity,

    summary:
      lesson.summary,

    summarySource:
      lesson.summarySource,

    planificationItemIds: [
      ...lesson.planificationItemIds
    ],

    notes:
      lesson.notes,

    giaeStatus:
      lesson.giaeStatus
  }
}

function FieldLabel({
  children,
  optional = false
}: {
  children: string
  optional?: boolean
}) {
  return (
    <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-200">
      <span>
        {children}
      </span>

      {optional ? (
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Opcional
        </span>
      ) : null}
    </span>
  )
}

function WorkspaceSectionHeader({
  eyebrow,
  title,
  description,
  tone = 'cyan'
}: {
  eyebrow: string
  title: string
  description?: string
  tone?: 'cyan' | 'emerald' | 'violet'
}) {
  const eyebrowClass =
    tone === 'emerald'
      ? 'text-emerald-200'
      : tone === 'violet'
        ? 'text-violet-200'
        : 'text-cyan-200'

  return (
    <div>
      <p
        className={`text-xs font-bold uppercase tracking-[0.16em] ${eyebrowClass}`}
      >
        {eyebrow}
      </p>

      <h3 className="mt-2 text-xl font-black text-white">
        {title}
      </h3>

      {description ? (
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
  )
}

function StatusSelector({
  value,
  disabled,
  onChange
}: {
  value: LessonStatus
  disabled: boolean
  onChange: (
    status: LessonStatus
  ) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {statusOptions.map(
        (
          option
        ) => {
          const selected =
            value ===
            option.value

          return (
            <button
              key={
                option.value
              }
              type="button"
              onClick={() =>
                onChange(
                  option.value
                )
              }
              disabled={
                disabled
              }
              className={`rounded-2xl border p-4 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                selected
                  ? statusClasses[
                      option.value
                    ]
                  : 'border-white/10 bg-white/[0.025] text-slate-400 hover:border-white/20 hover:bg-white/[0.045]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    option.value ===
                    'planned'
                      ? 'bg-cyan-300'
                      : option.value ===
                          'taught'
                        ? 'bg-emerald-300'
                        : 'bg-rose-300'
                  }`}
                />

                <span className="text-sm font-black">
                  {
                    option.label
                  }
                </span>
              </div>

              <p className="mt-2 text-xs leading-5 opacity-70">
                {
                  option.description
                }
              </p>
            </button>
          )
        }
      )}
    </div>
  )
}

export default function LessonEditorDialog({
  context,
  onClose,
  onSaved
}: LessonEditorDialogProps) {
  const [
    form,
    setForm
  ] =
    useState<LessonEditorFormState>(
      () =>
        buildInitialForm(
          context
        )
    )

  const [
    saving,
    setSaving
  ] =
    useState(false)

  const [
    error,
    setError
  ] =
    useState('')

  const attendanceSectionRef =
    useRef<LessonAttendanceSectionHandle>(
      null
    )

  const lesson =
    context.lessonRow.lesson

  const subjectLabel =
    context.lessonRow.subject.shortName.trim() ||
    context.lessonRow.subject.name

  const selectedModule =
    useMemo(
      () =>
        context.assignmentModules.find(
          (
            module
          ) =>
            module.id ===
            form.moduleId
        ) ??
        null,
      [
        context.assignmentModules,
        form.moduleId
      ]
    )

  const canUsePlanification =
    Boolean(
      context.nextPlanificationItem &&
      form.moduleId ===
        lesson.moduleId
    )

  const canSubmitToGIAE =
    form.status ===
      'taught' &&
    Boolean(
      form.summary.trim()
    )

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key ===
          'Escape' &&
        !saving
      ) {
        onClose()
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      document.body.style.overflow =
        previousOverflow

      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [
    onClose,
    saving
  ])

  function updateForm<
    Key extends keyof LessonEditorFormState
  >(
    key: Key,
    value: LessonEditorFormState[Key]
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,
        [key]: value
      })
    )
  }

  function handleStatusChange(
    status: LessonStatus
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,

        status,

        countTowardProgress:
          status ===
          'cancelled'
            ? false
            : current.status ===
                'cancelled'
              ? true
              : current.countTowardProgress,

        giaeStatus:
          status ===
          'taught'
            ? current.giaeStatus
            : 'pending'
      })
    )
  }

  function copyPreviousLesson() {
    const previous =
      context.previousLessonTemplate

    if (
      !previous
    ) {
      return
    }

    setForm(
      (
        current
      ) => ({
        ...current,

        plannedActivity:
          previous.plannedActivity,

        summary:
          previous.summary,

        summarySource:
          'manual',

        planificationItemIds:
          [],

        notes:
          previous.notes
      })
    )
  }

  function useNextPlanificationItem() {
    const item =
      context.nextPlanificationItem

    if (
      !item ||
      !canUsePlanification
    ) {
      return
    }

    setForm(
      (
        current
      ) => ({
        ...current,

        plannedActivity:
          item.activity.trim() ||
          item.content.trim(),

        summary:
          item.suggestedSummary.trim() ||
          item.content.trim(),

        summarySource:
          'planification',

        planificationItemIds: [
          item.id
        ]
      })
    )
  }

  function handleSummaryChange(
    event: ChangeEvent<HTMLTextAreaElement>
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,

        summary:
          event.target.value,

        summarySource:
          'manual',

        planificationItemIds:
          []
      })
    )
  }

  function disconnectPlanification() {
    setForm(
      (
        current
      ) => ({
        ...current,

        planificationItemIds:
          [],

        summarySource:
          'manual'
      })
    )
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      saving
    ) {
      return
    }

    const periodCount =
      Number(
        form.periodCount
      )

    if (
      !Number.isInteger(
        periodCount
      ) ||
      periodCount <=
        0
    ) {
      setError(
        'O número de tempos deve ser um número inteiro superior a zero.'
      )

      return
    }

    if (
      form.status ===
        'taught' &&
      !form.summary.trim()
    ) {
      setError(
        'Indique o sumário antes de marcar a aula como dada.'
      )

      return
    }

    setSaving(true)
    setError('')

    try {
      let updated =
        await lessonRepository.updateLesson(
          lesson.id,
          {
            moduleId:
              form.moduleId,

            status:
              form.status,

            date:
              form.date,

            startTime:
              form.startTime,

            endTime:
              form.endTime,

            periodCount,

            countTowardProgress:
              form.status ===
              'cancelled'
                ? false
                : form.countTowardProgress,

            plannedActivity:
              form.plannedActivity,

            summary:
              form.summary,

            summarySource:
              form.summarySource,

            planificationItemIds:
              form.planificationItemIds,

            notes:
              form.notes
          }
        )

      if (
        form.giaeStatus ===
          'submitted' &&
        updated.status ===
          'taught' &&
        updated.summary.trim() &&
        updated.giaeStatus !==
          'submitted'
      ) {
        updated =
          await lessonRepository.markGIAESubmitted(
            updated.id
          )
      }

      if (
        form.giaeStatus ===
          'pending' &&
        updated.giaeStatus ===
          'submitted'
      ) {
        updated =
          await lessonRepository.markGIAEPending(
            updated.id
          )
      }

      if (
        updated.status ===
        'taught'
      ) {
        const attendanceSection =
          attendanceSectionRef.current

        if (
          !attendanceSection
        ) {
          throw new Error(
            'Não foi possível preparar a assiduidade desta aula.'
          )
        }

        await attendanceSection.saveAttendance(
          updated
        )
      }

      await onSaved(
        updated
      )
    } catch (
      saveError
    ) {
      setError(
        getErrorMessage(
          saveError
        )
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(
        event: MouseEvent<HTMLDivElement>
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !saving
        ) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-editor-title"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950 shadow-2xl shadow-black/60"
      >
        <header className="shrink-0 border-b border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[110rem] items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-cyan-100">
                  {
                    context
                      .lessonRow
                      .group
                      .name
                  }
                </span>

                <span
                  className={`rounded-full border px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] ${
                    statusClasses[
                      form.status
                    ]
                  }`}
                >
                  {getCalendarLessonStatusLabel(
                    form.status
                  )}
                </span>

                {lesson.origin ===
                'extra' ? (
                  <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-violet-100">
                    Aula extra
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-col gap-1 lg:flex-row lg:items-end lg:gap-4">
                <h2
                  id="lesson-editor-title"
                  className="truncate text-2xl font-black text-white sm:text-3xl"
                >
                  {subjectLabel}
                </h2>

                <p className="text-sm capitalize leading-6 text-slate-400">
                  {formatDate(
                    form.date
                  )}{' '}
                  ·{' '}
                  {
                    form.startTime
                  }
                  –
                  {
                    form.endTime
                  }
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={
                onClose
              }
              disabled={
                saving
              }
              aria-label="Fechar edição da aula"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl font-black text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </header>

        <form
          onSubmit={
            handleSubmit
          }
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto grid w-full max-w-[110rem] gap-5 px-4 py-5 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(40rem,1.1fr)] xl:items-start">
              <div className="space-y-5">
                <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                  <WorkspaceSectionHeader
                    eyebrow="Aula do dia"
                    title="Estado, data e horário"
                    description="Confirme a aula e altere apenas o que for necessário."
                  />

                  <div className="mt-5">
                    <StatusSelector
                      value={
                        form.status
                      }
                      disabled={
                        saving
                      }
                      onChange={
                        handleStatusChange
                      }
                    />
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="block sm:col-span-2 xl:col-span-1">
                      <FieldLabel>
                        Data
                      </FieldLabel>

                      <input
                        type="date"
                        value={
                          form.date
                        }
                        onChange={(
                          event: ChangeEvent<HTMLInputElement>
                        ) =>
                          updateForm(
                            'date',
                            event.target.value
                          )
                        }
                        disabled={
                          saving
                        }
                        required
                        className={
                          fieldClassName
                        }
                      />
                    </label>

                    <label className="block">
                      <FieldLabel>
                        Início
                      </FieldLabel>

                      <input
                        type="time"
                        value={
                          form.startTime
                        }
                        onChange={(
                          event: ChangeEvent<HTMLInputElement>
                        ) =>
                          updateForm(
                            'startTime',
                            event.target.value
                          )
                        }
                        disabled={
                          saving
                        }
                        required
                        className={
                          fieldClassName
                        }
                      />
                    </label>

                    <label className="block">
                      <FieldLabel>
                        Fim
                      </FieldLabel>

                      <input
                        type="time"
                        value={
                          form.endTime
                        }
                        onChange={(
                          event: ChangeEvent<HTMLInputElement>
                        ) =>
                          updateForm(
                            'endTime',
                            event.target.value
                          )
                        }
                        disabled={
                          saving
                        }
                        required
                        className={
                          fieldClassName
                        }
                      />
                    </label>

                    <label className="block">
                      <FieldLabel>
                        Tempos
                      </FieldLabel>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={
                          form.periodCount
                        }
                        onChange={(
                          event: ChangeEvent<HTMLInputElement>
                        ) =>
                          updateForm(
                            'periodCount',
                            event.target.value
                          )
                        }
                        disabled={
                          saving
                        }
                        required
                        className={
                          fieldClassName
                        }
                      />
                    </label>
                  </div>

                  <label className="mt-5 block">
                    <FieldLabel>
                      UFCD ou módulo
                    </FieldLabel>

                    <select
                      value={
                        form.moduleId
                      }
                      onChange={(
                        event: ChangeEvent<HTMLSelectElement>
                      ) => {
                        const moduleId =
                          event.target.value

                        setForm(
                          (
                            current
                          ) => ({
                            ...current,

                            moduleId,

                            planificationItemIds:
                              [],

                            summarySource:
                              current.summarySource ===
                              'planification'
                                ? 'manual'
                                : current.summarySource
                          })
                        )
                      }}
                      disabled={
                        saving
                      }
                      className={
                        fieldClassName
                      }
                    >
                      {context.assignmentModules.map(
                        (
                          module
                        ) => (
                          <option
                            key={
                              module.id
                            }
                            value={
                              module.id
                            }
                          >
                            {getModuleLabel(
                              module.code,
                              module.name
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/55 p-4">
                    <input
                      type="checkbox"
                      checked={
                        form.countTowardProgress
                      }
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>
                      ) =>
                        updateForm(
                          'countTowardProgress',
                          event.target.checked
                        )
                      }
                      disabled={
                        saving ||
                        form.status ===
                          'cancelled'
                      }
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30 disabled:opacity-40"
                    />

                    <span>
                      <span className="block text-sm font-black text-white">
                        Contabilizar no progresso da UFCD
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Desative apenas quando a aula não deve aumentar os tempos dados.
                      </span>
                    </span>
                  </label>
                </section>

                <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <article className="rounded-[1.5rem] border border-cyan-300/15 bg-cyan-300/[0.035] p-5 sm:p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                      Próximo da planificação
                    </p>

                    {context.nextPlanificationItem ? (
                      <>
                        <p className="mt-4 text-sm font-black leading-6 text-white">
                          {
                            context
                              .nextPlanificationItem
                              .content
                          }
                        </p>

                        {context.nextPlanificationItem.activity ? (
                          <p className="mt-2 text-xs leading-5 text-slate-400">
                            {
                              context
                                .nextPlanificationItem
                                .activity
                            }
                          </p>
                        ) : null}

                        <button
                          type="button"
                          onClick={
                            useNextPlanificationItem
                          }
                          disabled={
                            saving ||
                            !canUsePlanification
                          }
                          className="mt-5 w-full rounded-xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Usar próximo item
                        </button>

                        {!canUsePlanification ? (
                          <p className="mt-3 text-xs leading-5 text-amber-200/80">
                            Volte à UFCD original da aula para utilizar esta sugestão.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-slate-400">
                        Não existe um próximo item disponível na planificação desta UFCD.
                      </p>
                    )}
                  </article>

                  <article className="rounded-[1.5rem] border border-violet-300/15 bg-violet-300/[0.035] p-5 sm:p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                      Aula anterior
                    </p>

                    {context.previousLessonTemplate ? (
                      <>
                        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">
                          {context.previousLessonTemplate.summary ||
                            context.previousLessonTemplate
                              .plannedActivity ||
                            'A aula anterior não possui texto.'}
                        </p>

                        <button
                          type="button"
                          onClick={
                            copyPreviousLesson
                          }
                          disabled={
                            saving
                          }
                          className="mt-5 w-full rounded-xl border border-violet-200/25 bg-violet-300/10 px-4 py-3 text-sm font-black text-violet-50 transition hover:bg-violet-300/15 disabled:cursor-wait disabled:opacity-60"
                        >
                          Copiar aula anterior
                        </button>
                      </>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-slate-400">
                        Ainda não existe uma aula anterior desta turma e disciplina.
                      </p>
                    )}
                  </article>
                </section>

                <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                  <WorkspaceSectionHeader
                    eyebrow="Registo pedagógico"
                    title="Atividade e sumário"
                    description="O sumário fica pronto para copiar para o GIAE. As notas privadas não são incluídas."
                  />

                  <div className="mt-5 space-y-5">
                    <label className="block">
                      <FieldLabel optional>
                        Atividade prevista
                      </FieldLabel>

                      <textarea
                        value={
                          form.plannedActivity
                        }
                        onChange={(
                          event: ChangeEvent<HTMLTextAreaElement>
                        ) =>
                          updateForm(
                            'plannedActivity',
                            event.target.value
                          )
                        }
                        disabled={
                          saving
                        }
                        rows={
                          3
                        }
                        placeholder="Conteúdos, atividade ou trabalho previsto para a aula."
                        className={
                          textAreaClassName
                        }
                      />
                    </label>

                    <label className="block">
                      <FieldLabel
                        optional={
                          form.status !==
                          'taught'
                        }
                      >
                        Sumário
                      </FieldLabel>

                      <textarea
                        value={
                          form.summary
                        }
                        onChange={
                          handleSummaryChange
                        }
                        disabled={
                          saving
                        }
                        rows={
                          5
                        }
                        placeholder="Escreva o sumário que será registado no GIAE."
                        className={
                          textAreaClassName
                        }
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-slate-400">
                        Origem:{' '}
                        {form.summarySource ===
                        'planification'
                          ? 'planificação'
                          : form.summarySource ===
                              'ai'
                            ? 'inteligência artificial'
                            : 'manual'}
                      </span>

                      {form.planificationItemIds.length >
                      0 ? (
                        <button
                          type="button"
                          onClick={
                            disconnectPlanification
                          }
                          disabled={
                            saving
                          }
                          className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 font-bold text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-wait disabled:opacity-60"
                        >
                          Desligar da planificação
                        </button>
                      ) : null}
                    </div>

                    <label className="block">
                      <FieldLabel optional>
                        Notas privadas
                      </FieldLabel>

                      <textarea
                        value={
                          form.notes
                        }
                        onChange={(
                          event: ChangeEvent<HTMLTextAreaElement>
                        ) =>
                          updateForm(
                            'notes',
                            event.target.value
                          )
                        }
                        disabled={
                          saving
                        }
                        rows={
                          3
                        }
                        placeholder="Observações que não serão incluídas no sumário."
                        className={
                          textAreaClassName
                        }
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-violet-300/15 bg-violet-300/[0.035] p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                        Registo no GIAE
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Marque como submetido apenas depois de copiar o sumário para o GIAE.
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                        form.giaeStatus ===
                        'submitted'
                          ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                          : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                      }`}
                    >
                      {form.giaeStatus ===
                      'submitted'
                        ? 'Submetido'
                        : 'Pendente'}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateForm(
                          'giaeStatus',
                          'pending'
                        )
                      }
                      disabled={
                        saving
                      }
                      className={`rounded-xl border px-4 py-3 text-sm font-black transition disabled:cursor-wait disabled:opacity-60 ${
                        form.giaeStatus ===
                        'pending'
                          ? 'border-amber-300/25 bg-amber-300/10 text-amber-50'
                          : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]'
                      }`}
                    >
                      Manter pendente
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateForm(
                          'giaeStatus',
                          'submitted'
                        )
                      }
                      disabled={
                        saving ||
                        !canSubmitToGIAE
                      }
                      className={`rounded-xl border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        form.giaeStatus ===
                        'submitted'
                          ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50'
                          : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]'
                      }`}
                    >
                      Marcar como submetido
                    </button>
                  </div>

                  {!canSubmitToGIAE ? (
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Para submeter no GIAE, marque a aula como dada e preencha o sumário.
                    </p>
                  ) : null}
                </section>
              </div>

              <div className="space-y-5">
                <section className="rounded-[1.5rem] border border-emerald-300/15 bg-emerald-300/[0.025] p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <WorkspaceSectionHeader
                      eyebrow="Turma"
                      title="Alunos, faltas e avaliações"
                      description="Registe a assiduidade e a avaliação desta aula sem sair deste ecrã."
                      tone="emerald"
                    />

                    <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-right">
                      <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
                        Turma
                      </p>

                      <p className="mt-1 text-sm font-black text-white">
                        {
                          context
                            .lessonRow
                            .group
                            .name
                        }
                      </p>
                    </div>
                  </div>
                </section>

                {form.status ===
                'taught' ? (
                  <>
                    <LessonAttendanceSection
                      ref={
                        attendanceSectionRef
                      }
                      lessonId={
                        lesson.id
                      }
                      disabled={
                        saving
                      }
                    />

                    <LessonAssessmentSection
                      lessonId={
                        lesson.id
                      }
                      disabled={
                        saving
                      }
                    />
                  </>
                ) : (
                  <section className="rounded-[1.5rem] border border-dashed border-amber-300/25 bg-amber-300/[0.045] p-6 sm:p-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-xl font-black text-amber-100">
                      !
                    </div>

                    <h3 className="mt-5 text-xl font-black text-white">
                      Marque a aula como dada
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-slate-400">
                      A lista de alunos, o registo de faltas e as avaliações ficam disponíveis assim que selecionar o estado{' '}
                      <strong className="text-amber-100">
                        Dada
                      </strong>
                      .
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        handleStatusChange(
                          'taught'
                        )
                      }
                      disabled={
                        saving
                      }
                      className="mt-6 rounded-2xl border border-emerald-200/30 bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                    >
                      Marcar como dada
                    </button>
                  </section>
                )}

                {error ? (
                  <div
                    role="alert"
                    className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
                  >
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <footer className="shrink-0 border-t border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[110rem] flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">
                {selectedModule
                  ? getModuleLabel(
                      selectedModule.code,
                      selectedModule.name
                    )
                  : 'Selecione uma UFCD válida.'}
              </p>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={
                    onClose
                  }
                  disabled={
                    saving
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-50"
                >
                  Fechar
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving
                    ? 'A guardar...'
                    : 'Guardar aula completa'}
                </button>
              </div>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}
