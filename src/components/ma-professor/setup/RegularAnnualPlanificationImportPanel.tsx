import {
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  SetupSnapshot
} from '../repository'
import type {
  ModuleUnit
} from '../types'
import {
  resolvePlanificationDestination
} from './planificationDestination'
import {
  readModuleDocument,
  type ModuleDocument
} from './planificationModuleDocument'
import {
  commitRegularAnnualPlanificationImport,
  readRegularAnnualPlanificationImportState
} from './regularAnnualPlanificationImportRepository'

type Props = {
  snapshot: SetupSnapshot
  disabled: boolean
  onActiveChange: (active: boolean) => void
  onImported: () => Promise<unknown>
  guided?: boolean
}

const field =
  'w-full rounded-xl border border-white/15 bg-slate-900 p-3 text-sm text-white'
const button =
  'rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40'

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function annualModule(
  snapshot: SetupSnapshot,
  assignmentId: string
): ModuleUnit | null {
  const assignment =
    snapshot.teachingAssignments.find(item =>
      item.active &&
      item.id === assignmentId
    )

  const group = assignment
    ? snapshot.groups.find(item =>
        item.active &&
        item.id === assignment.groupId
      )
    : null

  if (
    !assignment ||
    group?.educationType !== 'regular'
  ) {
    return null
  }

  const modules =
    snapshot.modules.filter(module =>
      module.active &&
      module.teachingAssignmentId === assignment.id &&
      module.regularAnnual === true
    )

  return modules.length === 1
    ? modules[0]
    : null
}

export default function RegularAnnualPlanificationImportPanel({
  snapshot,
  disabled,
  onActiveChange,
  onImported,
  guided = false
}: Props) {
  const [document, setDocument] =
    useState<ModuleDocument | null>(null)
  const [assignmentId, setAssignmentId] =
    useState('')
  const [fingerprint, setFingerprint] =
    useState('')
  const [reviewed, setReviewed] =
    useState(false)
  const [showDetails, setShowDetails] =
    useState(false)
  const [busy, setBusy] =
    useState(false)
  const [message, setMessage] =
    useState('')
  const [error, setError] =
    useState('')

  const destinations = useMemo(
    () =>
      snapshot.teachingAssignments
        .filter(assignment =>
          assignment.active &&
          Boolean(
            annualModule(
              snapshot,
              assignment.id
            )
          )
        )
        .map(assignment => {
          const group =
            snapshot.groups.find(item =>
              item.id === assignment.groupId
            )
          const subject =
            snapshot.subjects.find(item =>
              item.id === assignment.subjectId
            )
          const module =
            annualModule(
              snapshot,
              assignment.id
            )

          return {
            assignment,
            group,
            subject,
            module,
            label:
              `${group?.name ?? 'Turma'} · ${subject?.name ?? assignment.displayName}`
          }
        })
        .sort((left, right) =>
          left.label.localeCompare(
            right.label,
            'pt-PT',
            {
              numeric: true,
              sensitivity: 'base'
            }
          )
        ),
    [snapshot]
  )

  const selected =
    destinations.find(item =>
      item.assignment.id === assignmentId
    ) ?? null

  const hasActivePlanification =
    selected?.module
      ? snapshot.planifications.some(planification =>
          planification.active &&
          planification.moduleId === selected.module?.id
        )
      : false

  useEffect(() => {
    onActiveChange(
      Boolean(document)
    )
  }, [document, onActiveChange])

  async function load(file: File) {
    if (busy || disabled) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const parsed =
        await readModuleDocument(file)

      if (
        parsed.importKind !==
        'regular_annual'
      ) {
        throw new Error(
          'Este Excel contém UFCD/módulos. Use o importador curricular normal para esse documento.'
        )
      }

      if (
        parsed.sections.length !== 1
      ) {
        throw new Error(
          'A planificação anual tem de conter uma única grelha reconhecível.'
        )
      }

      const state =
        await readRegularAnnualPlanificationImportState()
      const resolved =
        resolvePlanificationDestination(
          snapshot,
          parsed
        )
      const suggested =
        resolved.destination &&
        annualModule(
          snapshot,
          resolved.destination.assignment.id
        )
          ? resolved.destination.assignment.id
          : destinations.length === 1
            ? destinations[0].assignment.id
            : ''

      setDocument(parsed)
      setFingerprint(
        state.fingerprint
      )
      setAssignmentId(
        suggested
      )
      setReviewed(false)
      setShowDetails(false)
    } catch (failure) {
      setDocument(null)
      setAssignmentId('')
      setReviewed(false)
      setError(
        errorText(failure)
      )
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    if (
      document &&
      !window.confirm(
        'Descartar esta planificação anual sem importar?'
      )
    ) {
      return
    }

    setDocument(null)
    setAssignmentId('')
    setReviewed(false)
    setShowDetails(false)
    setError('')
    setMessage('')
  }

  async function save() {
    if (
      busy ||
      disabled ||
      !document ||
      !selected?.module ||
      !reviewed
    ) {
      return
    }

    const source =
      document.sections[0]

    if (
      !source.contentsText.trim() &&
      !source.objectivesText.trim()
    ) {
      setError(
        'A grelha não contém conteúdos nem objetivos importáveis.'
      )
      return
    }

    if (
      !guided &&
      !window.confirm(
        'Associar esta planificação à Componente anual existente? A disciplina, a turma e a carga letiva calculada pelo horário não serão alteradas.'
      )
    ) {
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const result =
        await commitRegularAnnualPlanificationImport({
          confirmed: true,
          academicYearId:
            snapshot.academicYear.id,
          assignmentIds: [
            selected.assignment.id
          ],
          expectedFingerprint:
            fingerprint,
          document,
          selections: [{
            sectionIndex: 0,
            code: '',
            name:
              selected.module.name,
            plannedPeriods:
              selected.module.plannedPeriods,
            reviewed: true
          }]
        })

      await onImported()
      setDocument(null)
      setAssignmentId('')
      setReviewed(false)
      setShowDetails(false)
      setMessage(
        result.attached
          ? 'Planificação anual associada à Componente anual.'
          : 'A Componente anual já tinha uma planificação ativa; foi preservada sem alterações.'
      )
    } catch (failure) {
      setError(
        errorText(failure)
      )
    } finally {
      setBusy(false)
    }
  }

  if (!destinations.length) {
    return null
  }

  const source =
    document?.sections[0]

  return (
    <section className="mt-5 rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-5 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black">
            Planificação anual · Ensino regular
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            Importe a grelha anual Excel sem criar módulos artificiais. A planificação fica ligada à Componente anual já calculada pelo horário.
          </p>
        </div>
        {!document ? (
          <label className={`${button} cursor-pointer`}>
            Escolher Excel anual
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls"
              className="hidden"
              disabled={disabled || busy}
              onChange={event => {
                const file =
                  event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) void load(file)
              }}
            />
          </label>
        ) : null}
      </div>

      {document && source ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="break-words font-black">
              {document.name}
            </p>
            <p className="mt-2 text-xs leading-5 text-cyan-100">
              Sem código artificial: este documento só pode ser associado a uma Componente anual de ensino regular já existente.
            </p>
          </div>

          <label className="block text-sm font-bold text-slate-200">
            Disciplina e turma de destino
            <select
              className={`${field} mt-2`}
              value={assignmentId}
              onChange={event => {
                setAssignmentId(
                  event.target.value
                )
                setReviewed(false)
              }}
            >
              <option value="">
                Escolher destino
              </option>
              {destinations.map(item => (
                <option
                  key={item.assignment.id}
                  value={item.assignment.id}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {selected?.module ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm">
              <p className="font-black text-white">
                {selected.module.name}
              </p>
              <p className="mt-1 text-slate-300">
                {selected.module.plannedPeriods} tempos letivos já calculados pelo horário. Este valor não será alterado pela importação.
              </p>
              {hasActivePlanification ? (
                <p className="mt-2 font-bold text-amber-100">
                  Já existe uma planificação ativa. Será preservada e este ficheiro não a substituirá.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 p-4 text-sm">
            <p>
              <span className="font-bold">Períodos:</span>{' '}
              {source.periodLabel || 'não indicados'}
            </p>
            <p className="mt-2">
              <span className="font-bold">Conteúdos:</span>{' '}
              {source.contentsText || '—'}
            </p>
            <p className="mt-2">
              <span className="font-bold">Objetivos:</span>{' '}
              {source.objectivesText || '—'}
            </p>
            {source.plannedLessons ? (
              <p className="mt-2 text-slate-400">
                O ficheiro refere {source.plannedLessons} aulas/tempos. É apenas informação de revisão; não substitui a carga calculada pelo horário.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="text-xs font-bold text-cyan-200 underline underline-offset-4"
            onClick={() =>
              setShowDetails(value => !value)
            }
          >
            {showDetails
              ? 'Ocultar detalhes'
              : 'Rever detalhes'}
          </button>

          {showDetails ? (
            <div className="space-y-3">
              {[
                ['Período', 'periodLabel'],
                ['Conteúdos', 'contentsText'],
                ['Objetivos', 'objectivesText'],
                ['Metodologias', 'methodologyText'],
                ['Recursos', 'resourcesText'],
                ['Avaliação', 'evaluationText']
              ].map(([label, key]) => (
                <label
                  key={key}
                  className="block text-xs font-bold text-slate-300"
                >
                  {label}
                  <textarea
                    className={`${field} mt-1 min-h-24 font-normal`}
                    value={String(source[key as keyof typeof source] ?? '')}
                    onChange={event => {
                      const text =
                        event.target.value
                      setDocument(current =>
                        current
                          ? {
                              ...current,
                              sections:
                                current.sections.map(
                                  (section, index) =>
                                    index === 0
                                      ? {
                                          ...section,
                                          [key]: text
                                        }
                                      : section
                                )
                            }
                          : current
                      )
                      setReviewed(false)
                    }}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={!selected?.module}
              onChange={event =>
                setReviewed(
                  event.target.checked
                )
              }
            />
            <span>
              Revi o destino, os conteúdos e os objetivos. Confirmo que esta planificação pertence à Componente anual selecionada.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              disabled={
                busy ||
                disabled ||
                !selected?.module ||
                !reviewed
              }
              onClick={() => void save()}
            >
              Associar planificação anual
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300"
              onClick={clear}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {busy ? (
        <p role="status" className="mt-3 text-sm">
          A processar a planificação anual…
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </section>
  )
}
