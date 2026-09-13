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
  assessmentCriteriaManagementRepository,
  type AssessmentCriteriaEditability,
  type AssessmentCriteriaEvidence,
  type UpdatedAssessmentCriteriaScheme
} from './assessmentCriteriaManagementRepository'

type Props = {
  snapshot: AssessmentWorkspaceSnapshot
  disabled?: boolean
  onSaved?: (
    result: UpdatedAssessmentCriteriaScheme
  ) => void
}

type CriterionDraft = {
  localId: string
  id?: EntityId
  name: string
  description: string
  weightPercent: string
}

const field =
  'w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50'

function createLocalId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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
      String(criterion.weightPercent)
  }
}

function formatPercent(value: number) {
  return new Intl.NumberFormat(
    'pt-PT',
    { maximumFractionDigits: 2 }
  ).format(value)
}

function evidenceFromError(
  error: unknown
): AssessmentCriteriaEvidence | null {
  if (
    !error ||
    typeof error !== 'object' ||
    !('evidence' in error)
  ) {
    return null
  }

  const candidate =
    error.evidence as Partial<AssessmentCriteriaEvidence> | null

  if (
    !candidate ||
    typeof candidate.lessonAssessmentCount !== 'number' ||
    typeof candidate.assessmentResultCount !== 'number' ||
    typeof candidate.finalGradeCount !== 'number'
  ) {
    return null
  }

  return {
    lessonAssessmentCount:
      candidate.lessonAssessmentCount,
    assessmentResultCount:
      candidate.assessmentResultCount,
    finalGradeCount:
      candidate.finalGradeCount
  }
}

export default function RegularAssessmentCriteriaManagementPanel({
  snapshot,
  disabled = false,
  onSaved
}: Props) {
  const rootRef =
    useRef<HTMLDivElement>(null)

  const scheme = snapshot.scheme
  const schemeId = scheme?.id ?? ''
  const persistedName = scheme?.name ?? ''

  const [
    editability,
    setEditability
  ] = useState<AssessmentCriteriaEditability | null>(null)
  const [checking, setChecking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [schemeName, setSchemeName] = useState(persistedName)
  const [criteria, setCriteria] = useState<CriterionDraft[]>(
    () => snapshot.criteria.map(toDraft)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setSchemeName(persistedName)
    setCriteria(snapshot.criteria.map(toDraft))
    setEditing(false)
    setError('')
    setSuccess('')
  }, [
    persistedName,
    schemeId,
    snapshot.generatedAt
  ])

  useEffect(() => {
    let cancelled = false

    if (!schemeId) {
      setEditability(null)
      setChecking(false)
      return () => {
        cancelled = true
      }
    }

    setChecking(true)
    setError('')

    void assessmentCriteriaManagementRepository
      .getEditability(schemeId)
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
              : 'Não foi possível verificar se estes critérios podem ser alterados.'
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
    schemeId,
    snapshot.generatedAt
  ])

  const weightTotal = useMemo(
    () =>
      criteria.reduce(
        (total, criterion) => {
          const value =
            Number(criterion.weightPercent)
          return total +
            (Number.isFinite(value) ? value : 0)
        },
        0
      ),
    [criteria]
  )

  const dirty =
    editing &&
    (
      schemeName !== persistedName ||
      criteria.length !== snapshot.criteria.length ||
      criteria.some((criterion, index) => {
        const original = snapshot.criteria[index]
        return (
          !original ||
          criterion.id !== original.id ||
          criterion.name !== original.name ||
          criterion.description !== original.description ||
          criterion.weightPercent !== String(original.weightPercent)
        )
      })
    )

  useMAProfessorUnsavedWorkspaceProtection(
    dirty,
    rootRef,
    'Existem alterações por guardar nos critérios de avaliação. Se continuar, essas alterações serão perdidas. Pretende continuar?'
  )

  if (!scheme) {
    return null
  }

  const locked =
    editability?.editable === false

  function updateCriterion(
    localId: string,
    changes: Partial<CriterionDraft>
  ) {
    setCriteria(current =>
      current.map(criterion =>
        criterion.localId === localId
          ? { ...criterion, ...changes }
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

  function removeCriterion(localId: string) {
    if (criteria.length <= 1) {
      setError(
        'Deve existir pelo menos um critério de avaliação.'
      )
      return
    }

    setCriteria(current =>
      current.filter(
        criterion => criterion.localId !== localId
      )
    )
    setError('')
    setSuccess('')
  }

  function distributeEqually() {
    if (!criteria.length) return

    const base =
      Math.floor((100 / criteria.length) * 100) / 100
    const last =
      Number(
        (
          100 -
          base * (criteria.length - 1)
        ).toFixed(2)
      )

    setCriteria(current =>
      current.map((criterion, index) => ({
        ...criterion,
        weightPercent:
          String(
            index === current.length - 1
              ? last
              : base
          )
      }))
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

    setSchemeName(persistedName)
    setCriteria(snapshot.criteria.map(toDraft))
    setEditing(false)
    setError('')
    setSuccess('')
  }

  async function save() {
    if (
      !schemeId ||
      saving ||
      disabled ||
      locked
    ) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const result =
        await assessmentCriteriaManagementRepository
          .updateScheme({
            schemeId,
            name: schemeName,
            criteria:
              criteria.map(criterion => ({
                id: criterion.id,
                name: criterion.name,
                description: criterion.description,
                weightPercent:
                  Number(criterion.weightPercent)
              }))
          })

      setSchemeName(result.scheme.name)
      setCriteria(result.criteria.map(toDraft))
      setEditability({
        editable: true,
        evidence: {
          lessonAssessmentCount: 0,
          assessmentResultCount: 0,
          finalGradeCount: 0
        }
      })
      setEditing(false)
      setSuccess(
        'Critérios atualizados com sucesso.'
      )
      onSaved?.(result)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível guardar os critérios.'
      )

      if (
        saveError &&
        typeof saveError === 'object' &&
        'code' in saveError &&
        saveError.code ===
          'ASSESSMENT_CRITERIA_HISTORY_EXISTS'
      ) {
        setEditability(current => ({
          editable: false,
          evidence:
            evidenceFromError(saveError) ??
            current?.evidence ?? {
              lessonAssessmentCount: 0,
              assessmentResultCount: 0,
              finalGradeCount: 0
            }
        }))
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      ref={rootRef}
      className="rounded-[2rem] border border-emerald-300/15 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
              Gestão dos critérios
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.62rem] font-bold text-slate-400">
              {scheme.scope === 'module'
                ? 'Específicos desta componente anual'
                : 'Gerais da disciplina'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Consulte e ajuste os critérios aplicados a esta disciplina. As ponderações devem totalizar 100%.
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
              disabled || checking || locked
            }
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-2.5 text-xs font-black text-emerald-100 transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
          >
            {checking
              ? 'A verificar...'
              : locked
                ? 'Histórico protegido'
                : 'Editar critérios'}
          </button>
        ) : null}
      </div>

      {disabled ? (
        <p className="mt-3 text-xs font-semibold text-amber-200/80">
          Aguarde a conclusão da operação atual antes de editar os critérios.
        </p>
      ) : null}

      {locked && editability ? (
        <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/85">
          Este conjunto já tem histórico associado e está bloqueado para edição: {editability.evidence.lessonAssessmentCount} atividade(s), {editability.evidence.assessmentResultCount} resultado(s) e {editability.evidence.finalGradeCount} avaliação(ões) final(is). Pode continuar a consultá-lo normalmente.
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

      {success ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-3 text-xs leading-5 text-emerald-100"
        >
          {success}
        </div>
      ) : null}

      {editing ? (
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-300">
              Nome do conjunto
            </span>
            <input
              type="text"
              value={schemeName}
              onChange={event =>
                setSchemeName(event.target.value)
              }
              disabled={saving}
              className={field}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold text-slate-400">
              Ponderações
            </p>
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                Math.abs(weightTotal - 100) < 0.001
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
                        { name: event.target.value }
                      )
                    }
                    disabled={saving}
                    className={field}
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
                    value={criterion.weightPercent}
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
                    className={field}
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
                    saving || criteria.length <= 1
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
                  className={`${field} min-h-20 resize-y`}
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
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-300 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={
                saving ||
                disabled ||
                Math.abs(weightTotal - 100) >= 0.001
              }
              className="rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? 'A guardar...'
                : 'Guardar critérios'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
