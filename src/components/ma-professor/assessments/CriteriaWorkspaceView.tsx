import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState
} from 'react'

import AssessmentCriteriaManagementPanel from './AssessmentCriteriaManagementPanel'

import {
  assessmentCriteriaManagementRepository,
  type AssessmentSubjectCriteriaContext,
  type UpdatedAssessmentCriteriaScheme
} from './assessmentCriteriaManagementRepository'

import type {
  AssessmentWorkspaceFilters,
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

interface CriteriaWorkspaceViewProps {
  snapshot: AssessmentWorkspaceSnapshot
  loading?: boolean
  error?: string
  onRefresh?: () => void
  onOpenDataReset?: () => void
  onFiltersChange: (
    filters: AssessmentWorkspaceFilters
  ) => void
}

export default function CriteriaWorkspaceView({
  snapshot,
  loading = false,
  error = '',
  onRefresh,
  onOpenDataReset,
  onFiltersChange
}: CriteriaWorkspaceViewProps) {
  const subjectOptions =
    useMemo(
      () => {
        const seen =
          new Set<string>()

        return snapshot
          .assignmentOptions
          .filter(
            option => {
              if (
                seen.has(
                  option.subject.id
                )
              ) {
                return false
              }

              seen.add(
                option.subject.id
              )
              return true
            }
          )
          .sort(
            (left, right) =>
              (
                left.subject.shortName.trim() ||
                left.subject.name
              ).localeCompare(
                right.subject.shortName.trim() ||
                right.subject.name,
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

  const [
    selectedSubjectId,
    setSelectedSubjectId
  ] = useState(
    () =>
      snapshot.selectedSubject?.id ??
      subjectOptions[0]?.subject.id ??
      ''
  )

  const [
    subjectContext,
    setSubjectContext
  ] = useState<
    AssessmentSubjectCriteriaContext |
    null
  >(null)

  const [
    subjectLoading,
    setSubjectLoading
  ] = useState(false)

  const [
    subjectError,
    setSubjectError
  ] = useState('')

  const [
    criteriaOverride,
    setCriteriaOverride
  ] = useState<
    UpdatedAssessmentCriteriaScheme |
    null
  >(null)

  useEffect(() => {
    if (
      subjectOptions.some(
        option =>
          option.subject.id ===
          selectedSubjectId
      )
    ) {
      return
    }

    setSelectedSubjectId(
      snapshot.selectedSubject?.id ??
      subjectOptions[0]?.subject.id ??
      ''
    )
  }, [
    selectedSubjectId,
    snapshot.selectedSubject?.id,
    subjectOptions
  ])

  useEffect(() => {
    let cancelled =
      false

    setCriteriaOverride(null)

    if (!selectedSubjectId) {
      setSubjectContext(null)
      setSubjectError('')
      setSubjectLoading(false)

      return () => {
        cancelled = true
      }
    }

    setSubjectLoading(true)
    setSubjectError('')

    void assessmentCriteriaManagementRepository
      .getSubjectContext(
        snapshot.academicYear.id,
        selectedSubjectId
      )
      .then(
        result => {
          if (!cancelled) {
            setSubjectContext(
              result
            )
          }
        }
      )
      .catch(
        loadError => {
          if (!cancelled) {
            setSubjectContext(null)
            setSubjectError(
              loadError instanceof Error
                ? loadError.message
                : 'Não foi possível carregar os critérios desta disciplina.'
            )
          }
        }
      )
      .finally(
        () => {
          if (!cancelled) {
            setSubjectLoading(false)
          }
        }
      )

    return () => {
      cancelled = true
    }
  }, [
    selectedSubjectId,
    snapshot.academicYear.id,
    snapshot.generatedAt
  ])

  const selectedSubjectOption =
    subjectOptions.find(
      option =>
        option.subject.id ===
        selectedSubjectId
    ) ??
    null

  const subjectLabel =
    selectedSubjectOption
      ? (
          selectedSubjectOption
            .subject
            .shortName
            .trim() ||
          selectedSubjectOption
            .subject
            .name
        )
      : 'Disciplina'

  const subjectScheme =
    criteriaOverride?.scheme ??
    subjectContext?.scheme ??
    null

  const subjectCriteria =
    criteriaOverride?.criteria ??
    subjectContext?.criteria ??
    []

  const subjectSnapshot =
    subjectScheme
      ? {
          ...snapshot,
          scheme:
            subjectScheme,
          criteria:
            subjectCriteria
        }
      : null

  function handleSubjectChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    setCriteriaOverride(null)
    setSelectedSubjectId(
      event.target.value
    )
  }

  function handleAssignmentChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    onFiltersChange({
      teachingAssignmentId:
        event.target.value ||
        null,
      moduleId: null
    })
  }

  function handleModuleChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    onFiltersChange({
      teachingAssignmentId:
        snapshot.selectedAssignment?.id ??
        null,
      moduleId:
        event.target.value ||
        null
    })
  }

  const moduleLabel =
    snapshot
      .moduleOptions
      .find(
        option =>
          option.module.id ===
          snapshot
            .selectedModule
            ?.id
      )
      ?.label ??
    snapshot
      .selectedModule
      ?.name ??
    'Sem componente selecionada'

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 shadow-2xl shadow-cyan-950/10 backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan-100">
                  Critérios de avaliação
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-bold text-slate-400">
                  {snapshot.academicYear.name}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Critérios e ponderações
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Os critérios gerais pertencem à disciplina e são aplicados às turmas que usam esse conjunto. Alterações ao nome, descrição ou ponderação são sincronizadas sem recriar os critérios nem perder as avaliações já associadas.
              </p>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={
                loading ||
                !onRefresh
              }
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
            >
              {loading
                ? 'A atualizar...'
                : 'Atualizar'}
            </button>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-7">
          <label className="block max-w-2xl">
            <span className="mb-2 block text-sm font-bold text-slate-200">
              Disciplina
            </span>

            <select
              value={
                selectedSubjectId
              }
              onChange={
                handleSubjectChange
              }
              disabled={
                subjectLoading ||
                subjectOptions.length ===
                  0
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {subjectOptions.length ===
              0 ? (
                <option value="">
                  Sem disciplinas disponíveis
                </option>
              ) : null}

              {subjectOptions.map(
                option => (
                  <option
                    key={
                      option.subject.id
                    }
                    value={
                      option.subject.id
                    }
                  >
                    {option.subject
                      .shortName
                      .trim() ||
                      option.subject.name}
                  </option>
                )
              )}
            </select>
          </label>

          <p className="mt-3 max-w-3xl text-xs leading-5 text-slate-500">
            As personalizações específicas de uma UFCD ou módulo continuam preservadas e podem ser consultadas na gestão avançada mais abaixo.
          </p>
        </div>
      </section>

      {subjectError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-50"
        >
          {subjectError}
        </div>
      ) : null}

      {subjectLoading ? (
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 text-center">
          <p className="text-sm font-bold text-slate-300">
            A carregar os critérios da disciplina...
          </p>
        </section>
      ) : !selectedSubjectId ? (
        <section className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/60 p-8 text-center">
          <p className="text-lg font-black text-white">
            Ainda não existem disciplinas disponíveis.
          </p>
        </section>
      ) : !subjectContext?.scheme ? (
        <section className="rounded-[2rem] border border-amber-300/20 bg-amber-300/[0.06] p-6">
          <p className="text-sm font-black text-amber-100">
            Não existe um conjunto de critérios gerais ativo para {subjectLabel}.
          </p>

          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            Esta disciplina pode estar configurada apenas com critérios específicos por UFCD/módulo. Pode consultá-los na gestão avançada ou corrigir a configuração inicial.
          </p>
        </section>
      ) : !subjectContext.aligned ? (
        <section className="rounded-[2rem] border border-amber-300/20 bg-amber-300/[0.06] p-6">
          <p className="text-sm font-black text-amber-100">
            Os critérios gerais de {subjectLabel} diferem entre turmas.
          </p>

          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            Para proteger avaliações já existentes, a edição conjunta fica bloqueada quando não é possível relacionar os critérios com segurança. Use a gestão avançada por turma/UFCD abaixo para resolver primeiro essas diferenças.
          </p>
        </section>
      ) : subjectSnapshot ? (
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-xl shadow-black/20">
          <div className="px-5 pt-5 sm:px-7 sm:pt-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
              Critérios gerais da disciplina
            </p>

            <h2 className="mt-3 text-xl font-black text-white">
              {subjectLabel}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Aplicados a {subjectContext.coveredTeachingAssignmentIds.length}{' '}
              {subjectContext.coveredTeachingAssignmentIds.length === 1
                ? 'turma'
                : 'turmas'} com critérios gerais.
            </p>
          </div>

          <AssessmentCriteriaManagementPanel
            snapshot={
              subjectSnapshot
            }
            disabled={
              loading
            }
            subjectScope={{
              academicYearId:
                snapshot.academicYear.id,
              subjectId:
                selectedSubjectId
            }}
            onOpenDataReset={
              onOpenDataReset
            }
            onSaved={
              result => {
                setCriteriaOverride(
                  result
                )
                onRefresh?.()
              }
            }
          />
        </section>
      ) : null}

      <details className="group overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60">
        <summary className="cursor-pointer list-none px-5 py-5 sm:px-7">
          <span className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-black text-slate-200">
                Gestão avançada por turma / UFCD
              </span>

              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Mantém o acesso às personalizações específicas e aos conjuntos antigos por turma.
              </span>
            </span>

            <span
              aria-hidden="true"
              className="text-slate-500 transition group-open:rotate-180"
            >
              ↓
            </span>
          </span>
        </summary>

        <div className="border-t border-white/10 px-5 py-6 sm:px-7">
          <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-xs leading-5 text-amber-100/80">
            Use esta área para critérios específicos de uma UFCD/módulo ou para corrigir diferenças já existentes entre turmas. Se editar aqui um conjunto geral de apenas uma turma, ele pode deixar de coincidir com os restantes conjuntos da disciplina.
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-200">
                Turma e disciplina
              </span>

              <select
                value={
                  snapshot.filters
                    .teachingAssignmentId ??
                  snapshot
                    .selectedAssignment
                    ?.id ??
                  ''
                }
                onChange={
                  handleAssignmentChange
                }
                disabled={
                  loading ||
                  snapshot.assignmentOptions
                    .length === 0
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {snapshot.assignmentOptions
                  .length === 0 ? (
                  <option value="">
                    Sem turmas disponíveis
                  </option>
                ) : null}

                {snapshot.assignmentOptions.map(
                  option => (
                    <option
                      key={
                        option.assignment.id
                      }
                      value={
                        option.assignment.id
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-200">
                UFCD, módulo ou componente
              </span>

              <select
                value={
                  snapshot.filters
                    .moduleId ??
                  snapshot
                    .selectedModule
                    ?.id ??
                  ''
                }
                onChange={
                  handleModuleChange
                }
                disabled={
                  loading ||
                  snapshot.moduleOptions
                    .length === 0
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {snapshot.moduleOptions
                  .length === 0 ? (
                  <option value="">
                    Sem componentes disponíveis
                  </option>
                ) : null}

                {snapshot.moduleOptions.map(
                  option => (
                    <option
                      key={
                        option.module.id
                      }
                      value={
                        option.module.id
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-50"
            >
              {error}
            </div>
          ) : null}

          {!snapshot.selectedAssignment ||
          !snapshot.selectedModule ? (
            <p className="mt-5 text-sm leading-6 text-slate-500">
              Selecione uma turma, disciplina e componente curricular.
            </p>
          ) : !snapshot.scheme ? (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100/80">
              Não existe um conjunto de critérios ativo para esta seleção.
            </div>
          ) : (
            <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
              <div className="px-5 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Seleção avançada
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {snapshot.selectedGroup?.name}{' '}
                  · {moduleLabel}
                </p>
              </div>

              <AssessmentCriteriaManagementPanel
                snapshot={
                  snapshot
                }
                disabled={
                  loading
                }
                onOpenDataReset={
                  onOpenDataReset
                }
                onSaved={
                  () =>
                    onRefresh?.()
                }
              />
            </section>
          )}
        </div>
      </details>
    </div>
  )
}
