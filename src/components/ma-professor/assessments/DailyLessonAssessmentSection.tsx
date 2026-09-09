import {
  forwardRef,
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  assessmentAtomicPersistenceRepository
} from '../assessmentAtomicPersistenceRepository'

import type {
  AssessmentActivityType,
  AssessmentResultStatus,
  EntityId,
  Lesson,
  LessonStatus
} from '../types'

import {
  assessmentRepository,
  getAssessmentActivityTypeLabel,
  type AssessmentRegister,
  type AssessmentResultDraft,
  type LessonAssessmentWorkspace
} from './assessmentRepository'

import {
  buildQuickAssessmentTitle,
  hasQuickGradeData,
  resolveQuickCriterionId,
  resolveQuickGradeStatus
} from './dailyQuickGrade'

type DailyResultStatus =
  | AssessmentResultStatus
  | 'not_evaluated'

interface DailyAssessmentRow {
  studentId: EntityId
  studentNumber: string
  studentName: string
  status: DailyResultStatus
  score: string
  note: string
}

interface StoredRegisterState {
  register: AssessmentRegister | null
  rows: DailyAssessmentRow[]
  loading: boolean
  dirty: boolean
  error: string
}

interface DraftAssessmentState {
  enabled: boolean
  title: string
  criterionId: EntityId
  activityType: AssessmentActivityType
  description: string
  rows: DailyAssessmentRow[]
}

interface DailyLessonAssessmentSectionProps {
  lessonId: EntityId
  lessonStatus: LessonStatus
  moduleChanged: boolean
  disabled: boolean
}

export interface DailyLessonAssessmentSectionHandle {
  validateLessonChanges: (changes: {
    moduleId: EntityId
    status: LessonStatus
  }) => void
  saveAssessments: (lesson: Lesson) => Promise<void>
  resetTransientSaveState: () => void
}

const activityTypeOptions: AssessmentActivityType[] = [
  'participation',
  'practical_work',
  'presentation',
  'written_work',
  'test',
  'other'
]

const resultStatusOptions: Array<{
  value: DailyResultStatus
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

const fieldClassName =
  'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function createRowsFromWorkspace(
  workspace: LessonAssessmentWorkspace
): DailyAssessmentRow[] {
  return workspace.students.map(student => ({
    studentId: student.id,
    studentNumber: student.number,
    studentName: student.name,
    status: 'not_evaluated',
    score: '',
    note: ''
  }))
}

function createRowsFromRegister(
  register: AssessmentRegister
): DailyAssessmentRow[] {
  return register.rows.map(row => ({
    studentId: row.student.id,
    studentNumber: row.student.number,
    studentName: row.student.name,
    status: row.result?.status ?? 'not_evaluated',
    score:
      row.result?.status === 'evaluated'
        ? String(row.result.score)
        : '',
    note: row.result?.note ?? ''
  }))
}

function createDraftState(
  workspace: LessonAssessmentWorkspace
): DraftAssessmentState {
  return {
    enabled: false,
    title: '',
    criterionId: resolveQuickCriterionId(
      workspace.criteria,
      workspace.assessments.map(
        item => item.assessment
      )
    ),
    activityType: 'practical_work',
    description: '',
    rows: createRowsFromWorkspace(workspace)
  }
}

function normalizeScoreInput(value: string) {
  return value.replace(',', '.')
}

function validateAndBuildEntries(
  rows: DailyAssessmentRow[]
): AssessmentResultDraft[] {
  return rows.flatMap<AssessmentResultDraft>(row => {
    if (row.status === 'not_evaluated') {
      return []
    }

    if (row.status === 'evaluated') {
      const normalized = normalizeScoreInput(
        row.score.trim()
      )
      const score = Number(normalized)

      if (
        normalized === '' ||
        !Number.isFinite(score) ||
        score < 0 ||
        score > 20
      ) {
        throw new Error(
          `A classificação de ${row.studentName} deve estar entre 0 e 20 valores.`
        )
      }

      return [
        {
          studentId: row.studentId,
          status: 'evaluated' as const,
          score,
          note: row.note
        }
      ]
    }

    return [
      {
        studentId: row.studentId,
        status: row.status,
        score: null,
        note: row.note
      }
    ]
  })
}

function StatusBadge({
  status
}: {
  status: DailyResultStatus
}) {
  const className =
    status === 'evaluated'
      ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
      : status === 'absent'
        ? 'border-rose-300/20 bg-rose-300/10 text-rose-100'
        : status === 'exempt'
          ? 'border-violet-300/20 bg-violet-300/10 text-violet-100'
          : 'border-slate-300/15 bg-white/[0.04] text-slate-400'

  const label =
    resultStatusOptions.find(
      option => option.value === status
    )?.label ?? 'Não avaliado'

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.08em] ${className}`}
    >
      {label}
    </span>
  )
}

function AssessmentRowsEditor({
  rows,
  disabled,
  onChange
}: {
  rows: DailyAssessmentRow[]
  disabled: boolean
  onChange: (rows: DailyAssessmentRow[]) => void
}) {
  const scoreInputRefs =
    useRef<Array<HTMLInputElement | null>>([])

  function updateRow(
    studentId: EntityId,
    changes: Partial<
      Pick<DailyAssessmentRow, 'status' | 'score' | 'note'>
    >
  ) {
    onChange(
      rows.map(row =>
        row.studentId === studentId
          ? {
              ...row,
              ...changes
            }
          : row
      )
    )
  }

  function changeStatus(
    row: DailyAssessmentRow,
    status: DailyResultStatus
  ) {
    updateRow(row.studentId, {
      status,
      score:
        status === 'evaluated' &&
        row.status === 'evaluated'
          ? row.score
          : ''
    })
  }

  function changeScore(
    row: DailyAssessmentRow,
    value: string
  ) {
    updateRow(row.studentId, {
      score: value,
      status: resolveQuickGradeStatus(
        row.status,
        value
      )
    })
  }

  function focusNextScore(
    currentIndex: number
  ) {
    for (
      let index = currentIndex + 1;
      index < scoreInputRefs.current.length;
      index += 1
    ) {
      const input =
        scoreInputRefs.current[index]

      if (
        input &&
        !input.disabled
      ) {
        input.focus()
        input.select()
        return
      }
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
        A turma não possui alunos ativos.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-[58rem] w-full border-collapse text-left">
        <thead className="bg-slate-950/80 text-[0.65rem] uppercase tracking-[0.1em] text-slate-500">
          <tr>
            <th className="px-4 py-3 font-black">Aluno</th>
            <th className="px-4 py-3 font-black">Nota 0–20</th>
            <th className="px-4 py-3 font-black">Estado</th>
            <th className="px-4 py-3 font-black">Observação</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-white/10">
          {rows.map((row, rowIndex) => {
            const specialStatus =
              row.status === 'absent' ||
              row.status === 'exempt'

            return (
              <tr
                key={row.studentId}
                className="bg-white/[0.015] align-top"
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 min-w-8 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-xs font-black text-slate-400">
                      {row.studentNumber || '—'}
                    </span>

                    <div>
                      <p className="text-sm font-black text-white">
                        {row.studentName}
                      </p>

                      <div className="mt-1.5">
                        <StatusBadge status={row.status} />
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <input
                    ref={element => {
                      scoreInputRefs.current[rowIndex] = element
                    }}
                    data-quick-grade-input="true"
                    type="text"
                    inputMode="decimal"
                    value={specialStatus ? '' : row.score}
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>
                    ) =>
                      changeScore(
                        row,
                        event.target.value
                      )
                    }
                    onKeyDown={(
                      event: KeyboardEvent<HTMLInputElement>
                    ) => {
                      if (
                        event.key === 'Enter' ||
                        event.key === 'ArrowDown'
                      ) {
                        event.preventDefault()
                        focusNextScore(rowIndex)
                      }
                    }}
                    disabled={
                      disabled ||
                      specialStatus
                    }
                    placeholder={
                      row.status === 'absent'
                        ? 'Falta'
                        : row.status === 'exempt'
                          ? 'Dispensado'
                          : '0–20'
                    }
                    aria-label={`Nota de ${row.studentName}`}
                    className={fieldClassName}
                  />
                </td>

                <td className="px-4 py-3">
                  <select
                    value={row.status}
                    onChange={(
                      event: ChangeEvent<HTMLSelectElement>
                    ) =>
                      changeStatus(
                        row,
                        event.target.value as DailyResultStatus
                      )
                    }
                    disabled={disabled}
                    className={fieldClassName}
                  >
                    {resultStatusOptions.map(option => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={row.note}
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>
                    ) =>
                      updateRow(row.studentId, {
                        note: event.target.value
                      })
                    }
                    disabled={disabled}
                    placeholder="Opcional"
                    className={fieldClassName}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const DailyLessonAssessmentSection = forwardRef<
  DailyLessonAssessmentSectionHandle,
  DailyLessonAssessmentSectionProps
>(
  function DailyLessonAssessmentSection(
    {
      lessonId,
      lessonStatus,
      moduleChanged,
      disabled
    },
    ref
  ) {
    const [workspace, setWorkspace] =
      useState<LessonAssessmentWorkspace | null>(null)

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    const [selectedKey, setSelectedKey] =
      useState<EntityId | 'new' | null>(null)

    const [registers, setRegisters] = useState<
      Record<EntityId, StoredRegisterState>
    >({})

    const [draft, setDraft] =
      useState<DraftAssessmentState | null>(null)

    const [detailsOpen, setDetailsOpen] =
      useState(false)

    const [deleting, setDeleting] = useState(false)

    const draftCreatedAssessmentIdRef =
      useRef<EntityId | null>(null)

    useEffect(() => {
      let active = true

      setLoading(true)
      setLoadError('')
      setWorkspace(null)
      setRegisters({})
      setSelectedKey(null)
      setDraft(null)
      setDetailsOpen(false)
      draftCreatedAssessmentIdRef.current = null

      assessmentRepository
        .getLessonAssessmentWorkspace(lessonId)
        .then(nextWorkspace => {
          if (!active) {
            return
          }

          const nextDraft =
            createDraftState(nextWorkspace)

          setWorkspace(nextWorkspace)
          setDraft(nextDraft)
          setSelectedKey(
            nextWorkspace.assessments[0]?.assessment.id ??
              'new'
          )
          setDetailsOpen(
            nextWorkspace.assessments.length === 0 &&
              nextWorkspace.criteria.length > 1 &&
              !nextDraft.criterionId
          )
        })
        .catch(error => {
          if (active) {
            setLoadError(getErrorMessage(error))
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false)
          }
        })

      return () => {
        active = false
      }
    }, [lessonId])

    useEffect(() => {
      if (
        !selectedKey ||
        selectedKey === 'new' ||
        registers[selectedKey]
      ) {
        return
      }

      let active = true
      const assessmentId = selectedKey

      setRegisters(current => ({
        ...current,
        [assessmentId]: {
          register: null,
          rows: [],
          loading: true,
          dirty: false,
          error: ''
        }
      }))

      assessmentRepository
        .getAssessmentRegister(assessmentId)
        .then(register => {
          if (!active) {
            return
          }

          setRegisters(current => ({
            ...current,
            [assessmentId]: {
              register,
              rows: createRowsFromRegister(register),
              loading: false,
              dirty: false,
              error: ''
            }
          }))
        })
        .catch(error => {
          if (!active) {
            return
          }

          setRegisters(current => ({
            ...current,
            [assessmentId]: {
              register: null,
              rows: [],
              loading: false,
              dirty: false,
              error: getErrorMessage(error)
            }
          }))
        })

      return () => {
        active = false
      }
    }, [selectedKey, registers])

    const selectedAssessment = useMemo(() => {
      if (!workspace || !selectedKey || selectedKey === 'new') {
        return null
      }

      return (
        workspace.assessments.find(
          item => item.assessment.id === selectedKey
        ) ?? null
      )
    }, [selectedKey, workspace])

    const selectedRegister =
      selectedKey && selectedKey !== 'new'
        ? registers[selectedKey] ?? null
        : null

    const hasExistingAssessments =
      Boolean(workspace?.assessments.length)

    const hasDraftAssessment =
      Boolean(draft?.enabled)

    function validatePendingAssessments() {
      for (const state of Object.values(registers)) {
        if (!state.dirty) {
          continue
        }

        if (state.loading) {
          throw new Error(
            'Uma das grelhas de avaliação ainda está a carregar.'
          )
        }

        if (state.error || !state.register) {
          throw new Error(
            `Não foi possível preparar uma avaliação: ${
              state.error || 'dados indisponíveis.'
            }`
          )
        }

        validateAndBuildEntries(state.rows)
      }

      if (!draft?.enabled) {
        return
      }

      if (!workspace?.scheme || workspace.criteria.length === 0) {
        throw new Error(
          'Configure primeiro os critérios de avaliação desta disciplina ou UFCD.'
        )
      }

      if (!draft.criterionId) {
        throw new Error(
          'Selecione o critério da avaliação em Detalhes.'
        )
      }

      validateAndBuildEntries(draft.rows)
    }

    useImperativeHandle(
      ref,
      () => ({
        validateLessonChanges(changes) {
          if (loading) {
            throw new Error(
              'A área de avaliações ainda está a carregar. Aguarde um momento e volte a guardar.'
            )
          }

          if (loadError || !workspace) {
            throw new Error(
              `Não foi possível preparar as avaliações: ${
                loadError || 'dados indisponíveis.'
              }`
            )
          }

          const hasAssessmentData =
            hasExistingAssessments ||
            hasDraftAssessment

          if (
            hasAssessmentData &&
            changes.status !== 'taught'
          ) {
            throw new Error(
              'Esta aula possui avaliações. Mantenha-a marcada como dada ou elimine primeiro as avaliações associadas.'
            )
          }

          if (
            hasAssessmentData &&
            changes.moduleId !== workspace.lesson.moduleId
          ) {
            throw new Error(
              'Esta aula possui avaliações ligadas à UFCD atual. Elimine-as antes de alterar a UFCD ou o módulo.'
            )
          }

          if (
            changes.status === 'taught' &&
            changes.moduleId === workspace.lesson.moduleId
          ) {
            validatePendingAssessments()
          }
        },

        async saveAssessments(lesson) {
          if (lesson.status !== 'taught') {
            return
          }

          if (loading) {
            throw new Error(
              'A área de avaliações ainda está a carregar. Aguarde um momento e volte a guardar.'
            )
          }

          if (loadError || !workspace) {
            throw new Error(
              `Não foi possível preparar as avaliações: ${
                loadError || 'dados indisponíveis.'
              }`
            )
          }

          if (lesson.moduleId !== workspace.lesson.moduleId) {
            if (
              hasExistingAssessments ||
              hasDraftAssessment
            ) {
              throw new Error(
                'Não é possível guardar avaliações depois de alterar a UFCD desta aula.'
              )
            }

            return
          }

          for (const [assessmentId, state] of Object.entries(registers)) {
            if (!state.dirty) {
              continue
            }

            if (state.loading) {
              throw new Error(
                'Uma das grelhas de avaliação ainda está a carregar.'
              )
            }

            if (state.error || !state.register) {
              throw new Error(
                `Não foi possível preparar uma avaliação: ${
                  state.error || 'dados indisponíveis.'
                }`
              )
            }

            const entries =
              validateAndBuildEntries(state.rows)

            await assessmentRepository.saveAssessmentResults(
              assessmentId,
              entries
            )
          }

          if (draft?.enabled) {
            if (
              !workspace.scheme ||
              workspace.criteria.length === 0
            ) {
              throw new Error(
                'Configure primeiro os critérios de avaliação desta disciplina ou UFCD.'
              )
            }

            if (!draft.criterionId) {
              throw new Error(
                'Selecione o critério da avaliação em Detalhes.'
              )
            }

            const criterion =
              workspace.criteria.find(
                item => item.id === draft.criterionId
              )

            if (!criterion) {
              throw new Error(
                'O critério selecionado já não está disponível nesta UFCD.'
              )
            }

            const entries =
              validateAndBuildEntries(draft.rows)

            if (entries.length === 0) {
              return
            }

            const assessmentDraft = {
              lessonId: lesson.id,
              criterionId: draft.criterionId,
              title:
                draft.title.trim() ||
                buildQuickAssessmentTitle(
                  lesson.date,
                  criterion.name
                ),
              activityType: draft.activityType,
              description: draft.description
            }

            const existingAssessmentId =
              draftCreatedAssessmentIdRef.current

            if (!existingAssessmentId) {
              const created =
                await assessmentAtomicPersistenceRepository
                  .createLessonAssessmentWithResults(
                    assessmentDraft,
                    entries
                  )

              draftCreatedAssessmentIdRef.current =
                created.assessment.id
            } else {
              await assessmentRepository.saveAssessmentResults(
                existingAssessmentId,
                entries
              )
            }

            draftCreatedAssessmentIdRef.current = null

            setDraft(current =>
              current
                ? {
                    ...current,
                    enabled: false,
                    title: '',
                    description: '',
                    rows:
                      current.rows.map(row => ({
                        ...row,
                        status: 'not_evaluated',
                        score: '',
                        note: ''
                      }))
                  }
                : current
            )
          }
        },

        resetTransientSaveState() {
          draftCreatedAssessmentIdRef.current = null
        }
      }),
      [
        draft,
        hasDraftAssessment,
        hasExistingAssessments,
        loadError,
        loading,
        registers,
        workspace
      ]
    )

    function beginDraftAssessment() {
      if (
        !workspace ||
        !draft ||
        disabled ||
        moduleChanged
      ) {
        return
      }

      if (draft.enabled) {
        setSelectedKey('new')
        return
      }

      const nextDraft =
        createDraftState(workspace)

      setDraft(nextDraft)
      setDetailsOpen(
        workspace.criteria.length > 1 &&
          !nextDraft.criterionId
      )
      setSelectedKey('new')
    }

    function cancelDraftAssessment() {
      if (!workspace || disabled) {
        return
      }

      const nextDraft =
        createDraftState(workspace)

      setDraft(nextDraft)
      setDetailsOpen(false)
      setSelectedKey(
        workspace.assessments[0]?.assessment.id ??
          'new'
      )
    }

    function updateDraftRows(rows: DailyAssessmentRow[]) {
      setDraft(current =>
        current
          ? {
              ...current,
              rows,
              enabled:
                hasQuickGradeData(rows)
            }
          : current
      )
    }

    function updateStoredRows(
      assessmentId: EntityId,
      rows: DailyAssessmentRow[]
    ) {
      setRegisters(current => ({
        ...current,
        [assessmentId]: {
          ...(current[assessmentId] ?? {
            register: null,
            rows: [],
            loading: false,
            dirty: false,
            error: ''
          }),
          rows,
          dirty: true
        }
      }))
    }

    async function deleteSelectedAssessment() {
      if (
        !selectedAssessment ||
        disabled ||
        deleting ||
        !workspace
      ) {
        return
      }

      const confirmed = window.confirm(
        `Eliminar a avaliação “${selectedAssessment.assessment.title}” e todas as classificações associadas?`
      )

      if (!confirmed) {
        return
      }

      setDeleting(true)
      setLoadError('')

      try {
        await assessmentRepository.deleteLessonAssessment(
          selectedAssessment.assessment.id
        )

        const nextWorkspace =
          await assessmentRepository.getLessonAssessmentWorkspace(
            lessonId
          )

        const nextDraft =
          createDraftState(nextWorkspace)

        setWorkspace(nextWorkspace)
        setDraft(nextDraft)

        setRegisters(current => {
          const next = { ...current }
          delete next[selectedAssessment.assessment.id]
          return next
        })

        setSelectedKey(
          nextWorkspace.assessments[0]?.assessment.id ??
            'new'
        )
      } catch (error) {
        setLoadError(getErrorMessage(error))
      } finally {
        setDeleting(false)
      }
    }

    if (loading) {
      return (
        <section className="rounded-[1.5rem] border border-amber-300/15 bg-amber-300/[0.035] p-5 sm:p-6">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-100/20 border-t-amber-200" />
            <span>A carregar avaliações e alunos...</span>
          </div>
        </section>
      )
    }

    if (loadError && !workspace) {
      return (
        <section className="rounded-[1.5rem] border border-rose-300/20 bg-rose-300/[0.07] p-5 text-sm leading-6 text-rose-100 sm:p-6">
          {loadError}
        </section>
      )
    }

    if (!workspace || !draft) {
      return null
    }

    const canCreateAssessment =
      !moduleChanged &&
      Boolean(workspace.scheme) &&
      workspace.criteria.length > 0 &&
      workspace.students.length > 0

    const draftNeedsCriterion =
      workspace.criteria.length > 1 &&
      !draft.criterionId

    return (
      <section className="rounded-[1.5rem] border border-amber-300/15 bg-amber-300/[0.035] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
              Avaliações da aula
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Escreva diretamente a nota de cada aluno. O estado
              “Avaliado” é assumido automaticamente quando introduz
              uma nota.
            </p>
          </div>

          {workspace.assessments.length > 0 ? (
            <button
              type="button"
              onClick={beginDraftAssessment}
              disabled={
                disabled ||
                !canCreateAssessment
              }
              className="rounded-xl border border-amber-200/25 bg-amber-300/10 px-4 py-2.5 text-xs font-black text-amber-50 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              + Outra avaliação
            </button>
          ) : null}
        </div>

        {moduleChanged ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100">
            {hasExistingAssessments || hasDraftAssessment
              ? 'Existem avaliações ligadas à UFCD original. Reponha essa UFCD ou elimine as avaliações antes de guardar a alteração.'
              : 'Guarde primeiro a aula com a nova UFCD. Depois poderá registar avaliações nessa UFCD.'}
          </div>
        ) : null}

        {!workspace.scheme || workspace.criteria.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
            <p className="text-sm font-black text-amber-100">
              Não existem critérios de avaliação configurados.
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-100/70">
              Configure os critérios desta disciplina ou UFCD antes
              de registar classificações.
            </p>
          </div>
        ) : workspace.students.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
            <p className="text-sm font-black text-amber-100">
              A turma ainda não possui alunos ativos.
            </p>
          </div>
        ) : null}

        {workspace.lesson.status !== 'taught' &&
        lessonStatus === 'taught' ? (
          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 text-xs leading-5 text-cyan-100/80">
            Esta aula ainda está guardada como planeada. Pode
            preparar as notas agora; a avaliação só será criada
            quando guardar a aula como dada.
          </div>
        ) : null}

        {loadError ? (
          <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-100">
            {loadError}
          </div>
        ) : null}

        {workspace.assessments.length > 0 ? (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {workspace.assessments.map(item => {
              const selected =
                selectedKey === item.assessment.id

              return (
                <button
                  key={item.assessment.id}
                  type="button"
                  onClick={() =>
                    setSelectedKey(item.assessment.id)
                  }
                  disabled={disabled}
                  className={`shrink-0 rounded-xl border px-4 py-2.5 text-left transition disabled:cursor-wait disabled:opacity-50 ${
                    selected
                      ? 'border-amber-200/30 bg-amber-300/10 text-amber-50'
                      : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="block text-xs font-black">
                    {item.assessment.title}
                  </span>

                  <span className="mt-1 block text-[0.65rem] text-current opacity-65">
                    {getAssessmentActivityTypeLabel(
                      item.assessment.activityType
                    )}
                  </span>
                </button>
              )
            })}

            {selectedKey === 'new' || draft.enabled ? (
              <button
                type="button"
                onClick={() => setSelectedKey('new')}
                disabled={disabled}
                className={`shrink-0 rounded-xl border px-4 py-2.5 text-left transition disabled:cursor-wait disabled:opacity-50 ${
                  selectedKey === 'new'
                    ? 'border-cyan-200/30 bg-cyan-300/10 text-cyan-50'
                    : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]'
                }`}
              >
                <span className="block text-xs font-black">
                  Avaliação rápida
                </span>

                <span className="mt-1 block text-[0.65rem] opacity-65">
                  {draft.enabled
                    ? 'Alterações por guardar'
                    : 'Ainda não criada'}
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        {selectedKey === 'new' && canCreateAssessment ? (
          <div className="mt-5 space-y-4">
            {draftNeedsCriterion ? (
              <div className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.06] p-4 text-sm leading-6 text-violet-100">
                Esta UFCD tem vários critérios ativos. Escolha o
                critério em “Detalhes” antes de guardar; não será
                feita uma escolha automática ambígua.
              </div>
            ) : null}

            <AssessmentRowsEditor
              rows={draft.rows}
              disabled={disabled || moduleChanged}
              onChange={updateDraftRows}
            />

            <button
              type="button"
              onClick={() =>
                setDetailsOpen(current => !current)
              }
              disabled={disabled}
              aria-expanded={detailsOpen}
              className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-black text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100 disabled:opacity-50"
            >
              {detailsOpen
                ? 'Ocultar detalhes'
                : 'Detalhes'}
            </button>

            {detailsOpen ? (
              <div className="grid gap-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-xs font-bold text-slate-300">
                    Nome da atividade · opcional
                  </span>

                  <input
                    type="text"
                    value={draft.title}
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>
                    ) =>
                      setDraft(current =>
                        current
                          ? {
                              ...current,
                              title: event.target.value
                            }
                          : current
                      )
                    }
                    disabled={disabled || moduleChanged}
                    placeholder="Gerado automaticamente se ficar vazio"
                    className={fieldClassName}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300">
                    Critério
                  </span>

                  <select
                    value={draft.criterionId}
                    onChange={(
                      event: ChangeEvent<HTMLSelectElement>
                    ) =>
                      setDraft(current =>
                        current
                          ? {
                              ...current,
                              criterionId: event.target.value
                            }
                          : current
                      )
                    }
                    disabled={disabled || moduleChanged}
                    className={fieldClassName}
                  >
                    {workspace.criteria.length > 1 ? (
                      <option value="">
                        Selecione o critério
                      </option>
                    ) : null}

                    {workspace.criteria.map(criterion => (
                      <option
                        key={criterion.id}
                        value={criterion.id}
                      >
                        {criterion.name} · {criterion.weightPercent}%
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300">
                    Tipo de atividade
                  </span>

                  <select
                    value={draft.activityType}
                    onChange={(
                      event: ChangeEvent<HTMLSelectElement>
                    ) =>
                      setDraft(current =>
                        current
                          ? {
                              ...current,
                              activityType:
                                event.target.value as AssessmentActivityType
                            }
                          : current
                      )
                    }
                    disabled={disabled || moduleChanged}
                    className={fieldClassName}
                  >
                    {activityTypeOptions.map(activityType => (
                      <option
                        key={activityType}
                        value={activityType}
                      >
                        {getAssessmentActivityTypeLabel(activityType)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-xs font-bold text-slate-300">
                    Descrição · opcional
                  </span>

                  <textarea
                    value={draft.description}
                    onChange={(
                      event: ChangeEvent<HTMLTextAreaElement>
                    ) =>
                      setDraft(current =>
                        current
                          ? {
                              ...current,
                              description: event.target.value
                            }
                          : current
                      )
                    }
                    disabled={disabled || moduleChanged}
                    rows={2}
                    className={`${fieldClassName} resize-y`}
                  />
                </label>

                {workspace.assessments.length > 0 ? (
                  <div className="flex justify-end sm:col-span-2">
                    <button
                      type="button"
                      onClick={cancelDraftAssessment}
                      disabled={disabled}
                      className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-50"
                    >
                      Cancelar nova avaliação
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!draft.enabled ? (
              <p className="text-xs leading-5 text-slate-500">
                Nenhuma avaliação será criada enquanto não introduzir
                uma nota ou escolher “Faltou”/“Dispensado”.
              </p>
            ) : null}
          </div>
        ) : selectedAssessment ? (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div>
                <p className="text-sm font-black text-white">
                  {selectedAssessment.assessment.title}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {selectedAssessment.criterion.name} ·{' '}
                  {getAssessmentActivityTypeLabel(
                    selectedAssessment.assessment.activityType
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={deleteSelectedAssessment}
                disabled={
                  disabled ||
                  deleting ||
                  Boolean(selectedRegister?.dirty)
                }
                className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {deleting
                  ? 'A eliminar...'
                  : 'Eliminar avaliação'}
              </button>
            </div>

            {selectedRegister?.loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 p-5 text-sm text-slate-400">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-amber-200" />
                A carregar classificações...
              </div>
            ) : selectedRegister?.error ? (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-100">
                {selectedRegister.error}
              </div>
            ) : selectedRegister ? (
              <AssessmentRowsEditor
                rows={selectedRegister.rows}
                disabled={disabled || moduleChanged}
                onChange={rows =>
                  updateStoredRows(
                    selectedAssessment.assessment.id,
                    rows
                  )
                }
              />
            ) : null}
          </div>
        ) : null}

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Todas as alterações desta área são guardadas pelo botão
          “Guardar aula completa”.
        </p>
      </section>
    )
  }
)

export default DailyLessonAssessmentSection
