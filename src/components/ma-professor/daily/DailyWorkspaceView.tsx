import { useCallback, useEffect, useMemo, useState } from 'react'

import { getAssessmentActivityTypeLabel } from '../assessments/assessmentRepository'
import type {
  AssessmentActivityType,
  EntityId,
  GIAEStatus,
  ISODate,
  LessonStatus,
  Score,
  SummarySource
} from '../types'
import {
  dailyWorkspaceRepository,
  type DailyAssessmentStatus,
  type DailyDateWorkspace,
  type DailyStudentRow
} from './dailyWorkspaceRepository'

interface DailyWorkspaceViewProps {
  academicYearId: EntityId
  initialDate?: ISODate
  initialLessonId?: EntityId
  onSaved?: () => void | Promise<void>
}

interface LessonFormState {
  status: LessonStatus
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

interface AssessmentFormState {
  choice: 'none' | 'new' | EntityId
  criterionId: EntityId
  title: string
  activityType: AssessmentActivityType
  description: string
}

interface StudentEditorRow extends DailyStudentRow {
  assessmentScoreText: string
}

interface SaveOptions {
  reload?: boolean
  announce?: boolean
}

const activityTypeOptions: AssessmentActivityType[] = [
  'participation',
  'practical_work',
  'presentation',
  'written_work',
  'test',
  'other'
]

const assessmentStatusOptions: Array<{
  value: DailyAssessmentStatus
  label: string
}> = [
  { value: 'not_evaluated', label: 'Não avaliado' },
  { value: 'evaluated', label: 'Avaliado' },
  { value: 'absent', label: 'Faltou' },
  { value: 'exempt', label: 'Dispensado' }
]

const inputClassName =
  'w-full min-w-0 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45'

const compactInputClassName =
  'w-full min-w-0 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45'

function todayISO(): ISODate {
  const date = new Date()

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function addDays(value: ISODate, amount: number): ISODate {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  date.setUTCDate(date.getUTCDate() + amount)

  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function parseISODate(value: ISODate) {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function formatShortWeekday(value: ISODate) {
  const date = parseISODate(value)
  const weekday = new Intl.DateTimeFormat('pt-PT', {
    weekday: 'short'
  })
    .format(date)
    .replace('.', '')

  return `${weekday} ${String(date.getDate()).padStart(2, '0')}/${String(
    date.getMonth() + 1
  ).padStart(2, '0')}`
}

function formatWeekRange(startDate: ISODate, endDate: ISODate) {
  const start = parseISODate(startDate)
  const end = parseISODate(endDate)
  const sameYear = start.getFullYear() === end.getFullYear()

  const startLabel = new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' })
  }).format(start)

  const endLabel = new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(end)

  return `${startLabel} — ${endLabel}`
}

function formatScore(value: Score | null) {
  return value === null
    ? '—'
    : new Intl.NumberFormat('pt-PT', {
        maximumFractionDigits: 2
      }).format(value)
}

function formatPercent(value: number | null) {
  return value === null
    ? '—'
    : `${new Intl.NumberFormat('pt-PT', {
        maximumFractionDigits: 1
      }).format(value)}%`
}

function getModuleLabel(code: string, name: string) {
  return code.trim() ? `${code.trim()} — ${name}` : name
}

function getSubjectLabel(shortName: string, name: string) {
  return shortName.trim() || name
}

function lessonStatusLabel(status: LessonStatus) {
  const labels: Record<LessonStatus, string> = {
    planned: 'Planeada',
    taught: 'Dada',
    cancelled: 'Cancelada'
  }

  return labels[status]
}

function lessonStatusClasses(status: LessonStatus) {
  if (status === 'taught') {
    return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
  }

  if (status === 'cancelled') {
    return 'border-rose-300/25 bg-rose-300/10 text-rose-100'
  }

  return 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'
}

function buildLessonForm(
  workspace: NonNullable<DailyDateWorkspace['selectedLesson']>
): LessonFormState {
  const lesson = workspace.context.lessonRow.lesson

  return {
    status: lesson.status,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    periodCount: String(lesson.periodCount),
    countTowardProgress: lesson.countTowardProgress,
    plannedActivity: lesson.plannedActivity,
    summary: lesson.summary,
    summarySource: lesson.summarySource,
    planificationItemIds: [...lesson.planificationItemIds],
    notes: lesson.notes,
    giaeStatus: lesson.giaeStatus
  }
}

function buildAssessmentForm(
  workspace: NonNullable<DailyDateWorkspace['selectedLesson']>
): AssessmentFormState {
  if (workspace.selectedAssessment) {
    return {
      choice: workspace.selectedAssessment.id,
      criterionId: workspace.selectedAssessment.criterionId,
      title: workspace.selectedAssessment.title,
      activityType: workspace.selectedAssessment.activityType,
      description: workspace.selectedAssessment.description
    }
  }

  return {
    choice: 'none',
    criterionId: workspace.assessmentWorkspace.criteria[0]?.id ?? '',
    title: '',
    activityType: 'practical_work',
    description: ''
  }
}

function buildStudentRows(rows: DailyStudentRow[]): StudentEditorRow[] {
  return rows.map(row => ({
    ...row,
    assessmentScoreText:
      row.assessmentStatus === 'evaluated' && row.assessmentScore !== null
        ? String(row.assessmentScore)
        : ''
  }))
}

function buildEditorSignature(
  lessonForm: LessonFormState | null,
  assessmentForm: AssessmentFormState | null,
  students: StudentEditorRow[]
) {
  if (!lessonForm || !assessmentForm) {
    return ''
  }

  return JSON.stringify({
    lesson: lessonForm,
    assessment: assessmentForm,
    students: students.map(row => ({
      studentId: row.student.id,
      attendanceStatus: row.attendanceStatus,
      attendanceCode: row.attendanceCode,
      attendanceNote: row.attendanceNote,
      assessmentStatus: row.assessmentStatus,
      assessmentScoreText: row.assessmentScoreText,
      assessmentNote: row.assessmentNote
    }))
  })
}

export default function DailyWorkspaceView({
  academicYearId,
  initialDate,
  initialLessonId,
  onSaved
}: DailyWorkspaceViewProps) {
  const [date, setDate] = useState<ISODate>(initialDate ?? todayISO())
  const [workspace, setWorkspace] = useState<DailyDateWorkspace | null>(null)
  const [lessonForm, setLessonForm] = useState<LessonFormState | null>(null)
  const [assessmentForm, setAssessmentForm] =
    useState<AssessmentFormState | null>(null)
  const [students, setStudents] = useState<StudentEditorRow[]>([])
  const [savedSignature, setSavedSignature] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showAssessmentDetails, setShowAssessmentDetails] = useState(false)
  const [showStudentDetails, setShowStudentDetails] = useState(false)

  const hydrate = useCallback((nextWorkspace: DailyDateWorkspace) => {
    setWorkspace(nextWorkspace)

    if (!nextWorkspace.selectedLesson) {
      setLessonForm(null)
      setAssessmentForm(null)
      setStudents([])
      setSavedSignature('')
      return
    }

    const nextLessonForm = buildLessonForm(nextWorkspace.selectedLesson)
    const nextAssessmentForm = buildAssessmentForm(
      nextWorkspace.selectedLesson
    )
    const nextStudents = buildStudentRows(
      nextWorkspace.selectedLesson.students
    )

    setLessonForm(nextLessonForm)
    setAssessmentForm(nextAssessmentForm)
    setStudents(nextStudents)

    setSavedSignature(
      buildEditorSignature(
        nextLessonForm,
        nextAssessmentForm,
        nextStudents
      )
    )
  }, [])

  const loadDate = useCallback(
    async (
      nextDate: ISODate,
      requestedLessonId?: EntityId | null,
      requestedAssessmentId?: EntityId | null
    ) => {
      setLoading(true)
      setError('')
      setSuccess('')

      try {
        const nextWorkspace =
          await dailyWorkspaceRepository.getDateWorkspace(
            academicYearId,
            nextDate,
            requestedLessonId,
            requestedAssessmentId
          )

        hydrate(nextWorkspace)
      } catch (loadError) {
        setError(dailyWorkspaceRepository.describeError(loadError))
      } finally {
        setLoading(false)
      }
    },
    [academicYearId, hydrate]
  )

  useEffect(() => {
    const nextDate = initialDate ?? todayISO()

    setDate(nextDate)
    void loadDate(nextDate, initialLessonId)
  }, [initialDate, initialLessonId, loadDate])

  const selectedLesson = workspace?.selectedLesson ?? null
  const lessonRow = selectedLesson?.context.lessonRow ?? null
  const assessmentWorkspace = selectedLesson?.assessmentWorkspace ?? null

  const assessmentEnabled =
    assessmentForm !== null && assessmentForm.choice !== 'none'

  const selectedAssessmentId =
    assessmentForm &&
    assessmentForm.choice !== 'none' &&
    assessmentForm.choice !== 'new'
      ? assessmentForm.choice
      : null

  const presentCount = useMemo(
    () =>
      students.filter(row => row.attendanceStatus === 'present').length,
    [students]
  )

  const absentCount = students.length - presentCount

  const currentEditorSignature = useMemo(
    () => buildEditorSignature(lessonForm, assessmentForm, students),
    [assessmentForm, lessonForm, students]
  )

  const hasUnsavedChanges = Boolean(
    currentEditorSignature &&
      currentEditorSignature !== savedSignature
  )

  const weekTimeSlots = useMemo(() => {
    const slots = new Map<
      string,
      {
        startTime: string
        endTime: string
      }
    >()

    workspace?.weekDays.forEach(day => {
      day.lessons.forEach(row => {
        const key = `${row.lesson.startTime}-${row.lesson.endTime}`

        if (!slots.has(key)) {
          slots.set(key, {
            startTime: row.lesson.startTime,
            endTime: row.lesson.endTime
          })
        }
      })
    })

    return [...slots.values()].sort((left, right) => {
      const startComparison = left.startTime.localeCompare(right.startTime)

      return startComparison !== 0
        ? startComparison
        : left.endTime.localeCompare(right.endTime)
    })
  }, [workspace?.weekDays])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  function updateLessonForm<Key extends keyof LessonFormState>(
    key: Key,
    value: LessonFormState[Key]
  ) {
    setLessonForm(current =>
      current
        ? {
            ...current,
            [key]: value
          }
        : current
    )
  }

  function updateStudent(
    studentId: EntityId,
    changes: Partial<StudentEditorRow>
  ) {
    setStudents(current =>
      current.map(row =>
        row.student.id === studentId
          ? {
              ...row,
              ...changes
            }
          : row
      )
    )
  }

  function closeSecondaryPanels() {
    setShowAdvanced(false)
    setShowAssessmentDetails(false)
    setShowStudentDetails(false)
  }

  async function saveBeforeNavigation() {
    if (!hasUnsavedChanges) {
      return true
    }

    return saveAll({
      reload: false,
      announce: false
    })
  }

  async function changeDate(
    nextDate: ISODate,
    requestedLessonId?: EntityId | null
  ) {
    if (loading || saving) {
      return
    }

    if (
      nextDate === date &&
      (!requestedLessonId ||
        requestedLessonId === workspace?.selectedLessonId)
    ) {
      return
    }

    if (!(await saveBeforeNavigation())) {
      return
    }

    closeSecondaryPanels()
    setDate(nextDate)
    await loadDate(nextDate, requestedLessonId)
  }

  async function selectLesson(lessonDate: ISODate, lessonId: EntityId) {
    if (
      loading ||
      saving ||
      (lessonDate === date && workspace?.selectedLessonId === lessonId)
    ) {
      return
    }

    await changeDate(lessonDate, lessonId)
  }

  async function changeAssessment(choice: string) {
    if (!selectedLesson || !assessmentWorkspace || saving) {
      return
    }

    if (choice === 'none' || choice === 'new') {
      setAssessmentForm({
        choice,
        criterionId: assessmentWorkspace.criteria[0]?.id ?? '',
        title: '',
        activityType: 'practical_work',
        description: ''
      })

      setStudents(current =>
        current.map(row => ({
          ...row,
          assessmentStatus:
            choice === 'new' && row.attendanceStatus === 'absent'
              ? 'absent'
              : 'not_evaluated',
          assessmentScore: null,
          assessmentScoreText: '',
          assessmentNote: ''
        }))
      )

      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const nextSelectedLesson =
        await dailyWorkspaceRepository.getLessonWorkspace(
          academicYearId,
          selectedLesson.context.lessonRow.lesson.id,
          choice
        )

      setWorkspace(current =>
        current
          ? {
              ...current,
              selectedLesson: nextSelectedLesson
            }
          : current
      )

      setAssessmentForm(buildAssessmentForm(nextSelectedLesson))

      setStudents(current => {
        const currentAttendanceByStudent = new Map(
          current.map(row => [
            row.student.id,
            {
              attendanceStatus: row.attendanceStatus,
              attendanceCode: row.attendanceCode,
              attendanceNote: row.attendanceNote
            }
          ])
        )

        return buildStudentRows(nextSelectedLesson.students).map(row => ({
          ...row,
          ...(currentAttendanceByStudent.get(row.student.id) ?? {})
        }))
      })
    } catch (loadError) {
      setError(dailyWorkspaceRepository.describeError(loadError))
    } finally {
      setLoading(false)
    }
  }

  function useNextPlanificationItem() {
    if (!selectedLesson || !lessonForm) {
      return
    }

    const item = selectedLesson.context.nextPlanificationItem

    if (!item) {
      return
    }

    setLessonForm({
      ...lessonForm,
      status:
        lessonForm.status === 'planned'
          ? 'taught'
          : lessonForm.status,
      plannedActivity:
        item.activity.trim() || item.content.trim(),
      summary:
        item.suggestedSummary.trim() || item.content.trim(),
      summarySource: 'planification',
      planificationItemIds: [item.id]
    })
  }

  function copyPreviousLesson() {
    if (!selectedLesson || !lessonForm) {
      return
    }

    const previous = selectedLesson.context.previousLessonTemplate

    if (!previous) {
      return
    }

    setLessonForm({
      ...lessonForm,
      status:
        lessonForm.status === 'planned'
          ? 'taught'
          : lessonForm.status,
      plannedActivity: previous.plannedActivity,
      summary: previous.summary,
      summarySource: 'manual',
      planificationItemIds: [],
      notes: previous.notes
    })
  }

  function markAllPresent() {
    setStudents(current =>
      current.map(row => ({
        ...row,
        attendanceStatus: 'present',
        attendanceCode: '',
        attendanceNote: '',
        assessmentStatus:
          assessmentEnabled &&
          row.attendanceStatus === 'absent' &&
          row.assessmentStatus === 'absent'
            ? 'not_evaluated'
            : row.assessmentStatus
      }))
    )
  }

  function toggleAttendance(row: StudentEditorRow) {
    const willBeAbsent = row.attendanceStatus === 'present'

    updateStudent(row.student.id, {
      attendanceStatus:
        willBeAbsent
          ? 'absent'
          : 'present',
      attendanceCode:
        willBeAbsent
          ? row.attendanceCode || 'F'
          : '',
      attendanceNote:
        willBeAbsent
          ? row.attendanceNote
          : '',
      assessmentStatus:
        assessmentEnabled &&
        willBeAbsent &&
        row.assessmentStatus === 'not_evaluated'
          ? 'absent'
          : assessmentEnabled &&
              !willBeAbsent &&
              row.assessmentStatus === 'absent'
            ? 'not_evaluated'
            : row.assessmentStatus,
      assessmentScore:
        assessmentEnabled &&
        willBeAbsent &&
        row.assessmentStatus === 'not_evaluated'
          ? null
          : row.assessmentScore,
      assessmentScoreText:
        assessmentEnabled &&
        willBeAbsent &&
        row.assessmentStatus === 'not_evaluated'
          ? ''
          : row.assessmentScoreText
    })
  }

  function changeScore(
    row: StudentEditorRow,
    value: string
  ) {
    updateStudent(row.student.id, {
      assessmentScoreText: value,
      assessmentStatus:
        value.trim()
          ? 'evaluated'
          : 'not_evaluated',
      assessmentScore: null
    })
  }

  async function saveAll(
    options: SaveOptions = {}
  ): Promise<boolean> {
    const {
      reload = true,
      announce = true
    } = options

    if (
      !selectedLesson ||
      !lessonForm ||
      !assessmentForm ||
      saving
    ) {
      return false
    }

    const periodCount = Number(lessonForm.periodCount)

    const effectiveStatus: LessonStatus =
      lessonForm.status === 'cancelled'
        ? 'cancelled'
        : lessonForm.summary.trim()
          ? 'taught'
          : lessonForm.status

    if (
      effectiveStatus !== 'taught' &&
      absentCount > 0
    ) {
      setError(
        'Escreva o sumário antes de guardar faltas nesta aula.'
      )
      setSuccess('')
      return false
    }

    setSaving(true)
    setError('')

    if (announce) {
      setSuccess('')
    }

    try {
      const result =
        await dailyWorkspaceRepository.saveLesson({
          lessonId:
            selectedLesson.context.lessonRow.lesson.id,
          status: effectiveStatus,
          startTime: lessonForm.startTime,
          endTime: lessonForm.endTime,
          periodCount,
          countTowardProgress:
            lessonForm.countTowardProgress,
          plannedActivity:
            lessonForm.plannedActivity,
          summary: lessonForm.summary,
          summarySource:
            lessonForm.summarySource,
          planificationItemIds:
            lessonForm.planificationItemIds,
          notes: lessonForm.notes,
          giaeStatus: lessonForm.giaeStatus,
          students: students.map(row => {
            const normalizedScore = Number(
              row.assessmentScoreText.replace(',', '.')
            )

            return {
              studentId: row.student.id,
              attendanceStatus:
                row.attendanceStatus,
              attendanceCode:
                row.attendanceCode,
              attendanceNote:
                row.attendanceNote,
              assessmentStatus:
                row.assessmentStatus,
              assessmentScore:
                row.assessmentStatus === 'evaluated' &&
                row.assessmentScoreText.trim()
                  ? normalizedScore
                  : null,
              assessmentNote:
                row.assessmentNote
            }
          }),
          assessment: {
            mode:
              assessmentForm.choice === 'none'
                ? 'none'
                : assessmentForm.choice === 'new'
                  ? 'new'
                  : 'existing',
            assessmentId: selectedAssessmentId,
            criterionId:
              assessmentForm.criterionId,
            title: assessmentForm.title,
            activityType:
              assessmentForm.activityType,
            description:
              assessmentForm.description
          }
        })

      if (reload) {
        await loadDate(
          date,
          result.lesson.id,
          result.assessmentId
        )
      } else {
        setSavedSignature(currentEditorSignature)
      }

      if (announce) {
        setSuccess(
          'Aula, sumário, faltas e avaliações guardados.'
        )
      }

      if (onSaved) {
        await onSaved()
      }

      return true
    } catch (saveError) {
      setError(
        dailyWorkspaceRepository.describeError(saveError)
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-3 py-4 text-white sm:px-5 lg:px-7">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-3 shadow-2xl shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void changeDate(
                    workspace?.previousWeekDate ??
                    addDays(date, -7)
                  )
                }
                disabled={loading || saving}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-white disabled:opacity-40"
                aria-label="Semana anterior"
              >
                ‹
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-300">
                  Horário semanal
                </p>

                <h1 className="mt-0.5 truncate text-base font-black capitalize sm:text-xl">
                  {workspace
                    ? formatWeekRange(
                        workspace.weekStartDate,
                        workspace.weekEndDate
                      )
                    : 'A preparar a semana…'}
                </h1>
              </div>

              <button
                type="button"
                onClick={() =>
                  void changeDate(
                    workspace?.nextWeekDate ??
                    addDays(date, 7)
                  )
                }
                disabled={loading || saving}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-white disabled:opacity-40"
                aria-label="Semana seguinte"
              >
                ›
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={event => {
                  if (event.target.value) {
                    void changeDate(event.target.value)
                  }
                }}
                disabled={loading || saving}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-300/50 disabled:opacity-50 sm:flex-none"
              />

              <button
                type="button"
                onClick={() =>
                  void changeDate(todayISO())
                }
                disabled={loading || saving}
                className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-40"
              >
                Hoje
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto pb-1">
            <div className="min-w-[900px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
              <div className="grid grid-cols-[8rem_repeat(5,minmax(0,1fr))] border-b border-white/10 bg-slate-900/80">
                <div className="flex items-center justify-center border-r border-white/10 px-3 py-3 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">
                  Hora
                </div>

                {workspace?.weekDays.map(day => {
                  const selected = day.date === date

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() =>
                        void changeDate(day.date)
                      }
                      disabled={loading || saving}
                      className={`border-r border-white/10 px-3 py-3 text-center text-xs font-black capitalize transition last:border-r-0 ${
                        selected
                          ? 'bg-cyan-300/10 text-cyan-100'
                          : day.isToday
                            ? 'text-cyan-200 hover:bg-white/[0.04]'
                            : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {formatShortWeekday(day.date)}
                    </button>
                  )
                })}
              </div>

              {weekTimeSlots.map(slot => (
                <div
                  key={`${slot.startTime}-${slot.endTime}`}
                  className="grid grid-cols-[8rem_repeat(5,minmax(0,1fr))] border-b border-white/10 last:border-b-0"
                >
                  <div className="flex items-start justify-center border-r border-white/10 bg-slate-900/45 px-2 py-3 text-center text-xs font-black text-slate-300">
                    <span>
                      {slot.startTime}
                      <br />

                      <span className="text-slate-600">
                        {slot.endTime}
                      </span>
                    </span>
                  </div>

                  {workspace?.weekDays.map(day => {
                    const lessons = day.lessons.filter(
                      row =>
                        row.lesson.startTime === slot.startTime &&
                        row.lesson.endTime === slot.endTime
                    )

                    const selectedDay = day.date === date

                    return (
                      <div
                        key={`${day.date}-${slot.startTime}-${slot.endTime}`}
                        className={`min-h-[5.4rem] border-r border-white/10 p-1.5 last:border-r-0 ${
                          selectedDay
                            ? 'bg-cyan-300/[0.025]'
                            : ''
                        }`}
                      >
                        <div className="space-y-1.5">
                          {lessons.map(row => {
                            const active =
                              workspace.selectedLessonId ===
                              row.lesson.id

                            const cancelled =
                              row.lesson.status === 'cancelled'

                            return (
                              <button
                                key={row.lesson.id}
                                type="button"
                                onClick={() =>
                                  void selectLesson(
                                    day.date,
                                    row.lesson.id
                                  )
                                }
                                disabled={loading || saving}
                                className={`w-full rounded-xl border px-2.5 py-2 text-left transition disabled:opacity-50 ${
                                  active
                                    ? 'border-cyan-300/60 bg-cyan-300/15 shadow-md shadow-cyan-950/20'
                                    : cancelled
                                      ? 'border-rose-300/20 bg-rose-300/[0.06] opacity-70 hover:border-rose-300/35'
                                      : 'border-white/10 bg-slate-900/70 hover:border-cyan-300/30 hover:bg-cyan-300/[0.055]'
                                }`}
                              >
                                <span
                                  className={`block truncate text-xs font-black ${
                                    active
                                      ? 'text-cyan-100'
                                      : cancelled
                                        ? 'text-rose-100'
                                        : 'text-white'
                                  }`}
                                >
                                  {row.group.name} ·{' '}
                                  {getSubjectLabel(
                                    row.subject.shortName,
                                    row.subject.name
                                  )}
                                </span>

                                <span className="mt-1 block truncate text-[0.66rem] font-semibold text-slate-500">
                                  {row.module.code ||
                                    row.module.name}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {!loading &&
              weekTimeSlots.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  Não existem aulas nesta semana.
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-500">
              Selecione uma aula para editar o sumário, as faltas e as
              avaliações abaixo.
            </p>

            {hasUnsavedChanges ? (
              <p className="font-black text-amber-200">
                Alterações por guardar na aula selecionada.
              </p>
            ) : lessonRow ? (
              <p className="font-bold text-emerald-200">
                Aula guardada.
              </p>
            ) : null}
          </div>
        </section>

        {loading && !lessonRow ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/60 px-5 py-14 text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

            <p className="mt-4 text-sm font-semibold text-slate-400">
              A preparar a aula…
            </p>
          </section>
        ) : null}

        {lessonRow &&
        lessonForm &&
        assessmentForm &&
        selectedLesson ? (
          <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-2xl shadow-black/20">
            <header className="border-b border-white/10 bg-slate-900 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black sm:text-2xl">
                      {lessonRow.group.name} ·{' '}
                      {getSubjectLabel(
                        lessonRow.subject.shortName,
                        lessonRow.subject.name
                      )}
                    </h2>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] ${lessonStatusClasses(
                        lessonForm.status
                      )}`}
                    >
                      {lessonStatusLabel(lessonForm.status)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    {getModuleLabel(
                      lessonRow.module.code,
                      lessonRow.module.name
                    )}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {lessonForm.startTime}–
                    {lessonForm.endTime} ·{' '}
                    {lessonForm.periodCount}{' '}
                    {lessonForm.periodCount === '1'
                      ? 'tempo'
                      : 'tempos'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAdvanced(
                      current => !current
                    )
                  }
                  className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                    showAdvanced
                      ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/30 hover:text-white'
                  }`}
                >
                  {showAdvanced
                    ? 'Fechar opções'
                    : 'Mais opções'}
                </button>
              </div>
            </header>

            <div className="space-y-4 p-4 sm:p-6">
              {lessonForm.status === 'cancelled' ? (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-bold text-rose-100">
                  Esta aula está cancelada. Pode alterar o estado em “Mais
                  opções”.
                </div>
              ) : null}

              <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-300">
                      Sumário
                    </p>

                    <h3 className="mt-1 text-lg font-black">
                      O que foi feito nesta aula?
                    </h3>

                    <p
                      className={`mt-1 text-xs font-bold ${
                        hasUnsavedChanges
                          ? 'text-amber-200'
                          : 'text-emerald-200'
                      }`}
                    >
                      {hasUnsavedChanges
                        ? 'Alterações por guardar'
                        : 'Guardado'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={useNextPlanificationItem}
                      disabled={
                        saving ||
                        !selectedLesson.context
                          .nextPlanificationItem ||
                        lessonForm.status === 'cancelled'
                      }
                      className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      Usar próximo da planificação
                    </button>

                    <button
                      type="button"
                      onClick={copyPreviousLesson}
                      disabled={
                        saving ||
                        !selectedLesson.context
                          .previousLessonTemplate ||
                        lessonForm.status === 'cancelled'
                      }
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      Copiar aula anterior
                    </button>

                    <button
                      type="button"
                      onClick={() => void saveAll()}
                      disabled={
                        loading ||
                        saving ||
                        !hasUnsavedChanges
                      }
                      className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving
                        ? 'A guardar…'
                        : hasUnsavedChanges
                          ? 'Guardar'
                          : 'Guardado'}
                    </button>
                  </div>
                </div>

                <textarea
                  value={lessonForm.summary}
                  onChange={event => {
                    const value = event.target.value

                    setLessonForm(current =>
                      current
                        ? {
                            ...current,
                            summary: value,
                            summarySource: 'manual',
                            status:
                              current.status === 'planned' &&
                              value.trim()
                                ? 'taught'
                                : current.status
                          }
                        : current
                    )
                  }}
                  disabled={
                    saving ||
                    lessonForm.status === 'cancelled'
                  }
                  rows={6}
                  placeholder="Escreva o sumário da aula…"
                  className={`${inputClassName} mt-4 resize-y text-base leading-7`}
                />

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-slate-500">
                    Ao escrever um sumário, uma aula planeada passa
                    automaticamente a aula dada quando guardar.
                  </p>

                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={
                        lessonForm.giaeStatus === 'submitted'
                      }
                      onChange={event =>
                        updateLessonForm(
                          'giaeStatus',
                          event.target.checked
                            ? 'submitted'
                            : 'pending'
                        )
                      }
                      disabled={
                        saving ||
                        lessonForm.status === 'cancelled' ||
                        !lessonForm.summary.trim()
                      }
                      className="h-4 w-4 accent-cyan-300"
                    />

                    Já submeti no GIAE
                  </label>
                </div>
              </section>

              {showAdvanced ? (
                <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 sm:p-5">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-amber-300">
                    Opções menos frequentes
                  </p>

                  <h3 className="mt-1 text-lg font-black">
                    Estado, horário e notas internas
                  </h3>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs font-bold text-slate-400">
                      Estado da aula

                      <select
                        value={lessonForm.status}
                        onChange={event =>
                          updateLessonForm(
                            'status',
                            event.target.value as LessonStatus
                          )
                        }
                        disabled={saving}
                        className={`${inputClassName} mt-1.5`}
                      >
                        <option value="planned">
                          Planeada
                        </option>

                        <option value="taught">
                          Dada
                        </option>

                        <option value="cancelled">
                          Cancelada
                        </option>
                      </select>
                    </label>

                    <label className="text-xs font-bold text-slate-400">
                      Hora de início

                      <input
                        type="time"
                        value={lessonForm.startTime}
                        onChange={event =>
                          updateLessonForm(
                            'startTime',
                            event.target.value
                          )
                        }
                        disabled={saving}
                        className={`${inputClassName} mt-1.5`}
                      />
                    </label>

                    <label className="text-xs font-bold text-slate-400">
                      Hora de fim

                      <input
                        type="time"
                        value={lessonForm.endTime}
                        onChange={event =>
                          updateLessonForm(
                            'endTime',
                            event.target.value
                          )
                        }
                        disabled={saving}
                        className={`${inputClassName} mt-1.5`}
                      />
                    </label>

                    <label className="text-xs font-bold text-slate-400">
                      Número de tempos

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={lessonForm.periodCount}
                        onChange={event =>
                          updateLessonForm(
                            'periodCount',
                            event.target.value
                          )
                        }
                        disabled={saving}
                        className={`${inputClassName} mt-1.5`}
                      />
                    </label>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={
                        lessonForm.countTowardProgress
                      }
                      onChange={event =>
                        updateLessonForm(
                          'countTowardProgress',
                          event.target.checked
                        )
                      }
                      disabled={
                        saving ||
                        lessonForm.status === 'cancelled'
                      }
                      className="h-4 w-4 accent-cyan-300"
                    />

                    Contabilizar estes tempos no progresso da UFCD
                  </label>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <label className="text-xs font-bold text-slate-400">
                      Atividade prevista

                      <textarea
                        value={lessonForm.plannedActivity}
                        onChange={event =>
                          updateLessonForm(
                            'plannedActivity',
                            event.target.value
                          )
                        }
                        disabled={saving}
                        rows={4}
                        placeholder="Atividade prevista para esta aula"
                        className={`${inputClassName} mt-1.5 resize-y`}
                      />
                    </label>

                    <label className="text-xs font-bold text-slate-400">
                      Nota privada do professor

                      <textarea
                        value={lessonForm.notes}
                        onChange={event =>
                          updateLessonForm(
                            'notes',
                            event.target.value
                          )
                        }
                        disabled={saving}
                        rows={4}
                        placeholder="Observações que não fazem parte do sumário"
                        className={`${inputClassName} mt-1.5 resize-y`}
                      />
                    </label>
                  </div>
                </section>
              ) : null}

              <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55">
                <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-300">
                      Turma
                    </p>

                    <h3 className="mt-1 text-lg font-black">
                      Alunos, faltas e notas
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {presentCount} presentes · {absentCount} faltas
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={markAllPresent}
                      disabled={
                        saving ||
                        lessonForm.status === 'cancelled'
                      }
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200 transition hover:border-white/20 disabled:opacity-35"
                    >
                      Todos presentes
                    </button>

                    {!assessmentEnabled ? (
                      <button
                        type="button"
                        onClick={() =>
                          void changeAssessment('new')
                        }
                        disabled={
                          saving ||
                          lessonForm.status === 'cancelled' ||
                          !assessmentWorkspace?.criteria.length
                        }
                        className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        + Registar avaliação
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setShowAssessmentDetails(
                            current => !current
                          )
                        }
                        className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100"
                      >
                        {showAssessmentDetails
                          ? 'Fechar detalhes'
                          : 'Detalhes da avaliação'}
                      </button>
                    )}
                  </div>
                </div>

                {!assessmentWorkspace?.criteria.length ? (
                  <div className="border-b border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100 sm:px-5">
                    Ainda não existem critérios de avaliação para esta
                    disciplina ou UFCD. Pode criá-los no Menu.
                  </div>
                ) : null}

                {assessmentEnabled && assessmentForm ? (
                  <div className="border-b border-cyan-300/15 bg-cyan-300/[0.04] px-4 py-4 sm:px-5">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.7fr)_auto] lg:items-end">
                      <label className="text-xs font-bold text-slate-400">
                        Nome da avaliação

                        <input
                          type="text"
                          value={assessmentForm.title}
                          onChange={event =>
                            setAssessmentForm(current =>
                              current
                                ? {
                                    ...current,
                                    title: event.target.value
                                  }
                                : current
                            )
                          }
                          disabled={saving}
                          placeholder="Ex.: Apresentação do projeto"
                          className={`${inputClassName} mt-1.5`}
                        />
                      </label>

                      <label className="text-xs font-bold text-slate-400">
                        Critério

                        <select
                          value={assessmentForm.criterionId}
                          onChange={event =>
                            setAssessmentForm(current =>
                              current
                                ? {
                                    ...current,
                                    criterionId:
                                      event.target.value
                                  }
                                : current
                            )
                          }
                          disabled={saving}
                          className={`${inputClassName} mt-1.5`}
                        >
                          <option value="">
                            Selecione…
                          </option>

                          {assessmentWorkspace?.criteria.map(
                            criterion => (
                              <option
                                key={criterion.id}
                                value={criterion.id}
                              >
                                {criterion.name} ·{' '}
                                {criterion.weightPercent}%
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          void changeAssessment('none')
                        }
                        disabled={saving}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-black text-slate-300 transition hover:border-rose-300/30 hover:text-rose-100"
                      >
                        {assessmentForm.choice === 'new'
                          ? 'Cancelar avaliação'
                          : 'Fechar sem alterar'}
                      </button>
                    </div>

                    {showAssessmentDetails ? (
                      <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 lg:grid-cols-3">
                        <label className="text-xs font-bold text-slate-400">
                          Atividade nesta aula

                          <select
                            value={assessmentForm.choice}
                            onChange={event =>
                              void changeAssessment(
                                event.target.value
                              )
                            }
                            disabled={saving || loading}
                            className={`${inputClassName} mt-1.5`}
                          >
                            <option value="new">
                              Nova avaliação
                            </option>

                            {assessmentWorkspace?.assessments.map(
                              item => (
                                <option
                                  key={item.assessment.id}
                                  value={item.assessment.id}
                                >
                                  {item.assessment.title}
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label className="text-xs font-bold text-slate-400">
                          Tipo de atividade

                          <select
                            value={assessmentForm.activityType}
                            onChange={event =>
                              setAssessmentForm(current =>
                                current
                                  ? {
                                      ...current,
                                      activityType:
                                        event.target
                                          .value as AssessmentActivityType
                                    }
                                  : current
                              )
                            }
                            disabled={saving}
                            className={`${inputClassName} mt-1.5`}
                          >
                            {activityTypeOptions.map(type => (
                              <option
                                key={type}
                                value={type}
                              >
                                {getAssessmentActivityTypeLabel(type)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-bold text-slate-400">
                          Descrição opcional

                          <input
                            type="text"
                            value={assessmentForm.description}
                            onChange={event =>
                              setAssessmentForm(current =>
                                current
                                  ? {
                                      ...current,
                                      description:
                                        event.target.value
                                    }
                                  : current
                              )
                            }
                            disabled={saving}
                            placeholder="Observação sobre a atividade"
                            className={`${inputClassName} mt-1.5`}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div
                  className={`grid items-center gap-2 border-b border-white/10 bg-slate-900/80 px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500 sm:px-4 ${
                    assessmentEnabled
                      ? 'grid-cols-[2.75rem_minmax(0,1fr)_4.75rem_5rem]'
                      : 'grid-cols-[2.75rem_minmax(0,1fr)_4.75rem]'
                  }`}
                >
                  <span className="text-center">
                    N.º
                  </span>

                  <span>
                    Aluno
                  </span>

                  <span className="text-center">
                    Falta
                  </span>

                  {assessmentEnabled ? (
                    <span className="text-center">
                      Nota
                    </span>
                  ) : null}
                </div>

                <div className="divide-y divide-white/10">
                  {students.map((row, index) => {
                    const absencePercent =
                      row.absenceSummary?.absencePercent ?? null

                    const hasAbsenceWarning =
                      absencePercent !== null &&
                      absencePercent >= 10

                    return (
                      <div key={row.student.id}>
                        <div
                          className={`grid items-center gap-2 px-3 py-3 sm:px-4 ${
                            assessmentEnabled
                              ? 'grid-cols-[2.75rem_minmax(0,1fr)_4.75rem_5rem]'
                              : 'grid-cols-[2.75rem_minmax(0,1fr)_4.75rem]'
                          }`}
                        >
                          <span className="text-center text-sm font-black text-slate-500">
                            {row.student.number || index + 1}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white sm:text-base">
                              {row.student.name}
                            </p>

                            {(hasAbsenceWarning ||
                              row.provisionalAverage !== null) && (
                              <p className="mt-0.5 truncate text-[0.68rem] font-semibold text-slate-500">
                                {row.provisionalAverage !== null
                                  ? `Média ${formatScore(
                                      row.provisionalAverage
                                    )}`
                                  : ''}

                                {row.provisionalAverage !== null &&
                                hasAbsenceWarning
                                  ? ' · '
                                  : ''}

                                {hasAbsenceWarning
                                  ? `Faltas ${formatPercent(
                                      absencePercent
                                    )}`
                                  : ''}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              toggleAttendance(row)
                            }
                            disabled={
                              saving ||
                              lessonForm.status === 'cancelled'
                            }
                            aria-pressed={
                              row.attendanceStatus === 'absent'
                            }
                            className={`rounded-xl border px-2 py-2 text-xs font-black transition disabled:opacity-35 ${
                              row.attendanceStatus === 'absent'
                                ? 'border-rose-300/40 bg-rose-300/15 text-rose-100'
                                : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-rose-300/30 hover:text-rose-100'
                            }`}
                          >
                            {row.attendanceStatus === 'absent'
                              ? 'F'
                              : '—'}
                          </button>

                          {assessmentEnabled ? (
                            row.assessmentStatus === 'absent' ? (
                              <span className="rounded-xl border border-rose-300/25 bg-rose-300/10 px-2 py-2 text-center text-xs font-black text-rose-100">
                                F
                              </span>
                            ) : row.assessmentStatus === 'exempt' ? (
                              <span className="rounded-xl border border-violet-300/25 bg-violet-300/10 px-2 py-2 text-center text-xs font-black text-violet-100">
                                D
                              </span>
                            ) : (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={row.assessmentScoreText}
                                onChange={event =>
                                  changeScore(
                                    row,
                                    event.target.value
                                  )
                                }
                                disabled={
                                  saving ||
                                  lessonForm.status === 'cancelled'
                                }
                                placeholder="0–20"
                                aria-label={`Classificação de ${row.student.name}`}
                                className={`${compactInputClassName} text-center font-black`}
                              />
                            )
                          ) : null}
                        </div>

                        {showStudentDetails ? (
                          <div className="grid gap-3 border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 sm:grid-cols-2 sm:px-4 lg:grid-cols-4">
                            <label className="text-[0.68rem] font-bold text-slate-500">
                              Código da falta

                              <input
                                type="text"
                                value={row.attendanceCode}
                                onChange={event =>
                                  updateStudent(
                                    row.student.id,
                                    {
                                      attendanceCode:
                                        event.target.value
                                    }
                                  )
                                }
                                disabled={
                                  saving ||
                                  row.attendanceStatus !== 'absent' ||
                                  lessonForm.status === 'cancelled'
                                }
                                placeholder="F"
                                className={`${compactInputClassName} mt-1`}
                              />
                            </label>

                            <label className="text-[0.68rem] font-bold text-slate-500">
                              Observação da falta

                              <input
                                type="text"
                                value={row.attendanceNote}
                                onChange={event =>
                                  updateStudent(
                                    row.student.id,
                                    {
                                      attendanceNote:
                                        event.target.value
                                    }
                                  )
                                }
                                disabled={
                                  saving ||
                                  row.attendanceStatus !== 'absent' ||
                                  lessonForm.status === 'cancelled'
                                }
                                placeholder="Motivo ou nota"
                                className={`${compactInputClassName} mt-1`}
                              />
                            </label>

                            {assessmentEnabled ? (
                              <label className="text-[0.68rem] font-bold text-slate-500">
                                Estado da avaliação

                                <select
                                  value={row.assessmentStatus}
                                  onChange={event => {
                                    const assessmentStatus =
                                      event.target
                                        .value as DailyAssessmentStatus

                                    updateStudent(
                                      row.student.id,
                                      {
                                        assessmentStatus,
                                        assessmentScore:
                                          assessmentStatus === 'evaluated'
                                            ? row.assessmentScore
                                            : null,
                                        assessmentScoreText:
                                          assessmentStatus === 'evaluated'
                                            ? row.assessmentScoreText
                                            : ''
                                      }
                                    )
                                  }}
                                  disabled={saving}
                                  className={`${compactInputClassName} mt-1`}
                                >
                                  {assessmentStatusOptions.map(
                                    option => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    )
                                  )}
                                </select>
                              </label>
                            ) : null}

                            {assessmentEnabled ? (
                              <label className="text-[0.68rem] font-bold text-slate-500">
                                Observação da avaliação

                                <input
                                  type="text"
                                  value={row.assessmentNote}
                                  onChange={event =>
                                    updateStudent(
                                      row.student.id,
                                      {
                                        assessmentNote:
                                          event.target.value
                                      }
                                    )
                                  }
                                  disabled={saving}
                                  placeholder="Observação opcional"
                                  className={`${compactInputClassName} mt-1`}
                                />
                              </label>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}

                  {students.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      Esta turma ainda não possui alunos ativos.
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 border-t border-white/10 bg-slate-900/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    Médias, percentagens e observações ficam escondidas
                    para a grelha diária continuar simples.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowStudentDetails(
                        current => !current
                      )
                    }
                    className="self-start rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300 transition hover:border-cyan-300/30 hover:text-white sm:self-auto"
                  >
                    {showStudentDetails
                      ? 'Ocultar detalhes dos alunos'
                      : 'Mostrar detalhes dos alunos'}
                  </button>
                </div>
              </section>
            </div>

            <footer className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-white/10 bg-slate-900/95 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-h-5 text-xs">
                {error ? (
                  <p
                    role="alert"
                    className="font-bold text-rose-200"
                  >
                    {error}
                  </p>
                ) : null}

                {success ? (
                  <p className="font-bold text-emerald-200">
                    {success}
                  </p>
                ) : null}

                {!error && !success ? (
                  <p
                    className={
                      hasUnsavedChanges
                        ? 'font-bold text-amber-200'
                        : 'text-slate-500'
                    }
                  >
                    {hasUnsavedChanges
                      ? 'Existem alterações por guardar.'
                      : 'Sumário, faltas e notas estão guardados em conjunto.'}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => void saveAll()}
                disabled={
                  loading ||
                  saving ||
                  !hasUnsavedChanges
                }
                className="rounded-xl bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving
                  ? 'A guardar…'
                  : hasUnsavedChanges
                    ? 'Guardar aula'
                    : 'Aula guardada'}
              </button>
            </footer>
          </article>
        ) : !loading && error ? (
          <section className="rounded-3xl border border-rose-300/20 bg-rose-300/10 px-5 py-8 text-center text-sm font-bold text-rose-100">
            {error}
          </section>
        ) : null}
      </div>
    </main>
  )
}
