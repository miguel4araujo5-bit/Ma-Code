import {
  type ChangeEvent,
  useEffect,
  useState
} from 'react'

import AssessmentCriteriaManagementPanel from './AssessmentCriteriaManagementPanel'

import type {
  UpdatedAssessmentCriteriaScheme
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
  onFiltersChange: (
    filters: AssessmentWorkspaceFilters
  ) => void
}

function getSubjectLabel(
  snapshot: AssessmentWorkspaceSnapshot
) {
  const subject =
    snapshot.selectedSubject

  if (!subject) {
    return 'Disciplina'
  }

  return (
    subject.shortName.trim() ||
    subject.name
  )
}

export default function CriteriaWorkspaceView({
  snapshot,
  loading = false,
  error = '',
  onRefresh,
  onFiltersChange
}: CriteriaWorkspaceViewProps) {
  const [
    criteriaOverride,
    setCriteriaOverride
  ] = useState<
    UpdatedAssessmentCriteriaScheme |
    null
  >(null)

  useEffect(() => {
    setCriteriaOverride(null)
  }, [
    snapshot.generatedAt,
    snapshot.scheme?.id
  ])

  const effectiveSnapshot =
    criteriaOverride
      ? {
          ...snapshot,
          scheme:
            criteriaOverride.scheme,
          criteria:
            criteriaOverride.criteria
        }
      : snapshot

  function handleAssignmentChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    setCriteriaOverride(null)

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
    setCriteriaOverride(null)

    onFiltersChange({
      teachingAssignmentId:
        snapshot.selectedAssignment?.id ??
        null,
      moduleId:
        event.target.value ||
        null
    })
  }

  const subjectLabel =
    getSubjectLabel(
      effectiveSnapshot
    )

  const moduleLabel =
    effectiveSnapshot
      .moduleOptions
      .find(
        option =>
          option.module.id ===
          effectiveSnapshot
            .selectedModule
            ?.id
      )
      ?.label ??
    effectiveSnapshot
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
                Consulte e edite os critérios de avaliação separadamente das classificações. As ponderações continuam a alimentar os cálculos das avaliações sem misturar os dois fluxos.
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

        <div className="grid gap-5 px-5 py-6 sm:px-7 xl:grid-cols-2">
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
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-50"
        >
          {error}
        </div>
      ) : null}

      {!effectiveSnapshot
        .selectedAssignment ||
      !effectiveSnapshot
        .selectedModule ? (
        <section className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/60 p-8 text-center">
          <p className="text-lg font-black text-white">
            Ainda não existem critérios disponíveis.
          </p>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Confirme a turma, a disciplina e a componente curricular na configuração do ano letivo.
          </p>
        </section>
      ) : !effectiveSnapshot.scheme ||
        effectiveSnapshot.criteria
          .length === 0 ? (
        <section className="rounded-[2rem] border border-amber-300/20 bg-amber-300/[0.06] p-6">
          <p className="text-sm font-black text-amber-100">
            Não existem critérios ativos para esta seleção.
          </p>

          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            Pode criá-los ou corrigir a configuração pedagógica em “Corrigir configuração inicial”.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-xl shadow-black/20">
          <div className="px-5 pt-5 sm:px-7 sm:pt-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
              Conjunto selecionado
            </p>

            <h2 className="mt-3 text-xl font-black text-white">
              {subjectLabel}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {effectiveSnapshot
                .selectedGroup
                ?.name}{' '}
              · {moduleLabel}
            </p>
          </div>

          <AssessmentCriteriaManagementPanel
            snapshot={
              effectiveSnapshot
            }
            disabled={
              loading
            }
            onSaved={
              setCriteriaOverride
            }
          />
        </section>
      )}
    </div>
  )
}
