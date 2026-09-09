import { type FormEvent, useMemo, useRef, useState } from 'react'

import { assessmentCriteriaBatchRepository } from '../assessmentCriteriaBatchRepository'
import { assessmentCriteriaModuleRepository } from '../assessmentCriteriaModuleRepository'
import {
  maProfessorRepository,
  type AssessmentCriterionDraft,
  type SetupSnapshot
} from '../repository'
import type { AssessmentSchemeScope, EntityId } from '../types'
import { useMAProfessorUnsavedWorkspaceProtection } from '../navigation/useUnsavedWorkspaceProtection'

type AssessmentCriteriaSetupStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (snapshot: SetupSnapshot) => void
  onCompleted: (snapshot: SetupSnapshot) => void
}

type CriterionFormRow = {
  localId: string
  name: string
  description: string
  weightPercent: string
}

type CriteriaFormState = {
  teachingAssignmentIds: EntityId[]
  scope: AssessmentSchemeScope
  moduleTeachingAssignmentId: EntityId
  moduleId: EntityId
  schemeName: string
}

const emptyForm: CriteriaFormState = {
  teachingAssignmentIds: [],
  scope: 'subject',
  moduleTeachingAssignmentId: '',
  moduleId: '',
  schemeName: 'Critérios de avaliação'
}

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

const textareaClassName =
  'min-h-24 w-full resize-y rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

const discardCriteriaDraftMessage =
  'Existem alterações por guardar nestes critérios. Se continuar, essas alterações serão perdidas. Pretende continuar?'

function createLocalId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createCriterionRow(index: number): CriterionFormRow {
  return {
    localId: createLocalId(),
    name: '',
    description: '',
    weightPercent: index === 0 ? '100' : ''
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat('pt-PT', {
    maximumFractionDigits: 2
  }).format(value)
}

function FieldLabel({
  children,
  optional = false
}: {
  children: string
  optional?: boolean
}) {
  return (
    <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-200">
      <span>{children}</span>
      {optional ? (
        <span className="text-xs font-medium text-slate-500">
          Opcional
        </span>
      ) : null}
    </span>
  )
}

export default function AssessmentCriteriaSetupStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: AssessmentCriteriaSetupStepProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<CriteriaFormState>(emptyForm)
  const [criteria, setCriteria] = useState<CriterionFormRow[]>([
    createCriterionRow(0)
  ])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const assignments = useMemo(
    () =>
      snapshot.teachingAssignments
        .filter(assignment => assignment.active)
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName, 'pt-PT', {
            numeric: true,
            sensitivity: 'base'
          })
        ),
    [snapshot.teachingAssignments]
  )

  const moduleById = useMemo(
    () => new Map(snapshot.modules.map(module => [module.id, module])),
    [snapshot.modules]
  )

  const selectedModuleAssignment = useMemo(
    () =>
      assignments.find(
        assignment => assignment.id === form.moduleTeachingAssignmentId
      ) ?? null,
    [assignments, form.moduleTeachingAssignmentId]
  )

  const selectedAssignmentModules = useMemo(
    () =>
      snapshot.modules
        .filter(
          module =>
            module.active &&
            module.teachingAssignmentId === form.moduleTeachingAssignmentId
        )
        .sort((left, right) => left.order - right.order),
    [snapshot.modules, form.moduleTeachingAssignmentId]
  )

  const criteriaByScheme = useMemo(() => {
    const result = new Map<
      EntityId,
      typeof snapshot.assessmentCriteria
    >()

    snapshot.assessmentCriteria.forEach(criterion => {
      const schemeCriteria = result.get(criterion.schemeId) ?? []
      schemeCriteria.push(criterion)
      result.set(criterion.schemeId, schemeCriteria)
    })

    result.forEach(schemeCriteria => {
      schemeCriteria.sort((left, right) => left.order - right.order)
    })

    return result
  }, [snapshot.assessmentCriteria])

  const schemesByAssignment = useMemo(() => {
    const result = new Map<
      EntityId,
      typeof snapshot.assessmentSchemes
    >()

    assignments.forEach(assignment => {
      result.set(assignment.id, [])
    })

    snapshot.assessmentSchemes
      .filter(scheme => scheme.active)
      .forEach(scheme => {
        const schemes = result.get(scheme.teachingAssignmentId) ?? []
        schemes.push(scheme)
        result.set(scheme.teachingAssignmentId, schemes)
      })

    return result
  }, [assignments, snapshot.assessmentSchemes])

  const assignmentHasSubjectScheme = useMemo(() => {
    const result = new Set<EntityId>()

    assignments.forEach(assignment => {
      const schemes = schemesByAssignment.get(assignment.id) ?? []
      if (
        schemes.some(
          scheme => scheme.active && scheme.scope === 'subject'
        )
      ) {
        result.add(assignment.id)
      }
    })

    return result
  }, [assignments, schemesByAssignment])

  const uncoveredAssignments = useMemo(
    () =>
      assignments.filter(assignment => {
        const schemes = schemesByAssignment.get(assignment.id) ?? []
        const hasSubjectScheme = schemes.some(
          scheme => scheme.active && scheme.scope === 'subject'
        )

        if (hasSubjectScheme) return false

        const modules = snapshot.modules.filter(
          module =>
            module.active &&
            module.teachingAssignmentId === assignment.id
        )

        if (modules.length === 0) return true

        return modules.some(
          module =>
            !schemes.some(
              scheme =>
                scheme.active &&
                scheme.scope === 'module' &&
                scheme.moduleId === module.id
            )
        )
      }),
    [assignments, schemesByAssignment, snapshot.modules]
  )

  const weightTotal = useMemo(
    () =>
      criteria.reduce((total, criterion) => {
        const value = Number(criterion.weightPercent)
        return total + (Number.isFinite(value) ? value : 0)
      }, 0),
    [criteria]
  )

  const weightIsValid = Math.abs(weightTotal - 100) < 0.001

  const hasUnsavedCriteriaDraft =
    form.scope !== emptyForm.scope ||
    form.teachingAssignmentIds.length > 0 ||
    Boolean(form.moduleTeachingAssignmentId || form.moduleId) ||
    form.schemeName !== emptyForm.schemeName ||
    criteria.length !== 1 ||
    criteria.some((criterion, index) =>
      Boolean(
        criterion.name.trim() ||
          criterion.description.trim() ||
          criterion.weightPercent !== (index === 0 ? '100' : '')
      )
    )

  useMAProfessorUnsavedWorkspaceProtection(
    hasUnsavedCriteriaDraft,
    rootRef,
    discardCriteriaDraftMessage
  )

  async function refreshSnapshot() {
    const nextSnapshot = await maProfessorRepository.getSetupSnapshot(
      snapshot.academicYear.id
    )
    onSnapshotChange(nextSnapshot)
    return nextSnapshot
  }

  function resetCriteria() {
    setCriteria([createCriterionRow(0)])
  }

  function resetForm() {
    setForm(emptyForm)
    resetCriteria()
  }

  function confirmDiscardCriteriaDraft() {
    return (
      !hasUnsavedCriteriaDraft ||
      window.confirm(discardCriteriaDraftMessage)
    )
  }

  function requestResetForm() {
    if (busy || !confirmDiscardCriteriaDraft()) return
    resetForm()
    setError('')
    setSuccess('')
  }

  function setScope(scope: AssessmentSchemeScope) {
    if (busy || scope === form.scope) return

    setForm(current => ({
      ...current,
      scope,
      teachingAssignmentIds: [],
      moduleTeachingAssignmentId: '',
      moduleId: ''
    }))
    setError('')
    setSuccess('')
  }

  function toggleAssignment(teachingAssignmentId: EntityId) {
    if (
      busy ||
      assignmentHasSubjectScheme.has(teachingAssignmentId)
    ) {
      return
    }

    setForm(current => ({
      ...current,
      teachingAssignmentIds: current.teachingAssignmentIds.includes(
        teachingAssignmentId
      )
        ? current.teachingAssignmentIds.filter(
            currentId => currentId !== teachingAssignmentId
          )
        : [...current.teachingAssignmentIds, teachingAssignmentId]
    }))
    setError('')
    setSuccess('')
  }

  function updateCriterion(
    localId: string,
    changes: Partial<Omit<CriterionFormRow, 'localId'>>
  ) {
    setCriteria(current =>
      current.map(criterion =>
        criterion.localId === localId
          ? { ...criterion, ...changes }
          : criterion
      )
    )
  }

  function addCriterion() {
    setCriteria(current => [
      ...current,
      createCriterionRow(current.length)
    ])
    setError('')
    setSuccess('')
  }

  function removeCriterion(localId: string) {
    if (criteria.length === 1) {
      setError('Deve existir pelo menos um critério de avaliação.')
      return
    }

    setCriteria(current =>
      current.filter(criterion => criterion.localId !== localId)
    )
    setError('')
    setSuccess('')
  }

  function distributeEqually() {
    if (criteria.length === 0) return

    const baseValue =
      Math.floor((100 / criteria.length) * 100) / 100
    const assignedBeforeLast =
      baseValue * (criteria.length - 1)
    const lastValue = Number(
      (100 - assignedBeforeLast).toFixed(2)
    )

    setCriteria(current =>
      current.map((criterion, index) => ({
        ...criterion,
        weightPercent: String(
          index === current.length - 1
            ? lastValue
            : baseValue
        )
      }))
    )
    setError('')
    setSuccess('')
  }

  function validateCriteria(): AssessmentCriterionDraft[] {
    if (!form.schemeName.trim()) {
      throw new Error(
        'Indique um nome para o conjunto de critérios.'
      )
    }

    if (criteria.length === 0) {
      throw new Error(
        'Adicione pelo menos um critério de avaliação.'
      )
    }

    const names = new Set<string>()

    const criterionDrafts = criteria.map((criterion, index) => {
      const name = criterion.name.trim()

      if (!name) {
        throw new Error(
          `Indique o nome do critério ${index + 1}.`
        )
      }

      const normalizedName = name.toLocaleLowerCase('pt-PT')
      if (names.has(normalizedName)) {
        throw new Error(`O critério “${name}” está repetido.`)
      }
      names.add(normalizedName)

      const weightPercent = Number(criterion.weightPercent)
      if (
        !Number.isFinite(weightPercent) ||
        weightPercent <= 0
      ) {
        throw new Error(
          `A ponderação do critério “${name}” deve ser superior a 0%.`
        )
      }

      return {
        name,
        description: criterion.description,
        weightPercent,
        order: index + 1,
        active: true
      }
    })

    if (!weightIsValid) {
      throw new Error(
        `Os critérios devem totalizar 100%. O total atual é ${formatPercentage(
          weightTotal
        )}%.`
      )
    }

    return criterionDrafts
  }

  function validateModuleSelection() {
    if (!form.moduleTeachingAssignmentId) {
      throw new Error(
        'Selecione a turma e a disciplina da personalização.'
      )
    }

    if (!form.moduleId) {
      throw new Error(
        'Selecione a UFCD ou módulo a personalizar.'
      )
    }

    const existingSchemes =
      schemesByAssignment.get(form.moduleTeachingAssignmentId) ??
      []

    if (
      existingSchemes.some(
        scheme =>
          scheme.active &&
          scheme.scope === 'module' &&
          scheme.moduleId === form.moduleId
      )
    ) {
      throw new Error(
        'Esta UFCD ou módulo já possui critérios específicos.'
      )
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    if (busy) return

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const criterionDrafts = validateCriteria()
      const submittedScope = form.scope

      if (submittedScope === 'subject') {
        if (form.teachingAssignmentIds.length === 0) {
          throw new Error(
            'Selecione pelo menos uma turma e disciplina em “Aplicar a”.'
          )
        }

        await assessmentCriteriaBatchRepository.createSubjectSchemes({
          academicYearId: snapshot.academicYear.id,
          teachingAssignmentIds: form.teachingAssignmentIds,
          name: form.schemeName,
          criteria: criterionDrafts,
          active: true
        })
      } else {
        validateModuleSelection()

        await assessmentCriteriaModuleRepository.createModuleScheme(
          {
            academicYearId: snapshot.academicYear.id,
            teachingAssignmentId: form.moduleTeachingAssignmentId,
            moduleId: form.moduleId,
            name: form.schemeName,
            active: true
          },
          criterionDrafts
        )
      }

      await refreshSnapshot()
      resetForm()
      setSuccess(
        submittedScope === 'subject'
          ? 'Critérios aplicados com sucesso às disciplinas selecionadas.'
          : 'Personalização da UFCD guardada com sucesso.'
      )
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setBusy(false)
    }
  }

  async function handleContinue() {
    if (busy) return

    if (hasUnsavedCriteriaDraft) {
      setError(
        'Existem alterações por guardar neste passo. Guarde os critérios ou limpe o rascunho antes de continuar.'
      )
      return
    }

    if (snapshot.assessmentSchemes.length === 0) {
      setError(
        'Adicione os critérios de avaliação antes de continuar.'
      )
      return
    }

    if (uncoveredAssignments.length > 0) {
      setError(
        `Ainda faltam critérios para: ${uncoveredAssignments
          .map(assignment => assignment.displayName)
          .join(', ')}.`
      )
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await maProfessorRepository.completeSetupStep(
        snapshot.academicYear.id,
        'assessment_criteria'
      )

      const nextSnapshot =
        await maProfessorRepository.getSetupSnapshot(
          snapshot.academicYear.id
        )

      onSnapshotChange(nextSnapshot)
      onCompleted(nextSnapshot)
    } catch (continueError) {
      setError(getErrorMessage(continueError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]"
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          Passo 6 de 9
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Critérios de avaliação
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Defina primeiro o conjunto de critérios e as respetivas
          ponderações. Depois escolha as disciplinas onde o pretende
          aplicar.
        </p>

        <div className="mt-7 space-y-5">
          <label className="block">
            <FieldLabel>Nome do conjunto</FieldLabel>
            <input
              type="text"
              value={form.schemeName}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  schemeName: event.target.value
                }))
              }
              placeholder="Critérios de avaliação"
              required
              className={inputClassName}
            />
          </label>
        </div>

        <div className="mt-8 border-t border-white/10 pt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Ponderações
              </p>
              <h3 className="mt-2 text-xl font-black text-white">
                Critérios
              </h3>
            </div>

            <div
              className={`rounded-full border px-4 py-2 text-sm font-black ${
                weightIsValid
                  ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                  : 'border-amber-300/25 bg-amber-300/10 text-amber-100'
              }`}
            >
              Total: {formatPercentage(weightTotal)}%
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {criteria.map((criterion, index) => (
              <article
                key={criterion.localId}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
                    {index + 1}
                  </div>

                  <button
                    type="button"
                    disabled={criteria.length === 1}
                    onClick={() =>
                      removeCriterion(criterion.localId)
                    }
                    className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Remover
                  </button>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_9rem]">
                  <label className="block">
                    <FieldLabel>Nome do critério</FieldLabel>
                    <input
                      type="text"
                      value={criterion.name}
                      onChange={event =>
                        updateCriterion(criterion.localId, {
                          name: event.target.value
                        })
                      }
                      placeholder="Trabalhos práticos"
                      required
                      className={inputClassName}
                    />
                  </label>

                  <label className="block">
                    <FieldLabel>Peso</FieldLabel>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        inputMode="decimal"
                        value={criterion.weightPercent}
                        onChange={event =>
                          updateCriterion(criterion.localId, {
                            weightPercent: event.target.value
                          })
                        }
                        required
                        className={`${inputClassName} pr-10`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-bold text-slate-500">
                        %
                      </span>
                    </div>
                  </label>
                </div>

                <label className="mt-4 block">
                  <FieldLabel optional>Descrição</FieldLabel>
                  <textarea
                    value={criterion.description}
                    onChange={event =>
                      updateCriterion(criterion.localId, {
                        description: event.target.value
                      })
                    }
                    placeholder="Qualidade da execução, cumprimento das orientações e adequação do resultado."
                    className={textareaClassName}
                  />
                </label>
              </article>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={addCriterion}
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100"
            >
              Adicionar critério
            </button>
            <button
              type="button"
              onClick={distributeEqually}
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100"
            >
              Distribuir 100% igualmente
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                Aplicar a
              </p>
              <h3 className="mt-2 text-xl font-black text-white">
                {form.scope === 'subject'
                  ? 'Disciplinas'
                  : 'Personalização de UFCD'}
              </h3>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setScope(
                  form.scope === 'subject' ? 'module' : 'subject'
                )
              }
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.06] disabled:opacity-50"
            >
              {form.scope === 'subject'
                ? 'Personalizar uma UFCD'
                : 'Voltar à aplicação por disciplina'}
            </button>
          </div>

          {form.scope === 'subject' ? (
            <div className="mt-5">
              <p className="text-sm leading-6 text-slate-300">
                Este conjunto será aplicado a todas as UFCD das
                disciplinas selecionadas.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {assignments.map(assignment => {
                  const alreadyConfigured =
                    assignmentHasSubjectScheme.has(assignment.id)
                  const selected =
                    form.teachingAssignmentIds.includes(
                      assignment.id
                    )

                  return (
                    <label
                      key={assignment.id}
                      className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                        alreadyConfigured
                          ? 'cursor-not-allowed border-white/10 bg-white/[0.02] opacity-60'
                          : selected
                            ? 'cursor-pointer border-cyan-300/35 bg-cyan-300/[0.08]'
                            : 'cursor-pointer border-white/10 bg-white/[0.03] hover:border-cyan-300/25'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={alreadyConfigured || busy}
                        onChange={() =>
                          toggleAssignment(assignment.id)
                        }
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30"
                      />
                      <span>
                        <span className="block font-black text-white">
                          {assignment.displayName}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {alreadyConfigured
                            ? 'Já possui critérios gerais.'
                            : 'Aplicar o conjunto geral a todas as UFCD desta disciplina.'}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-300/[0.055] p-4">
              <p className="text-sm font-bold text-violet-100">
                Personalização avançada
              </p>
              <p className="mt-2 text-xs leading-6 text-violet-100/70">
                Estes critérios substituem os critérios gerais apenas
                na UFCD selecionada.
              </p>
              <p className="mt-2 text-xs leading-6 text-amber-100/80">
                Se esta UFCD já tiver avaliações ou classificações
                registadas, a personalização será bloqueada para
                preservar o histórico.
              </p>

              <div className="mt-4 grid gap-4">
                <label className="block">
                  <FieldLabel>Turma e disciplina</FieldLabel>
                  <select
                    value={form.moduleTeachingAssignmentId}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        moduleTeachingAssignmentId:
                          event.target.value,
                        moduleId: ''
                      }))
                    }
                    required
                    className={inputClassName}
                  >
                    <option value="">
                      Selecione uma turma e disciplina
                    </option>
                    {assignments.map(assignment => (
                      <option
                        key={assignment.id}
                        value={assignment.id}
                      >
                        {assignment.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <FieldLabel>UFCD ou módulo</FieldLabel>
                  <select
                    value={form.moduleId}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        moduleId: event.target.value
                      }))
                    }
                    required
                    disabled={!form.moduleTeachingAssignmentId}
                    className={inputClassName}
                  >
                    <option value="">
                      Selecione a UFCD ou módulo
                    </option>
                    {selectedAssignmentModules.map(module => (
                      <option key={module.id} value={module.id}>
                        {module.code ? `${module.code} — ` : ''}
                        {module.name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedModuleAssignment ? (
                  <p className="text-xs leading-6 text-slate-400">
                    Associação selecionada:{' '}
                    <span className="font-bold text-slate-200">
                      {selectedModuleAssignment.displayName}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm leading-6 text-emerald-100"
          >
            {success}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={busy || !weightIsValid}
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy
              ? 'A guardar...'
              : form.scope === 'subject'
                ? 'Aplicar critérios'
                : 'Guardar personalização'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={requestResetForm}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3.5 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
          >
            Limpar
          </button>
        </div>
      </form>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Ano letivo
            </p>
            <h3 className="mt-2 text-xl font-black text-white">
              Critérios configurados
            </h3>
          </div>

          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
            {snapshot.assessmentSchemes.length}
          </span>
        </div>

        <div className="mt-5 space-y-5">
          {assignments.map(assignment => {
            const schemes =
              schemesByAssignment.get(assignment.id) ?? []
            const uncovered = uncoveredAssignments.some(
              current => current.id === assignment.id
            )

            return (
              <article
                key={assignment.id}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white">
                      {assignment.displayName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {schemes.length}{' '}
                      {schemes.length === 1
                        ? 'conjunto de critérios'
                        : 'conjuntos de critérios'}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      uncovered
                        ? 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100'
                        : 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100'
                    }`}
                  >
                    {uncovered ? 'Incompleto' : 'Configurado'}
                  </span>
                </div>

                {schemes.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-3 text-xs text-slate-500">
                    Ainda sem critérios configurados.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {schemes.map(scheme => {
                      const schemeCriteria =
                        criteriaByScheme.get(scheme.id) ?? []
                      const module = scheme.moduleId
                        ? moduleById.get(scheme.moduleId)
                        : null

                      return (
                        <div
                          key={scheme.id}
                          className="rounded-xl border border-white/10 bg-slate-950/55 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-white">
                                {scheme.name}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {scheme.scope === 'subject'
                                  ? 'Aplicado a todas as UFCD desta disciplina'
                                  : module
                                    ? `${module.code ? `${module.code} — ` : ''}${module.name}`
                                    : 'UFCD específica'}
                              </p>
                            </div>

                            <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1.5 text-[0.65rem] font-bold text-violet-100">
                              {scheme.scope === 'subject'
                                ? 'Geral'
                                : 'UFCD'}
                            </span>
                          </div>

                          <div className="mt-4 space-y-2">
                            {schemeCriteria.map(criterion => (
                              <div
                                key={criterion.id}
                                className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3"
                              >
                                <div>
                                  <p className="text-sm font-bold text-slate-200">
                                    {criterion.name}
                                  </p>
                                  {criterion.description ? (
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                      {criterion.description}
                                    </p>
                                  ) : null}
                                </div>

                                <span className="shrink-0 text-sm font-black text-cyan-100">
                                  {formatPercentage(
                                    criterion.weightPercent
                                  )}
                                  %
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[0.055] p-4">
          <p className="text-sm font-bold text-violet-100">
            Todas as ponderações devem totalizar 100%.
          </p>
          <p className="mt-2 text-xs leading-6 text-violet-100/65">
            A personalização de uma UFCD substitui o conjunto geral
            apenas nessa UFCD.
          </p>
        </div>

        <button
          type="button"
          disabled={
            busy ||
            snapshot.assessmentSchemes.length === 0 ||
            uncoveredAssignments.length > 0
          }
          onClick={() => void handleContinue()}
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200/45 bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-200 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/30 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
        >
          Guardar critérios e continuar
        </button>
      </section>
    </div>
  )
}