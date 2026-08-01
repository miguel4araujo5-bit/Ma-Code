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

const inputClassName =
  'w-full min-w-0 rounded-md border border-white/10 bg-slate-950 px-2.5 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45'

const compactInputClassName =
  'w-full min-w-0 rounded border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45'

function todayISO(): ISODate {
  const date = new Date()

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function addDays(
  value: ISODate,
  amount: number
): ISODate {
  const [
    year,
    month,
    day
  ] = value
    .split('-')
    .map(Number)

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )

  date.setUTCDate(
    date.getUTCDate() +
      amount
  )

  return [
    String(
      date.getUTCFullYear()
    ).padStart(
      4,
      '0'
    ),
    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      '0'
    ),
    String(
      date.getUTCDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-')
}

function formatLongDate(
  value: ISODate
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

function formatScore(
  value: Score | null
) {
  if (
    value === null
  ) {
    return '—'
  }

  return new Intl.NumberFormat(
    'pt-PT',
    {
      maximumFractionDigits: 2
    }
  ).format(
    value
  )
}

function formatPercent(
  value: number | null
) {
  if (
    value === null
  ) {
    return '—'
  }

  return `${new Intl.NumberFormat(
    'pt-PT',
    {
      maximumFractionDigits: 1
    }
  ).format(value)}%`
}

function getModuleLabel(
  code: string,
  name: string
) {
  return code.trim()
    ? `${code.trim()} — ${name}`
    : name
}

function getSubjectLabel(
  shortName: string,
  name: string
) {
  return (
    shortName.trim() ||
    name
  )
}

function lessonStatusLabel(
  status: LessonStatus
) {
  const labels: Record<
    LessonStatus,
    string
  > = {
    planned: 'Planeada',
    taught: 'Dada',
    cancelled: 'Cancelada'
  }

  return labels[
    status
  ]
}

function lessonStatusClasses(
  status: LessonStatus
) {
  if (
    status === 'taught'
  ) {
    return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
  }

  if (
    status === 'cancelled'
  ) {
    return 'border-rose-300/25 bg-rose-300/10 text-rose-100'
  }

  return 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'
}

function buildLessonForm(
  workspace:
    NonNullable<
      DailyDateWorkspace[
        'selectedLesson'
      ]
    >
): LessonFormState {
  const lesson =
    workspace
      .context
      .lessonRow
      .lesson

  return {
    status:
      lesson.status,

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

function buildAssessmentForm(
  workspace:
    NonNullable<
      DailyDateWorkspace[
        'selectedLesson'
      ]
    >
): AssessmentFormState {
  if (
    workspace.selectedAssessment
  ) {
    return {
      choice:
        workspace
          .selectedAssessment
          .id,

      criterionId:
        workspace
          .selectedAssessment
          .criterionId,

      title:
        workspace
          .selectedAssessment
          .title,

      activityType:
        workspace
          .selectedAssessment
          .activityType,

      description:
        workspace
          .selectedAssessment
          .description
    }
  }

  return {
    choice:
      'none',

    criterionId:
      workspace
        .assessmentWorkspace
        .criteria[0]
        ?.id ??
      '',

    title:
      '',

    activityType:
      'practical_work',

    description:
      ''
  }
}

function buildStudentRows(
  rows: DailyStudentRow[]
): StudentEditorRow[] {
  return rows.map(
    (
      row
    ) => ({
      ...row,

      assessmentScoreText:
        row.assessmentStatus ===
          'evaluated' &&
        row.assessmentScore !==
          null
          ? String(
              row.assessmentScore
            )
          : ''
    })
  )
}

export default function DailyWorkspaceView({
  academicYearId,
  onSaved
}: DailyWorkspaceViewProps) {
  const [
    date,
    setDate
  ] =
    useState<ISODate>(
      todayISO
    )

  const [
    workspace,
    setWorkspace
  ] =
    useState<DailyDateWorkspace | null>(
      null
    )

  const [
    lessonForm,
    setLessonForm
  ] =
    useState<LessonFormState | null>(
      null
    )

  const [
    assessmentForm,
    setAssessmentForm
  ] =
    useState<AssessmentFormState | null>(
      null
    )

  const [
    students,
    setStudents
  ] =
    useState<StudentEditorRow[]>(
      []
    )

  const [
    loading,
    setLoading
  ] =
    useState(true)

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

  const [
    success,
    setSuccess
  ] =
    useState('')

  const hydrate =
    useCallback(
      (
        nextWorkspace:
          DailyDateWorkspace
      ) => {
        setWorkspace(
          nextWorkspace
        )

        if (
          !nextWorkspace.selectedLesson
        ) {
          setLessonForm(
            null
          )

          setAssessmentForm(
            null
          )

          setStudents(
            []
          )

          return
        }

        setLessonForm(
          buildLessonForm(
            nextWorkspace.selectedLesson
          )
        )

        setAssessmentForm(
          buildAssessmentForm(
            nextWorkspace.selectedLesson
          )
        )

        setStudents(
          buildStudentRows(
            nextWorkspace
              .selectedLesson
              .students
          )
        )
      },
      []
    )

  const loadDate =
    useCallback(
      async (
        nextDate: ISODate,
        requestedLessonId?:
          EntityId |
          null,
        requestedAssessmentId?:
          EntityId |
          null
      ) => {
        setLoading(
          true
        )

        setError(
          ''
        )

        setSuccess(
          ''
        )

        try {
          const nextWorkspace =
            await dailyWorkspaceRepository.getDateWorkspace(
              academicYearId,
              nextDate,
              requestedLessonId,
              requestedAssessmentId
            )

          hydrate(
            nextWorkspace
          )
        } catch (
          loadError
        ) {
          setError(
            dailyWorkspaceRepository.describeError(
              loadError
            )
          )
        } finally {
          setLoading(
            false
          )
        }
      },
      [
        academicYearId,
        hydrate
      ]
    )

  useEffect(
    () => {
      void loadDate(
        date
      )
    },
    [
      date,
      loadDate
    ]
  )

  const selectedLesson =
    workspace
      ?.selectedLesson ??
    null

  const lessonRow =
    selectedLesson
      ?.context
      .lessonRow ??
    null

  const assessmentWorkspace =
    selectedLesson
      ?.assessmentWorkspace ??
    null

  const assessmentEnabled =
    assessmentForm !==
      null &&
    assessmentForm.choice !==
      'none'

  const selectedAssessmentId =
    assessmentForm &&
    assessmentForm.choice !==
      'none' &&
    assessmentForm.choice !==
      'new'
      ? assessmentForm.choice
      : null

  const presentCount =
    useMemo(
      () =>
        students.filter(
          (
            row
          ) =>
            row.attendanceStatus ===
            'present'
        ).length,
      [
        students
      ]
    )

  const absentCount =
    students.length -
    presentCount

  function updateLessonForm<
    Key extends keyof LessonFormState
  >(
    key: Key,
    value:
      LessonFormState[Key]
  ) {
    setLessonForm(
      (
        current
      ) =>
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
    changes:
      Partial<StudentEditorRow>
  ) {
    setStudents(
      (
        current
      ) =>
        current.map(
          (
            row
          ) =>
            row.student.id ===
            studentId
              ? {
                  ...row,
                  ...changes
                }
              : row
        )
    )
  }

  async function selectLesson(
    lessonId: EntityId
  ) {
    if (
      loading ||
      saving ||
      workspace
        ?.selectedLessonId ===
        lessonId
    ) {
      return
    }

    await loadDate(
      date,
      lessonId
    )
  }

  async function changeAssessment(
    choice: string
  ) {
    if (
      !selectedLesson ||
      !assessmentWorkspace ||
      saving
    ) {
      return
    }

    if (
      choice === 'none'
    ) {
      setAssessmentForm({
        choice:
          'none',

        criterionId:
          assessmentWorkspace
            .criteria[0]
            ?.id ??
          '',

        title:
          '',

        activityType:
          'practical_work',

        description:
          ''
      })

      setStudents(
        (
          current
        ) =>
          current.map(
            (
              row
            ) => ({
              ...row,

              assessmentStatus:
                'not_evaluated',

              assessmentScore:
                null,

              assessmentScoreText:
                '',

              assessmentNote:
                ''
            })
          )
      )

      return
    }

    if (
      choice === 'new'
    ) {
      setAssessmentForm({
        choice:
          'new',

        criterionId:
          assessmentWorkspace
            .criteria[0]
            ?.id ??
          '',

        title:
          '',

        activityType:
          'practical_work',

        description:
          ''
      })

      setStudents(
        (
          current
        ) =>
          current.map(
            (
              row
            ) => ({
              ...row,

              assessmentStatus:
                'not_evaluated',

              assessmentScore:
                null,

              assessmentScoreText:
                '',

              assessmentNote:
                ''
            })
          )
      )

      return
    }

    setLoading(
      true
    )

    setError(
      ''
    )

    setSuccess(
      ''
    )

    try {
      const nextSelectedLesson =
        await dailyWorkspaceRepository.getLessonWorkspace(
          academicYearId,
          selectedLesson
            .context
            .lessonRow
            .lesson
            .id,
          choice
        )

      setWorkspace(
        (
          current
        ) =>
          current
            ? {
                ...current,

                selectedLesson:
                  nextSelectedLesson
              }
            : current
      )

      setAssessmentForm(
        buildAssessmentForm(
          nextSelectedLesson
        )
      )

      setStudents(
        (
          current
        ) => {
          const currentAttendanceByStudent =
            new Map(
              current.map(
                (
                  row
                ) => [
                  row.student.id,
                  {
                    attendanceStatus:
                      row.attendanceStatus,

                    attendanceCode:
                      row.attendanceCode,

                    attendanceNote:
                      row.attendanceNote
                  }
                ]
              )
            )

          return buildStudentRows(
            nextSelectedLesson.students
          ).map(
            (
              row
            ) => ({
              ...row,
              ...(
                currentAttendanceByStudent.get(
                  row.student.id
                ) ??
                {}
              )
            })
          )
        }
      )
    } catch (
      loadError
    ) {
      setError(
        dailyWorkspaceRepository.describeError(
          loadError
        )
      )
    } finally {
      setLoading(
        false
      )
    }
  }

  function useNextPlanificationItem() {
    if (
      !selectedLesson ||
      !lessonForm
    ) {
      return
    }

    const item =
      selectedLesson
        .context
        .nextPlanificationItem

    if (
      !item
    ) {
      return
    }

    setLessonForm({
      ...lessonForm,

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
  }

  function copyPreviousLesson() {
    if (
      !selectedLesson ||
      !lessonForm
    ) {
      return
    }

    const previous =
      selectedLesson
        .context
        .previousLessonTemplate

    if (
      !previous
    ) {
      return
    }

    setLessonForm({
      ...lessonForm,

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
  }

  function markAllPresent() {
    setStudents(
      (
        current
      ) =>
        current.map(
          (
            row
          ) => ({
            ...row,

            attendanceStatus:
              'present',

            attendanceCode:
              '',

            attendanceNote:
              ''
          })
        )
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

    const periodCount =
      Number(
        lessonForm.periodCount
      )

    setSaving(
      true
    )

    setError(
      ''
    )

    setSuccess(
      ''
    )

    try {
      const result =
        await dailyWorkspaceRepository.saveLesson({
          lessonId:
            selectedLesson
              .context
              .lessonRow
              .lesson
              .id,

          status:
            lessonForm.status,

          startTime:
            lessonForm.startTime,

          endTime:
            lessonForm.endTime,

          periodCount,

          countTowardProgress:
            lessonForm.countTowardProgress,

          plannedActivity:
            lessonForm.plannedActivity,

          summary:
            lessonForm.summary,

          summarySource:
            lessonForm.summarySource,

          planificationItemIds:
            lessonForm.planificationItemIds,

          notes:
            lessonForm.notes,

          giaeStatus:
            lessonForm.giaeStatus,

          students:
            students.map(
              (
                row
              ) => {
                const normalizedScore =
                  Number(
                    row.assessmentScoreText.replace(
                      ',',
                      '.'
                    )
                  )

                return {
                  studentId:
                    row.student.id,

                  attendanceStatus:
                    row.attendanceStatus,

                  attendanceCode:
                    row.attendanceCode,

                  attendanceNote:
                    row.attendanceNote,

                  assessmentStatus:
                    row.assessmentStatus,

                  assessmentScore:
                    row.assessmentStatus ===
                      'evaluated' &&
                    row.assessmentScoreText.trim()
                      ? normalizedScore
                      : null,

                  assessmentNote:
                    row.assessmentNote
                }
              }
            ),

          assessment: {
            mode:
              assessmentForm.choice ===
              'none'
                ? 'none'
                : assessmentForm.choice ===
                    'new'
                  ? 'new'
                  : 'existing',

            assessmentId:
              selectedAssessmentId,

            criterionId:
              assessmentForm.criterionId,

            title:
              assessmentForm.title,

            activityType:
              assessmentForm.activityType,

            description:
              assessmentForm.description
          }
        })

      await loadDate(
        date,
        result.lesson.id,
        result.assessmentId
      )

      setSuccess(
        'Aula, sumário, faltas e avaliações guardados.'
      )

      if (
        onSaved
      ) {
        await onSaved()
      }
    } catch (
      saveError
    ) {
      setError(
        dailyWorkspaceRepository.describeError(
          saveError
        )
      )
    } finally {
      setSaving(
        false
      )
    }
  }

  return (
    <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-2 py-3 text-white sm:px-4 lg:px-6">
      <div className="mx-auto max-w-[1800px] overflow-hidden border border-white/10 bg-slate-900/55 shadow-2xl shadow-black/25">
        <header className="border-b border-white/10 bg-slate-900 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-300">
                Aulas do dia
              </p>

              <h1 className="mt-1 truncate text-lg font-black capitalize text-white sm:text-xl">
                {formatLongDate(
                  date
                )}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setDate(
                    current =>
                      addDays(
                        current,
                        -1
                      )
                  )
                }
                disabled={
                  loading ||
                  saving
                }
                className="h-9 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-white/5 disabled:opacity-40"
                aria-label="Dia anterior"
              >
                ‹
              </button>

              <input
                type="date"
                value={
                  date
                }
                onChange={(
                  event:
                    ChangeEvent<HTMLInputElement>
                ) =>
                  setDate(
                    event.target.value
                  )
                }
                disabled={
                  loading ||
                  saving
                }
                className={`${inputClassName} h-9 w-auto py-1.5`}
              />

              <button
                type="button"
                onClick={() =>
                  setDate(
                    current =>
                      addDays(
                        current,
                        1
                      )
                  )
                }
                disabled={
                  loading ||
                  saving
                }
                className="h-9 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-white/5 disabled:opacity-40"
                aria-label="Dia seguinte"
              >
                ›
              </button>

              <button
                type="button"
                onClick={() =>
                  setDate(
                    todayISO()
                  )
                }
                disabled={
                  loading ||
                  saving ||
                  date ===
                    todayISO()
                }
                className="h-9 rounded-md border border-white/10 bg-slate-950 px-3 text-xs font-black text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={() =>
                  void loadDate(
                    date,
                    workspace
                      ?.selectedLessonId
                  )
                }
                disabled={
                  loading ||
                  saving
                }
                className="h-9 rounded-md border border-white/10 bg-slate-950 px-3 text-xs font-black text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
              >
                Atualizar
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveAll()
                }
                disabled={
                  loading ||
                  saving ||
                  !selectedLesson ||
                  !lessonForm
                }
                className="h-9 rounded-md bg-cyan-300 px-4 text-xs font-black uppercase tracking-[0.08em] text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving
                  ? 'A guardar…'
                  : 'Guardar tudo'}
              </button>
            </div>
          </div>
        </header>

        <section
          aria-label="Aulas do dia"
          className="border-b border-white/10"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-slate-950 text-[0.65rem] uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="w-32 border-r border-white/10 px-3 py-2 font-black">
                    Hora
                  </th>

                  <th className="w-28 border-r border-white/10 px-3 py-2 font-black">
                    Turma
                  </th>

                  <th className="w-40 border-r border-white/10 px-3 py-2 font-black">
                    Disciplina
                  </th>

                  <th className="w-72 border-r border-white/10 px-3 py-2 font-black">
                    UFCD / módulo
                  </th>

                  <th className="w-28 border-r border-white/10 px-3 py-2 font-black">
                    Estado
                  </th>

                  <th className="px-3 py-2 font-black">
                    Sumário
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {workspace
                  ?.lessons
                  .map(
                    (
                      row
                    ) => {
                      const selected =
                        workspace.selectedLessonId ===
                        row.lesson.id

                      return (
                        <tr
                          key={
                            row.lesson.id
                          }
                          onClick={() =>
                            void selectLesson(
                              row.lesson.id
                            )
                          }
                          className={`cursor-pointer transition ${
                            selected
                              ? 'bg-cyan-300/10'
                              : 'bg-slate-900/20 hover:bg-white/[0.035]'
                          }`}
                        >
                          <td className="border-r border-white/10 px-3 py-2 text-xs font-black text-white">
                            {
                              row.lesson
                                .startTime
                            }
                            –
                            {
                              row.lesson
                                .endTime
                            }
                          </td>

                          <td className="border-r border-white/10 px-3 py-2 text-xs font-black text-cyan-100">
                            {
                              row.group
                                .name
                            }
                          </td>

                          <td className="border-r border-white/10 px-3 py-2 text-xs font-bold text-slate-200">
                            {getSubjectLabel(
                              row.subject
                                .shortName,
                              row.subject
                                .name
                            )}
                          </td>

                          <td className="border-r border-white/10 px-3 py-2 text-xs text-slate-300">
                            {getModuleLabel(
                              row.module
                                .code,
                              row.module
                                .name
                            )}
                          </td>

                          <td className="border-r border-white/10 px-3 py-2">
                            <span
                              className={`inline-flex rounded border px-2 py-1 text-[0.62rem] font-black uppercase ${lessonStatusClasses(
                                row.lesson
                                  .status
                              )}`}
                            >
                              {lessonStatusLabel(
                                row.lesson
                                  .status
                              )}
                            </span>
                          </td>

                          <td className="max-w-xl px-3 py-2 text-xs leading-5 text-slate-300">
                            <span className="line-clamp-2">
                              {row.lesson
                                .summary ||
                                row.lesson
                                  .plannedActivity ||
                                'Sem sumário preenchido.'}
                            </span>
                          </td>
                        </tr>
                      )
                    }
                  )}

                {!loading &&
                (
                  workspace
                    ?.lessons
                    .length ??
                  0
                ) ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        6
                      }
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Não existem aulas neste dia. Pode criá-las na área de gestão/calendário.
                    </td>
                  </tr>
                ) : null}

                {loading &&
                !workspace ? (
                  <tr>
                    <td
                      colSpan={
                        6
                      }
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      A carregar as aulas do dia…
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {selectedLesson &&
        lessonRow &&
        lessonForm &&
        assessmentForm ? (
          <>
            <section className="border-b border-white/10 bg-slate-900/80">
              <div className="grid border-b border-white/10 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0 border-b border-white/10 px-3 py-3 lg:border-b-0 lg:border-r">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">
                    Aula selecionada
                  </p>

                  <p className="mt-1 truncate text-sm font-black text-white sm:text-base">
                    {
                      lessonRow
                        .group
                        .name
                    }{' '}
                    ·{' '}
                    {getSubjectLabel(
                      lessonRow
                        .subject
                        .shortName,
                      lessonRow
                        .subject
                        .name
                    )}{' '}
                    ·{' '}
                    {getModuleLabel(
                      lessonRow
                        .module
                        .code,
                      lessonRow
                        .module
                        .name
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-5">
                  <label>
                    <span className="mb-1 block text-[0.6rem] font-black uppercase text-slate-500">
                      Início
                    </span>

                    <input
                      type="time"
                      value={
                        lessonForm.startTime
                      }
                      onChange={(
                        event:
                          ChangeEvent<HTMLInputElement>
                      ) =>
                        updateLessonForm(
                          'startTime',
                          event.target
                            .value
                        )
                      }
                      disabled={
                        saving
                      }
                      className={
                        compactInputClassName
                      }
                    />
                  </label>

                  <label>
                    <span className="mb-1 block text-[0.6rem] font-black uppercase text-slate-500">
                      Fim
                    </span>

                    <input
                      type="time"
                      value={
                        lessonForm.endTime
                      }
                      onChange={(
                        event:
                          ChangeEvent<HTMLInputElement>
                      ) =>
                        updateLessonForm(
                          'endTime',
                          event.target
                            .value
                        )
                      }
                      disabled={
                        saving
                      }
                      className={
                        compactInputClassName
                      }
                    />
                  </label>

                  <label>
                    <span className="mb-1 block text-[0.6rem] font-black uppercase text-slate-500">
                      Tempos
                    </span>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={
                        lessonForm.periodCount
                      }
                      onChange={(
                        event:
                          ChangeEvent<HTMLInputElement>
                      ) =>
                        updateLessonForm(
                          'periodCount',
                          event.target
                            .value
                        )
                      }
                      disabled={
                        saving
                      }
                      className={
                        compactInputClassName
                      }
                    />
                  </label>

                  <label>
                    <span className="mb-1 block text-[0.6rem] font-black uppercase text-slate-500">
                      Estado
                    </span>

                    <select
                      value={
                        lessonForm.status
                      }
                      onChange={(
                        event:
                          ChangeEvent<HTMLSelectElement>
                      ) =>
                        updateLessonForm(
                          'status',
                          event.target
                            .value as LessonStatus
                        )
                      }
                      disabled={
                        saving
                      }
                      className={
                        compactInputClassName
                      }
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

                  <label className="flex items-end">
                    <span className="flex min-h-8 w-full items-center gap-2 rounded border border-white/10 bg-slate-950 px-2 text-[0.68rem] font-bold text-slate-300">
                      <input
                        type="checkbox"
                        checked={
                          lessonForm.countTowardProgress
                        }
                        onChange={(
                          event:
                            ChangeEvent<HTMLInputElement>
                        ) =>
                          updateLessonForm(
                            'countTowardProgress',
                            event.target
                              .checked
                          )
                        }
                        disabled={
                          saving ||
                          lessonForm.status ===
                            'cancelled'
                        }
                      />

                      Contabilizar
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                <label className="border-b border-white/10 p-3 xl:border-b-0 xl:border-r">
                  <span className="mb-1.5 block text-[0.65rem] font-black uppercase tracking-[0.1em] text-cyan-300">
                    Sumário
                  </span>

                  <textarea
                    value={
                      lessonForm.summary
                    }
                    onChange={(
                      event:
                        ChangeEvent<HTMLTextAreaElement>
                    ) =>
                      setLessonForm(
                        (
                          current
                        ) =>
                          current
                            ? {
                                ...current,

                                summary:
                                  event.target
                                    .value,

                                summarySource:
                                  'manual',

                                planificationItemIds:
                                  []
                              }
                            : current
                      )
                    }
                    disabled={
                      saving
                    }
                    rows={
                      4
                    }
                    placeholder="Escreva o sumário da aula."
                    className={`${inputClassName} resize-y text-sm leading-6`}
                  />
                </label>

                <div className="grid sm:grid-cols-2 xl:grid-cols-1">
                  <label className="border-b border-white/10 p-3 sm:border-r xl:border-r-0">
                    <span className="mb-1.5 block text-[0.65rem] font-black uppercase tracking-[0.1em] text-slate-500">
                      Atividade prevista
                    </span>

                    <textarea
                      value={
                        lessonForm.plannedActivity
                      }
                      onChange={(
                        event:
                          ChangeEvent<HTMLTextAreaElement>
                      ) =>
                        updateLessonForm(
                          'plannedActivity',
                          event.target
                            .value
                        )
                      }
                      disabled={
                        saving
                      }
                      rows={
                        2
                      }
                      className={`${inputClassName} resize-y`}
                    />
                  </label>

                  <label className="p-3">
                    <span className="mb-1.5 block text-[0.65rem] font-black uppercase tracking-[0.1em] text-slate-500">
                      Nota privada
                    </span>

                    <textarea
                      value={
                        lessonForm.notes
                      }
                      onChange={(
                        event:
                          ChangeEvent<HTMLTextAreaElement>
                      ) =>
                        updateLessonForm(
                          'notes',
                          event.target
                            .value
                        )
                      }
                      disabled={
                        saving
                      }
                      rows={
                        2
                      }
                      className={`${inputClassName} resize-y`}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-2.5">
                <button
                  type="button"
                  onClick={
                    useNextPlanificationItem
                  }
                  disabled={
                    saving ||
                    !selectedLesson
                      .context
                      .nextPlanificationItem
                  }
                  className="rounded border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-40"
                >
                  Usar próximo da planificação
                </button>

                <button
                  type="button"
                  onClick={
                    copyPreviousLesson
                  }
                  disabled={
                    saving ||
                    !selectedLesson
                      .context
                      .previousLessonTemplate
                  }
                  className="rounded border border-violet-300/20 bg-violet-300/[0.07] px-3 py-2 text-xs font-black text-violet-100 transition hover:bg-violet-300/10 disabled:opacity-40"
                >
                  Copiar aula anterior
                </button>

                <label className="ml-auto flex items-center gap-2 rounded border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={
                      lessonForm.giaeStatus ===
                      'submitted'
                    }
                    onChange={(
                      event:
                        ChangeEvent<HTMLInputElement>
                    ) =>
                      updateLessonForm(
                        'giaeStatus',
                        event.target
                          .checked
                          ? 'submitted'
                          : 'pending'
                      )
                    }
                    disabled={
                      saving ||
                      lessonForm.status !==
                        'taught' ||
                      !lessonForm.summary.trim()
                    }
                  />

                  Sumário submetido no GIAE
                </label>
              </div>
            </section>

            <section className="border-b border-white/10 bg-slate-900/35">
              <div className="grid lg:grid-cols-[220px_minmax(180px,1fr)_minmax(180px,0.8fr)_minmax(170px,0.7fr)]">
                <label className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
                  <span className="mb-1 block text-[0.6rem] font-black uppercase tracking-[0.1em] text-amber-300">
                    Avaliação desta aula
                  </span>

                  <select
                    value={
                      assessmentForm.choice
                    }
                    onChange={(
                      event:
                        ChangeEvent<HTMLSelectElement>
                    ) =>
                      void changeAssessment(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving ||
                      loading
                    }
                    className={
                      compactInputClassName
                    }
                  >
                    <option value="none">
                      Sem avaliação
                    </option>

                    {assessmentWorkspace
                      ?.assessments
                      .map(
                        (
                          item
                        ) => (
                          <option
                            key={
                              item
                                .assessment
                                .id
                            }
                            value={
                              item
                                .assessment
                                .id
                            }
                          >
                            {
                              item
                                .assessment
                                .title
                            }
                          </option>
                        )
                      )}

                    <option value="new">
                      + Nova avaliação
                    </option>
                  </select>
                </label>

                <label className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
                  <span className="mb-1 block text-[0.6rem] font-black uppercase tracking-[0.1em] text-slate-500">
                    Nome da atividade
                  </span>

                  <input
                    type="text"
                    value={
                      assessmentForm.title
                    }
                    onChange={(
                      event:
                        ChangeEvent<HTMLInputElement>
                    ) =>
                      setAssessmentForm(
                        (
                          current
                        ) =>
                          current
                            ? {
                                ...current,

                                title:
                                  event.target
                                    .value
                              }
                            : current
                      )
                    }
                    disabled={
                      saving ||
                      !assessmentEnabled
                    }
                    placeholder="Ex.: Apresentação do projeto"
                    className={
                      compactInputClassName
                    }
                  />
                </label>

                <label className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
                  <span className="mb-1 block text-[0.6rem] font-black uppercase tracking-[0.1em] text-slate-500">
                    Critério
                  </span>

                  <select
                    value={
                      assessmentForm.criterionId
                    }
                    onChange={(
                      event:
                        ChangeEvent<HTMLSelectElement>
                    ) =>
                      setAssessmentForm(
                        (
                          current
                        ) =>
                          current
                            ? {
                                ...current,

                                criterionId:
                                  event.target
                                    .value
                              }
                            : current
                      )
                    }
                    disabled={
                      saving ||
                      !assessmentEnabled
                    }
                    className={
                      compactInputClassName
                    }
                  >
                    {assessmentWorkspace
                      ?.criteria
                      .map(
                        (
                          criterion
                        ) => (
                          <option
                            key={
                              criterion.id
                            }
                            value={
                              criterion.id
                            }
                          >
                            {
                              criterion.name
                            }{' '}
                            ·{' '}
                            {
                              criterion.weightPercent
                            }
                            %
                          </option>
                        )
                      )}
                  </select>
                </label>

                <label className="p-3">
                  <span className="mb-1 block text-[0.6rem] font-black uppercase tracking-[0.1em] text-slate-500">
                    Tipo
                  </span>

                  <select
                    value={
                      assessmentForm.activityType
                    }
                    onChange={(
                      event:
                        ChangeEvent<HTMLSelectElement>
                    ) =>
                      setAssessmentForm(
                        (
                          current
                        ) =>
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
                    disabled={
                      saving ||
                      !assessmentEnabled
                    }
                    className={
                      compactInputClassName
                    }
                  >
                    {activityTypeOptions.map(
                      (
                        activityType
                      ) => (
                        <option
                          key={
                            activityType
                          }
                          value={
                            activityType
                          }
                        >
                          {getAssessmentActivityTypeLabel(
                            activityType
                          )}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              {assessmentEnabled &&
              (
                assessmentWorkspace
                  ?.criteria
                  .length ??
                0
              ) ===
                0 ? (
                <p className="border-t border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100">
                  Configure primeiro os critérios desta disciplina ou UFCD.
                </p>
              ) : null}
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950 px-3 py-2">
                <div className="flex flex-wrap gap-2 text-[0.68rem] font-black">
                  <span className="rounded border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-emerald-100">
                    {
                      presentCount
                    }{' '}
                    presentes
                  </span>

                  <span className="rounded border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-rose-100">
                    {
                      absentCount
                    }{' '}
                    faltas
                  </span>
                </div>

                <button
                  type="button"
                  onClick={
                    markAllPresent
                  }
                  disabled={
                    saving ||
                    students.length ===
                      0
                  }
                  className="rounded border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-1.5 text-xs font-black text-emerald-100 transition hover:bg-emerald-300/10 disabled:opacity-40"
                >
                  Marcar todos presentes
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1320px] border-collapse text-left">
                  <thead className="bg-slate-950 text-[0.62rem] uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th className="w-14 border-r border-white/10 px-2 py-2 font-black">
                        N.º
                      </th>

                      <th className="w-56 border-r border-white/10 px-3 py-2 font-black">
                        Aluno
                      </th>

                      <th className="w-64 border-r border-white/10 px-3 py-2 font-black">
                        Assiduidade
                      </th>

                      <th className="w-40 border-r border-white/10 px-3 py-2 font-black">
                        Avaliação
                      </th>

                      <th className="w-24 border-r border-white/10 px-3 py-2 font-black">
                        Nota
                      </th>

                      <th className="border-r border-white/10 px-3 py-2 font-black">
                        Observação da avaliação
                      </th>

                      <th className="w-20 border-r border-white/10 px-3 py-2 text-center font-black">
                        Média
                      </th>

                      <th className="w-24 px-3 py-2 text-center font-black">
                        Faltas
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {students.map(
                      (
                        row
                      ) => {
                        const warningLevel =
                          row.absenceSummary
                            ?.warningLevel

                        const warning =
                          warningLevel ===
                          'warning'

                        const recovery =
                          warningLevel ===
                          'recovery_required'

                        return (
                          <tr
                            key={
                              row.student.id
                            }
                            className={`align-middle ${
                              recovery
                                ? 'bg-rose-300/[0.045]'
                                : warning
                                  ? 'bg-amber-300/[0.035]'
                                  : 'bg-slate-900/20'
                            }`}
                          >
                            <td className="border-r border-white/10 px-2 py-2 text-center text-xs font-black text-slate-400">
                              {row.student
                                .number ||
                                '—'}
                            </td>

                            <td className="border-r border-white/10 px-3 py-2 text-sm font-black text-white">
                              {
                                row.student
                                  .name
                              }
                            </td>

                            <td className="border-r border-white/10 px-2 py-1.5">
                              <div className="grid grid-cols-[100px_44px_minmax(100px,1fr)] gap-1.5">
                                <select
                                  value={
                                    row.attendanceStatus
                                  }
                                  onChange={(
                                    event:
                                      ChangeEvent<HTMLSelectElement>
                                  ) => {
                                    const attendanceStatus =
                                      event.target
                                        .value as
                                        | 'present'
                                        | 'absent'

                                    updateStudent(
                                      row.student.id,
                                      {
                                        attendanceStatus,

                                        attendanceCode:
                                          attendanceStatus ===
                                          'absent'
                                            ? row.attendanceCode ||
                                              'F'
                                            : '',

                                        attendanceNote:
                                          attendanceStatus ===
                                          'absent'
                                            ? row.attendanceNote
                                            : '',

                                        assessmentStatus:
                                          attendanceStatus ===
                                            'absent' &&
                                          row.assessmentStatus ===
                                            'not_evaluated' &&
                                          assessmentEnabled
                                            ? 'absent'
                                            : row.assessmentStatus
                                      }
                                    )
                                  }}
                                  disabled={
                                    saving ||
                                    lessonForm.status !==
                                      'taught'
                                  }
                                  className={
                                    compactInputClassName
                                  }
                                >
                                  <option value="present">
                                    Presente
                                  </option>

                                  <option value="absent">
                                    Faltou
                                  </option>
                                </select>

                                <input
                                  type="text"
                                  value={
                                    row.attendanceCode
                                  }
                                  onChange={(
                                    event:
                                      ChangeEvent<HTMLInputElement>
                                  ) =>
                                    updateStudent(
                                      row.student.id,
                                      {
                                        attendanceCode:
                                          event.target
                                            .value
                                      }
                                    )
                                  }
                                  disabled={
                                    saving ||
                                    lessonForm.status !==
                                      'taught' ||
                                    row.attendanceStatus !==
                                      'absent'
                                  }
                                  title="Código da falta"
                                  placeholder="F"
                                  className={
                                    compactInputClassName
                                  }
                                />

                                <input
                                  type="text"
                                  value={
                                    row.attendanceNote
                                  }
                                  onChange={(
                                    event:
                                      ChangeEvent<HTMLInputElement>
                                  ) =>
                                    updateStudent(
                                      row.student.id,
                                      {
                                        attendanceNote:
                                          event.target
                                            .value
                                      }
                                    )
                                  }
                                  disabled={
                                    saving ||
                                    lessonForm.status !==
                                      'taught' ||
                                    row.attendanceStatus !==
                                      'absent'
                                  }
                                  placeholder="Motivo / nota"
                                  className={
                                    compactInputClassName
                                  }
                                />
                              </div>
                            </td>

                            <td className="border-r border-white/10 px-2 py-1.5">
                              <select
                                value={
                                  row.assessmentStatus
                                }
                                onChange={(
                                  event:
                                    ChangeEvent<HTMLSelectElement>
                                ) => {
                                  const assessmentStatus =
                                    event.target
                                      .value as DailyAssessmentStatus

                                  updateStudent(
                                    row.student.id,
                                    {
                                      assessmentStatus,

                                      assessmentScore:
                                        assessmentStatus ===
                                        'evaluated'
                                          ? row.assessmentScore
                                          : null,

                                      assessmentScoreText:
                                        assessmentStatus ===
                                        'evaluated'
                                          ? row.assessmentScoreText
                                          : ''
                                    }
                                  )
                                }}
                                disabled={
                                  saving ||
                                  lessonForm.status !==
                                    'taught' ||
                                  !assessmentEnabled
                                }
                                className={
                                  compactInputClassName
                                }
                              >
                                {assessmentStatusOptions.map(
                                  (
                                    option
                                  ) => (
                                    <option
                                      key={
                                        option.value
                                      }
                                      value={
                                        option.value
                                      }
                                    >
                                      {
                                        option.label
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </td>

                            <td className="border-r border-white/10 px-2 py-1.5">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  row.assessmentScoreText
                                }
                                onChange={(
                                  event:
                                    ChangeEvent<HTMLInputElement>
                                ) =>
                                  updateStudent(
                                    row.student.id,
                                    {
                                      assessmentScoreText:
                                        event.target
                                          .value
                                    }
                                  )
                                }
                                disabled={
                                  saving ||
                                  lessonForm.status !==
                                    'taught' ||
                                  !assessmentEnabled ||
                                  row.assessmentStatus !==
                                    'evaluated'
                                }
                                placeholder="0–20"
                                className={
                                  compactInputClassName
                                }
                              />
                            </td>

                            <td className="border-r border-white/10 px-2 py-1.5">
                              <input
                                type="text"
                                value={
                                  row.assessmentNote
                                }
                                onChange={(
                                  event:
                                    ChangeEvent<HTMLInputElement>
                                ) =>
                                  updateStudent(
                                    row.student.id,
                                    {
                                      assessmentNote:
                                        event.target
                                          .value
                                    }
                                  )
                                }
                                disabled={
                                  saving ||
                                  !assessmentEnabled
                                }
                                placeholder="Observação opcional"
                                className={
                                  compactInputClassName
                                }
                              />
                            </td>

                            <td className="border-r border-white/10 px-3 py-2 text-center text-sm font-black text-cyan-100">
                              {formatScore(
                                row.provisionalAverage
                              )}
                            </td>

                            <td className="px-3 py-2 text-center">
                              <span
                                className={`inline-flex min-w-[4.5rem] justify-center rounded border px-2 py-1 text-xs font-black ${
                                  recovery
                                    ? 'border-rose-300/25 bg-rose-300/10 text-rose-100'
                                    : warning
                                      ? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
                                      : 'border-white/10 bg-white/[0.03] text-slate-400'
                                }`}
                              >
                                {formatPercent(
                                  row.absenceSummary
                                    ?.absencePercent ??
                                    null
                                )}
                              </span>
                            </td>
                          </tr>
                        )
                      }
                    )}

                    {students.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={
                            8
                          }
                          className="px-4 py-8 text-center text-sm text-slate-500"
                        >
                          Esta turma ainda não possui alunos ativos.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="flex flex-col gap-2 border-t border-white/10 bg-slate-900 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-5 text-xs">
                {error ? (
                  <p
                    role="alert"
                    className="font-bold text-rose-200"
                  >
                    {
                      error
                    }
                  </p>
                ) : null}

                {success ? (
                  <p className="font-bold text-emerald-200">
                    {
                      success
                    }
                  </p>
                ) : null}

                {!error &&
                !success ? (
                  <p className="text-slate-500">
                    Tudo nesta grelha é guardado pelo mesmo botão.
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() =>
                  void saveAll()
                }
                disabled={
                  loading ||
                  saving
                }
                className="rounded-md bg-cyan-300 px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-slate-950 transition hover:brightness-110 disabled:opacity-40"
              >
                {saving
                  ? 'A guardar…'
                  : 'Guardar aula completa'}
              </button>
            </footer>
          </>
        ) : loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            A preparar o registo diário…
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-sm text-rose-200">
            {
              error
            }
          </div>
        ) : null}
      </div>
    </main>
  )
}
