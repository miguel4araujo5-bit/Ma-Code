import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'

import type {
  AssessmentCriterion,
  EntityId
} from '../types'

import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

import {
  AssessmentCriteriaDeletionBlockedError,
  assessmentCriteriaManagementRepository,
  type AssessmentCriteriaEditability,
  type UpdatedAssessmentCriteriaScheme
} from './assessmentCriteriaManagementRepository'

interface CriterionDraft {
  localId: string
  id?: EntityId
  name: string
  description: string
  weightPercent: string
}

interface AssessmentCriteriaManagementPanelProps {
  snapshot: AssessmentWorkspaceSnapshot
  disabled?: boolean
  subjectScope?: {
    academicYearId: EntityId
    subjectId: EntityId
  } | null
  onOpenDataReset?: () => void
  onSaved?: (
    result: UpdatedAssessmentCriteriaScheme
  ) => void
}

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50'

function createLocalId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`
}

function toDraft(
  criterion: AssessmentCriterion
): CriterionDraft {
  return {
    localId: createLocalId(),
    id: criterion.id,
    name: criterion.name,
    description: criterion.description,
    weightPercent:
      String(
        criterion.weightPercent
      )
  }
}

function formatPercent(
  value: number
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      maximumFractionDigits: 2
    }
  ).format(value)
}

function hasHistory(
  editability: AssessmentCriteriaEditability | null
) {
  if (!editability) {
    return false
  }

  return (
    editability.evidence.lessonAssessmentCount > 0 ||
    editability.evidence.assessmentResultCount > 0 ||
    editability.evidence.finalGradeCount > 0
  )
}

export default function AssessmentCriteriaManagementPanel({
  snapshot,
  disabled = false,
  subjectScope = null,
  onOpenDataReset,
  onSaved
}: AssessmentCriteriaManagementPanelProps) {
  const rootRef =
    useRef<HTMLDivElement>(null)

  const scheme =
    snapshot.scheme

  const persistedSchemeId =
    scheme?.id ?? ''

  const persistedSchemeName =
    scheme?.name ?? ''

  const [
    editability,
    setEditability
  ] = useState<AssessmentCriteriaEditability | null>(null)

  const [
    checking,
    setChecking
  ] = useState(false)

  const [
    editing,
    setEditing
  ] = useState(false)

  const [
    schemeName,
    setSchemeName
  ] = useState(
    persistedSchemeName
  )

  const [
    criteria,
    setCriteria
  ] = useState<CriterionDraft[]>(
    () =>
      snapshot.criteria.map(toDraft)
  )

  const [
    saving,
    setSaving
  ] = useState(false)

  const [
    error,
    setError
  ] = useState('')

  const [
    success,
    setSuccess
  ] = useState('')

  const [
    destructiveBlocked,
    setDestructiveBlocked
  ] = useState(false)

  useEffect(() => {
    setSchemeName(
      persistedSchemeName
    )
    setCriteria(
      snapshot.criteria.map(toDraft)
    )
    setEditing(false)
    setError('')
    setSuccess('')
    setDestructiveBlocked(false)
  }, [
    persistedSchemeId,
    persistedSchemeName,
    snapshot.generatedAt
  ])

  useEffect(() => {
    let cancelled = false

    if (!persistedSchemeId) {
      setEditability(null)
      setChecking(false)

      return () => {
        cancelled = true
      }
    }

    setChecking(true)
    setError('')

    const editabilityRequest =
      scheme?.scope ===
        'subject' &&
      subjectScope
        ? assessmentCriteriaManagementRepository
            .getSubjectEditability(
              subjectScope.academicYearId,
              subjectScope.subjectId
            )
        : assessmentCriteriaManagementRepository
            .getEditability(
              persistedSchemeId
            )

    void editabilityRequest
      .then(result => {
        if (!cancelled) {
          setEditability(result)
        }
      })
      .catch(loadError => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível verificar o histórico destes critérios.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setChecking(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    persistedSchemeId,
    scheme?.scope,
    snapshot.generatedAt,
    subjectScope?.academicYearId,
    subjectScope?.subjectId
  ])

  const weightTotal =
    useMemo(
      () =>
        criteria.reduce(
          (total, criterion) => {
            const value =
              Number(
                criterion.weightPercent
              )

            return total +
              (
                Number.isFinite(value)
                  ? value
                  : 0
              )
          },
          0
        ),
      [criteria]
    )

  const dirty =
    editing &&
    (
      schemeName !==
        persistedSchemeName ||
      criteria.length !==
        snapshot.criteria.length ||
      criteria.some(
        (criterion, index) => {
          const original =
            snapshot.criteria[index]

          return (
            !original ||
            criterion.id !== original.id ||
            criterion.name !== original.name ||
            criterion.description !== original.description ||
            criterion.weightPercent !==
              String(
                original.weightPercent
              )
          )
        }
      )
    )

  const calculationImpactingChange =
    useMemo(
      () => {
        if (!editing) {
          return false
        }

        const originalById =
          new Map(
            snapshot.criteria.map(
              criterion => [
                criterion.id,
                criterion
              ]
            )
          )

        const currentIds =
          new Set(
            criteria.flatMap(
              criterion =>
                criterion.id
                  ? [criterion.id]
                  : []
            )
          )

        const addedOrReweighted =
          criteria.some(criterion => {
            if (!criterion.id) {
              return true
            }

            const original =
              originalById.get(
                criterion.id
              )

            return (
              !original ||
              Number(
                criterion.weightPercent
              ) !== original.weightPercent
            )
          })

        const removed =
          snapshot.criteria.some(
            criterion =>
              !currentIds.has(
                criterion.id
              )
          )

        return (
          addedOrReweighted ||
          removed
        )
      },
      [
        criteria,
        editing,
        snapshot.criteria
      ]
    )

  const historyPresent =
    hasHistory(
      editability
    )

  useMAProfessorUnsavedWorkspaceProtection(
    dirty,
    rootRef,
    'Existem alterações por guardar nos critérios de avaliação. Se continuar, essas alterações serão perdidas. Pretende continuar?'
  )

  if (!scheme) {
    return null
  }

  function updateCriterion(
    localId: string,
    changes: Partial<CriterionDraft>
  ) {
    setCriteria(current =>
      current.map(criterion =>
        criterion.localId === localId
          ? {
              ...criterion,
              ...changes
            }
          : criterion
      )
    )
    setError('')
    setSuccess('')
  }

  function addCriterion() {
    setCriteria(current => [
      ...current,
      {
        localId: createLocalId(),
        name: '',
        description: '',
        weightPercent: ''
      }
    ])
    setError('')
    setSuccess('')
  }

  function removeCriterion(
    localId: string
  ) {
    if (criteria.length <= 1) {
      setError(
        'Deve existir pelo menos um critério de avaliação.'
      )
      return
    }

    setCriteria(current =>
      current.filter(
        criterion =>
          criterion.localId !== localId
      )
    )
    setError('')
    setSuccess('')
  }

  function distributeEqually() {
    if (criteria.length === 0) {
      return
    }

    const base =
      Math.floor(
        (
          100 /
          criteria.length
        ) * 100
      ) / 100

    const last =
      Number(
        (
          100 -
          base *
            (criteria.length - 1)
        ).toFixed(2)
      )

    setCriteria(current =>
      current.map(
        (criterion, index) => ({
          ...criterion,
          weightPercent:
            String(
              index ===
                current.length - 1
                ? last
                : base
            )
        })
      )
    )
    setError('')
    setSuccess('')
  }

  function cancelEditing() {
    if (
      dirty &&
      !window.confirm(
        'Descartar as alterações feitas aos critérios?'
      )
    ) {
      return
    }

    setSchemeName(
      persistedSchemeName
    )
    setCriteria(
      snapshot.criteria.map(toDraft)
    )
    setEditing(false)
    setError('')
    setSuccess('')
  }

  async function saveCriteria() {
    const activeScheme =
      scheme

    if (
      !activeScheme ||
      !persistedSchemeId ||
      saving ||
      disabled
    ) {
      return
    }

    if (
      historyPresent &&
      calculationImpactingChange &&
      !window.confirm(
        'Este conjunto já tem avaliações ou classificações associadas. Alterar ponderações, adicionar critérios ou remover critérios pode recalcular as médias provisórias e as classificações sugeridas. As classificações finais já confirmadas pelo professor não serão alteradas automaticamente. Pretende guardar estas alterações?'
      )
    ) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    setDestructiveBlocked(false)

    try {
      const criteriaInput =
        criteria.map(criterion => ({
          id: criterion.id,
          name: criterion.name,
          description:
            criterion.description,
          weightPercent:
            Number(
              criterion.weightPercent
            )
        }))

      const result =
        activeScheme.scope ===
          'subject' &&
        subjectScope
          ? await assessmentCriteriaManagementRepository
              .updateSubjectSchemes({
                academicYearId:
                  subjectScope.academicYearId,
                subjectId:
                  subjectScope.subjectId,
                referenceSchemeId:
                  persistedSchemeId,
                name:
                  schemeName,
                criteria:
                  criteriaInput
              })
          : await assessmentCriteriaManagementRepository
              .updateScheme({
                schemeId:
                  persistedSchemeId,
                name:
                  schemeName,
                criteria:
                  criteriaInput
              })

      setSchemeName(
        result.scheme.name
      )
      setCriteria(
        result.criteria.map(toDraft)
      )
      setEditability(current => ({
        editable: true,
        evidence:
          current?.evidence ?? {
            lessonAssessmentCount: 0,
            assessmentResultCount: 0,
            finalGradeCount: 0,
            confirmedFinalGradeCount: 0
          }
      }))
      setEditing(false)
      setSuccess(
        activeScheme.scope ===
          'subject' &&
        subjectScope
          ? 'Critérios atualizados em todas as turmas desta disciplina que usam critérios gerais.'
          : 'Critérios atualizados com sucesso.'
      )
      onSaved?.(result)
    } catch (saveError) {
      const deletionBlocked =
        saveError instanceof
          AssessmentCriteriaDeletionBlockedError

      setDestructiveBlocked(
        deletionBlocked
      )
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível guardar os critérios.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      id="ma-professor-criteria-management"
      ref={rootRef}
      className="scroll-mt-24 border-t border-white/10 px-5 py-5 sm:px-7"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
              Gestão dos critérios
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.62rem] font-bold text-slate-400">
              {scheme.scope === 'module'
                ? 'Específicos desta UFCD'
                : 'Gerais da disciplina'}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Consulte e ajuste o conjunto de critérios selecionado. As ponderações devem totalizar 100%.
          </p>
        </div>

        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setEditing(true)
              setError('')
              setSuccess('')
            }}
            disabled={
              disabled ||
              checking
            }
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
          >
            {checking
              ? 'A verificar...'
              : 'Editar critérios'}
          </button>
        ) : null}
      </div>

      {disabled ? (
        <p className="mt-3 text-xs font-semibold text-amber-200/80">
          Guarde primeiro as alterações das classificações antes de editar os critérios.
        </p>
      ) : null}

      {historyPresent && editability ? (
        <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/90">
          Este conjunto já tem histórico associado: {editability.evidence.lessonAssessmentCount} atividade(s), {editability.evidence.assessmentResultCount} resultado(s) e {editability.evidence.finalGradeCount} registo(s) de nota final, dos quais {editability.evidence.confirmedFinalGradeCount} confirmado(s). Pode continuar a editar. Alterar apenas o nome ou a descrição não muda os cálculos. Alterar ponderações ou adicionar/remover critérios pode recalcular médias provisórias e sugestões; as notas finais já confirmadas não são alteradas automaticamente.
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-xs leading-5 text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {destructiveBlocked ? (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/90">
          <p>
            Este critério já tem avaliações associadas e não pode ser apagado sem quebrar o histórico. Pode alterar o nome, a descrição ou a ponderação.
          </p>

          {onOpenDataReset ? (
            <p className="mt-2">
              Se pretende eliminar toda a configuração e começar novamente, pode{' '}
              <button
                type="button"
                onClick={onOpenDataReset}
                className="font-black text-amber-200 underline decoration-amber-300/70 underline-offset-2 transition hover:text-amber-100"
              >
                apagar tudo e começar de novo
              </button>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-3 text-xs leading-5 text-emerald-100"
        >
          {success}
        </div>
      ) : null}

      {!editing ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {snapshot.criteria.map(criterion => (
            <article
              key={criterion.id}
              className="rounded-xl border border-white/10 bg-white/[0.025] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-black text-white">
                  {criterion.name}
                </p>

                <span className="shrink-0 text-xs font-black text-amber-200">
                  {formatPercent(
                    criterion.weightPercent
                  )}%
                </span>
              </div>

              {criterion.description ? (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {criterion.description}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-300">
              Nome do conjunto
            </span>

            <input
              type="text"
              value={schemeName}
              onChange={event =>
                setSchemeName(
                  event.target.value
                )
              }
              disabled={saving}
              className={inputClassName}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold text-slate-400">
              Ponderações
            </p>

            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                Math.abs(
                  weightTotal - 100
                ) < 0.001
                  ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                  : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
              }`}
            >
              Total: {formatPercent(weightTotal)}%
            </span>
          </div>

          {criteria.map((criterion, index) => (
            <article
              key={criterion.localId}
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
            >
              <div className="grid gap-3 lg:grid-cols-[1fr_9rem_auto] lg:items-end">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300">
                    Critério {index + 1}
                  </span>

                  <input
                    type="text"
                    value={criterion.name}
                    onChange={event =>
                      updateCriterion(
                        criterion.localId,
                        {
                          name:
                            event.target.value
                        }
                      )
                    }
                    disabled={saving}
                    className={inputClassName}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300">
                    Peso (%)
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={
                      criterion.weightPercent
                    }
                    onChange={event =>
                      updateCriterion(
                        criterion.localId,
                        {
                          weightPercent:
                            event.target.value
                        }
                      )
                    }
                    disabled={saving}
                    className={inputClassName}
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    removeCriterion(
                      criterion.localId
                    )
                  }
                  disabled={
                    saving ||
                    criteria.length <= 1
                  }
                  className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2.5 text-xs font-bold text-rose-200 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Remover
                </button>
              </div>

              <label className="mt-3 block">
                <span className="mb-2 block text-xs font-bold text-slate-400">
                  Descrição opcional
                </span>

                <textarea
                  value={criterion.description}
                  onChange={event =>
                    updateCriterion(
                      criterion.localId,
                      {
                        description:
                          event.target.value
                      }
                    )
                  }
                  disabled={saving}
                  className={`${inputClassName} min-h-20 resize-y`}
                />
              </label>
            </article>
          ))}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={addCriterion}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              Adicionar critério
            </button>

            <button
              type="button"
              onClick={distributeEqually}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              Distribuir 100% igualmente
            </button>

            <div className="flex-1" />

            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() =>
                void saveCriteria()
              }
              disabled={
                saving ||
                !dirty ||
                Math.abs(
                  weightTotal - 100
                ) >= 0.001
              }
              className="rounded-xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-2.5 text-xs font-black text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
            >
              {saving
                ? 'A guardar...'
                : 'Guardar critérios'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
