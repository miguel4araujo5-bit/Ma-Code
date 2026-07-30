import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useState
} from 'react'

import type {
  AssessmentActivityType,
  AssessmentResultStatus,
  EntityId
} from '../types'

import {
  assessmentRepository,
  getAssessmentActivityTypeLabel,
  getAssessmentResultStatusLabel,
  type AssessmentRegister,
  type AssessmentRegisterRow,
  type LessonAssessmentWorkspace
} from './assessmentRepository'

interface LessonAssessmentSectionProps {
  lessonId: EntityId
  disabled: boolean
}

interface CreateAssessmentFormState {
  title: string
  criterionId: EntityId
  activityType: AssessmentActivityType
  description: string
}

const activityTypeOptions: AssessmentActivityType[] = [
  'participation',
  'practical_work',
  'presentation',
  'written_work',
  'test',
  'other'
]

const resultStatusOptions: AssessmentResultStatus[] = [
  'evaluated',
  'absent',
  'exempt'
]

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function createInitialForm(
  criterionId: EntityId = ''
): CreateAssessmentFormState {
  return {
    title: '',
    criterionId,
    activityType: 'practical_work',
    description: ''
  }
}

function formatScore(score: number | null) {
  if (score === null) {
    return '—'
  }

  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(score)
}

function FieldLabel({
  children,
  optional = false
}: {
  children: ReactNode
  optional?: boolean
}) {
  return (
    <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
      <span>{children}</span>

      {optional ? (
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Opcional
        </span>
      ) : null}
    </span>
  )
}

export default function LessonAssessmentSection({
  lessonId,
  disabled
}: LessonAssessmentSectionProps) {
  const [workspace, setWorkspace] =
    useState<LessonAssessmentWorkspace | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [
    selectedAssessmentId,
    setSelectedAssessmentId
  ] =
    useState<EntityId | null>(null)

  const [register, setRegister] =
    useState<AssessmentRegister | null>(null)

  const [rows, setRows] =
    useState<AssessmentRegisterRow[]>([])

  const [registerLoading, setRegisterLoading] =
    useState(false)

  const [registerError, setRegisterError] =
    useState('')

  const [showCreateForm, setShowCreateForm] =
    useState(false)

  const [createForm, setCreateForm] =
    useState<CreateAssessmentFormState>(
      () => createInitialForm()
    )

  const [creating, setCreating] =
    useState(false)

  const [savingResults, setSavingResults] =
    useState(false)

  const [deleting, setDeleting] =
    useState(false)

  const busy =
    disabled ||
    creating ||
    savingResults ||
    deleting

  async function refreshWorkspace(
    preferredAssessmentId?: EntityId
  ) {
    const nextWorkspace =
      await assessmentRepository
        .getLessonAssessmentWorkspace(
          lessonId
        )

    setWorkspace(nextWorkspace)

    setCreateForm(current => ({
      ...current,

      criterionId:
        nextWorkspace.criteria.some(
          criterion =>
            criterion.id ===
            current.criterionId
        )
          ? current.criterionId
          : nextWorkspace.criteria[0]?.id ??
            ''
    }))

    setSelectedAssessmentId(current => {
      if (
        preferredAssessmentId &&
        nextWorkspace.assessments.some(
          item =>
            item.assessment.id ===
            preferredAssessmentId
        )
      ) {
        return preferredAssessmentId
      }

      if (
        current &&
        nextWorkspace.assessments.some(
          item =>
            item.assessment.id ===
            current
        )
      ) {
        return current
      }

      return (
        nextWorkspace.assessments[0]
          ?.assessment.id ??
        null
      )
    })

    return nextWorkspace
  }

  useEffect(() => {
    let active =
      true

    setLoading(true)
    setError('')

    assessmentRepository
      .getLessonAssessmentWorkspace(
        lessonId
      )
      .then(nextWorkspace => {
        if (!active) {
          return
        }

        setWorkspace(nextWorkspace)

        setCreateForm(
          createInitialForm(
            nextWorkspace.criteria[0]?.id ??
              ''
          )
        )

        setSelectedAssessmentId(
          nextWorkspace.assessments[0]
            ?.assessment.id ??
            null
        )
      })
      .catch(loadError => {
        if (active) {
          setError(
            getErrorMessage(loadError)
          )
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active =
        false
    }
  }, [
    lessonId
  ])

  useEffect(() => {
    if (!selectedAssessmentId) {
      setRegister(null)
      setRows([])
      setRegisterError('')

      return
    }

    let active =
      true

    setRegisterLoading(true)
    setRegisterError('')

    assessmentRepository
      .getAssessmentRegister(
        selectedAssessmentId
      )
      .then(nextRegister => {
        if (!active) {
          return
        }

        setRegister(nextRegister)
        setRows(nextRegister.rows)
      })
      .catch(loadError => {
        if (!active) {
          return
        }

        setRegister(null)
        setRows([])

        setRegisterError(
          getErrorMessage(loadError)
        )
      })
      .finally(() => {
        if (active) {
          setRegisterLoading(false)
        }
      })

    return () => {
      active =
        false
    }
  }, [
    selectedAssessmentId
  ])

  function updateCreateForm<
    Key extends keyof CreateAssessmentFormState
  >(
    key: Key,
    value: CreateAssessmentFormState[Key]
  ) {
    setCreateForm(current => ({
      ...current,
      [key]: value
    }))
  }

  function updateRow(
    studentId: EntityId,
    changes: Partial<
      Pick<
        AssessmentRegisterRow,
        | 'effectiveStatus'
        | 'effectiveScore'
        | 'effectiveNote'
      >
    >
  ) {
    setRows(current =>
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

  function changeResultStatus(
    row: AssessmentRegisterRow,
    status: AssessmentResultStatus
  ) {
    if (!register) {
      return
    }

    updateRow(
      row.student.id,
      {
        effectiveStatus:
          status,

        effectiveScore:
          status === 'absent'
            ? register.assessment
                .absentScore
            : status === 'exempt'
              ? register.assessment
                  .exemptScore
              : row.effectiveStatus ===
                  'evaluated'
                ? row.effectiveScore
                : null
      }
    )
  }

  async function createAssessment() {
    if (
      !workspace ||
      creating ||
      disabled
    ) {
      return
    }

    if (
      workspace.lesson.status !==
      'taught'
    ) {
      setError(
        'Guarde primeiro a aula como dada para poder registar uma avaliação.'
      )

      return
    }

    if (
      !createForm.title.trim()
    ) {
      setError(
        'Indique o nome da atividade de avaliação.'
      )

      return
    }

    if (
      !createForm.criterionId
    ) {
      setError(
        'Selecione o critério de avaliação.'
      )

      return
    }

    setCreating(true)
    setError('')

    try {
      const assessment =
        await assessmentRepository
          .createLessonAssessment({
            lessonId,

            criterionId:
              createForm.criterionId,

            title:
              createForm.title,

            activityType:
              createForm.activityType,

            description:
              createForm.description
          })

      await refreshWorkspace(
        assessment.id
      )

      setCreateForm(
        createInitialForm(
          createForm.criterionId
        )
      )

      setShowCreateForm(false)
    } catch (createError) {
      setError(
        getErrorMessage(createError)
      )
    } finally {
      setCreating(false)
    }
  }

  async function saveResults() {
    if (
      !register ||
      savingResults ||
      disabled
    ) {
      return
    }

    const invalidRow =
      rows.find(
        row =>
          row.effectiveStatus ===
            'evaluated' &&
          row.effectiveScore !==
            null &&
          (
            !Number.isFinite(
              row.effectiveScore
            ) ||
            row.effectiveScore < 0 ||
            row.effectiveScore > 20
          )
      )

    if (invalidRow) {
      setRegisterError(
        `A classificação de ${invalidRow.student.name} deve estar entre 0 e 20 valores.`
      )

      return
    }

    const entries =
      rows.flatMap(row => {
        if (
          row.effectiveStatus ===
            'evaluated' &&
          row.effectiveScore ===
            null
        ) {
          return []
        }

        return [
          {
            studentId:
              row.student.id,

            status:
              row.effectiveStatus,

            score:
              row.effectiveScore,

            note:
              row.effectiveNote
          }
        ]
      })

    setSavingResults(true)
    setRegisterError('')

    try {
      const savedRegister =
        await assessmentRepository
          .saveAssessmentResults(
            register.assessment.id,
            entries
          )

      setRegister(savedRegister)
      setRows(savedRegister.rows)

      await refreshWorkspace(
        savedRegister.assessment.id
      )
    } catch (saveError) {
      setRegisterError(
        getErrorMessage(saveError)
      )
    } finally {
      setSavingResults(false)
    }
  }

  async function deleteAssessment() {
    if (
      !register ||
      deleting ||
      disabled
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Eliminar a avaliação “${register.assessment.title}” e todas as classificações associadas?`
      )

    if (!confirmed) {
      return
    }

    setDeleting(true)
    setRegisterError('')

    try {
      await assessmentRepository
        .deleteLessonAssessment(
          register.assessment.id
        )

      setRegister(null)
      setRows([])

      setSelectedAssessmentId(
        null
      )

      await refreshWorkspace()
    } catch (deleteError) {
      setRegisterError(
        getErrorMessage(deleteError)
      )
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[1.5rem] border border-amber-300/15 bg-amber-300/[0.035] p-5 sm:p-6">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-100/20 border-t-amber-200" />

          <span>
            A carregar a avaliação da aula...
          </span>
        </div>
      </section>
    )
  }

  if (
    error &&
    !workspace
  ) {
    return (
      <section className="rounded-[1.5rem] border border-rose-300/20 bg-rose-300/[0.07] p-5 text-sm leading-6 text-rose-100 sm:p-6">
        {error}
      </section>
    )
  }

  if (!workspace) {
    return null
  }

  const canCreateAssessment =
    workspace.lesson.status ===
      'taught' &&
    Boolean(workspace.scheme) &&
    workspace.criteria.length > 0 &&
    workspace.students.length > 0

  const completedRows =
    rows.filter(
      row =>
        row.effectiveStatus !==
          'evaluated' ||
        row.effectiveScore !== null
    ).length

  return (
    <section className="rounded-[1.5rem] border border-amber-300/15 bg-amber-300/[0.035] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
            Avaliação
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Registe a atividade e introduza apenas as classificações disponíveis.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreateForm(
              current => !current
            )

            setError('')
          }}
          disabled={
            busy ||
            !canCreateAssessment
          }
          className="rounded-xl border border-amber-200/25 bg-amber-300/10 px-4 py-2.5 text-xs font-black text-amber-50 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {showCreateForm
            ? 'Cancelar'
            : '+ Nova avaliação'}
        </button>
      </div>

      {workspace.lesson.status !==
      'taught' ? (
        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
          <p className="text-sm font-black text-cyan-100">
            Guarde primeiro a aula como dada.
          </p>

          <p className="mt-1 text-xs leading-5 text-cyan-100/70">
            Depois de guardar, volte a abrir a aula para registar avaliações e classificações.
          </p>
        </div>
      ) : !workspace.scheme ||
        workspace.criteria.length ===
          0 ? (
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
          <p className="text-sm font-black text-amber-100">
            Não existem critérios de avaliação configurados.
          </p>

          <p className="mt-1 text-xs leading-5 text-amber-100/70">
            Configure os critérios desta disciplina ou UFCD antes de criar uma avaliação.
          </p>
        </div>
      ) : workspace.students.length ===
        0 ? (
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
          <p className="text-sm font-black text-amber-100">
            A turma ainda não possui alunos.
          </p>

          <p className="mt-1 text-xs leading-5 text-amber-100/70">
            Adicione os alunos na configuração inicial para registar classificações.
          </p>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {showCreateForm &&
      canCreateAssessment ? (
        <div className="mt-5 rounded-2xl border border-amber-200/20 bg-slate-950/45 p-4 sm:p-5">
          <p className="text-sm font-black text-white">
            Nova atividade de avaliação
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <FieldLabel>
                Nome da atividade
              </FieldLabel>

              <input
                type="text"
                value={
                  createForm.title
                }
                onChange={(
                  event:
                    ChangeEvent<HTMLInputElement>
                ) =>
                  updateCreateForm(
                    'title',
                    event.target.value
                  )
                }
                disabled={
                  busy
                }
                placeholder="Ex.: Trabalho prático sobre comunicação"
                className="w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-wait disabled:opacity-60"
              />
            </label>

            <label className="block">
              <FieldLabel>
                Critério
              </FieldLabel>

              <select
                value={
                  createForm.criterionId
                }
                onChange={(
                  event:
                    ChangeEvent<HTMLSelectElement>
                ) =>
                  updateCreateForm(
                    'criterionId',
                    event.target.value
                  )
                }
                disabled={
                  busy
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-wait disabled:opacity-60"
              >
                {workspace.criteria.map(
                  criterion => (
                    <option
                      key={
                        criterion.id
                      }
                      value={
                        criterion.id
                      }
                    >
                      {criterion.name}{' '}
                      (
                      {formatScore(
                        criterion.weightPercent
                      )}
                      %)
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block">
              <FieldLabel>
                Tipo de atividade
              </FieldLabel>

              <select
                value={
                  createForm.activityType
                }
                onChange={(
                  event:
                    ChangeEvent<HTMLSelectElement>
                ) =>
                  updateCreateForm(
                    'activityType',
                    event.target.value as AssessmentActivityType
                  )
                }
                disabled={
                  busy
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-wait disabled:opacity-60"
              >
                {activityTypeOptions.map(
                  activityType => (
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

            <label className="block sm:col-span-2">
              <FieldLabel optional>
                Descrição
              </FieldLabel>

              <textarea
                value={
                  createForm.description
                }
                onChange={(
                  event:
                    ChangeEvent<HTMLTextAreaElement>
                ) =>
                  updateCreateForm(
                    'description',
                    event.target.value
                  )
                }
                disabled={
                  busy
                }
                rows={
                  3
                }
                placeholder="Indicações, objetivos ou observações sobre a atividade."
                className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-wait disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={
                createAssessment
              }
              disabled={
                busy
              }
              className="rounded-xl border border-amber-200/30 bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            >
              {creating
                ? 'A criar...'
                : 'Criar avaliação'}
            </button>
          </div>
        </div>
      ) : null}

      {workspace.assessments.length >
      0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {workspace.assessments.map(
            item => {
              const selected =
                item.assessment.id ===
                selectedAssessmentId

              return (
                <button
                  key={
                    item.assessment.id
                  }
                  type="button"
                  onClick={() =>
                    setSelectedAssessmentId(
                      item.assessment.id
                    )
                  }
                  disabled={
                    busy
                  }
                  className={`rounded-2xl border p-4 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                    selected
                      ? 'border-amber-300/30 bg-amber-300/10'
                      : 'border-white/10 bg-slate-900/55 hover:border-white/20 hover:bg-white/[0.045]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">
                        {
                          item
                            .assessment
                            .title
                        }
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-400">
                        {
                          item
                            .criterion
                            .name
                        }
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.08em] ${
                        item.complete
                          ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                          : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                      }`}
                    >
                      {item.complete
                        ? 'Completa'
                        : 'Por preencher'}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] font-bold text-slate-400">
                    <span>
                      {getAssessmentActivityTypeLabel(
                        item.assessment
                          .activityType
                      )}
                    </span>

                    <span>
                      ·
                    </span>

                    <span>
                      Média{' '}
                      {formatScore(
                        item.average
                      )}
                    </span>

                    <span>
                      ·
                    </span>

                    <span>
                      {
                        item.resultCount
                      }
                      /
                      {
                        workspace
                          .students
                          .length
                      }
                    </span>
                  </div>
                </button>
              )
            }
          )}
        </div>
      ) : canCreateAssessment &&
        !showCreateForm ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-slate-900/35 p-5 text-center">
          <p className="text-sm font-black text-white">
            Ainda não existem avaliações nesta aula.
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Carregue em “Nova avaliação” para criar a primeira atividade.
          </p>
        </div>
      ) : null}

      {selectedAssessmentId ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
          {registerLoading ? (
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-100/20 border-t-amber-200" />

              <span>
                A carregar classificações...
              </span>
            </div>
          ) : registerError &&
            !register ? (
            <div
              role="alert"
              className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
            >
              {registerError}
            </div>
          ) : register ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-black text-white">
                    {
                      register
                        .assessment
                        .title
                    }
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {
                      register
                        .criterion
                        .name
                    }{' '}
                    · peso{' '}
                    {formatScore(
                      register.criterion
                        .weightPercent
                    )}
                    % ·{' '}
                    {getAssessmentActivityTypeLabel(
                      register.assessment
                        .activityType
                    )}
                  </p>

                  {register.assessment
                    .description ? (
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {
                        register
                          .assessment
                          .description
                      }
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={
                    deleteAssessment
                  }
                  disabled={
                    busy
                  }
                  className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-300/10 disabled:cursor-wait disabled:opacity-60"
                >
                  {deleting
                    ? 'A eliminar...'
                    : 'Eliminar avaliação'}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100">
                  {completedRows}
                  /
                  {rows.length}{' '}
                  preenchidos
                </span>

                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-black text-emerald-100">
                  Média{' '}
                  {formatScore(
                    register.average
                  )}
                </span>

                <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-black text-rose-100">
                  {
                    register
                      .absentCount
                  }{' '}
                  faltas
                </span>

                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs font-black text-violet-100">
                  {
                    register
                      .exemptCount
                  }{' '}
                  dispensados
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {rows.map(row => (
                  <article
                    key={
                      row.student.id
                    }
                    className="rounded-2xl border border-white/10 bg-slate-900/55 p-4"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
                          N.º{' '}
                          {
                            row
                              .student
                              .number
                          }
                        </p>

                        <p className="mt-1 truncate text-sm font-black text-white">
                          {
                            row
                              .student
                              .name
                          }
                        </p>
                      </div>

                      <div className="grid shrink-0 grid-cols-3 gap-2">
                        {resultStatusOptions.map(
                          status => {
                            const selected =
                              row.effectiveStatus ===
                              status

                            return (
                              <button
                                key={
                                  status
                                }
                                type="button"
                                onClick={() =>
                                  changeResultStatus(
                                    row,
                                    status
                                  )
                                }
                                disabled={
                                  busy
                                }
                                className={`rounded-xl border px-3 py-2 text-[0.68rem] font-black transition disabled:cursor-wait disabled:opacity-60 ${
                                  selected
                                    ? status ===
                                      'evaluated'
                                      ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-50'
                                      : status ===
                                          'absent'
                                        ? 'border-rose-300/25 bg-rose-300/10 text-rose-50'
                                        : 'border-violet-300/25 bg-violet-300/10 text-violet-50'
                                    : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]'
                                }`}
                              >
                                {getAssessmentResultStatusLabel(
                                  status
                                )}
                              </button>
                            )
                          }
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[9rem_1fr]">
                      {row.effectiveStatus ===
                      'evaluated' ? (
                        <label className="block">
                          <FieldLabel>
                            Classificação
                          </FieldLabel>

                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.1"
                            value={
                              row.effectiveScore ??
                              ''
                            }
                            onChange={(
                              event:
                                ChangeEvent<HTMLInputElement>
                            ) =>
                              updateRow(
                                row.student.id,
                                {
                                  effectiveScore:
                                    event
                                      .target
                                      .value ===
                                    ''
                                      ? null
                                      : Number(
                                          event
                                            .target
                                            .value
                                        )
                                }
                              )
                            }
                            disabled={
                              busy
                            }
                            placeholder="0–20"
                            className="w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
                          />
                        </label>
                      ) : (
                        <div>
                          <FieldLabel>
                            Classificação
                          </FieldLabel>

                          <div className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm font-black text-slate-300">
                            {formatScore(
                              row.effectiveScore
                            )}
                          </div>
                        </div>
                      )}

                      <label className="block">
                        <FieldLabel optional>
                          Observação
                        </FieldLabel>

                        <input
                          type="text"
                          value={
                            row.effectiveNote
                          }
                          onChange={(
                            event:
                              ChangeEvent<HTMLInputElement>
                          ) =>
                            updateRow(
                              row.student.id,
                              {
                                effectiveNote:
                                  event
                                    .target
                                    .value
                              }
                            )
                          }
                          disabled={
                            busy
                          }
                          placeholder="Comentário sobre o desempenho do aluno."
                          className="w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-wait disabled:opacity-60"
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>

              {registerError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
                >
                  {registerError}
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">
                  Pode guardar uma avaliação incompleta e preencher as restantes notas mais tarde.
                </p>

                <button
                  type="button"
                  onClick={
                    saveResults
                  }
                  disabled={
                    busy
                  }
                  className="rounded-xl border border-amber-200/30 bg-gradient-to-r from-amber-300 to-yellow-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                >
                  {savingResults
                    ? 'A guardar...'
                    : 'Guardar classificações'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
