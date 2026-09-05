import {
  type FormEvent,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'
import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'

import type {
  EntityId,
  Weekday,
  WeeklyScheduleSlot
} from '../types'

type WeeklyScheduleSetupStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (
    snapshot: SetupSnapshot
  ) => void
  onCompleted: (
    snapshot: SetupSnapshot
  ) => void
}

type ScheduleFormState = {
  teachingAssignmentId: EntityId
  weekday: Weekday
  startTime: string
  endTime: string
  periodCount: string
  validFrom: string
  validUntil: string
}

type WeekdayDefinition = {
  value: Weekday
  shortLabel: string
  label: string
}

const weekdays: WeekdayDefinition[] = [
  {
    value: 1,
    shortLabel: 'Seg',
    label: 'Segunda-feira'
  },
  {
    value: 2,
    shortLabel: 'Ter',
    label: 'Terça-feira'
  },
  {
    value: 3,
    shortLabel: 'Qua',
    label: 'Quarta-feira'
  },
  {
    value: 4,
    shortLabel: 'Qui',
    label: 'Quinta-feira'
  },
  {
    value: 5,
    shortLabel: 'Sex',
    label: 'Sexta-feira'
  },
  {
    value: 6,
    shortLabel: 'Sáb',
    label: 'Sábado'
  },
  {
    value: 7,
    shortLabel: 'Dom',
    label: 'Domingo'
  }
]

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50'

const UNSAVED_SCHEDULE_DRAFT_MESSAGE =
  'Existe um bloco de horário por guardar neste passo. Se continuar, essas alterações serão perdidas. Pretende continuar?'

const RETARGET_SCHEDULE_DRAFT_MESSAGE =
  'Existe um bloco de horário por guardar. Se mudar de turma e disciplina, esse bloco passará a ser aplicado à nova seleção. Pretende continuar?'

const SAVING_SCHEDULE_MESSAGE =
  'Está a ser guardado um bloco de horário. Se continuar agora, a operação pode ficar incompleta. Pretende continuar?'

function createInitialScheduleForm(
  snapshot: SetupSnapshot
): ScheduleFormState {
  return {
    teachingAssignmentId: '',
    weekday: 1,
    startTime: '08:30',
    endTime: '09:20',
    periodCount: '1',
    validFrom:
      snapshot.academicYear.startDate,
    validUntil:
      snapshot.academicYear.endDate
  }
}

function areScheduleFormsEqual(
  left: ScheduleFormState,
  right: ScheduleFormState
) {
  return (
    left.teachingAssignmentId ===
      right.teachingAssignmentId &&
    left.weekday ===
      right.weekday &&
    left.startTime ===
      right.startTime &&
    left.endTime ===
      right.endTime &&
    left.periodCount ===
      right.periodCount &&
    left.validFrom ===
      right.validFrom &&
    left.validUntil ===
      right.validUntil
  )
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message
  }

  return 'Ocorreu um erro inesperado.'
}

function getWeekdayLabel(
  weekday: Weekday
) {
  return (
    weekdays.find(
      (
        definition
      ) =>
        definition.value ===
        weekday
    )?.label ??
    'Dia da semana'
  )
}

function formatDate(
  value: string
) {
  if (!value) {
    return '—'
  }

  const [
    year,
    month,
    day
  ] =
    value
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }
  ).format(
    new Date(
      year,
      month -
        1,
      day
    )
  )
}

function getPeriodLabel(
  periodCount: number
) {
  return periodCount ===
    1
    ? '1 tempo'
    : `${periodCount} tempos`
}

function dateRangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string
) {
  return (
    firstStart <=
      secondEnd &&
    secondStart <=
      firstEnd
  )
}

function timeRangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string
) {
  return (
    firstStart <
      secondEnd &&
    secondStart <
      firstEnd
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
    <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-200">
      <span>
        {children}
      </span>

      {optional ? (
        <span className="text-xs font-medium text-slate-500">
          Opcional
        </span>
      ) : null}
    </span>
  )
}

function ScheduleStatus({
  configured
}: {
  configured: boolean
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
        configured
          ? 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100'
          : 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100'
      }`}
    >
      {configured
        ? 'Configurado'
        : 'Em falta'}
    </span>
  )
}

export default function WeeklyScheduleSetupStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: WeeklyScheduleSetupStepProps) {
  const [
    form,
    setForm
  ] =
    useState<ScheduleFormState>(
      () =>
        createInitialScheduleForm(
          snapshot
        )
    )

  const [
    scheduleFormBaseline,
    setScheduleFormBaseline
  ] =
    useState<ScheduleFormState>(
      () =>
        createInitialScheduleForm(
          snapshot
        )
    )

  const [
    busy,
    setBusy
  ] =
    useState(false)

  const [
    error,
    setError
  ] =
    useState('')

  const [
    success,
    setSuccess
  ] =
    useState('')

  const rootRef =
    useRef<HTMLDivElement>(null)

  const hasUnsavedScheduleDraft =
    !areScheduleFormsEqual(
      form,
      scheduleFormBaseline
    )

  const hasProtectedScheduleWork =
    hasUnsavedScheduleDraft || busy

  useMAProfessorUnsavedWorkspaceProtection(
    hasProtectedScheduleWork,
    rootRef,
    busy
      ? SAVING_SCHEDULE_MESSAGE
      : UNSAVED_SCHEDULE_DRAFT_MESSAGE
  )

  const assignments =
    useMemo(
      () =>
        snapshot
          .teachingAssignments
          .filter(
            (
              assignment
            ) =>
              assignment.active
          )
          .sort(
            (
              left,
              right
            ) =>
              left.displayName.localeCompare(
                right.displayName,
                'pt-PT',
                {
                  numeric: true,
                  sensitivity:
                    'base'
                }
              )
          ),
      [
        snapshot
          .teachingAssignments
      ]
    )

  const assignmentById =
    useMemo(
      () =>
        new Map(
          assignments.map(
            (
              assignment
            ) => [
              assignment.id,
              assignment
            ]
          )
        ),
      [
        assignments
      ]
    )

  const activeSlots =
    useMemo(
      () =>
        snapshot
          .weeklyScheduleSlots
          .filter(
            (
              slot
            ) =>
              slot.active
          )
          .sort(
            (
              left,
              right
            ) => {
              if (
                left.weekday !==
                right.weekday
              ) {
                return (
                  left.weekday -
                  right.weekday
                )
              }

              return left.startTime.localeCompare(
                right.startTime
              )
            }
          ),
      [
        snapshot
          .weeklyScheduleSlots
      ]
    )

  const slotsByAssignment =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          WeeklyScheduleSlot[]
        >()

      assignments.forEach(
        (
          assignment
        ) => {
          result.set(
            assignment.id,
            []
          )
        }
      )

      activeSlots.forEach(
        (
          slot
        ) => {
          const current =
            result.get(
              slot.teachingAssignmentId
            ) ??
            []

          current.push(
            slot
          )

          result.set(
            slot.teachingAssignmentId,
            current
          )
        }
      )

      return result
    }, [
      assignments,
      activeSlots
    ])

  const slotsByWeekday =
    useMemo(() => {
      const result =
        new Map<
          Weekday,
          WeeklyScheduleSlot[]
        >()

      weekdays.forEach(
        (
          weekday
        ) => {
          result.set(
            weekday.value,
            []
          )
        }
      )

      activeSlots.forEach(
        (
          slot
        ) => {
          const current =
            result.get(
              slot.weekday
            ) ??
            []

          current.push(
            slot
          )

          result.set(
            slot.weekday,
            current
          )
        }
      )

      result.forEach(
        (
          slots
        ) => {
          slots.sort(
            (
              left,
              right
            ) =>
              left.startTime.localeCompare(
                right.startTime
              )
          )
        }
      )

      return result
    }, [
      activeSlots
    ])

  const uncoveredAssignments =
    useMemo(
      () =>
        assignments.filter(
          (
            assignment
          ) =>
            (
              slotsByAssignment.get(
                assignment.id
              ) ??
              []
            ).length ===
            0
        ),
      [
        assignments,
        slotsByAssignment
      ]
    )

  const selectedAssignment =
    useMemo(
      () =>
        assignmentById.get(
          form.teachingAssignmentId
        ) ??
        null,
      [
        assignmentById,
        form.teachingAssignmentId
      ]
    )

  const totalWeeklyPeriods =
    useMemo(
      () =>
        activeSlots.reduce(
          (
            total,
            slot
          ) =>
            total +
            slot.periodCount,
          0
        ),
      [
        activeSlots
      ]
    )

  async function refreshSnapshot() {
    const nextSnapshot =
      await maProfessorRepository.getSetupSnapshot(
        snapshot.academicYear.id
      )

    onSnapshotChange(
      nextSnapshot
    )

    return nextSnapshot
  }

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function confirmRetargetScheduleDraft() {
    if (!hasUnsavedScheduleDraft) {
      return true
    }

    return window.confirm(
      RETARGET_SCHEDULE_DRAFT_MESSAGE
    )
  }

  function requestSelectAssignment(
    teachingAssignmentId:
      EntityId
  ) {
    if (busy) {
      return false
    }

    if (
      teachingAssignmentId ===
      form.teachingAssignmentId
    ) {
      return true
    }

    if (
      !confirmRetargetScheduleDraft()
    ) {
      return false
    }

    const nextForm:
      ScheduleFormState = {
        ...form,
        teachingAssignmentId
      }

    setForm(nextForm)

    if (!hasUnsavedScheduleDraft) {
      setScheduleFormBaseline(
        nextForm
      )
    }

    clearMessages()

    return true
  }

  function resetForm(
    preserveAssignment =
      true
  ) {
    const nextForm:
      ScheduleFormState = {
        teachingAssignmentId:
          preserveAssignment
            ? form.teachingAssignmentId
            : '',
        weekday:
          form.weekday,
        startTime:
          '08:30',
        endTime:
          '09:20',
        periodCount:
          '1',
        validFrom:
          snapshot.academicYear.startDate,
        validUntil:
          snapshot.academicYear.endDate
      }

    setForm(nextForm)
    setScheduleFormBaseline(
      nextForm
    )
    clearMessages()
  }

  function requestResetForm(
    preserveAssignment =
      true
  ) {
    if (busy) {
      return
    }

    if (
      hasUnsavedScheduleDraft &&
      !window.confirm(
        UNSAVED_SCHEDULE_DRAFT_MESSAGE
      )
    ) {
      return
    }

    resetForm(
      preserveAssignment
    )
  }

  function requestSelectAssignmentFromList(
    teachingAssignmentId:
      EntityId
  ) {
    if (
      !requestSelectAssignment(
        teachingAssignmentId
      )
    ) {
      return
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  function validateForm() {
    if (
      !form.teachingAssignmentId
    ) {
      throw new Error(
        'Selecione a turma e a disciplina.'
      )
    }

    if (
      !assignmentById.has(
        form.teachingAssignmentId
      )
    ) {
      throw new Error(
        'A turma e disciplina selecionadas já não existem.'
      )
    }

    if (
      !weekdays.some(
        (
          weekday
        ) =>
          weekday.value ===
          form.weekday
      )
    ) {
      throw new Error(
        'Selecione um dia da semana válido.'
      )
    }

    if (
      !form.startTime ||
      !form.endTime
    ) {
      throw new Error(
        'Indique as horas de início e de fim.'
      )
    }

    if (
      form.startTime >=
      form.endTime
    ) {
      throw new Error(
        'A hora de início deve ser anterior à hora de fim.'
      )
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
      throw new Error(
        'O número de tempos deve ser um número inteiro superior a zero.'
      )
    }

    if (
      !form.validFrom ||
      !form.validUntil
    ) {
      throw new Error(
        'Indique o início e o fim da vigência deste horário.'
      )
    }

    if (
      form.validFrom >
      form.validUntil
    ) {
      throw new Error(
        'A data inicial da vigência não pode ser posterior à data final.'
      )
    }

    if (
      form.validFrom <
      snapshot.academicYear.startDate
    ) {
      throw new Error(
        'A vigência do horário não pode começar antes do início do ano letivo.'
      )
    }

    if (
      form.validUntil >
      snapshot.academicYear.endDate
    ) {
      throw new Error(
        'A vigência do horário não pode terminar depois do fim do ano letivo.'
      )
    }

    const conflict =
      activeSlots.find(
        (
          slot
        ) =>
          slot.weekday ===
            form.weekday &&
          dateRangesOverlap(
            slot.validFrom,
            slot.validUntil,
            form.validFrom,
            form.validUntil
          ) &&
          timeRangesOverlap(
            slot.startTime,
            slot.endTime,
            form.startTime,
            form.endTime
          )
      )

    if (
      conflict
    ) {
      const assignment =
        assignmentById.get(
          conflict.teachingAssignmentId
        )

      throw new Error(
        `Este horário sobrepõe-se a ${
          assignment
            ?.displayName ??
          'outra aula'
        }, à ${getWeekdayLabel(
          conflict.weekday
        )}, das ${conflict.startTime} às ${conflict.endTime}.`
      )
    }

    return {
      periodCount
    }
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      busy
    ) {
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const {
        periodCount
      } =
        validateForm()

      await maProfessorRepository.createWeeklyScheduleSlot(
        {
          academicYearId:
            snapshot.academicYear.id,
          teachingAssignmentId:
            form.teachingAssignmentId,
          weekday:
            form.weekday,
          startTime:
            form.startTime,
          endTime:
            form.endTime,
          periodCount,
          validFrom:
            form.validFrom,
          validUntil:
            form.validUntil,
          active: true
        }
      )

      const nextSnapshot =
        await refreshSnapshot()

      const nextUncoveredAssignment =
        nextSnapshot
          .teachingAssignments
          .filter(
            (
              assignment
            ) =>
              assignment.active
          )
          .find(
            (
              assignment
            ) =>
              !nextSnapshot
                .weeklyScheduleSlots
                .some(
                  (
                    slot
                  ) =>
                    slot.active &&
                    slot.teachingAssignmentId ===
                      assignment.id
                )
          )

      const nextForm:
        ScheduleFormState = {
          ...form,
          teachingAssignmentId:
            nextUncoveredAssignment
              ?.id ??
            form.teachingAssignmentId,
          startTime:
            '08:30',
          endTime:
            '09:20',
          periodCount:
            '1'
        }

      setForm(nextForm)
      setScheduleFormBaseline(
        nextForm
      )

      setSuccess(
        'Bloco de horário adicionado com sucesso.'
      )
    } catch (
      submitError
    ) {
      setError(
        getErrorMessage(
          submitError
        )
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleContinue() {
    if (
      busy
    ) {
      return
    }

    if (
      hasUnsavedScheduleDraft
    ) {
      setError(
        'Existe um bloco de horário por guardar neste passo. Adicione-o ao horário ou limpe o formulário antes de continuar.'
      )

      return
    }

    if (
      activeSlots.length ===
      0
    ) {
      setError(
        'Adicione o horário semanal antes de continuar.'
      )

      return
    }

    if (
      uncoveredAssignments.length >
      0
    ) {
      setError(
        `Ainda faltam horários para: ${uncoveredAssignments
          .map(
            (
              assignment
            ) =>
              assignment.displayName
          )
          .join(', ')}.`
      )

      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await maProfessorRepository.completeSetupStep(
        snapshot.academicYear.id,
        'weekly_schedule'
      )

      const nextSnapshot =
        await maProfessorRepository.getSetupSnapshot(
          snapshot.academicYear.id
        )

      onSnapshotChange(
        nextSnapshot
      )

      onCompleted(
        nextSnapshot
      )
    } catch (
      continueError
    ) {
      setError(
        getErrorMessage(
          continueError
        )
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]"
    >
      <form
        onSubmit={
          handleSubmit
        }
        className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6"
      >
        <fieldset
          disabled={busy}
          className="contents"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Passo 7 de 9
          </p>

          <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Horário semanal
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
            Introduza os blocos semanais de cada turma e disciplina. O
            MA-Professor utilizará este horário para criar as aulas
            previstas e calcular a evolução das UFCD.
          </p>

          <div className="mt-7 space-y-5">
            <label className="block">
              <FieldLabel>
                Turma e disciplina
              </FieldLabel>

              <select
                value={
                  form.teachingAssignmentId
                }
                onChange={(
                  event
                ) =>
                  requestSelectAssignment(
                    event.target.value
                  )
                }
                required
                className={
                  inputClassName
                }
              >
                <option value="">
                  Selecione uma turma e disciplina
                </option>

                {assignments.map(
                  (
                    assignment
                  ) => (
                    <option
                      key={
                        assignment.id
                      }
                      value={
                        assignment.id
                      }
                    >
                      {
                        assignment.displayName
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            {selectedAssignment ? (
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                  Seleção atual
                </p>

                <p className="mt-2 font-black text-white">
                  {
                    selectedAssignment.displayName
                  }
                </p>

                <p className="mt-1 text-xs leading-6 text-slate-400">
                  Já possui{' '}
                  {
                    (
                      slotsByAssignment.get(
                        selectedAssignment.id
                      ) ??
                      []
                    ).length
                  }{' '}
                  {(
                    slotsByAssignment.get(
                      selectedAssignment.id
                    ) ??
                    []
                  ).length ===
                  1
                    ? 'bloco semanal'
                    : 'blocos semanais'}
                  .
                </p>
              </div>
            ) : null}

            <fieldset>
              <legend className="text-sm font-bold text-slate-200">
                Dia da semana
              </legend>

              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {weekdays.map(
                  (
                    weekday
                  ) => (
                    <button
                      key={
                        weekday.value
                      }
                      type="button"
                      onClick={() =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            weekday:
                              weekday.value
                          })
                        )
                      }
                      className={`rounded-xl border px-2 py-3 text-xs font-black transition ${
                        form.weekday ===
                        weekday.value
                          ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                      aria-label={
                        weekday.label
                      }
                    >
                      {
                        weekday.shortLabel
                      }
                    </button>
                  )
                )}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>
                  Hora de início
                </FieldLabel>

                <input
                  type="time"
                  value={
                    form.startTime
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        startTime:
                          event
                            .target
                            .value
                      })
                    )
                  }
                  required
                  className={
                    inputClassName
                  }
                />
              </label>

              <label className="block">
                <FieldLabel>
                  Hora de fim
                </FieldLabel>

                <input
                  type="time"
                  value={
                    form.endTime
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        endTime:
                          event
                            .target
                            .value
                      })
                    )
                  }
                  required
                  className={
                    inputClassName
                  }
                />
              </label>
            </div>

            <label className="block">
              <FieldLabel>
                Número de tempos
              </FieldLabel>

              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={
                  form.periodCount
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      periodCount:
                        event
                          .target
                          .value
                    })
                  )
                }
                placeholder="1"
                required
                className={
                  inputClassName
                }
              />

              <p className="mt-2 text-xs leading-6 text-slate-500">
                Exemplo: uma aula consecutiva de 100 minutos pode
                corresponder a 2 tempos.
              </p>
            </label>

            <fieldset className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <legend className="px-2 text-sm font-bold text-slate-200">
                Vigência deste horário
              </legend>

              <p className="mt-1 text-xs leading-6 text-slate-500">
                Permite alterar o horário durante o ano sem apagar o
                horário anterior.
              </p>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel>
                    Válido desde
                  </FieldLabel>

                  <input
                    type="date"
                    min={
                      snapshot.academicYear.startDate
                    }
                    max={
                      snapshot.academicYear.endDate
                    }
                    value={
                      form.validFrom
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          validFrom:
                            event
                              .target
                              .value
                        })
                      )
                    }
                    required
                    className={
                      inputClassName
                    }
                  />
                </label>

                <label className="block">
                  <FieldLabel>
                    Válido até
                  </FieldLabel>

                  <input
                    type="date"
                    min={
                      form.validFrom ||
                      snapshot.academicYear.startDate
                    }
                    max={
                      snapshot.academicYear.endDate
                    }
                    value={
                      form.validUntil
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          validUntil:
                            event
                              .target
                              .value
                        })
                      )
                    }
                    required
                    className={
                      inputClassName
                    }
                  />
                </label>
              </div>
            </fieldset>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
            >
              {error}
            </div>
          ) : null}

          {success ? (
            <div
              role="status"
              className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm leading-6 text-emerald-100"
            >
              {success}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={
                busy
              }
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-55"
            >
              {busy
                ? 'A guardar...'
                : 'Adicionar ao horário'}
            </button>

            <button
              type="button"
              disabled={
                busy
              }
              onClick={() =>
                requestResetForm(
                  false
                )
              }
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3.5 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
            >
              Limpar
            </button>
          </div>
        </fieldset>
      </form>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Horário semanal
            </p>

            <h3 className="mt-2 text-xl font-black text-white">
              Aulas configuradas
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
              {
                activeSlots.length
              }{' '}
              {activeSlots.length ===
              1
                ? 'bloco'
                : 'blocos'}
            </span>

            <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-xs font-black text-violet-100">
              {
                totalWeeklyPeriods
              }{' '}
              {totalWeeklyPeriods ===
              1
                ? 'tempo semanal'
                : 'tempos semanais'}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {weekdays.map(
            (
              weekday
            ) => {
              const daySlots =
                slotsByWeekday.get(
                  weekday.value
                ) ??
                []

              return (
                <article
                  key={
                    weekday.value
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
                        {
                          weekday.shortLabel
                        }
                      </span>

                      <div>
                        <p className="font-black text-white">
                          {
                            weekday.label
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            daySlots.length
                          }{' '}
                          {daySlots.length ===
                          1
                            ? 'aula'
                            : 'aulas'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {daySlots.length ===
                  0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-center text-xs text-slate-600">
                      Sem aulas configuradas.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {daySlots.map(
                        (
                          slot
                        ) => {
                          const assignment =
                            assignmentById.get(
                              slot.teachingAssignmentId
                            )

                          return (
                            <div
                              key={
                                slot.id
                              }
                              className="rounded-xl border border-white/10 bg-slate-950/60 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-lg font-black text-cyan-100">
                                    {
                                      slot.startTime
                                    }
                                    {' — '}
                                    {
                                      slot.endTime
                                    }
                                  </p>

                                  <p className="mt-2 font-bold leading-6 text-white">
                                    {assignment
                                      ?.displayName ??
                                      'Turma e disciplina'}
                                  </p>
                                </div>

                                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs font-bold text-violet-100">
                                  {getPeriodLabel(
                                    slot.periodCount
                                  )}
                                </span>
                              </div>

                              <p className="mt-3 text-xs leading-5 text-slate-500">
                                Válido de{' '}
                                {formatDate(
                                  slot.validFrom
                                )}{' '}
                                até{' '}
                                {formatDate(
                                  slot.validUntil
                                )}
                              </p>
                            </div>
                          )
                        }
                      )}
                    </div>
                  )}
                </article>
              )
            }
          )}
        </div>

        <div className="mt-6 space-y-3">
          {assignments.map(
            (
              assignment
            ) => {
              const assignmentSlots =
                slotsByAssignment.get(
                  assignment.id
                ) ??
                []

              const configured =
                assignmentSlots.length >
                0

              return (
                <article
                  key={
                    assignment.id
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">
                        {
                          assignment.displayName
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {
                          assignmentSlots.length
                        }{' '}
                        {assignmentSlots.length ===
                        1
                          ? 'bloco semanal'
                          : 'blocos semanais'}
                      </p>
                    </div>

                    <ScheduleStatus
                      configured={
                        configured
                      }
                    />
                  </div>

                  {!configured ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        requestSelectAssignmentFromList(
                          assignment.id
                        )
                      }
                      className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-xs font-bold text-slate-400 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.05] hover:text-cyan-100 disabled:cursor-wait disabled:opacity-50"
                    >
                      Adicionar horário
                    </button>
                  ) : null}
                </article>
              )
            }
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[0.055] p-4">
          <p className="text-sm font-bold text-violet-100">
            Cada turma e disciplina deve ter pelo menos um bloco
            semanal.
          </p>

          <p className="mt-2 text-xs leading-6 text-violet-100/65">
            Os feriados, interrupções, visitas de estudo, greves e
            faltas do professor serão configurados posteriormente no
            calendário escolar.
          </p>
        </div>

        {uncoveredAssignments.length >
        0 ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
            <p className="text-sm font-bold text-amber-100">
              Ainda faltam horários para{' '}
              {
                uncoveredAssignments.length
              }{' '}
              {uncoveredAssignments.length ===
              1
                ? 'turma e disciplina'
                : 'turmas e disciplinas'}
              .
            </p>
          </div>
        ) : null}

        <button
          type="button"
          disabled={
            busy ||
            activeSlots.length ===
              0 ||
            uncoveredAssignments.length >
              0
          }
          onClick={() =>
            void handleContinue()
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3.5 text-sm font-black text-white transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar horário e continuar
        </button>
      </section>
    </div>
  )
}
