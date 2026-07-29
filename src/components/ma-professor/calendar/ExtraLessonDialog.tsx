import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  EntityId,
  GIAEStatus,
  Lesson,
  LessonStatus,
  PlanificationItem,
  SummarySource,
  WeeklyScheduleSlot
} from '../types'

import {
  extraLessonRepository,
  type ExtraLessonCreateContext,
  type ExtraLessonSelectionContext
} from './extraLessonRepository'

type ExtraLessonDialogProps = {
  context: ExtraLessonCreateContext
  onClose: () => void
  onCreated: (lesson: Lesson) => void | Promise<void>
}

type ExtraLessonFormState = {
  teachingAssignmentId: EntityId
  moduleId: EntityId
  date: string
  startTime: string
  endTime: string
  periodCount: string
  status: LessonStatus
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
    description: 'Fica no calendário para ser preenchida depois.'
  },
  {
    value: 'taught',
    label: 'Dada',
    description: 'Conta para o progresso e exige um sumário.'
  },
  {
    value: 'cancelled',
    label: 'Cancelada',
    description: 'Fica registada, mas não conta como tempo dado.'
  }
]

const statusClasses: Record<LessonStatus, string> = {
  planned: 'border-cyan-300/25 bg-cyan-300/[0.07] text-cyan-50',
  taught: 'border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-50',
  cancelled: 'border-rose-300/25 bg-rose-300/[0.07] text-rose-50'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(year, month - 1, day))
}

function getModuleLabel(code: string, name: string) {
  return code.trim() ? `${code.trim()} · ${name}` : name
}

function buildInitialForm(
  context: ExtraLessonCreateContext
): ExtraLessonFormState {
  return {
    teachingAssignmentId: context.defaultTeachingAssignmentId ?? '',
    moduleId: context.defaultModuleId ?? '',
    date: context.date,
    startTime: '09:00',
    endTime: '10:00',
    periodCount: '1',
    status: 'planned',
    countTowardProgress: true,
    plannedActivity: '',
    summary: '',
    summarySource: 'manual',
    planificationItemIds: [],
    notes: '',
    giaeStatus: 'pending'
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
      <span>{children}</span>

      {optional ? (
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Opcional
        </span>
      ) : null}
    </span>
  )
}

function StatusSelector({
  value,
  disabled,
  onChange
}: {
  value: LessonStatus
  disabled: boolean
  onChange: (status: LessonStatus) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {statusOptions.map((option) => {
        const selected = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`rounded-2xl border p-4 text-left transition disabled:cursor-wait disabled:opacity-60 ${
              selected
                ? statusClasses[option.value]
                : 'border-white/10 bg-white/[0.025] text-slate-400 hover:border-white/20 hover:bg-white/[0.045]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  option.value === 'planned'
                    ? 'bg-cyan-300'
                    : option.value === 'taught'
                      ? 'bg-emerald-300'
                      : 'bg-rose-300'
                }`}
              />

              <span className="text-sm font-black">{option.label}</span>
            </div>

            <p className="mt-2 text-xs leading-5 opacity-70">
              {option.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}

function ScheduleSlotButton({
  slot,
  selected,
  disabled,
  onSelect
}: {
  slot: WeeklyScheduleSlot
  selected: boolean
  disabled: boolean
  onSelect: (slot: WeeklyScheduleSlot) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      disabled={disabled}
      className={`rounded-xl border px-4 py-3 text-left transition disabled:cursor-wait disabled:opacity-60 ${
        selected
          ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-50'
          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/20 hover:bg-cyan-300/[0.05]'
      }`}
    >
      <span className="block text-sm font-black">
        {slot.startTime}–{slot.endTime}
      </span>

      <span className="mt-1 block text-xs text-slate-500">
        {slot.periodCount} {slot.periodCount === 1 ? 'tempo' : 'tempos'}
      </span>
    </button>
  )
}

function EmptyConfiguration({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-lesson-empty-title"
        className="w-full max-w-xl rounded-t-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/60 sm:rounded-[2rem] sm:p-8"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-2xl font-black text-amber-100">
          !
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
          Configuração incompleta
        </p>

        <h2
          id="extra-lesson-empty-title"
          className="mt-3 text-2xl font-black text-white"
        >
          Não é possível criar uma aula extra.
        </h2>

        <p className="mt-4 text-sm leading-7 text-slate-400">
          É necessário existir pelo menos uma turma, disciplina e UFCD ativas no ano letivo.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.09]"
        >
          Fechar
        </button>
      </section>
    </div>
  )
}

export default function ExtraLessonDialog({
  context,
  onClose,
  onCreated
}: ExtraLessonDialogProps) {
  const [form, setForm] = useState<ExtraLessonFormState>(() =>
    buildInitialForm(context)
  )

  const [selectionContext, setSelectionContext] =
    useState<ExtraLessonSelectionContext | null>(null)

  const [selectionLoading, setSelectionLoading] = useState(false)
  const [selectionError, setSelectionError] = useState('')

  const [planificationItem, setPlanificationItem] =
    useState<PlanificationItem | null>(null)

  const [planificationLoading, setPlanificationLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedAssignmentOption = useMemo(
    () =>
      context.assignmentOptions.find(
        (option) => option.assignment.id === form.teachingAssignmentId
      ) ?? null,
    [context.assignmentOptions, form.teachingAssignmentId]
  )

  const selectedModule = useMemo(
    () =>
      selectionContext?.modules.find(
        (module) => module.id === form.moduleId
      ) ??
      selectedAssignmentOption?.modules.find(
        (module) => module.id === form.moduleId
      ) ??
      null,
    [form.moduleId, selectedAssignmentOption, selectionContext]
  )

  const matchingScheduleSlots =
    selectionContext?.matchingScheduleSlots ?? []

  const canSubmitToGIAE =
    form.status === 'taught' && Boolean(form.summary.trim())

  const busy = saving || selectionLoading

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, saving])

  useEffect(() => {
    let cancelled = false

    if (
      !form.teachingAssignmentId ||
      !form.date ||
      !isValidTime(form.startTime)
    ) {
      setSelectionContext(null)
      setSelectionError('')
      setSelectionLoading(false)

      return () => {
        cancelled = true
      }
    }

    setSelectionLoading(true)
    setSelectionError('')

    async function loadSelectionContext() {
      try {
        const nextContext =
          await extraLessonRepository.getSelectionContext(
            form.teachingAssignmentId,
            form.date,
            form.startTime
          )

        if (cancelled) {
          return
        }

        setSelectionContext(nextContext)

        setForm((current) => {
          const currentModuleStillExists = nextContext.modules.some(
            (module) => module.id === current.moduleId
          )

          if (currentModuleStillExists) {
            return current
          }

          return {
            ...current,
            moduleId:
              nextContext.suggestedModule?.id ??
              nextContext.modules[0]?.id ??
              '',
            summarySource: 'manual',
            planificationItemIds: []
          }
        })
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setSelectionContext(null)
        setSelectionError(getErrorMessage(loadError))
      } finally {
        if (!cancelled) {
          setSelectionLoading(false)
        }
      }
    }

    void loadSelectionContext()

    return () => {
      cancelled = true
    }
  }, [form.date, form.startTime, form.teachingAssignmentId])

  useEffect(() => {
    let cancelled = false

    if (!form.moduleId) {
      setPlanificationItem(null)
      setPlanificationLoading(false)

      return () => {
        cancelled = true
      }
    }

    setPlanificationLoading(true)

    async function loadPlanificationItem() {
      try {
        const item =
          await extraLessonRepository.getModulePlanificationItem(
            form.moduleId
          )

        if (!cancelled) {
          setPlanificationItem(item)
        }
      } catch {
        if (!cancelled) {
          setPlanificationItem(null)
        }
      } finally {
        if (!cancelled) {
          setPlanificationLoading(false)
        }
      }
    }

    void loadPlanificationItem()

    return () => {
      cancelled = true
    }
  }, [form.moduleId])

  function updateForm<Key extends keyof ExtraLessonFormState>(
    key: Key,
    value: ExtraLessonFormState[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value
    }))
  }

  function handleAssignmentChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    setForm((current) => ({
      ...current,
      teachingAssignmentId: event.target.value,
      moduleId: '',
      summarySource: 'manual',
      planificationItemIds: []
    }))
  }

  function handleStatusChange(status: LessonStatus) {
    setForm((current) => ({
      ...current,
      status,
      countTowardProgress:
        status === 'cancelled'
          ? false
          : current.status === 'cancelled'
            ? true
            : current.countTowardProgress,
      giaeStatus:
        status === 'taught'
          ? current.giaeStatus
          : 'pending'
    }))
  }

  function applyScheduleSlot(slot: WeeklyScheduleSlot) {
    setForm((current) => ({
      ...current,
      startTime: slot.startTime,
      endTime: slot.endTime,
      periodCount: String(slot.periodCount)
    }))
  }

  function copyPreviousLesson() {
    const previous = selectionContext?.previousLessonTemplate

    if (!previous) {
      return
    }

    setForm((current) => ({
      ...current,
      plannedActivity: previous.plannedActivity,
      summary: previous.summary,
      notes: previous.notes,
      summarySource: 'manual',
      planificationItemIds: []
    }))
  }

  function usePlanificationItem() {
    if (!planificationItem) {
      return
    }

    setForm((current) => ({
      ...current,
      plannedActivity:
        planificationItem.activity.trim() ||
        planificationItem.content.trim(),
      summary:
        planificationItem.suggestedSummary.trim() ||
        planificationItem.content.trim(),
      summarySource: 'planification',
      planificationItemIds: [planificationItem.id]
    }))
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    const periodCount = Number(form.periodCount)

    if (!form.teachingAssignmentId) {
      setError('Selecione uma turma e disciplina.')
      return
    }

    if (!form.moduleId) {
      setError('Selecione uma UFCD ou módulo.')
      return
    }

    if (!form.date) {
      setError('Indique a data da aula.')
      return
    }

    if (
      !isValidTime(form.startTime) ||
      !isValidTime(form.endTime) ||
      form.startTime >= form.endTime
    ) {
      setError('A hora de início deve ser anterior à hora de fim.')
      return
    }

    if (!Number.isInteger(periodCount) || periodCount <= 0) {
      setError(
        'O número de tempos deve ser um número inteiro superior a zero.'
      )
      return
    }

    if (form.status === 'taught' && !form.summary.trim()) {
      setError(
        'Indique o sumário antes de marcar a aula como dada.'
      )
      return
    }

    setSaving(true)
    setError('')

    try {
      const lesson =
        await extraLessonRepository.createExtraLesson({
          academicYearId: context.academicYear.id,
          teachingAssignmentId: form.teachingAssignmentId,
          moduleId: form.moduleId,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          periodCount,
          status: form.status,
          countTowardProgress:
            form.status === 'cancelled'
              ? false
              : form.countTowardProgress,
          plannedActivity: form.plannedActivity,
          summary: form.summary,
          summarySource: form.summarySource,
          planificationItemIds: form.planificationItemIds,
          notes: form.notes,
          giaeStatus: form.giaeStatus
        })

      await onCreated(lesson)
    } catch (createError) {
      setError(getErrorMessage(createError))
    } finally {
      setSaving(false)
    }
  }

  if (context.assignmentOptions.length === 0) {
    return <EmptyConfiguration onClose={onClose} />
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget && !saving) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-lesson-title"
        className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/60 sm:max-h-[92vh] sm:rounded-[2rem]"
      >
        <header className="border-b border-white/10 bg-slate-950/95 px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-violet-100">
                  Aula extra
                </span>

                <span
                  className={`rounded-full border px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] ${
                    statusClasses[form.status]
                  }`}
                >
                  {
                    statusOptions.find(
                      (option) => option.value === form.status
                    )?.label
                  }
                </span>
              </div>

              <h2
                id="extra-lesson-title"
                className="mt-3 text-2xl font-black text-white"
              >
                Criar nova aula
              </h2>

              <p className="mt-2 text-sm capitalize leading-6 text-slate-400">
                {formatDate(form.date)}
                {selectedAssignmentOption
                  ? ` · ${selectedAssignmentOption.label}`
                  : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Fechar criação da aula extra"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl font-black text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
            <div className="space-y-7">
              <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  Turma e disciplina
                </p>

                <label className="mt-5 block">
                  <FieldLabel>
                    Turma e disciplina
                  </FieldLabel>

                  <select
                    value={form.teachingAssignmentId}
                    onChange={handleAssignmentChange}
                    disabled={busy}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
                  >
                    <option value="">
                      Selecione...
                    </option>

                    {context.assignmentOptions.map((option) => (
                      <option
                        key={option.assignment.id}
                        value={option.assignment.id}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {selectionError ? (
                  <div
                    role="alert"
                    className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm leading-6 text-amber-100"
                  >
                    {selectionError}
                  </div>
                ) : null}
              </section>

              <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                      Data e horário
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      A aula será criada como extra, mesmo quando utilizar um horário habitual.
                    </p>
                  </div>

                  {selectionLoading ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-100">
                      A atualizar sugestões...
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="block sm:col-span-2 xl:col-span-1">
                    <FieldLabel>
                      Data
                    </FieldLabel>

                    <input
                      type="date"
                      min={context.academicYear.startDate}
                      max={context.academicYear.endDate}
                      value={form.date}
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>
                      ) =>
                        updateForm(
                          'date',
                          event.target.value
                        )
                      }
                      disabled={saving}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <FieldLabel>
                      Início
                    </FieldLabel>

                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>
                      ) =>
                        updateForm(
                          'startTime',
                          event.target.value
                        )
                      }
                      disabled={saving}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <FieldLabel>
                      Fim
                    </FieldLabel>

                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>
                      ) =>
                        updateForm(
                          'endTime',
                          event.target.value
                        )
                      }
                      disabled={saving}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
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
                      value={form.periodCount}
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>
                      ) =>
                        updateForm(
                          'periodCount',
                          event.target.value
                        )
                      }
                      disabled={saving}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
                    />
                  </label>
                </div>

                {matchingScheduleSlots.length > 0 ? (
                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Horários habituais deste dia
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3">
                      {matchingScheduleSlots.map((slot) => (
                        <ScheduleSlotButton
                          key={slot.id}
                          slot={slot}
                          selected={
                            form.startTime === slot.startTime &&
                            form.endTime === slot.endTime &&
                            form.periodCount ===
                              String(slot.periodCount)
                          }
                          disabled={saving}
                          onSelect={applyScheduleSlot}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  Estado da aula
                </p>

                <div className="mt-4">
                  <StatusSelector
                    value={form.status}
                    disabled={saving}
                    onChange={handleStatusChange}
                  />
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  UFCD ou módulo
                </p>

                <label className="mt-5 block">
                  <FieldLabel>
                    UFCD ou módulo
                  </FieldLabel>

                  <select
                    value={form.moduleId}
                    onChange={(
                      event: ChangeEvent<HTMLSelectElement>
                    ) =>
                      setForm((current) => ({
                        ...current,
                        moduleId: event.target.value,
                        summarySource: 'manual',
                        planificationItemIds: []
                      }))
                    }
                    disabled={busy}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
                  >
                    <option value="">
                      Selecione...
                    </option>

                    {(
                      selectionContext?.modules ??
                      selectedAssignmentOption?.modules ??
                      []
                    ).map((module) => (
                      <option
                        key={module.id}
                        value={module.id}
                      >
                        {getModuleLabel(
                          module.code,
                          module.name
                        )}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/55 p-4">
                  <input
                    type="checkbox"
                    checked={form.countTowardProgress}
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
                      form.status === 'cancelled'
                    }
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30 disabled:opacity-40"
                  />

                  <span>
                    <span className="block text-sm font-black text-white">
                      Contabilizar no progresso da UFCD
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Desative quando a aula extra não deve aumentar os tempos dados.
                    </span>
                  </span>
                </label>
              </section>

              <section className="grid gap-5 xl:grid-cols-2">
                <article className="rounded-[1.5rem] border border-cyan-300/15 bg-cyan-300/[0.035] p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                      Planificação
                    </p>

                    {planificationLoading ? (
                      <span className="text-xs text-slate-500">
                        A carregar...
                      </span>
                    ) : null}
                  </div>

                  {planificationItem ? (
                    <>
                      <p className="mt-4 text-sm font-black leading-6 text-white">
                        {planificationItem.content}
                      </p>

                      {planificationItem.activity ? (
                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          {planificationItem.activity}
                        </p>
                      ) : null}

                      <button
                        type="button"
                        onClick={usePlanificationItem}
                        disabled={
                          saving ||
                          planificationLoading
                        }
                        className="mt-5 w-full rounded-xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-50"
                      >
                        Usar próximo item
                      </button>
                    </>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      {selectedModule
                        ? 'Não existe um próximo item disponível na planificação desta UFCD.'
                        : 'Selecione uma UFCD para consultar a planificação.'}
                    </p>
                  )}
                </article>

                <article className="rounded-[1.5rem] border border-violet-300/15 bg-violet-300/[0.035] p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                    Aula anterior
                  </p>

                  {selectionContext?.previousLessonTemplate ? (
                    <>
                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">
                        {selectionContext.previousLessonTemplate.summary ||
                          selectionContext.previousLessonTemplate
                            .plannedActivity ||
                          'A aula anterior não possui texto.'}
                      </p>

                      <button
                        type="button"
                        onClick={copyPreviousLesson}
                        disabled={saving}
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
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  Conteúdo e sumário
                </p>

                <div className="mt-5 space-y-5">
                  <label className="block">
                    <FieldLabel optional>
                      Atividade prevista
                    </FieldLabel>

                    <textarea
                      value={form.plannedActivity}
                      onChange={(
                        event: ChangeEvent<HTMLTextAreaElement>
                      ) =>
                        updateForm(
                          'plannedActivity',
                          event.target.value
                        )
                      }
                      disabled={saving}
                      rows={3}
                      placeholder="Conteúdos, atividade ou trabalho previsto para a aula."
                      className="w-full resize-y rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <FieldLabel
                      optional={form.status !== 'taught'}
                    >
                      Sumário
                    </FieldLabel>

                    <textarea
                      value={form.summary}
                      onChange={(
                        event: ChangeEvent<HTMLTextAreaElement>
                      ) =>
                        setForm((current) => ({
                          ...current,
                          summary: event.target.value,
                          summarySource: 'manual',
                          planificationItemIds: []
                        }))
                      }
                      disabled={saving}
                      rows={5}
                      placeholder="Escreva o sumário que será registado no GIAE."
                      className="w-full resize-y rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-slate-400">
                      Origem:{' '}
                      {form.summarySource === 'planification'
                        ? 'planificação'
                        : form.summarySource === 'ai'
                          ? 'inteligência artificial'
                          : 'manual'}
                    </span>

                    {form.planificationItemIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            planificationItemIds: [],
                            summarySource: 'manual'
                          }))
                        }
                        disabled={saving}
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
                      value={form.notes}
                      onChange={(
                        event: ChangeEvent<HTMLTextAreaElement>
                      ) =>
                        updateForm(
                          'notes',
                          event.target.value
                        )
                      }
                      disabled={saving}
                      rows={3}
                      placeholder="Observações que não serão incluídas no sumário."
                      className="w-full resize-y rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
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
                      Marque como submetida apenas depois de copiar o sumário para o GIAE.
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                      form.giaeStatus === 'submitted'
                        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                        : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                    }`}
                  >
                    {form.giaeStatus === 'submitted'
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
                    disabled={saving}
                    className={`rounded-xl border px-4 py-3 text-sm font-black transition disabled:cursor-wait disabled:opacity-60 ${
                      form.giaeStatus === 'pending'
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
                      form.giaeStatus === 'submitted'
                        ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50'
                        : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]'
                    }`}
                  >
                    Marcar como submetida
                  </button>
                </div>

                {!canSubmitToGIAE ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Para submeter no GIAE, marque a aula como dada e preencha o sumário.
                  </p>
                ) : null}
              </section>

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

          <footer className="border-t border-white/10 bg-slate-950/95 px-5 py-4 sm:px-7">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    selectionLoading ||
                    !form.teachingAssignmentId ||
                    !form.moduleId
                  }
                  className="rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving
                    ? 'A criar...'
                    : 'Criar aula extra'}
                </button>
              </div>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}
