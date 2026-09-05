import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'

import type {
  EntityId,
  SchoolCalendarEventScope,
  SchoolCalendarEventType,
  Weekday
} from '../types'

import {
  getSchoolCalendarEventScopeLabel,
  getSchoolCalendarEventTypeLabel,
  getWeekdayLabel,
  type ScheduleSlotChanges,
  type ScheduleSlotDraft,
  type ScheduleWorkspaceFilters,
  type ScheduleWorkspaceSnapshot,
  type SchoolCalendarEventChanges,
  type SchoolCalendarEventDraft
} from './scheduleWorkspaceRepository'

interface ScheduleWorkspaceViewProps {
  snapshot: ScheduleWorkspaceSnapshot
  loading?: boolean
  error?: string
  onRefresh?: () => void

  onFiltersChange: (
    filters: ScheduleWorkspaceFilters
  ) => void

  onCreateScheduleSlot: (
    input: ScheduleSlotDraft
  ) => Promise<void> | void

  onUpdateScheduleSlot: (
    slotId: EntityId,
    changes: ScheduleSlotChanges
  ) => Promise<void> | void

  onDeleteScheduleSlot: (
    slotId: EntityId
  ) => Promise<void> | void

  onCreateSchoolCalendarEvent: (
    input: SchoolCalendarEventDraft
  ) => Promise<void> | void

  onUpdateSchoolCalendarEvent: (
    eventId: EntityId,
    changes: SchoolCalendarEventChanges
  ) => Promise<void> | void

  onDeleteSchoolCalendarEvent: (
    eventId: EntityId
  ) => Promise<void> | void
}

interface SlotFormState {
  teachingAssignmentId: EntityId
  weekday: Weekday
  startTime: string
  endTime: string
  periodCount: string
  validFrom: string
  validUntil: string
  active: boolean
}

interface EventFormState {
  type: SchoolCalendarEventType
  scope: SchoolCalendarEventScope
  groupId: EntityId
  teachingAssignmentId: EntityId
  title: string
  description: string
  startDate: string
  endDate: string
  blocksLessons: boolean
}

type Feedback =
  | {
      tone: 'success' | 'error'
      message: string
    }
  | null

const weekdays: Weekday[] = [
  1,
  2,
  3,
  4,
  5,
  6,
  7
]

const eventTypes: SchoolCalendarEventType[] = [
  'holiday',
  'school_break',
  'strike',
  'field_trip',
  'teacher_absence',
  'meeting',
  'school_activity',
  'other'
]

const eventScopes: SchoolCalendarEventScope[] = [
  'all',
  'group',
  'teaching_assignment'
]

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60'

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function createSlotForm(
  snapshot: ScheduleWorkspaceSnapshot
): SlotFormState {
  return {
    teachingAssignmentId:
      snapshot.assignmentOptions[0]
        ?.assignment.id ??
      '',
    weekday: 1,
    startTime: '09:00',
    endTime: '09:50',
    periodCount: '1',
    validFrom:
      snapshot.academicYear.startDate,
    validUntil:
      snapshot.academicYear.endDate,
    active: true
  }
}

function createEventForm(
  snapshot: ScheduleWorkspaceSnapshot
): EventFormState {
  return {
    type: 'holiday',
    scope: 'all',
    groupId:
      snapshot.assignmentOptions[0]
        ?.group.id ??
      '',
    teachingAssignmentId:
      snapshot.assignmentOptions[0]
        ?.assignment.id ??
      '',
    title: '',
    description: '',
    startDate:
      snapshot.academicYear.startDate,
    endDate:
      snapshot.academicYear.startDate,
    blocksLessons: true
  }
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

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'short',
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

function FieldLabel({
  children,
  optional = false
}: {
  children: string
  optional?: boolean
}) {
  return (
    <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
      <span>
        {children}
      </span>

      {optional ? (
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Opcional
        </span>
      ) : null}
    </span>
  )
}

function MetricCard({
  label,
  value,
  detail,
  className
}: {
  label: string
  value: string | number
  detail: string
  className: string
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${className}`}
    >
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </article>
  )
}

export default function ScheduleWorkspaceView({
  snapshot,
  loading = false,
  error = '',
  onRefresh,
  onFiltersChange,
  onCreateScheduleSlot,
  onUpdateScheduleSlot,
  onDeleteScheduleSlot,
  onCreateSchoolCalendarEvent,
  onUpdateSchoolCalendarEvent,
  onDeleteSchoolCalendarEvent
}: ScheduleWorkspaceViewProps) {
  const rootRef =
    useRef<HTMLDivElement>(
      null
    )

  const [
    slotForm,
    setSlotForm
  ] = useState<SlotFormState>(
    () =>
      createSlotForm(
        snapshot
      )
  )

  const [
    eventForm,
    setEventForm
  ] = useState<EventFormState>(
    () =>
      createEventForm(
        snapshot
      )
  )

  const slotBaselineRef =
    useRef<SlotFormState>(
      slotForm
    )

  const eventBaselineRef =
    useRef<EventFormState>(
      eventForm
    )

  const [
    editingSlotId,
    setEditingSlotId
  ] = useState<EntityId | null>(
    null
  )

  const [
    editingEventId,
    setEditingEventId
  ] = useState<EntityId | null>(
    null
  )

  const [
    showSlotForm,
    setShowSlotForm
  ] = useState(false)

  const [
    showEventForm,
    setShowEventForm
  ] = useState(false)

  const [
    busyAction,
    setBusyAction
  ] = useState<string | null>(
    null
  )

  const [
    feedback,
    setFeedback
  ] = useState<Feedback>(
    null
  )

  useEffect(() => {
    if (
      !showSlotForm &&
      !editingSlotId
    ) {
      const nextSlotForm =
        createSlotForm(
          snapshot
        )

      slotBaselineRef.current =
        nextSlotForm
      setSlotForm(
        nextSlotForm
      )
    }

    if (
      !showEventForm &&
      !editingEventId
    ) {
      const nextEventForm =
        createEventForm(
          snapshot
        )

      eventBaselineRef.current =
        nextEventForm
      setEventForm(
        nextEventForm
      )
    }
  }, [
    editingEventId,
    editingSlotId,
    showEventForm,
    showSlotForm,
    snapshot.generatedAt
  ])

  const groupOptions = useMemo(
    () => {
      const byId = new Map<
        EntityId,
        {
          id: EntityId
          name: string
        }
      >()

      snapshot.assignmentOptions.forEach(
        option => {
          byId.set(
            option.group.id,
            {
              id: option.group.id,
              name: option.group.name
            }
          )
        }
      )

      return [
        ...byId.values()
      ].sort(
        (
          left,
          right
        ) =>
          left.name.localeCompare(
            right.name,
            'pt-PT',
            {
              numeric: true,
              sensitivity: 'base'
            }
          )
      )
    },
    [
      snapshot.assignmentOptions
    ]
  )

  const slotsByWeekday = useMemo(
    () => {
      const map = new Map<
        Weekday,
        ScheduleWorkspaceSnapshot['slotRows']
      >()

      weekdays.forEach(
        weekday =>
          map.set(
            weekday,
            []
          )
      )

      snapshot.slotRows.forEach(
        row => {
          const current =
            map.get(
              row.slot.weekday
            ) ?? []

          current.push(
            row
          )

          map.set(
            row.slot.weekday,
            current
          )
        }
      )

      return map
    },
    [
      snapshot.slotRows
    ]
  )

  const busy =
    loading ||
    Boolean(
      busyAction
    )

  const hasSlotUnsavedChanges =
    showSlotForm &&
    JSON.stringify(
      slotForm
    ) !==
      JSON.stringify(
        slotBaselineRef.current
      )

  const hasEventUnsavedChanges =
    showEventForm &&
    JSON.stringify(
      eventForm
    ) !==
      JSON.stringify(
        eventBaselineRef.current
      )

  const hasScheduleUnsavedChanges =
    hasSlotUnsavedChanges ||
    hasEventUnsavedChanges

  useMAProfessorUnsavedWorkspaceProtection(
    hasScheduleUnsavedChanges,
    rootRef,
    'Existem alterações no horário ou em eventos por guardar. Se sair deste ecrã, essas alterações serão perdidas. Pretende continuar?'
  )

  function confirmDiscardSlotChanges() {
    return (
      !hasSlotUnsavedChanges ||
      window.confirm(
        'Existem alterações no bloco de horário por guardar. Se continuar, essas alterações serão perdidas. Pretende continuar?'
      )
    )
  }

  function confirmDiscardEventChanges() {
    return (
      !hasEventUnsavedChanges ||
      window.confirm(
        'Existem alterações no evento escolar por guardar. Se continuar, essas alterações serão perdidas. Pretende continuar?'
      )
    )
  }

  function confirmDiscardScheduleChanges() {
    return (
      !hasScheduleUnsavedChanges ||
      window.confirm(
        'Existem alterações no horário ou em eventos por guardar. Se continuar, essas alterações serão perdidas. Pretende continuar?'
      )
    )
  }

  async function runAction(
    actionId: string,
    action: () => Promise<void> | void,
    successMessage: string
  ) {
    if (
      busyAction
    ) {
      return
    }

    setBusyAction(
      actionId
    )

    setFeedback(null)

    try {
      await action()

      setFeedback({
        tone: 'success',
        message: successMessage
      })
    } catch (
      actionError
    ) {
      setFeedback({
        tone: 'error',
        message:
          getErrorMessage(
            actionError
          )
      })
    } finally {
      setBusyAction(null)
    }
  }

  function updateSlotForm<
    Key extends keyof SlotFormState
  >(
    key: Key,
    value: SlotFormState[Key]
  ) {
    setSlotForm(
      current => ({
        ...current,
        [key]: value
      })
    )
  }

  function updateEventForm<
    Key extends keyof EventFormState
  >(
    key: Key,
    value: EventFormState[Key]
  ) {
    setEventForm(
      current => ({
        ...current,
        [key]: value
      })
    )
  }

  function resetSlotForm() {
    const nextSlotForm =
      createSlotForm(
        snapshot
      )

    slotBaselineRef.current =
      nextSlotForm
    setEditingSlotId(null)
    setSlotForm(
      nextSlotForm
    )
  }

  function resetEventForm() {
    const nextEventForm =
      createEventForm(
        snapshot
      )

    eventBaselineRef.current =
      nextEventForm
    setEditingEventId(null)
    setEventForm(
      nextEventForm
    )
  }

  function handleSlotFormToggle() {
    if (
      showSlotForm
    ) {
      if (
        !confirmDiscardSlotChanges()
      ) {
        return
      }

      resetSlotForm()
      setShowSlotForm(false)
      setFeedback(null)
      return
    }

    resetSlotForm()
    setShowSlotForm(true)
    setFeedback(null)
  }

  function handleEventFormToggle() {
    if (
      showEventForm
    ) {
      if (
        !confirmDiscardEventChanges()
      ) {
        return
      }

      resetEventForm()
      setShowEventForm(false)
      setFeedback(null)
      return
    }

    resetEventForm()
    setShowEventForm(true)
    setFeedback(null)
  }

  function handleCancelSlotEditing() {
    if (
      !confirmDiscardSlotChanges()
    ) {
      return
    }

    resetSlotForm()
    setShowSlotForm(false)
  }

  function handleCancelEventEditing() {
    if (
      !confirmDiscardEventChanges()
    ) {
      return
    }

    resetEventForm()
    setShowEventForm(false)
  }

  function discardOpenForms() {
    resetSlotForm()
    setShowSlotForm(false)
    resetEventForm()
    setShowEventForm(false)
  }

  function handleFiltersChange(
    filters: ScheduleWorkspaceFilters
  ) {
    if (
      !confirmDiscardScheduleChanges()
    ) {
      return
    }

    discardOpenForms()
    setFeedback(null)
    onFiltersChange(
      filters
    )
  }

  function handleRefresh() {
    if (
      !onRefresh ||
      !confirmDiscardScheduleChanges()
    ) {
      return
    }

    discardOpenForms()
    onRefresh()
  }

  async function saveSlot(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    const periodCount =
      Number(
        slotForm.periodCount
      )

    if (
      !Number.isInteger(
        periodCount
      ) ||
      periodCount <= 0
    ) {
      setFeedback({
        tone: 'error',
        message:
          'O número de tempos deve ser um número inteiro superior a zero.'
      })
      return
    }

    if (
      !slotForm.teachingAssignmentId
    ) {
      setFeedback({
        tone: 'error',
        message:
          'Selecione a turma e disciplina do bloco de horário.'
      })
      return
    }

    await runAction(
      editingSlotId
        ? `slot-${editingSlotId}`
        : 'create-slot',
      async () => {
        const input: ScheduleSlotDraft = {
          academicYearId:
            snapshot.academicYear.id,
          teachingAssignmentId:
            slotForm.teachingAssignmentId,
          weekday:
            slotForm.weekday,
          startTime:
            slotForm.startTime,
          endTime:
            slotForm.endTime,
          periodCount,
          validFrom:
            slotForm.validFrom,
          validUntil:
            slotForm.validUntil,
          active:
            slotForm.active
        }

        if (
          editingSlotId
        ) {
          await onUpdateScheduleSlot(
            editingSlotId,
            input
          )
        } else {
          await onCreateScheduleSlot(
            input
          )
        }

        resetSlotForm()
        setShowSlotForm(false)
      },
      editingSlotId
        ? 'O bloco de horário foi atualizado.'
        : 'O bloco de horário foi criado.'
    )
  }

  function editSlot(
    row: ScheduleWorkspaceSnapshot['slotRows'][number]
  ) {
    if (
      showSlotForm &&
      editingSlotId ===
        row.slot.id
    ) {
      return
    }

    if (
      !confirmDiscardSlotChanges()
    ) {
      return
    }

    const nextSlotForm: SlotFormState = {
      teachingAssignmentId:
        row.slot.teachingAssignmentId,
      weekday:
        row.slot.weekday,
      startTime:
        row.slot.startTime,
      endTime:
        row.slot.endTime,
      periodCount:
        String(
          row.slot.periodCount
        ),
      validFrom:
        row.slot.validFrom,
      validUntil:
        row.slot.validUntil,
      active:
        row.slot.active
    }

    slotBaselineRef.current =
      nextSlotForm
    setEditingSlotId(
      row.slot.id
    )
    setSlotForm(
      nextSlotForm
    )
    setShowSlotForm(true)
    setFeedback(null)
  }

  async function toggleSlot(
    row: ScheduleWorkspaceSnapshot['slotRows'][number]
  ) {
    const nextActive =
      !row.slot.active

    await runAction(
      `toggle-slot-${row.slot.id}`,
      async () => {
        await onUpdateScheduleSlot(
          row.slot.id,
          {
            active:
              nextActive
          }
        )

        if (
          showSlotForm &&
          editingSlotId ===
            row.slot.id
        ) {
          slotBaselineRef.current = {
            ...slotBaselineRef.current,
            active:
              nextActive
          }

          setSlotForm(
            current => ({
              ...current,
              active:
                nextActive
            })
          )
        }
      },
      row.slot.active
        ? 'O bloco de horário foi desativado.'
        : 'O bloco de horário foi ativado.'
    )
  }

  async function deleteSlot(
    row: ScheduleWorkspaceSnapshot['slotRows'][number]
  ) {
    const deletingEditedSlot =
      showSlotForm &&
      editingSlotId ===
        row.slot.id

    if (
      deletingEditedSlot &&
      !confirmDiscardSlotChanges()
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Eliminar o bloco de ${getWeekdayLabel(
          row.slot.weekday
        )}, ${row.slot.startTime}–${row.slot.endTime}, de ${row.label}?`
      )

    if (
      !confirmed
    ) {
      return
    }

    await runAction(
      `delete-slot-${row.slot.id}`,
      async () => {
        await onDeleteScheduleSlot(
          row.slot.id
        )

        if (
          deletingEditedSlot
        ) {
          resetSlotForm()
          setShowSlotForm(false)
        }
      },
      'O bloco de horário foi eliminado.'
    )
  }

  async function saveEvent(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      !eventForm.title.trim()
    ) {
      setFeedback({
        tone: 'error',
        message:
          'Indique o título do evento escolar.'
      })
      return
    }

    if (
      eventForm.scope ===
        'group' &&
      !eventForm.groupId
    ) {
      setFeedback({
        tone: 'error',
        message:
          'Selecione a turma abrangida pelo evento.'
      })
      return
    }

    if (
      eventForm.scope ===
        'teaching_assignment' &&
      !eventForm.teachingAssignmentId
    ) {
      setFeedback({
        tone: 'error',
        message:
          'Selecione a turma e disciplina abrangidas pelo evento.'
      })
      return
    }

    await runAction(
      editingEventId
        ? `event-${editingEventId}`
        : 'create-event',
      async () => {
        const input: SchoolCalendarEventDraft = {
          academicYearId:
            snapshot.academicYear.id,
          type:
            eventForm.type,
          scope:
            eventForm.scope,
          groupId:
            eventForm.scope ===
            'group'
              ? eventForm.groupId
              : null,
          teachingAssignmentId:
            eventForm.scope ===
            'teaching_assignment'
              ? eventForm.teachingAssignmentId
              : null,
          title:
            eventForm.title,
          description:
            eventForm.description,
          startDate:
            eventForm.startDate,
          endDate:
            eventForm.endDate,
          blocksLessons:
            eventForm.blocksLessons
        }

        if (
          editingEventId
        ) {
          await onUpdateSchoolCalendarEvent(
            editingEventId,
            input
          )
        } else {
          await onCreateSchoolCalendarEvent(
            input
          )
        }

        resetEventForm()
        setShowEventForm(false)
      },
      editingEventId
        ? 'O evento escolar foi atualizado.'
        : 'O evento escolar foi criado.'
    )
  }

  function editEvent(
    row: ScheduleWorkspaceSnapshot['eventRows'][number]
  ) {
    if (
      showEventForm &&
      editingEventId ===
        row.event.id
    ) {
      return
    }

    if (
      !confirmDiscardEventChanges()
    ) {
      return
    }

    const nextEventForm: EventFormState = {
      type:
        row.event.type,
      scope:
        row.event.scope,
      groupId:
        row.event.groupId ??
        '',
      teachingAssignmentId:
        row.event.teachingAssignmentId ??
        '',
      title:
        row.event.title,
      description:
        row.event.description,
      startDate:
        row.event.startDate,
      endDate:
        row.event.endDate,
      blocksLessons:
        row.event.blocksLessons
    }

    eventBaselineRef.current =
      nextEventForm
    setEditingEventId(
      row.event.id
    )
    setEventForm(
      nextEventForm
    )
    setShowEventForm(true)
    setFeedback(null)
  }

  async function deleteEvent(
    row: ScheduleWorkspaceSnapshot['eventRows'][number]
  ) {
    const deletingEditedEvent =
      showEventForm &&
      editingEventId ===
        row.event.id

    if (
      deletingEditedEvent &&
      !confirmDiscardEventChanges()
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Eliminar o evento “${row.event.title}”?`
      )

    if (
      !confirmed
    ) {
      return
    }

    await runAction(
      `delete-event-${row.event.id}`,
      async () => {
        await onDeleteSchoolCalendarEvent(
          row.event.id
        )

        if (
          deletingEditedEvent
        ) {
          resetEventForm()
          setShowEventForm(false)
        }
      },
      'O evento escolar foi eliminado.'
    )
  }

  return (
    <div
      ref={rootRef}
      className="space-y-6"
    >
      <section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 shadow-2xl shadow-cyan-950/10 backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan-100">
                  Horários
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-bold text-slate-400">
                  {snapshot.academicYear.name}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Horário e calendário escolar
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Organize os blocos semanais e registe os eventos que condicionam ou bloqueiam aulas.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSlotFormToggle}
                disabled={busy}
                className="rounded-2xl border border-cyan-200/25 bg-cyan-300/10 px-5 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/15 disabled:opacity-50"
              >
                {showSlotForm
                  ? 'Fechar horário'
                  : '+ Bloco de horário'}
              </button>

              <button
                type="button"
                onClick={handleEventFormToggle}
                disabled={busy}
                className="rounded-2xl border border-violet-200/25 bg-violet-300/10 px-5 py-3 text-sm font-black text-violet-50 transition hover:bg-violet-300/15 disabled:opacity-50"
              >
                {showEventForm
                  ? 'Fechar evento'
                  : '+ Evento escolar'}
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={
                  busy ||
                  !onRefresh
                }
                className="rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {loading
                  ? 'A atualizar...'
                  : 'Atualizar'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-5 px-5 py-6 sm:px-7 xl:grid-cols-[1fr_auto] xl:items-end">
          <label>
            <span className="mb-2 block text-sm font-bold text-slate-200">
              Filtrar turma e disciplina
            </span>

            <select
              value={
                snapshot.filters
                  .teachingAssignmentId ??
                ''
              }
              onChange={(
                event: ChangeEvent<HTMLSelectElement>
              ) =>
                handleFiltersChange({
                  teachingAssignmentId:
                    event.target.value ||
                    null,
                  includeInactive:
                    snapshot.filters.includeInactive
                })
              }
              disabled={busy}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
            >
              <option value="">
                Todas as turmas e disciplinas
              </option>

              {snapshot.assignmentOptions.map(
                option => (
                  <option
                    key={option.assignment.id}
                    value={option.assignment.id}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-bold text-slate-300">
            <input
              type="checkbox"
              checked={
                snapshot.filters.includeInactive
              }
              onChange={(
                event: ChangeEvent<HTMLInputElement>
              ) =>
                handleFiltersChange({
                  teachingAssignmentId:
                    snapshot.filters
                      .teachingAssignmentId,
                  includeInactive:
                    event.target.checked
                })
              }
              className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30"
            />

            Mostrar horários inativos
          </label>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-sm leading-6 ${
            feedback.tone ===
            'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-50'
              : 'border-rose-300/20 bg-rose-300/[0.07] text-rose-50'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Blocos ativos"
          value={snapshot.totals.activeSlotCount}
          detail="Incluídos na geração de aulas."
          className="border-cyan-300/15 bg-cyan-300/[0.035]"
        />

        <MetricCard
          label="Blocos inativos"
          value={snapshot.totals.inactiveSlotCount}
          detail="Mantidos no histórico."
          className="border-slate-300/15 bg-slate-300/[0.035]"
        />

        <MetricCard
          label="Tempos semanais"
          value={snapshot.totals.weeklyPeriodCount}
          detail="Soma dos blocos ativos."
          className="border-emerald-300/15 bg-emerald-300/[0.035]"
        />

        <MetricCard
          label="Eventos"
          value={snapshot.totals.eventCount}
          detail="Registos no calendário escolar."
          className="border-violet-300/15 bg-violet-300/[0.035]"
        />

        <MetricCard
          label="Bloqueiam aulas"
          value={snapshot.totals.blockingEventCount}
          detail="Eventos com impacto letivo."
          className="border-amber-300/15 bg-amber-300/[0.035]"
        />
      </section>

      {showSlotForm ? (
        <form
          onSubmit={saveSlot}
          className="rounded-[2rem] border border-cyan-300/15 bg-cyan-300/[0.035] p-5 sm:p-7"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                Horário semanal
              </p>

              <h2 className="mt-3 text-xl font-black text-white">
                {editingSlotId
                  ? 'Editar bloco de horário'
                  : 'Novo bloco de horário'}
              </h2>
            </div>

            {editingSlotId ? (
              <button
                type="button"
                onClick={handleCancelSlotEditing}
                disabled={busy}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <label className="lg:col-span-2">
              <FieldLabel>
                Turma e disciplina
              </FieldLabel>

              <select
                value={slotForm.teachingAssignmentId}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>
                ) =>
                  updateSlotForm(
                    'teachingAssignmentId',
                    event.target.value
                  )
                }
                disabled={busy}
                className={fieldClass}
              >
                <option value="">
                  Selecionar
                </option>

                {snapshot.assignmentOptions.map(
                  option => (
                    <option
                      key={option.assignment.id}
                      value={option.assignment.id}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <FieldLabel>
                Dia da semana
              </FieldLabel>

              <select
                value={slotForm.weekday}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>
                ) =>
                  updateSlotForm(
                    'weekday',
                    Number(
                      event.target.value
                    ) as Weekday
                  )
                }
                disabled={busy}
                className={fieldClass}
              >
                {weekdays.map(
                  weekday => (
                    <option
                      key={weekday}
                      value={weekday}
                    >
                      {getWeekdayLabel(
                        weekday
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <FieldLabel>
                Número de tempos
              </FieldLabel>

              <input
                type="number"
                min="1"
                step="1"
                value={slotForm.periodCount}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateSlotForm(
                    'periodCount',
                    event.target.value
                  )
                }
                disabled={busy}
                className={fieldClass}
              />
            </label>

            <label>
              <FieldLabel>
                Início
              </FieldLabel>

              <input
                type="time"
                value={slotForm.startTime}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateSlotForm(
                    'startTime',
                    event.target.value
                  )
                }
                disabled={busy}
                className={fieldClass}
              />
            </label>

            <label>
              <FieldLabel>
                Fim
              </FieldLabel>

              <input
                type="time"
                value={slotForm.endTime}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateSlotForm(
                    'endTime',
                    event.target.value
                  )
                }
                disabled={busy}
                className={fieldClass}
              />
            </label>

            <label>
              <FieldLabel>
                Vigente desde
              </FieldLabel>

              <input
                type="date"
                min={snapshot.academicYear.startDate}
                max={snapshot.academicYear.endDate}
                value={slotForm.validFrom}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateSlotForm(
                    'validFrom',
                    event.target.value
                  )
                }
                disabled={busy}
                className={fieldClass}
              />
            </label>

            <label>
              <FieldLabel>
                Vigente até
              </FieldLabel>

              <input
                type="date"
                min={snapshot.academicYear.startDate}
                max={snapshot.academicYear.endDate}
                value={slotForm.validUntil}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateSlotForm(
                    'validUntil',
                    event.target.value
                  )
                }
                disabled={busy}
                className={fieldClass}
              />
            </label>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <input
              type="checkbox"
              checked={slotForm.active}
              onChange={(
                event: ChangeEvent<HTMLInputElement>
              ) =>
                updateSlotForm(
                  'active',
                  event.target.checked
                )
              }
              disabled={busy}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30"
            />

            <span>
              <span className="block text-sm font-black text-white">
                Bloco ativo
              </span>

              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Os blocos inativos ficam guardados, mas deixam de ser considerados no horário atual.
              </span>
            </span>
          </label>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {busyAction ===
              (editingSlotId
                ? `slot-${editingSlotId}`
                : 'create-slot')
                ? 'A guardar...'
                : editingSlotId
                  ? 'Guardar alterações'
                  : 'Criar bloco'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
            Semana
          </p>

          <h2 className="mt-3 text-xl font-black text-white">
            Horário semanal
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Não é possível ativar dois blocos sobrepostos no mesmo dia e período de vigência.
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {weekdays.map(
            weekday => {
              const rows =
                slotsByWeekday.get(
                  weekday
                ) ?? []

              return (
                <article
                  key={weekday}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-white">
                      {getWeekdayLabel(
                        weekday
                      )}
                    </h3>

                    <span className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1 text-[0.65rem] font-black text-slate-400">
                      {rows.length}{' '}
                      {rows.length ===
                      1
                        ? 'bloco'
                        : 'blocos'}
                    </span>
                  </div>

                  {rows.length ===
                  0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-600">
                      Sem aulas neste dia.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {rows.map(
                        row => (
                          <div
                            key={row.slot.id}
                            className={`rounded-xl border p-4 ${
                              row.slot.active
                                ? 'border-cyan-300/15 bg-cyan-300/[0.04]'
                                : 'border-slate-300/10 bg-slate-300/[0.025] opacity-70'
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-black text-white">
                                  {row.slot.startTime}–{row.slot.endTime}
                                </p>

                                <p className="mt-1 text-xs leading-5 text-slate-400">
                                  {row.label}
                                </p>

                                <p className="mt-1 text-[0.68rem] leading-5 text-slate-500">
                                  {row.slot.periodCount}{' '}
                                  {row.slot.periodCount ===
                                  1
                                    ? 'tempo'
                                    : 'tempos'}
                                  {' · '}
                                  {formatDate(
                                    row.slot.validFrom
                                  )}
                                  {' a '}
                                  {formatDate(
                                    row.slot.validUntil
                                  )}
                                </p>
                              </div>

                              <span
                                className={`rounded-full border px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.08em] ${
                                  row.slot.active
                                    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                                    : 'border-slate-300/15 bg-slate-300/[0.07] text-slate-300'
                                }`}
                              >
                                {row.slot.active
                                  ? 'Ativo'
                                  : 'Inativo'}
                              </span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  editSlot(
                                    row
                                  )
                                }
                                disabled={busy}
                                className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-black text-cyan-100"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void toggleSlot(
                                    row
                                  )
                                }
                                disabled={busy}
                                className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs font-black text-amber-100"
                              >
                                {row.slot.active
                                  ? 'Desativar'
                                  : 'Ativar'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void deleteSlot(
                                    row
                                  )
                                }
                                disabled={busy}
                                className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-3 py-2 text-xs font-black text-rose-100"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </article>
              )
            }
          )}
        </div>
      </section>

      {showEventForm ? (
        <form
          onSubmit={saveEvent}
          className="rounded-[2rem] border border-violet-300/15 bg-violet-300/[0.035] p-5 sm:p-7"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                Calendário escolar
              </p>

              <h2 className="mt-3 text-xl font-black text-white">
                {editingEventId
                  ? 'Editar evento'
                  : 'Novo evento escolar'}
              </h2>
            </div>

            {editingEventId ? (
              <button
                type="button"
                onClick={handleCancelEventEditing}
                disabled={busy}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <label>
              <FieldLabel>
                Tipo de evento
              </FieldLabel>

              <select
                value={eventForm.type}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>
                ) =>
                  updateEventForm(
                    'type',
                    event.target.value as SchoolCalendarEventType
                  )
                }
                disabled={busy}
                className={fieldClass}
              >
                {eventTypes.map(
                  type => (
                    <option
                      key={type}
                      value={type}
                    >
                      {getSchoolCalendarEventTypeLabel(
                        type
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <FieldLabel>
                Âmbito
              </FieldLabel>

              <select
                value={eventForm.scope}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>
                ) =>
                  updateEventForm(
                    'scope',
                    event.target.value as SchoolCalendarEventScope
                  )
                }
                disabled={busy}
                className={fieldClass}
              >
                {eventScopes.map(
                  scope => (
                    <option
                      key={scope}
                      value={scope}
                    >
                      {getSchoolCalendarEventScopeLabel(
                        scope
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            {eventForm.scope ===
            'group' ? (
              <label className="lg:col-span-2">
                <FieldLabel>
                  Turma
                </FieldLabel>

                <select
                  value={eventForm.groupId}
                  onChange={(
                    event: ChangeEvent<HTMLSelectElement>
                  ) =>
                    updateEventForm(
                      'groupId',
                      event.target.value
                    )
                  }
                  disabled={busy}
                  className={fieldClass}
                >
                  <option value="">
                    Selecionar
                  </option>

                  {groupOptions.map(
                    group => (
                      <option
                        key={group.id}
                        value={group.id}
                      >
                        {group.name}
                      </option>
                    )
                  )}
                </select>
              </label>
            ) : null}

            {eventForm.scope ===
            'teaching_assignment' ? (
              <label className="lg:col-span-2">
                <FieldLabel>
                  Turma e disciplina
                </FieldLabel>

                <select
                  value={eventForm.teachingAssignmentId}
                  onChange={(
                    event: ChangeEvent<HTMLSelectElement>
                  ) =>
                    updateEventForm(
                      'teachingAssignmentId',
                      event.target.value
                    )
                  }
                  disabled={busy}
                  className={fieldClass}
                >
                  <option value="">
                    Selecionar
                  </option>

                  {snapshot.assignmentOptions.map(
                    option => (
                      <option
                        key={option.assignment.id}
                        value={option.assignment.id}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </label>
            ) : null}

            <label className="lg:col-span-2">
              <FieldLabel>
                Título
              </FieldLabel>

              <input
                type="text"
                value={eventForm.title}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateEventForm(
                    'title',
                    event.target.value
                  )
                }
                disabled={busy}
                placeholder="Ex.: Interrupção letiva do Natal"
                className={fieldClass}
              />
            </label>

            <label>
              <FieldLabel>
                Data inicial
              </FieldLabel>

              <input
                type="date"
                min={snapshot.academicYear.startDate}
                max={snapshot.academicYear.endDate}
                value={eventForm.startDate}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateEventForm(
                    'startDate',
                    event.target.value
                  )
                }
                disabled={busy}
                className={fieldClass}
              />
            </label>

            <label>
              <FieldLabel>
                Data final
              </FieldLabel>

              <input
                type="date"
                min={snapshot.academicYear.startDate}
                max={snapshot.academicYear.endDate}
                value={eventForm.endDate}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateEventForm(
                    'endDate',
                    event.target.value
                  )
                }
                disabled={busy}
                className={fieldClass}
              />
            </label>

            <label className="lg:col-span-2 xl:col-span-4">
              <FieldLabel optional>
                Descrição
              </FieldLabel>

              <textarea
                value={eventForm.description}
                onChange={(
                  event: ChangeEvent<HTMLTextAreaElement>
                ) =>
                  updateEventForm(
                    'description',
                    event.target.value
                  )
                }
                disabled={busy}
                rows={3}
                className={`${fieldClass} resize-y`}
              />
            </label>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <input
              type="checkbox"
              checked={eventForm.blocksLessons}
              onChange={(
                event: ChangeEvent<HTMLInputElement>
              ) =>
                updateEventForm(
                  'blocksLessons',
                  event.target.checked
                )
              }
              disabled={busy}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900 text-violet-300 focus:ring-violet-300/30"
            />

            <span>
              <span className="block text-sm font-black text-white">
                Bloquear aulas abrangidas
              </span>

              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Use esta opção para feriados, interrupções, greves, visitas ou ausências que impeçam a realização das aulas.
              </span>
            </span>
          </label>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl border border-violet-200/30 bg-gradient-to-r from-violet-300 to-fuchsia-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {busyAction ===
              (editingEventId
                ? `event-${editingEventId}`
                : 'create-event')
                ? 'A guardar...'
                : editingEventId
                  ? 'Guardar alterações'
                  : 'Criar evento'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            Calendário escolar
          </p>

          <h2 className="mt-3 text-xl font-black text-white">
            Eventos do ano letivo
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Os eventos podem abranger todas as turmas, apenas uma turma ou uma turma e disciplina específicas.
          </p>
        </div>

        {snapshot.eventRows.length ===
        0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
            <p className="text-sm font-black text-white">
              Ainda não existem eventos escolares.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {snapshot.eventRows.map(
              row => (
                <article
                  key={row.event.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">
                        {row.event.title}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {getSchoolCalendarEventTypeLabel(
                          row.event.type
                        )}
                        {' · '}
                        {row.scopeLabel}
                      </p>

                      <p className="mt-1 text-[0.68rem] leading-5 text-slate-500">
                        {formatDate(
                          row.event.startDate
                        )}
                        {row.event.endDate !==
                        row.event.startDate
                          ? ` a ${formatDate(
                              row.event.endDate
                            )}`
                          : ''}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.08em] ${
                        row.event.blocksLessons
                          ? 'border-rose-300/20 bg-rose-300/10 text-rose-100'
                          : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                      }`}
                    >
                      {row.event.blocksLessons
                        ? 'Bloqueia aulas'
                        : 'Não bloqueia'}
                    </span>
                  </div>

                  {row.event.description ? (
                    <p className="mt-3 whitespace-pre-line text-xs leading-6 text-slate-400">
                      {row.event.description}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        editEvent(
                          row
                        )
                      }
                      disabled={busy}
                      className="rounded-xl border border-violet-300/20 bg-violet-300/[0.07] px-3 py-2 text-xs font-black text-violet-100"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteEvent(
                          row
                        )
                      }
                      disabled={busy}
                      className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-3 py-2 text-xs font-black text-rose-100"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>
    </div>
  )
}
