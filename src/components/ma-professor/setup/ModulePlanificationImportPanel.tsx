import { useEffect, useMemo, useRef, useState } from 'react'
import type { SetupSnapshot } from '../repository'
import PlanificationScheduleGrid from './PlanificationScheduleGrid'
import {
  matchingPlanificationSubjects, normalizePlanificationLabel as normalizeSubjectLabel,
  planificationDestinations, resolvePlanificationDestination
} from './planificationDestination'
import { readModuleDocument, durationWarning, type ModuleDocument } from './planificationModuleDocument'
import {
  commitModulePlanificationImport, readModuleImportState, type ModuleImportSelection
} from './modulePlanificationImportRepository'

type Row = ModuleImportSelection & { selected: boolean }
type Props = {
  snapshot: SetupSnapshot
  disabled: boolean
  onActiveChange: (active: boolean) => void
  onImported: () => Promise<unknown>
  guided?: boolean
}

const field = 'w-full rounded-xl border border-white/15 bg-slate-900 p-3 text-sm text-white'
const button = 'rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40'
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
const validModuleCode = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._/-]{0,15}$/.test(value.trim())

function findMatchingSubjects(snapshot: SetupSnapshot, subjectName: string) {
  return matchingPlanificationSubjects(snapshot, subjectName)
}

function plannedPeriodsForSection(
  document: ModuleDocument,
  section: ModuleDocument['sections'][number],
  periodMinutes: number
) {
  if (
    document.periodMinutes === periodMinutes &&
    section.plannedLessons
  ) {
    return section.plannedLessons
  }

  if (
    section.durationHours &&
    Number.isInteger(
      section.durationHours * 60 / periodMinutes
    )
  ) {
    return section.durationHours * 60 / periodMinutes
  }

  return 0
}

function rowIsReady(
  row: Pick<Row, 'code' | 'name' | 'plannedPeriods'>,
  section: ModuleDocument['sections'][number]
) {
  return (
    validModuleCode(row.code) &&
    Boolean(row.name.trim()) &&
    Number.isInteger(row.plannedPeriods) &&
    row.plannedPeriods > 0 &&
    Boolean(section.contentsText.trim())
  )
}

function curricularUnitLabel(code: string) {
  return /^\d{3,6}$/.test(code.trim())
    ? 'UFCD'
    : 'Módulo'
}

export default function ModulePlanificationImportPanel({
  snapshot,
  disabled,
  onActiveChange,
  onImported,
  guided = false
}: Props) {
  const [open, setOpen] = useState(guided)
  const [document, setDocument] = useState<ModuleDocument | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [subjectName, setSubjectName] = useState('')
  const [courseName, setCourseName] = useState('')
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [targetAssignmentId, setTargetAssignmentId] = useState('')
  const [destinationWarnings, setDestinationWarnings] = useState<string[]>([])
  const [editingDestination, setEditingDestination] = useState(false)
  const [fingerprint, setFingerprint] = useState('')
  const [minutes, setMinutes] = useState(50)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showAllDetails, setShowAllDetails] = useState(false)
  const operation = useRef(0)
  const saving = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; operation.current++ }
  }, [])

  const activeGroups = useMemo(
    () => snapshot.groups.filter(group => group.active),
    [snapshot.groups]
  )

  const matchingSubjects = useMemo(
    () => findMatchingSubjects(snapshot, subjectName),
    [snapshot, subjectName]
  )

  const matchedSubject = matchingSubjects.length === 1
    ? matchingSubjects[0]
    : null

  const selectedRows = useMemo(
    () => rows.filter(row => row.selected),
    [rows]
  )
  const readyRows = useMemo(
    () => selectedRows.filter(row => row.reviewed),
    [selectedRows]
  )
  const pendingRows = useMemo(
    () => selectedRows.filter(row => !row.reviewed),
    [selectedRows]
  )
  const availableDestinations = useMemo(() => planificationDestinations(snapshot), [snapshot])
  const destinationReady = guided
    ? availableDestinations.some(item => item.assignment.id === targetAssignmentId)
    : Boolean(subjectName.trim() && matchingSubjects.length <= 1 && groupIds.length > 0)

  function applyDestination(parsed: ModuleDocument, assignmentId?: string) {
    const resolved = resolvePlanificationDestination(snapshot, parsed, assignmentId)
    setTargetAssignmentId(resolved.destination?.assignment.id ?? '')
    if (guided) setSubjectName(resolved.destination?.subject.name ?? parsed.subjectLabel)
    else setSubjectName(parsed.subjectLabel)
    setGroupIds(resolved.destination ? [resolved.destination.group.id] : [])
    setDestinationWarnings(resolved.warnings)
    setEditingDestination(false)
  }

  function selectDestination(assignmentId: string) {
    if (!document || busy || saving.current) return
    applyDestination(document, assignmentId)
    invalidateReview()
  }

  function changeOpen(value: boolean) {
    if (value) {
      setError('')
      setMessage('')
    }
    setOpen(value)
    onActiveChange(value)
  }

  async function load(file: File, assignmentId?: string) {
    if (saving.current || busy || disabled) return
    if (document && !window.confirm('Substituir o documento e descartar a revisão atual por guardar?')) return
    const token = ++operation.current
    setBusy(true)
    setError('')
    setMessage('')
    setDocument(null)
    setRows([])
    setSubjectName('')
    setCourseName('')
    setGroupIds([])
    setTargetAssignmentId('')
    setDestinationWarnings([])
    setEditingDestination(false)
    setShowAllDetails(false)
    try {
      const parsed = await readModuleDocument(file)
      const state = await readModuleImportState()
      if (!mounted.current || token !== operation.current) return

      const nextRows = parsed.sections.map((section, sectionIndex) => {
        const row = {
          sectionIndex,
          selected: true,
          reviewed: false,
          code: section.code,
          name: section.name,
          plannedPeriods: plannedPeriodsForSection(
            parsed,
            section,
            state.periodMinutes
          )
        }

        return {
          ...row,
          reviewed: guided && rowIsReady(row, section)
        }
      })

      setDocument(parsed)
      setFingerprint(state.fingerprint)
      setMinutes(state.periodMinutes)
      applyDestination(parsed, assignmentId)
      // No modo guiado o curso serve para resolver o destino, mas nunca
      // substitui automaticamente um curso já guardado na turma.
      setCourseName(guided ? '' : parsed.courseLabel)
      setRows(nextRows)
    } catch (failure) {
      if (mounted.current && token === operation.current) setError(errorText(failure))
    } finally {
      if (mounted.current && token === operation.current) setBusy(false)
    }
  }

  function edit(index: number, changes: Partial<Row>) {
    setRows(current => current.map((row, i) => {
      if (i !== index) return row

      if (
        guided &&
        Object.keys(changes).every(key => key === 'selected')
      ) {
        return { ...row, ...changes }
      }

      return { ...row, reviewed: false, ...changes }
    }))
  }

  function invalidateReview() {
    if (!guided) {
      setRows(current => current.map(row => ({ ...row, reviewed: false })))
    }
    setError('')
    setMessage('')
  }

  function changeSubject(value: string) {
    setSubjectName(value)
    setGroupIds([])
    invalidateReview()
  }

  function changeCourse(value: string) {
    setCourseName(value)
    invalidateReview()
  }

  function toggleGroup(groupId: string, checked: boolean) {
    setGroupIds(current =>
      checked
        ? current.includes(groupId)
          ? current
          : [...current, groupId]
        : current.filter(id => id !== groupId)
    )
    invalidateReview()
  }

  async function updateReview() {
    if (busy) return
    setBusy(true)
    try {
      await onImported()
      const state = await readModuleImportState()
      setFingerprint(state.fingerprint)
      setMinutes(state.periodMinutes)
      setRows(current => current.map(row => ({ ...row, reviewed: false })))
      setError('')
      setMessage('Destinos atualizados. Reveja novamente as UFCD/módulos selecionados.')
    } catch (failure) { setError(errorText(failure)) }
    finally { setBusy(false) }
  }

  async function save() {
    if (saving.current || busy || !document) return
    const selections = rows.filter(row => row.selected)

    if (!subjectName.trim()) {
      setError('Indique a disciplina de destino.')
      return
    }

    if (!guided && matchingSubjects.length > 1) {
      setError(`Existem várias disciplinas ativas chamadas “${subjectName.trim()}”. Corrija a duplicação antes de importar.`)
      return
    }

    if (!destinationReady || !selections.length || !groupIds.length || selections.some(row => !row.reviewed)) {
      setError('Selecione o destino e reveja apenas as UFCD/módulos ainda assinalados como pendentes.')
      return
    }

    if (!guided && !window.confirm('Criar as UFCD/módulos e planificações nos destinos selecionados? A disciplina indicada será usada se já existir ou criada se ainda não existir. Os módulos já existentes serão preservados e ignorados.')) return

    saving.current = true
    setBusy(true)
    setError('')
    let committed = false
    try {
      const result = await commitModulePlanificationImport({
        confirmed: true,
        academicYearId: snapshot.academicYear.id,
        ...(guided
          ? { assignmentIds: [targetAssignmentId] }
          : { subjectName: matchedSubject?.name ?? subjectName, groupIds, courseName }),
        document,
        selections,
        expectedFingerprint: fingerprint
      })
      committed = true
      setDocument(null)
      setRows([])
      setSubjectName('')
      setCourseName('')
      setGroupIds([])
      setTargetAssignmentId('')
      setDestinationWarnings([])
      setEditingDestination(false)
      setShowAllDetails(false)
      changeOpen(false)
      setMessage(`Importação concluída: ${result.created} UFCD/módulos com planificação criados; ${result.skipped} existentes preservados.`)
      await onImported()
    } catch (failure) {
      setError(committed
        ? 'Os dados foram guardados, mas a lista não foi atualizada. Recarregue a página para os consultar.'
        : errorText(failure))
    } finally { saving.current = false; setBusy(false) }
  }

  function clearImport() {
    if (document && !window.confirm('Descartar esta revisão sem importar?')) return
    operation.current++
    setDocument(null)
    setRows([])
    setSubjectName('')
    setCourseName('')
    setGroupIds([])
    setTargetAssignmentId('')
    setDestinationWarnings([])
    setEditingDestination(false)
    setShowAllDetails(false)
    setError('')
    setMessage('')
    changeOpen(false)
  }

  if (guided) {
    return (
      <section className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-5 text-white shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">Adicionar planificação</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Cada disciplina e turma tem a sua planificação. Os critérios de avaliação são tratados no passo seguinte.</p>
          </div>
          {!open ? (
            <button className={button} disabled={disabled || busy} onClick={() => changeOpen(true)}>
              Adicionar outra planificação
            </button>
          ) : null}
        </div>

        <PlanificationScheduleGrid
          snapshot={snapshot}
          disabled={disabled || busy}
          selectedAssignmentIds={targetAssignmentId ? [targetAssignmentId] : []}
          needsReview={destinationWarnings.length > 0}
          hasDocument={Boolean(document)}
          onSelect={selectDestination}
          onFile={(file, assignmentId) => { changeOpen(true); void load(file, assignmentId) }}
          onError={setError}
        />

        {open ? (
          <fieldset disabled={busy || disabled} className="mt-5 min-w-0 max-w-full space-y-4">
            {!document ? (
              <div
                className="rounded-2xl border-2 border-dashed border-cyan-300/25 bg-cyan-300/[0.025] p-5 text-center"
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault()
                  if (event.dataTransfer.files.length !== 1) {
                    setError('Adicione uma planificação de cada vez.')
                    return
                  }
                  const file = event.dataTransfer.files[0]
                  if (file) void load(file)
                }}
              >
                <label className="block cursor-pointer text-sm font-black text-white">
                  Arraste a planificação ou selecione PDF/Word
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    className="mt-3 block w-full text-sm font-normal text-slate-400"
                    onChange={event => {
                      const file = event.currentTarget.files?.[0]
                      event.currentTarget.value = ''
                      if (file) void load(file)
                    }}
                  />
                </label>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="break-words font-black text-white">{document.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-slate-300">
                      {document.subjectLabel || 'Disciplina por confirmar'}
                    </span>
                    {document.groupLabel ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-slate-300">{document.groupLabel}</span>
                    ) : document.gradeLabel ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-slate-300">{document.gradeLabel}</span>
                    ) : null}
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-emerald-100">
                      {readyRows.length} prontas
                    </span>
                    {pendingRows.length > 0 ? (
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-3 py-1.5 text-amber-100">
                        {pendingRows.length} por rever
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 text-sm ${destinationReady && !destinationWarnings.length ? 'border-emerald-300/20 bg-emerald-300/[0.055]' : 'border-amber-300/20 bg-amber-300/[0.055]'}`}>
                  <p className={`font-black ${destinationWarnings.length || !destinationReady ? 'text-amber-100' : 'text-emerald-100'}`}>
                    {destinationReady ? (destinationWarnings.length ? 'Destino a rever' : '✓ Destino da planificação') : 'Destino por associar'}
                  </p>
                  {destinationReady ? <p className="mt-1 text-slate-300">{availableDestinations.find(item => item.assignment.id === targetAssignmentId)?.label}</p> : null}
                  {destinationWarnings.map(warning => <p key={warning} className="mt-2 text-xs leading-5 text-amber-100">{warning}</p>)}
                  {destinationReady && destinationWarnings.length ? <p className="mt-2 text-xs text-slate-400">Pode manter este destino e importar, ou corrigir a associação.</p> : null}
                  <button type="button" onClick={() => setEditingDestination(value => !value)} className="mt-3 text-xs font-bold text-cyan-200 underline underline-offset-4">
                    {editingDestination ? 'Fechar escolha de destino' : 'Corrigir destino'}
                  </button>
                  {editingDestination || !destinationReady ? (
                    <label className="mt-3 block text-xs font-bold text-slate-300">
                      Disciplina e turma
                      <select className={field + ' mt-2'} value={targetAssignmentId}
                        onChange={event => selectDestination(event.target.value)}>
                        <option value="" disabled>Escolher no horário ou nesta lista</option>
                        {availableDestinations.map(item => <option key={item.assignment.id} value={item.assignment.id}>{item.label}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>

                <div className="min-w-0 max-w-full space-y-2">
                  {rows.map((row, index) => {
                    const source = document.sections[row.sectionIndex]
                    const warning = durationWarning(source, document.periodMinutes)
                    const expanded = showAllDetails || (row.selected && !row.reviewed)
                    const unitLabel = curricularUnitLabel(row.code || source.code)

                    return (
                      <article key={row.sectionIndex} className={`min-w-0 max-w-full overflow-hidden rounded-2xl border p-4 ${row.reviewed ? 'border-white/10 bg-white/[0.025]' : 'border-amber-300/20 bg-amber-300/[0.045]'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <label className="flex min-w-0 flex-1 items-center gap-2 font-bold text-white">
                            <input type="checkbox" checked={row.selected} onChange={event => edit(index, { selected: event.target.checked })} />
                            <span className="block min-w-0 flex-1 truncate">{unitLabel} {row.code || '—'} — {row.name || source.name || 'designação por confirmar'}</span>
                          </label>
                          <span className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-black ${row.reviewed ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100' : 'border-amber-300/20 bg-amber-300/[0.07] text-amber-100'}`}>
                            {row.reviewed ? `${row.plannedPeriods} tempos · pronto` : 'Rever'}
                          </span>
                        </div>

                        {expanded ? (
                          <div className="mt-4 space-y-3">
                            {warning ? <p className="text-xs leading-5 text-amber-100">{warning}</p> : null}
                            {source.warnings.map((text, warningIndex) => <p key={warningIndex} className="text-xs leading-5 text-amber-100">{text}</p>)}
                            <div className="grid gap-3 sm:grid-cols-[110px_1fr_140px]">
                              <label className="text-xs font-bold text-slate-300">Código<input className={field + ' mt-1'} value={row.code} onChange={event => edit(index, { code: event.target.value })} /></label>
                              <label className="text-xs font-bold text-slate-300">Designação<input className={field + ' mt-1'} value={row.name} onChange={event => edit(index, { name: event.target.value })} /></label>
                              <label className="text-xs font-bold text-slate-300">Tempos de {minutes} min<input className={field + ' mt-1'} type="number" min="1" step="1" value={row.plannedPeriods || ''} onChange={event => edit(index, { plannedPeriods: Number(event.target.value) })} /></label>
                            </div>

                            {showAllDetails ? (
                              <details>
                                <summary className="cursor-pointer text-xs font-bold text-slate-300">Conteúdos e planificação</summary>
                                {[['Período', source.periodLabel], ['Conteúdos', source.contentsText], ['Objetivos', source.objectivesText], ['Metodologias', source.methodologyText], ['Recursos', source.resourcesText], ['Avaliação', source.evaluationText]]
                                  .map(([label, value], fieldIndex) => <label key={label} className="mt-3 block text-xs font-bold text-slate-300">{label}
                                    <textarea className={field + ' mt-1 min-h-24 font-normal'} value={value}
                                      onChange={event => {
                                        const keys = ['periodLabel', 'contentsText', 'objectivesText', 'methodologyText', 'resourcesText', 'evaluationText'] as const
                                        const text = event.target.value
                                        setDocument(current => current ? { ...current, sections: current.sections.map((section, sectionIndex) =>
                                          sectionIndex === row.sectionIndex ? { ...section, [keys[fieldIndex]]: text } : section) } : current)
                                        edit(index, { reviewed: false })
                                      }} />
                                  </label>)}
                              </details>
                            ) : null}

                            {!row.reviewed && rowIsReady(row, source) ? (
                              <button
                                type="button"
                                onClick={() => setRows(current => current.map((item, rowIndex) => rowIndex === index ? { ...item, reviewed: true } : item))}
                                className="rounded-xl border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-2 text-xs font-black text-emerald-100"
                              >
                                Confirmar esta correção
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>

                {document.warnings.length > 0 && showAllDetails ? (
                  <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/80">
                    {document.warnings.map((warning, index) => <p key={index}>• {warning}</p>)}
                  </div>
                ) : null}

                <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAllDetails(value => !value)}
                    className="text-xs font-bold text-slate-400 underline decoration-slate-700 underline-offset-4"
                  >
                    {showAllDetails ? 'Ocultar detalhes' : 'Editar detalhes'}
                  </button>
                  <div className="ml-auto flex max-w-full flex-wrap justify-end gap-2">
                    <button type="button" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300" onClick={clearImport}>Cancelar</button>
                    <button
                      type="button"
                      className={button}
                      onClick={() => void save()}
                      disabled={!destinationReady || !selectedRows.length || pendingRows.length > 0}
                    >
                      Importar {selectedRows.length} {selectedRows.length === 1 ? 'planificação' : 'planificações'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </fieldset>
        ) : null}

        {disabled && !open ? <p className="mt-3 text-sm text-amber-200">Guarde ou limpe o rascunho manual antes de importar.</p> : null}
        {busy ? <p role="status" className="mt-3 text-sm">A processar a planificação…</p> : null}
        {message ? <p role="status" className="mt-3 text-sm text-emerald-200">{message}</p> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p> : null}
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-cyan-300/25 bg-slate-950 p-5 text-white xl:col-span-2">
      <h2 className="text-xl font-black">Importar planificação</h2>
      <p className="mt-2 text-sm text-slate-300">Crie as UFCD/módulos e as respetivas planificações a partir de um PDF ou Word, revendo separadamente disciplina, curso e turmas de destino.</p>
      {!open ? <button className={button + ' mt-4'} disabled={disabled || busy} onClick={() => changeOpen(true)}>
        Importar PDF ou Word
      </button> : <>
        <fieldset disabled={busy} className="mt-4 space-y-4">
          <div className="rounded-2xl border-2 border-dashed border-cyan-300/30 p-5"
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault()
              if (event.dataTransfer.files.length !== 1) { setError('Importe um documento de cada vez.'); return }
              const file = event.dataTransfer.files[0]
              if (file) void load(file)
            }}>
            <label className="block text-sm font-bold">Arraste a planificação ou selecione um ficheiro (até 20 MB)
              <input type="file" accept=".pdf,.docx" className="mt-3 block w-full text-sm"
                onChange={event => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (file) void load(file)
                }} />
            </label>
          </div>
          {document && <>
            <p className="break-words font-bold">{document.name}</p>
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-300 sm:grid-cols-2">
              <p><span className="font-bold text-white">Disciplina indicada no documento:</span> {document.subjectLabel || 'não identificada'}</p>
              <p><span className="font-bold text-white">Curso indicado no documento:</span> {document.courseLabel || 'não identificado'}</p>
            </div>
            {document.warnings.map((warning, i) => <p key={i} className="text-sm text-amber-200">{warning}</p>)}
            <label className="block text-sm font-bold">Disciplina de destino
              <input
                className={field + ' mt-2'}
                value={subjectName}
                onChange={event => changeSubject(event.target.value)}
                placeholder="Ex.: Área de Expressões"
              />
              <span className="mt-1 block text-xs font-normal leading-5 text-slate-400">
                Pode corrigir livremente a designação. Se já existir uma disciplina ativa com exatamente este nome, será usada; caso contrário será criada apenas ao confirmar a importação.
              </span>
            </label>
            {matchingSubjects.length === 1 ? (
              <p className="text-sm text-emerald-200">
                Disciplina existente encontrada: “{matchingSubjects[0].name}”.
              </p>
            ) : matchingSubjects.length > 1 ? (
              <p role="alert" className="text-sm font-bold text-rose-200">
                Existem várias disciplinas ativas com esta designação. Corrija a duplicação antes de importar.
              </p>
            ) : subjectName.trim() ? (
              <p className="text-sm text-cyan-100">
                A disciplina “{subjectName.trim()}” ainda não existe e será criada apenas depois da confirmação.
              </p>
            ) : null}
            <label className="block text-sm font-bold">Curso de destino
              <input className={field + ' mt-2'} value={courseName}
                onChange={event => changeCourse(event.target.value)}
                placeholder="Ex.: Técnico de Apoio Psicossocial" />
              <span className="mt-1 block text-xs font-normal leading-5 text-slate-400">
                Pode corrigir este valor antes de importar. O curso confirmado é guardado nas turmas selecionadas; deixe vazio quando não se aplicar um curso.
              </span>
            </label>
            <div>
              <p className="text-sm font-bold">Turmas de destino</p>
              <div className="mt-2 flex flex-wrap gap-4">
                {activeGroups.map(group => (
                  <label key={group.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(group.id)}
                      onChange={event => toggleGroup(group.id, event.target.checked)}
                    />
                    {group.name} · {group.courseName || 'curso não indicado'}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-sm text-slate-300">Os tempos a criar têm {minutes} minutos. Confirme os valores antes de guardar. UFCD já existentes no destino serão ignoradas, incluindo a respetiva planificação.</p>
            {rows.map((row, index) => {
              const source = document.sections[row.sectionIndex]
              const warning = durationWarning(source, document.periodMinutes)
              return <article key={index} className="space-y-3 rounded-2xl border border-white/15 p-4">
                <label className="flex items-center gap-2 font-bold">
                  <input type="checkbox" checked={row.selected} onChange={event => edit(index, { selected: event.target.checked })} />
                  UFCD {source.code} — {source.name}
                </label>
                <p className="text-sm text-slate-400">Documento: {source.durationHours ?? '—'} horas · {source.plannedLessons ?? '—'} aulas
                  {document.periodMinutes ? ` de ${document.periodMinutes} minutos` : ''}.
                  {source.sourcePages.length ? ` Páginas ${source.sourcePages.join(', ')}.` : ''}</p>
                {warning && <p role="note" className="text-sm font-bold text-amber-200">{warning}</p>}
                {source.warnings.map((text, i) => <p key={i} className="text-sm text-amber-200">{text}</p>)}
                <div className="grid gap-3 sm:grid-cols-[110px_1fr_140px]">
                  <label className="text-sm">Código<input className={field} value={row.code} onChange={e => edit(index, { code: e.target.value })} /></label>
                  <label className="text-sm">Designação<input className={field} value={row.name} onChange={e => edit(index, { name: e.target.value })} /></label>
                  <label className="text-sm">Tempos de {minutes} min<input className={field} type="number" min="1" step="1" value={row.plannedPeriods || ''} onChange={e => edit(index, { plannedPeriods: Number(e.target.value) })} /></label>
                </div>
                {groupIds.map(id => {
                  const group = snapshot.groups.find(g => g.id === id)
                  const assignment = matchedSubject
                    ? snapshot.teachingAssignments.find(item =>
                        item.active &&
                        item.groupId === id &&
                        item.subjectId === matchedSubject.id
                      )
                    : null
                  const existing = assignment
                    ? snapshot.modules.filter(module =>
                        module.teachingAssignmentId === assignment.id &&
                        module.code.trim() === row.code.trim()
                      )
                    : []
                  const currentCourse = group?.courseName?.trim() || 'não indicado'
                  const confirmedCourse = courseName.trim()
                  const courseChange = confirmedCourse && normalizeSubjectLabel(currentCourse) !== normalizeSubjectLabel(confirmedCourse)
                  const subjectAction = matchedSubject
                    ? assignment
                      ? ''
                      : `associar “${matchedSubject.name}” à turma; `
                    : subjectName.trim()
                      ? `criar/associar “${subjectName.trim()}”; `
                      : ''
                  return <p key={id} className="text-sm text-cyan-100">
                    {group?.name}: {subjectAction}{courseChange ? `curso “${currentCourse}” → “${confirmedCourse}”; ` : ''}{existing.length ? 'Já existe — preservar e ignorar' : 'Criar módulo e planificação'}
                  </p>
                })}
                <details><summary className="cursor-pointer text-sm font-bold">Rever conteúdos e planificação</summary>
                  {[['Período', source.periodLabel], ['Conteúdos', source.contentsText], ['Objetivos', source.objectivesText],
                    ['Metodologias', source.methodologyText], ['Recursos', source.resourcesText], ['Avaliação', source.evaluationText]]
                    .map(([label, value], fieldIndex) => <label key={label} className="mt-3 block text-sm font-bold">{label}
                      <textarea className={field + ' mt-1 min-h-24 font-normal'} value={value}
                        onChange={event => {
                          const keys = ['periodLabel', 'contentsText', 'objectivesText', 'methodologyText', 'resourcesText', 'evaluationText'] as const
                          const text = event.target.value
                          setDocument(current => current ? { ...current, sections: current.sections.map((s, i) =>
                            i === row.sectionIndex ? { ...s, [keys[fieldIndex]]: text } : s) } : current)
                          edit(index, { reviewed: false })
                        }} />
                    </label>)}
                </details>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.reviewed} disabled={!row.selected}
                  onChange={event => edit(index, { reviewed: event.target.checked })} />Revi os dados, o destino e os tempos desta UFCD.</label>
              </article>
            })}
            <div className="flex flex-wrap gap-3">
              <button className={button} onClick={() => void save()}
                disabled={!subjectName.trim() || matchingSubjects.length > 1 || !groupIds.length || !rows.some(r => r.selected) || rows.some(r => r.selected && !r.reviewed)}>
                Confirmar importação
              </button>
              <button className="rounded-xl border border-white/20 px-4 py-3 text-sm" onClick={() => void updateReview()}>Atualizar revisão</button>
            </div>
          </>}
          <button className="text-sm underline" onClick={clearImport}>Cancelar importação</button>
        </fieldset>
      </>}
      {disabled && !open && <p className="mt-3 text-sm text-amber-200">Guarde ou limpe o rascunho manual antes de importar.</p>}
      {busy && <p role="status" className="mt-3 text-sm">A processar a planificação…</p>}
      {message && <p role="status" className="mt-3 text-sm text-emerald-200">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
    </section>
  )
}
