import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'
import type {
  EntityId,
  ModuleUnit,
  Planification
} from '../types'
import {
  extractPlanificationPdf
} from '../planifications/planificationPdfExtractor'
import {
  parsePlanificationPdfDocument,
  type ParsedPlanificationPdfSection
} from '../planifications/planificationPdfParser'

type ModulesPlanificationPdfImportPanelProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (snapshot: SetupSnapshot) => void
}

type ImportRow = {
  key: string
  included: boolean
  section: ParsedPlanificationPdfSection
  code: string
  name: string
  plannedPeriods: string
}

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50 focus:ring-4 focus:ring-violet-300/10'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível importar a planificação.'
}

function normalizeForComparison(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-PT')
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null
}

function getModuleLabel(code: string, name: string) {
  return code.trim()
    ? `${code.trim()} — ${name.trim()}`
    : name.trim()
}

function buildPlanificationDescription(
  section: ParsedPlanificationPdfSection
) {
  const parts: string[] = []

  if (section.periodLabel.trim()) {
    parts.push(`Período letivo: ${section.periodLabel.trim()}`)
  }

  if (section.durationHours !== null) {
    parts.push(`Duração: ${section.durationHours} h`)
  }

  if (section.methodologyText.trim()) {
    parts.push(`Metodologias: ${section.methodologyText.trim()}`)
  }

  if (section.resourcesText.trim()) {
    parts.push(`Recursos: ${section.resourcesText.trim()}`)
  }

  if (section.evaluationText.trim()) {
    parts.push(`Avaliação: ${section.evaluationText.trim()}`)
  }

  return parts.join('\n\n')
}

function buildPlanificationItems(
  section: ParsedPlanificationPdfSection
) {
  const activity = [
    section.methodologyText.trim()
      ? `Metodologias: ${section.methodologyText.trim()}`
      : '',
    section.resourcesText.trim()
      ? `Recursos: ${section.resourcesText.trim()}`
      : ''
  ]
    .filter(Boolean)
    .join('\n')

  return [
    {
      content: section.contentsText.trim(),
      activity,
      objectives: section.objectivesText.trim(),
      suggestedSummary: ''
    }
  ]
}

function findModuleByCode(
  modules: ModuleUnit[],
  teachingAssignmentId: EntityId,
  code: string
) {
  const normalizedCode = normalizeForComparison(code)

  return modules.find(
    module =>
      module.teachingAssignmentId === teachingAssignmentId &&
      normalizeForComparison(module.code) === normalizedCode
  ) ?? null
}

function findActivePlanification(
  planifications: Planification[],
  moduleId: EntityId
) {
  return planifications.find(
    planification =>
      planification.moduleId === moduleId &&
      planification.active
  ) ?? null
}

export default function ModulesPlanificationPdfImportPanel({
  snapshot,
  onSnapshotChange
}: ModulesPlanificationPdfImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const activeSubjects = useMemo(
    () => snapshot.subjects.filter(subject => subject.active),
    [snapshot.subjects]
  )

  const activeAssignments = useMemo(
    () => snapshot.teachingAssignments.filter(assignment => assignment.active),
    [snapshot.teachingAssignments]
  )

  const groupById = useMemo(
    () => new Map(snapshot.groups.map(group => [group.id, group])),
    [snapshot.groups]
  )

  const [selectedSubjectId, setSelectedSubjectId] =
    useState<EntityId>(activeSubjects[0]?.id ?? '')
  const [selectedAssignmentIds, setSelectedAssignmentIds] =
    useState<EntityId[]>([])
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [documentWarnings, setDocumentWarnings] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedAssignments = useMemo(
    () =>
      activeAssignments.filter(
        assignment => assignment.subjectId === selectedSubjectId
      ),
    [activeAssignments, selectedSubjectId]
  )

  useEffect(() => {
    if (
      selectedSubjectId &&
      activeSubjects.some(subject => subject.id === selectedSubjectId)
    ) {
      return
    }

    setSelectedSubjectId(activeSubjects[0]?.id ?? '')
  }, [activeSubjects, selectedSubjectId])

  useEffect(() => {
    setSelectedAssignmentIds(
      selectedAssignments.map(assignment => assignment.id)
    )
    setError('')
    setSuccess('')
  }, [selectedAssignments])

  async function analyzeFile(file: File) {
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Selecione um ficheiro PDF exportado da planificação.')
      return
    }

    setAnalyzing(true)
    setError('')
    setSuccess('')
    setFileName(file.name)
    setRows([])
    setDocumentWarnings([])

    try {
      const extracted = await extractPlanificationPdf(file)
      const parsed = parsePlanificationPdfDocument(extracted, file.name)

      setDocumentWarnings(parsed.warnings)
      setRows(
        parsed.sections.map((section, index) => ({
          key: `${section.code || 'ufcd'}-${section.sourcePages.join('-')}-${index}`,
          included: true,
          section,
          code: section.code,
          name: section.name,
          plannedPeriods:
            section.plannedLessons === null
              ? ''
              : String(section.plannedLessons)
        }))
      )

      if (parsed.sections.length === 0) {
        setError(
          parsed.warnings[0] ||
          'Não foi possível identificar UFCD ou módulos neste PDF.'
        )
      }
    } catch (analysisError) {
      setError(getErrorMessage(analysisError))
    } finally {
      setAnalyzing(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (file) {
      void analyzeFile(file)
    }

    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)

    const file = event.dataTransfer.files?.[0]

    if (file) {
      void analyzeFile(file)
    }
  }

  function toggleAssignment(assignmentId: EntityId) {
    setSelectedAssignmentIds(current =>
      current.includes(assignmentId)
        ? current.filter(id => id !== assignmentId)
        : [...current, assignmentId]
    )
    setError('')
    setSuccess('')
  }

  function updateRow(
    key: string,
    changes: Partial<Pick<ImportRow, 'included' | 'code' | 'name' | 'plannedPeriods'>>
  ) {
    setRows(current =>
      current.map(row =>
        row.key === key
          ? { ...row, ...changes }
          : row
      )
    )
    setError('')
    setSuccess('')
  }

  async function handleImport() {
    if (importing || analyzing) {
      return
    }

    if (!selectedSubjectId) {
      setError('Selecione a disciplina a que pertence esta planificação.')
      return
    }

    if (selectedAssignmentIds.length === 0) {
      setError('Selecione pelo menos uma turma onde esta planificação se aplica.')
      return
    }

    const includedRows = rows.filter(row => row.included)

    if (includedRows.length === 0) {
      setError('Selecione pelo menos uma UFCD ou módulo para importar.')
      return
    }

    for (const row of includedRows) {
      if (!row.code.trim()) {
        setError('Todas as UFCD incluídas têm de ter um código confirmado.')
        return
      }

      if (!row.name.trim()) {
        setError(`Confirme a designação da UFCD ${row.code.trim()}.`)
        return
      }

      if (parsePositiveInteger(row.plannedPeriods) === null) {
        setError(
          `Confirme o número de aulas/tempos previstos da UFCD ${row.code.trim()}.`
        )
        return
      }
    }

    const seenCodes = new Set<string>()
    for (const row of includedRows) {
      const normalizedCode = normalizeForComparison(row.code)
      if (seenCodes.has(normalizedCode)) {
        setError(`O código ${row.code.trim()} aparece repetido no PDF revisto.`)
        return
      }
      seenCodes.add(normalizedCode)
    }

    setImporting(true)
    setError('')
    setSuccess('')

    try {
      const freshSnapshot = await maProfessorRepository.getSetupSnapshot(
        snapshot.academicYear.id
      )

      const validAssignments = freshSnapshot.teachingAssignments.filter(
        assignment =>
          assignment.active &&
          assignment.subjectId === selectedSubjectId &&
          selectedAssignmentIds.includes(assignment.id)
      )

      if (validAssignments.length !== selectedAssignmentIds.length) {
        throw new Error(
          'A seleção de turma/disciplina mudou entretanto. Reveja a seleção e tente novamente.'
        )
      }

      const knownModules = [...freshSnapshot.modules]
      const knownPlanifications = [...freshSnapshot.planifications]
      let createdModules = 0
      let createdPlanifications = 0
      let reusedModules = 0
      let skippedPlanifications = 0

      for (const assignment of validAssignments) {
        let nextOrder =
          knownModules
            .filter(module => module.teachingAssignmentId === assignment.id)
            .reduce((maximum, module) => Math.max(maximum, module.order), 0) + 1

        for (const row of includedRows) {
          const code = row.code.trim()
          const name = row.name.trim()
          const plannedPeriods = parsePositiveInteger(row.plannedPeriods)!

          let module = findModuleByCode(
            knownModules,
            assignment.id,
            code
          )

          if (!module) {
            module = await maProfessorRepository.createModule({
              academicYearId: snapshot.academicYear.id,
              teachingAssignmentId: assignment.id,
              code,
              name,
              plannedPeriods,
              order: nextOrder,
              plannedStartDate: null,
              plannedEndDate: null,
              active: true
            })
            knownModules.push(module)
            nextOrder += 1
            createdModules += 1
          } else {
            reusedModules += 1
          }

          if (findActivePlanification(knownPlanifications, module.id)) {
            skippedPlanifications += 1
            continue
          }

          const created = await maProfessorRepository.createPlanification(
            {
              academicYearId: snapshot.academicYear.id,
              teachingAssignmentId: assignment.id,
              moduleId: module.id,
              title: `Planificação — ${getModuleLabel(module.code, module.name)}`,
              description: buildPlanificationDescription(row.section),
              active: true
            },
            buildPlanificationItems(row.section)
          )

          knownPlanifications.push(created.planification)
          createdPlanifications += 1
        }
      }

      const nextSnapshot = await maProfessorRepository.getSetupSnapshot(
        snapshot.academicYear.id
      )
      onSnapshotChange(nextSnapshot)

      const details = [
        `${createdModules} ${createdModules === 1 ? 'UFCD/módulo criado' : 'UFCD/módulos criados'}`,
        `${createdPlanifications} ${createdPlanifications === 1 ? 'planificação criada' : 'planificações criadas'}`
      ]

      if (reusedModules > 0) {
        details.push(`${reusedModules} ${reusedModules === 1 ? 'UFCD existente reutilizada' : 'UFCD existentes reutilizadas'}`)
      }

      if (skippedPlanifications > 0) {
        details.push(`${skippedPlanifications} ${skippedPlanifications === 1 ? 'planificação existente preservada' : 'planificações existentes preservadas'}`)
      }

      setSuccess(`${details.join(' · ')}.`)
    } catch (importError) {
      setError(
        `${getErrorMessage(importError)} Se alguma linha já tiver sido guardada, pode repetir a importação: os códigos existentes e as planificações ativas são preservados.`
      )
    } finally {
      setImporting(false)
    }
  }

  const includedRows = rows.filter(row => row.included)

  return (
    <section className="rounded-[1.75rem] border border-violet-300/20 bg-violet-300/[0.035] p-5 shadow-xl shadow-violet-950/10 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">
            Importar planificação
          </p>
          <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">
            Criar UFCD/módulos e planificações a partir do PDF
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Importe o PDF exportado da planificação, reveja o que foi identificado e confirme a turma. Uma única ação cria as UFCD/módulos em falta e as respetivas planificações, sem substituir planificações ativas já existentes.
          </p>
        </div>

        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-emerald-100">
          Análise local
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-black text-slate-200">
            1. Disciplina
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeSubjects.map(subject => (
              <button
                key={subject.id}
                type="button"
                onClick={() => setSelectedSubjectId(subject.id)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-black transition ${
                  selectedSubjectId === subject.id
                    ? 'border-violet-300/40 bg-violet-300/15 text-violet-50'
                    : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-violet-300/25'
                }`}
              >
                {subject.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-black text-slate-200">
            2. Turma(s) onde se aplica
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedAssignments.map(assignment => {
              const selected = selectedAssignmentIds.includes(assignment.id)
              const group = groupById.get(assignment.groupId)

              return (
                <button
                  key={assignment.id}
                  type="button"
                  onClick={() => toggleAssignment(assignment.id)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-black transition ${
                    selected
                      ? 'border-emerald-300/35 bg-emerald-300/10 text-emerald-100'
                      : 'border-white/10 bg-slate-900/70 text-slate-500 hover:border-white/20'
                  }`}
                >
                  {selected ? '✓ ' : ''}
                  {group?.name ?? assignment.displayName}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onDragEnter={event => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={handleDrop}
        className={`mt-6 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragActive
            ? 'border-violet-300/60 bg-violet-300/10'
            : 'border-white/15 bg-slate-950/45'
        }`}
      >
        <p className="text-sm font-black text-white">
          {analyzing ? 'A analisar o PDF...' : '3. Arraste o PDF da planificação para aqui'}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          O ficheiro é lido localmente no dispositivo. Pode corrigir código, designação e número de aulas antes de gravar.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={analyzing || importing}
          className="mt-4 rounded-xl border border-violet-200/25 bg-violet-300/10 px-4 py-2.5 text-xs font-black text-violet-50 disabled:opacity-50"
        >
          Selecionar PDF
        </button>
      </div>

      {fileName ? (
        <p className="mt-3 text-xs text-slate-400">
          <span className="font-black text-white">Ficheiro:</span> {fileName}
        </p>
      ) : null}

      {documentWarnings.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-100">
            Avisos da análise
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-50/90">
            {documentWarnings.map(warning => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">
                4. Rever antes de importar
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Foram identificadas {rows.length} {rows.length === 1 ? 'UFCD' : 'UFCD'}; {includedRows.length} serão importadas.
              </p>
            </div>
          </div>

          {rows.map(row => (
            <article
              key={row.key}
              className={`rounded-2xl border p-4 ${
                row.included
                  ? 'border-white/10 bg-slate-950/60'
                  : 'border-white/[0.06] bg-slate-950/30 opacity-60'
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-black text-violet-100">
                    páginas {row.section.sourcePages.join(', ')}
                  </span>
                  {row.section.durationHours !== null ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                      {row.section.durationHours} h
                    </span>
                  ) : null}
                  {row.section.periodLabel.trim() ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                      {row.section.periodLabel}
                    </span>
                  ) : null}
                </div>

                <label className="flex items-center gap-2 text-sm font-bold text-slate-200">
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={event => updateRow(row.key, { included: event.target.checked })}
                  />
                  Incluir
                </label>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[0.6fr_1.5fr_0.7fr]">
                <label>
                  <span className="mb-2 block text-xs font-bold text-slate-300">Código</span>
                  <input
                    type="text"
                    value={row.code}
                    onChange={event => updateRow(row.key, { code: event.target.value })}
                    disabled={!row.included}
                    className={inputClassName}
                  />
                </label>

                <label>
                  <span className="mb-2 block text-xs font-bold text-slate-300">Designação</span>
                  <input
                    type="text"
                    value={row.name}
                    onChange={event => updateRow(row.key, { name: event.target.value })}
                    disabled={!row.included}
                    className={inputClassName}
                  />
                </label>

                <label>
                  <span className="mb-2 block text-xs font-bold text-slate-300">Aulas / tempos</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={row.plannedPeriods}
                    onChange={event => updateRow(row.key, { plannedPeriods: event.target.value })}
                    disabled={!row.included}
                    className={inputClassName}
                  />
                </label>
              </div>

              {row.section.warnings.length > 0 ? (
                <p className="mt-3 text-xs leading-5 text-amber-200">
                  {row.section.warnings.join(' ')}
                </p>
              ) : null}

              <details className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <summary className="cursor-pointer text-xs font-black text-slate-300">
                  Ver conteúdos, objetivos e metodologias extraídos
                </summary>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">Conteúdos</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">
                      {row.section.contentsText || 'Não identificados.'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">Objetivos / competências</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">
                      {row.section.objectivesText || 'Não identificados.'}
                    </p>
                  </div>
                </div>
              </details>
            </article>
          ))}

          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={
              importing ||
              analyzing ||
              selectedAssignmentIds.length === 0 ||
              includedRows.length === 0
            }
            className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-200/30 bg-gradient-to-r from-emerald-300 to-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {importing
              ? 'A criar UFCD e planificações...'
              : `Importar ${includedRows.length} ${includedRows.length === 1 ? 'UFCD + planificação' : 'UFCD + planificações'}`}
          </button>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm leading-6 text-emerald-100"
        >
          {success}
        </div>
      ) : null}
    </section>
  )
}
