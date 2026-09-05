import {
  forwardRef,
  type ChangeEvent,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'

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
  'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-wait disabled:opacity-50'

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
    criterionId: workspace.criteria[0]?.id ?? '',
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
            <th className="px-4 py-3 font-black">Estado</th>
            <th className="px-4 py-3 font-black">Classificação</th>
            <th className="px-4 py-3 font-black">Observação</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-white/10">
          {rows.map(row => (
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
                {row.status === 'evaluated' ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.score}
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>
                    ) =>
                      updateRow(row.studentId, {
                        score: event.target.value
                      })
                    }
                    disabled={disabled}
                    placeholder="0–20"
                    className={fieldClassName}
                  />
                ) : row.status === 'absent' ? (
                  <p className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2.5 text-xs font-bold text-rose-100/80">
                    Valor de falta definido nas configurações
                  </p>
                ) : row.status === 'exempt' ? (
                  <p className="rounded-xl border border-violet-300/15 bg-violet-300/[0.05] px-3 py-2.5 text-xs font-bold text-violet-100/80">
                    Valor de dispensa definido nas configurações
                  </p>
                ) : (
                  <p className="px-1 py-2.5 text-xs text-slate-600">
                    Não entra no cálculo.
                  </p>
                )}
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
          ))}
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
      draftCreatedAssessmentIdRef.current = null

      assessmentRepository
        .getLessonAssessmentWorkspace(lessonId)
        .then(nextWorkspace => {
          if (!active) {
            return
          }

          setWorkspace(nextWorkspace)
          setDraft(createDraftState(nextWorkspace))
          setSelectedKey(
            nextWorkspace.assessments[0]?.assessment.id ?? null
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

    const hasDraftAssessment = Boolean(draft?.enabled)

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

      if (!draft.title.trim()) {
        throw new Error(
          'Indique o nome da nova atividade de avaliação.'
        )
      }

      if (!draft.criterionId) {
        throw new Error(
          'Selecione o critério da nova atividade de avaliação.'
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
            hasExistingAssessments || hasDraftAssessment

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
            if (hasExistingAssessments || hasDraftAssessment) {
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

            const entries = validateAndBuildEntries(state.rows)

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

            if (!draft.title.trim()) {
              throw new Error(
                'Indique o nome da nova atividade de avaliação.'
              )
            }

            if (!draft.criterionId) {
              throw new Error(
                'Selecione o critério da nova atividade de avaliação.'
              )
            }

            let assessmentId =
              draftCreatedAssessmentIdRef.current

            if (!assessmentId) {
              const assessment =
                await assessmentRepository.createLessonAssessment({
                  lessonId: lesson.id,
                  criterionId: draft.criterionId,
                  title: draft.title,
                  activityType: draft.activityType,
                  description: draft.description
                })

              assessmentId = assessment.id
              draftCreatedAssessmentIdRef.current = assessment.id
            }

            await assessmentRepository.saveAssessmentResults(
              assessmentId,
              validateAndBuildEntries(draft.rows)
            )

            draftCreatedAssessmentIdRef.current = null

            setDraft(current =>
              current
                ? {
                    ...current,
                    enabled: false
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
      if (!draft || disabled || moduleChanged) {
        return
      }

      setDraft(current =>
        current
          ? {
              ...current,
              enabled: true
            }
          : current
      )

      setSelectedKey('new')
    }

    function cancelDraftAssessment() {
      if (!workspace || disabled) {
        return
      }

      setDraft(createDraftState(workspace))

      setSelectedKey(
        workspace.assessments[0]?.assessment.id ?? null
      )
    }

    function updateDraftRows(rows: DailyAssessmentRow[]) {
      setDraft(current =>
        current
          ? {
              ...current,
              rows
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

        setWorkspace(nextWorkspace)

        setRegisters(current => {
          const next = { ...current }
          delete next[selectedAssessment.assessment.id]
          return next
        })

        setSelectedKey(
          nextWorkspace.assessments[0]?.assessment.id ??
            (draft?.enabled ? 'new' : null)
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

    return (
      <section className="rounded-[1.5rem] border border-amber-300/15 bg-amber-300/[0.035] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
              Avaliações da aula
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Registe a atividade e a classificação de cada aluno.
              “Não avaliado” fica fora do cálculo.
            </p>
          </div>

          <button
            type="button"
            onClick={beginDraftAssessment}
            disabled={
              disabled ||
              draft.enabled ||
              !canCreateAssessment
            }
            className="rounded-xl border border-amber-200/25 bg-amber-300/10 px-4 py-2.5 text-xs font-black text-amber-50 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            + Nova avaliação
          </button>
        </div>

        {moduleChanged ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100">
            {hasExistingAssessments || hasDraftAssessment
              ? 'Existem avaliações ligadas à UFCD original. Reponha essa UFCD ou elimine as avaliações antes de guardar a alteração.'
              : 'Guarde primeiro a aula com a nova UFCD. Depois poderá criar avaliações nessa UFCD.'}
          </div>
        ) : null}

        {!workspace.scheme || workspace.criteria.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
            <p className="text-sm font-black text-amber-100">
              Não existem critérios de avaliação configurados.
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-100/70">
              Configure os critérios desta disciplina ou UFCD antes
              de criar uma avaliação.
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
            preparar a avaliação agora; tudo será criado depois de
            a aula ser guardada como dada.
          </div>
        ) : null}

        {loadError ? (
          <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-100">
            {loadError}
          </div>
        ) : null}

        {workspace.assessments.length > 0 || draft.enabled ? (
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

            {draft.enabled ? (
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
                  Nova avaliação
                </span>

                <span className="mt-1 block text-[0.65rem] opacity-65">
                  Ainda não guardada
                </span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-6 text-slate-500">
            Esta aula ainda não possui atividades de avaliação. Só
            precisa de adicionar uma quando existir algo para
            classificar.
          </div>
        )}

        {selectedKey === 'new' && draft.enabled ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-bold text-slate-300">
                  Nome da atividade
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
                  placeholder="Ex.: Apresentação do projeto"
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
                              event.target
                                .value as AssessmentActivityType
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

              <div className="flex justify-end sm:col-span-2">
                <button
                  type="button"
                  onClick={cancelDraftAssessment}
                  disabled={disabled}
                  className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-300/10 disabled:cursor-wait disabled:opacity-50"
                >
                  Remover nova avaliação
                </button>
              </div>
            </div>

            <AssessmentRowsEditor
              rows={draft.rows}
              disabled={disabled || moduleChanged}
              onChange={updateDraftRows}
            />
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
