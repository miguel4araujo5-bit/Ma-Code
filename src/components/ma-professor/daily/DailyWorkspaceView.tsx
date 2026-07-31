import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  getAssessmentActivityTypeLabel
} from '../assessments/assessmentRepository'

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

const fieldClassName =
  'w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-55'

const compactFieldClassName =
  'w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-2 text-xs text-white outline-none transition focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-55'

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
  {
    value: 'not_evaluated',
    label: 'Não avaliado'
  },
  {
    value: 'evaluated',
    label: 'Avaliado'
  },
  {
    value: 'absent',
    label: 'Faltou'
  },
  {
    value: 'exempt',
    label: 'Dispensado'
  }
]

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

function formatLongDate(value: ISODate) {
  const [year, month, day] = value.split('-').map(Number)

  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(year, month - 1, day))
}

function formatScore(value: Score | null) {
  if (value === null) {
    return '—'
  }

  return new Intl.NumberFormat('pt-PT', {
    maximumFractionDigits: 2
  }).format(value)
}

function formatPercent(value: number | null) {
  if (value === null) {
    return '—'
  }

  return `${new Intl.NumberFormat('pt-PT', {
    maximumFractionDigits: 1
  }).format(value)}%`
}

function getModuleLabel(code: string, name: string) {
  return code.trim() ? `${code.trim()} · ${name}` : name
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
      row.assessmentStatus === 'evaluated' &&
      row.assessmentScore !== null
        ? String(row.assessmentScore)
        : ''
  }))
}

export default function DailyWorkspaceView({
  academicYearId,
  onSaved
}: DailyWorkspaceViewProps) {
  const [date, setDate] = useState<ISODate>(todayISO)
  const [workspace, setWorkspace] =
    useState<DailyDateWorkspace | null>(null)
  const [lessonForm, setLessonForm] =
    useState<LessonFormState | null>(null)
  const [assessmentForm, setAssessmentForm] =
    useState<AssessmentFormState | null>(null)
  const [students, setStudents] = useState<StudentEditorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const hydrate = useCallback((nextWorkspace: DailyDateWorkspace) => {
    setWorkspace(nextWorkspace)

    if (!nextWorkspace.selectedLesson) {
      setLessonForm(null)
      setAssessmentForm(null)
      setStudents([])
      return
    }

    setLessonForm(buildLessonForm(nextWorkspace.selectedLesson))
    setAssessmentForm(buildAssessmentForm(nextWorkspace.selectedLesson))
    setStudents(buildStudentRows(nextWorkspace.selectedLesson.students))
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
    void loadDate(date)
  }, [date, loadDate])

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
    () => students.filter(row => row.attendanceStatus === 'present').length,
    [students]
  )

  const absentCount = students.length - presentCount

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

  async function selectLesson(lessonId: EntityId) {
    if (loading || saving || workspace?.selectedLessonId === lessonId) {
      return
    }

    await loadDate(date, lessonId)
  }

  async function changeAssessment(choice: string) {
    if (!selectedLesson || !assessmentWorkspace || saving) {
      return
    }

    if (choice === 'none') {
      setAssessmentForm({
        choice: 'none',
        criterionId: assessmentWorkspace.criteria[0]?.id ?? '',
        title: '',
        activityType: 'practical_work',
        description: ''
      })

      setStudents(current =>
        current.map(row => ({
          ...row,
          assessmentStatus: 'not_evaluated',
          assessmentScore: null,
          assessmentScoreText: '',
          assessmentNote: ''
        }))
      )
      return
    }

    if (choice === 'new') {
      setAssessmentForm({
        choice: 'new',
        criterionId: assessmentWorkspace.criteria[0]?.id ?? '',
        title: '',
        activityType: 'practical_work',
        description: ''
      })

      setStudents(current =>
        current.map(row => ({
          ...row,
          assessmentStatus: 'not_evaluated',
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
      plannedActivity: item.activity.trim() || item.content.trim(),
      summary: item.suggestedSummary.trim() || item.content.trim(),
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
        attendanceCode: ''
      }))
    )
  }

  async function saveAll() {
    if (
      !selectedLesson ||
      !lessonForm ||
      !assessmentForm ||
      saving
    ) {
      return
    }

    const periodCount = Number(lessonForm.periodCount)

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const result = await dailyWorkspaceRepository.saveLesson({
        lessonId: selectedLesson.context.lessonRow.lesson.id,
        status: lessonForm.status,
        startTime: lessonForm.startTime,
        endTime: lessonForm.endTime,
        periodCount,
        countTowardProgress: lessonForm.countTowardProgress,
        plannedActivity: lessonForm.plannedActivity,
        summary: lessonForm.summary,
        summarySource: lessonForm.summarySource,
        planificationItemIds: lessonForm.planificationItemIds,
        notes: lessonForm.notes,
        giaeStatus: lessonForm.giaeStatus,
        students: students.map(row => {
          const normalizedScore = Number(
            row.assessmentScoreText.replace(',', '.')
          )

          return {
            studentId: row.student.id,
            attendanceStatus: row.attendanceStatus,
            attendanceCode: row.attendanceCode,
            attendanceNote: row.attendanceNote,
            assessmentStatus: row.assessmentStatus,
            assessmentScore:
              row.assessmentStatus === 'evaluated' &&
              row.assessmentScoreText.trim()
                ? normalizedScore
                : null,
            assessmentNote: row.assessmentNote
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
          criterionId: assessmentForm.criterionId,
          title: assessmentForm.title,
          activityType: assessmentForm.activityType,
          description: assessmentForm.description
        }
      })

      await loadDate(
        date,
        result.lesson.id,
        result.assessmentId
      )

      setSuccess('Aula, sumário, faltas e avaliações guardados.')

      if (onSaved) {
        await onSaved()
      }
    } catch (saveError) {
      setError(dailyWorkspaceRepository.describeError(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/85 shadow-2xl shadow-cyan-950/25">
      <header className="border-b border-white/10 bg-gradient-to-r from-cyan-300/[0.08] via-slate-950 to-violet-300/[0.07] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              Registo diário
            </p>
            <h1 className="mt-1 text-2xl font-black capitalize text-white sm:text-3xl">
              {formatLongDate(date)}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(current => addDays(current, -1))}
              disabled={loading || saving}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.08] disabled:opacity-50"
              aria-label="Dia anterior"
            >
              ‹
            </button>

            <input
              type="date"
              value={date}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setDate(event.target.value)
              }
              disabled={loading || saving}
              className={`${fieldClassName} w-auto`}
            />

            <button
              type="button"
              onClick={() => setDate(current => addDays(current, 1))}
              disabled={loading || saving}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.08] disabled:opacity-50"
              aria-label="Dia seguinte"
            >
              ›
            </button>

            <button
              type="button"
              onClick={() => setDate(todayISO())}
              disabled={loading || saving || date === todayISO()}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-45"
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={() => void saveAll()}
              disabled={
                loading ||
                saving ||
                !selectedLesson ||
                !lessonForm
              }
              className="rounded-xl border border-cyan-200/30 bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? 'A guardar...' : 'Guardar tudo'}
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-white/10 px-4 py-3 sm:px-6">
        {loading && !workspace ? (
          <p className="py-3 text-sm text-slate-400">
            A carregar as aulas do dia...
          </p>
        ) : workspace && workspace.lessons.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {workspace.lessons.map(row => {
              const selected =
                workspace.selectedLessonId === row.lesson.id

              return (
                <button
                  key={row.lesson.id}
                  type="button"
                  onClick={() => void selectLesson(row.lesson.id)}
                  disabled={loading || saving}
                  className={`min-w-[15rem] shrink-0 rounded-xl border px-4 py-3 text-left transition disabled:opacity-50 ${
                    selected
                      ? 'border-cyan-300/40 bg-cyan-300/10 shadow-lg shadow-cyan-950/20'
                      : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-white">
                      {row.lesson.startTime}–{row.lesson.endTime}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-1 text-[0.62rem] font-black uppercase ${lessonStatusClasses(
                        row.lesson.status
                      )}`}
                    >
                      {lessonStatusLabel(row.lesson.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-black text-cyan-100">
                    {row.group.name} ·{' '}
                    {getSubjectLabel(
                      row.subject.shortName,
                      row.subject.name
                    )}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {getModuleLabel(row.module.code, row.module.name)}
                  </p>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-center">
            <p className="font-black text-white">Sem aulas neste dia.</p>
            <p className="mt-1 text-sm text-slate-500">
              Escolha outro dia ou crie a aula no Calendário.
            </p>
          </div>
        )}
      </div>

      {selectedLesson && lessonRow && lessonForm && assessmentForm ? (
        <div className="p-4 sm:p-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100">
                  {lessonRow.group.name}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-200">
                  {getSubjectLabel(
                    lessonRow.subject.shortName,
                    lessonRow.subject.name
                  )}
                </span>
                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs font-black text-violet-100">
                  {getModuleLabel(
                    lessonRow.module.code,
                    lessonRow.module.name
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <label>
                <span className="mb-1 block text-[0.62rem] font-black uppercase text-slate-500">
                  Início
                </span>
                <input
                  type="time"
                  value={lessonForm.startTime}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateLessonForm('startTime', event.target.value)
                  }
                  disabled={saving}
                  className={compactFieldClassName}
                />
              </label>

              <label>
                <span className="mb-1 block text-[0.62rem] font-black uppercase text-slate-500">
                  Fim
                </span>
                <input
                  type="time"
                  value={lessonForm.endTime}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateLessonForm('endTime', event.target.value)
                  }
                  disabled={saving}
                  className={compactFieldClassName}
                />
              </label>

              <label>
                <span className="mb-1 block text-[0.62rem] font-black uppercase text-slate-500">
                  Tempos
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={lessonForm.periodCount}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateLessonForm('periodCount', event.target.value)
                  }
                  disabled={saving}
                  className={compactFieldClassName}
                />
              </label>

              <label>
                <span className="mb-1 block text-[0.62rem] font-black uppercase text-slate-500">
                  Estado
                </span>
                <select
                  value={lessonForm.status}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    updateLessonForm(
                      'status',
                      event.target.value as LessonStatus
                    )
                  }
                  disabled={saving}
                  className={compactFieldClassName}
                >
                  <option value="planned">Planeada</option>
                  <option value="taught">Dada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </label>

              <label className="flex items-end">
                <span className="flex min-h-[2.2rem] w-full items-center gap-2 rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={lessonForm.countTowardProgress}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      updateLessonForm(
                        'countTowardProgress',
                        event.target.checked
                      )
                    }
                    disabled={saving || lessonForm.status === 'cancelled'}
                  />
                  Contabilizar
                </span>
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-cyan-200">
                Sumário
              </span>
              <textarea
                value={lessonForm.summary}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setLessonForm(current =>
                    current
                      ? {
                          ...current,
                          summary: event.target.value,
                          summarySource: 'manual',
                          planificationItemIds: []
                        }
                      : current
                  )
                }
                disabled={saving}
                rows={4}
                placeholder="Escreva o sumário da aula."
                className={`${fieldClassName} resize-y text-base leading-7`}
              />
            </label>

            <div className="grid gap-3">
              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                  Atividade prevista
                </span>
                <textarea
                  value={lessonForm.plannedActivity}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                    updateLessonForm(
                      'plannedActivity',
                      event.target.value
                    )
                  }
                  disabled={saving}
                  rows={2}
                  className={`${fieldClassName} resize-y`}
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                  Nota privada
                </span>
                <input
                  type="text"
                  value={lessonForm.notes}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateLessonForm('notes', event.target.value)
                  }
                  disabled={saving}
                  className={fieldClassName}
                />
              </label>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={useNextPlanificationItem}
              disabled={
                saving || !selectedLesson.context.nextPlanificationItem
              }
              className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-40"
            >
              Usar próximo da planificação
            </button>

            <button
              type="button"
              onClick={copyPreviousLesson}
              disabled={
                saving || !selectedLesson.context.previousLessonTemplate
              }
              className="rounded-xl border border-violet-300/20 bg-violet-300/[0.07] px-4 py-2 text-xs font-black text-violet-100 transition hover:bg-violet-300/10 disabled:opacity-40"
            >
              Copiar aula anterior
            </button>

            <label className="ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold text-slate-300">
              <input
                type="checkbox"
                checked={lessonForm.giaeStatus === 'submitted'}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateLessonForm(
                    'giaeStatus',
                    event.target.checked ? 'submitted' : 'pending'
                  )
                }
                disabled={
                  saving ||
                  lessonForm.status !== 'taught' ||
                  !lessonForm.summary.trim()
                }
              />
              GIAE submetido
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(14rem,0.7fr)_minmax(15rem,1fr)_minmax(12rem,0.8fr)_minmax(12rem,0.8fr)]">
              <label>
                <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-[0.1em] text-amber-200">
                  Avaliação desta aula
                </span>
                <select
                  value={assessmentForm.choice}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    void changeAssessment(event.target.value)
                  }
                  disabled={saving || loading}
                  className={compactFieldClassName}
                >
                  <option value="none">Sem avaliação nesta aula</option>
                  {assessmentWorkspace?.assessments.map(item => (
                    <option
                      key={item.assessment.id}
                      value={item.assessment.id}
                    >
                      {item.assessment.title}
                    </option>
                  ))}
                  <option value="new">+ Nova avaliação</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-[0.1em] text-slate-500">
                  Atividade
                </span>
                <input
                  type="text"
                  value={assessmentForm.title}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setAssessmentForm(current =>
                      current
                        ? {
                            ...current,
                            title: event.target.value
                          }
                        : current
                    )
                  }
                  disabled={saving || !assessmentEnabled}
                  placeholder="Ex.: Trabalho prático"
                  className={compactFieldClassName}
                />
              </label>

              <label>
                <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-[0.1em] text-slate-500">
                  Critério
                </span>
                <select
                  value={assessmentForm.criterionId}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setAssessmentForm(current =>
                      current
                        ? {
                            ...current,
                            criterionId: event.target.value
                          }
                        : current
                    )
                  }
                  disabled={saving || !assessmentEnabled}
                  className={compactFieldClassName}
                >
                  {assessmentWorkspace?.criteria.map(criterion => (
                    <option key={criterion.id} value={criterion.id}>
                      {criterion.name} · {criterion.weightPercent}%
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-[0.1em] text-slate-500">
                  Tipo
                </span>
                <select
                  value={assessmentForm.activityType}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setAssessmentForm(current =>
                      current
                        ? {
                            ...current,
                            activityType:
                              event.target.value as AssessmentActivityType
                          }
                        : current
                    )
                  }
                  disabled={saving || !assessmentEnabled}
                  className={compactFieldClassName}
                >
                  {activityTypeOptions.map(activityType => (
                    <option key={activityType} value={activityType}>
                      {getAssessmentActivityTypeLabel(activityType)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 font-black text-emerald-100">
                {presentCount} presentes
              </span>
              <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 font-black text-rose-100">
                {absentCount} faltas
              </span>
            </div>

            <button
              type="button"
              onClick={markAllPresent}
              disabled={saving || students.length === 0}
              className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-300/10 disabled:opacity-40"
            >
              Marcar todos presentes
            </button>
          </div>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[78rem] border-collapse text-left">
              <thead className="bg-slate-900/90 text-[0.65rem] uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-black">N.º</th>
                  <th className="px-3 py-3 font-black">Aluno</th>
                  <th className="px-3 py-3 font-black">Assiduidade</th>
                  <th className="px-3 py-3 font-black">Avaliação</th>
                  <th className="px-3 py-3 font-black">Nota</th>
                  <th className="px-3 py-3 font-black">Observação</th>
                  <th className="px-3 py-3 text-center font-black">
                    Média
                  </th>
                  <th className="px-3 py-3 text-center font-black">
                    Faltas
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {students.map(row => {
                  const warningLevel = row.absenceSummary?.warningLevel
                  const warning = warningLevel === 'warning'
                  const recovery = warningLevel === 'recovery_required'

                  return (
                    <tr
                      key={row.student.id}
                      className={`align-middle ${
                        recovery
                          ? 'bg-rose-300/[0.045]'
                          : warning
                            ? 'bg-amber-300/[0.035]'
                            : 'bg-white/[0.012]'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center text-xs font-black text-slate-400">
                        {row.student.number || '—'}
                      </td>

                      <td className="px-3 py-2.5">
                        <p className="text-sm font-black text-white">
                          {row.student.name}
                        </p>
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="grid grid-cols-[minmax(7rem,1fr)_4rem] gap-2">
                          <select
                            value={row.attendanceStatus}
                            onChange={(
                              event: ChangeEvent<HTMLSelectElement>
                            ) => {
                              const attendanceStatus = event.target.value as
                                | 'present'
                                | 'absent'

                              updateStudent(row.student.id, {
                                attendanceStatus,
                                attendanceCode:
                                  attendanceStatus === 'absent'
                                    ? row.attendanceCode || 'F'
                                    : '',
                                assessmentStatus:
                                  attendanceStatus === 'absent' &&
                                  row.assessmentStatus ===
                                    'not_evaluated' &&
                                  assessmentEnabled
                                    ? 'absent'
                                    : row.assessmentStatus
                              })
                            }}
                            disabled={
                              saving || lessonForm.status !== 'taught'
                            }
                            className={compactFieldClassName}
                          >
                            <option value="present">Presente</option>
                            <option value="absent">Faltou</option>
                          </select>

                          <input
                            type="text"
                            value={row.attendanceCode}
                            onChange={(
                              event: ChangeEvent<HTMLInputElement>
                            ) =>
                              updateStudent(row.student.id, {
                                attendanceCode: event.target.value
                              })
                            }
                            disabled={
                              saving ||
                              lessonForm.status !== 'taught' ||
                              row.attendanceStatus !== 'absent'
                            }
                            title="Código da falta"
                            placeholder="F"
                            className={compactFieldClassName}
                          />
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <select
                          value={row.assessmentStatus}
                          onChange={(
                            event: ChangeEvent<HTMLSelectElement>
                          ) => {
                            const assessmentStatus =
                              event.target.value as DailyAssessmentStatus

                            updateStudent(row.student.id, {
                              assessmentStatus,
                              assessmentScore:
                                assessmentStatus === 'evaluated'
                                  ? row.assessmentScore
                                  : null,
                              assessmentScoreText:
                                assessmentStatus === 'evaluated'
                                  ? row.assessmentScoreText
                                  : ''
                            })
                          }}
                          disabled={
                            saving ||
                            lessonForm.status !== 'taught' ||
                            !assessmentEnabled
                          }
                          className={compactFieldClassName}
                        >
                          {assessmentStatusOptions.map(option => (
                            <option
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.assessmentScoreText}
                          onChange={(
                            event: ChangeEvent<HTMLInputElement>
                          ) =>
                            updateStudent(row.student.id, {
                              assessmentScoreText: event.target.value
                            })
                          }
                          disabled={
                            saving ||
                            lessonForm.status !== 'taught' ||
                            !assessmentEnabled ||
                            row.assessmentStatus !== 'evaluated'
                          }
                          placeholder="0–20"
                          className={compactFieldClassName}
                        />
                      </td>

                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={row.assessmentNote}
                          onChange={(
                            event: ChangeEvent<HTMLInputElement>
                          ) =>
                            updateStudent(row.student.id, {
                              assessmentNote: event.target.value
                            })
                          }
                          disabled={saving || !assessmentEnabled}
                          placeholder="Opcional"
                          className={compactFieldClassName}
                        />
                      </td>

                      <td className="px-3 py-2.5 text-center text-sm font-black text-cyan-100">
                        {formatScore(row.provisionalAverage)}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex min-w-[4.5rem] justify-center rounded-full border px-2.5 py-1.5 text-xs font-black ${
                            recovery
                              ? 'border-rose-300/25 bg-rose-300/10 text-rose-100'
                              : warning
                                ? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
                                : 'border-white/10 bg-white/[0.03] text-slate-400'
                          }`}
                        >
                          {formatPercent(
                            row.absenceSummary?.absencePercent ?? null
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {students.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-slate-500">
              Esta turma ainda não possui alunos ativos.
            </div>
          ) : null}

          {assessmentEnabled &&
          (assessmentWorkspace?.criteria.length ?? 0) === 0 ? (
            <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">
              Configure primeiro os critérios desta disciplina ou UFCD.
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm text-rose-100"
            >
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-3 text-sm font-bold text-emerald-100">
              {success}
            </div>
          ) : null}
        </div>
      ) : loading ? (
        <div className="px-6 py-12 text-center text-sm text-slate-400">
          A preparar o registo diário...
        </div>
      ) : error ? (
        <div className="px-6 py-8">
          <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        </div>
      ) : null}
    </section>
  )
}
