import { useEffect, useRef, useState } from 'react'
import type { SetupSnapshot } from '../repository'
import { readModuleDocument, durationWarning, type ModuleDocument } from './planificationModuleDocument'
import {
  commitModulePlanificationImport, readModuleImportState, type ModuleImportSelection
} from './modulePlanificationImportRepository'

type Row = ModuleImportSelection & { selected: boolean }
const field = 'w-full rounded-xl border border-white/15 bg-slate-900 p-3 text-sm text-white'
const button = 'rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40'
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'

export default function ModulePlanificationImportPanel({ snapshot, disabled, onActiveChange, onImported }: {
  snapshot: SetupSnapshot
  disabled: boolean
  onActiveChange: (active: boolean) => void
  onImported: () => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [document, setDocument] = useState<ModuleDocument | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [assignmentIds, setAssignmentIds] = useState<string[]>([])
  const [fingerprint, setFingerprint] = useState('')
  const [minutes, setMinutes] = useState(50)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const operation = useRef(0)
  const saving = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; operation.current++ }
  }, [])

  function changeOpen(value: boolean) {
    setOpen(value)
    onActiveChange(value)
  }

  async function load(file: File) {
    if (saving.current || busy) return
    const token = ++operation.current
    setBusy(true)
    setError('')
    setMessage('')
    setDocument(null)
    setRows([])
    setSubjectId('')
    setAssignmentIds([])
    try {
      const parsed = await readModuleDocument(file)
      const state = await readModuleImportState()
      if (!mounted.current || token !== operation.current) return
      setDocument(parsed)
      setFingerprint(state.fingerprint)
      setMinutes(state.periodMinutes)
      setRows(parsed.sections.map((section, sectionIndex) => ({
        sectionIndex, selected: true, reviewed: false, code: section.code, name: section.name,
        plannedPeriods: parsed.periodMinutes === state.periodMinutes && section.plannedLessons
          ? section.plannedLessons
          : section.durationHours && Number.isInteger(section.durationHours * 60 / state.periodMinutes)
            ? section.durationHours * 60 / state.periodMinutes : 0
      })))
    } catch (failure) {
      if (mounted.current && token === operation.current) setError(errorText(failure))
    } finally {
      if (mounted.current && token === operation.current) setBusy(false)
    }
  }

  function edit(index: number, changes: Partial<Row>) {
    setRows(current => current.map((row, i) => i === index ? { ...row, reviewed: false, ...changes } : row))
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
      setMessage('Destinos atualizados. Reveja novamente as UFCD selecionadas.')
    } catch (failure) { setError(errorText(failure)) }
    finally { setBusy(false) }
  }

  async function save() {
    if (saving.current || busy || !document) return
    const selections = rows.filter(row => row.selected)
    if (!selections.length || !assignmentIds.length || selections.some(row => !row.reviewed)) {
      setError('Selecione as turmas e confirme a revisão de cada UFCD.')
      return
    }
    if (!window.confirm('Criar as UFCD e planificações nos destinos selecionados? Os módulos já existentes serão preservados e ignorados.')) return
    saving.current = true
    setBusy(true)
    setError('')
    let committed = false
    try {
      const result = await commitModulePlanificationImport({
        confirmed: true, academicYearId: snapshot.academicYear.id, assignmentIds,
        document, selections, expectedFingerprint: fingerprint
      })
      committed = true
      setDocument(null)
      setRows([])
      changeOpen(false)
      setMessage(`Importação concluída: ${result.created} UFCD com planificação criadas; ${result.skipped} existentes preservadas.`)
      await onImported()
    } catch (failure) {
      setError(committed
        ? 'Os dados foram guardados, mas a lista não foi atualizada. Recarregue a página para os consultar.'
        : errorText(failure))
    } finally { saving.current = false; setBusy(false) }
  }

  const assignments = snapshot.teachingAssignments.filter(a => a.active && a.subjectId === subjectId)
  return (
    <section className="rounded-3xl border border-cyan-300/25 bg-slate-950 p-5 text-white xl:col-span-2">
      <h2 className="text-xl font-black">Importar planificação</h2>
      <p className="mt-2 text-sm text-slate-300">Crie as UFCD/módulos e as respetivas planificações a partir de um PDF ou Word.</p>
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
            <p className="text-sm text-slate-300">Disciplina indicada no documento: {document.subjectLabel || 'não identificada'}</p>
            {document.warnings.map((warning, i) => <p key={i} className="text-sm text-amber-200">{warning}</p>)}
            <label className="block text-sm font-bold">Disciplina de destino
              <select className={field + ' mt-2'} value={subjectId}
                onChange={event => { setSubjectId(event.target.value); setAssignmentIds([]) }}>
                <option value="">Selecione a disciplina…</option>
                {snapshot.subjects.filter(s => s.active).map(subject =>
                  <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-4">
              {assignments.map(assignment => <label key={assignment.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={assignmentIds.includes(assignment.id)} onChange={event =>
                  setAssignmentIds(current => event.target.checked ? [...current, assignment.id] : current.filter(id => id !== assignment.id))} />
                {snapshot.groups.find(group => group.id === assignment.groupId)?.name ?? assignment.displayName}
              </label>)}
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
                {assignmentIds.map(id => {
                  const existing = snapshot.modules.filter(module => module.teachingAssignmentId === id && module.code.trim() === row.code.trim())
                  const assignment = assignments.find(a => a.id === id)
                  return <p key={id} className="text-sm text-cyan-100">
                    {snapshot.groups.find(g => g.id === assignment?.groupId)?.name}: {existing.length ? 'Já existe — preservar e ignorar' : 'Criar módulo e planificação'}
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
                  onChange={event => edit(index, { reviewed: event.target.checked })} />Revi os dados e confirmo os tempos desta UFCD.</label>
              </article>
            })}
            <div className="flex flex-wrap gap-3">
              <button className={button} onClick={() => void save()}
                disabled={!assignmentIds.length || !rows.some(r => r.selected) || rows.some(r => r.selected && !r.reviewed)}>
                Confirmar importação
              </button>
              <button className="rounded-xl border border-white/20 px-4 py-3 text-sm" onClick={() => void updateReview()}>Atualizar revisão</button>
            </div>
          </>}
          <button className="text-sm underline" onClick={() => {
            if (document && !window.confirm('Descartar esta revisão sem importar?')) return
            operation.current++
            setDocument(null)
            setRows([])
            changeOpen(false)
          }}>Cancelar importação</button>
        </fieldset>
      </>}
      {disabled && !open && <p className="mt-3 text-sm text-amber-200">Guarde ou limpe o rascunho manual antes de importar.</p>}
      {busy && <p role="status" className="mt-3 text-sm">A processar a planificação…</p>}
      {message && <p role="status" className="mt-3 text-sm text-emerald-200">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
    </section>
  )
}
