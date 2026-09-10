import { useMemo, useRef, useState } from 'react'
import type { SetupSnapshot } from '../repository'
import { planificationDestinations } from './planificationDestination'

type Props = {
  snapshot: SetupSnapshot
  disabled: boolean
  selectedAssignmentIds: string[]
  needsReview: boolean
  hasDocument: boolean
  onSelect: (assignmentId: string) => void
  onFile: (file: File, assignmentId: string) => void
  onError: (message: string) => void
}

const weekdays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

export default function PlanificationScheduleGrid({
  snapshot, disabled, selectedAssignmentIds, needsReview, hasDocument, onSelect, onFile, onError
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingAssignment = useRef('')
  const [draggedOver, setDraggedOver] = useState('')
  const destinations = useMemo(() => planificationDestinations(snapshot), [snapshot])
  const slots = useMemo(() => snapshot.weeklyScheduleSlots.filter(slot =>
    slot.active && slot.academicYearId === snapshot.academicYear.id &&
    destinations.some(item => item.assignment.id === slot.teachingAssignmentId)), [snapshot, destinations])
  const rows = useMemo(() => [...new Map(slots.map(slot =>
    [`${slot.startTime}|${slot.endTime}`, { start: slot.startTime, end: slot.endTime }])).values()]
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)), [slots])
  const dayCount = slots.some(slot => slot.weekday > 5) ? 7 : 5

  if (!slots.length) return null

  return (
    <section aria-label="Associar planificações ao horário" className="mt-5">
      <h3 className="font-black text-white">Planificações por turma</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        Arraste o PDF ou Word para uma aula, ou clique para escolher o ficheiro. A planificação fica associada a todas as aulas dessa disciplina e turma.
      </p>
      <input ref={fileInput} type="file" accept=".pdf,.docx" className="hidden" tabIndex={-1}
        aria-label="Escolher planificação para a aula selecionada" disabled={disabled}
        onChange={event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file && pendingAssignment.current && !disabled) onFile(file, pendingAssignment.current)
        }} />
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-left text-sm">
          <thead><tr className="bg-white/[0.035]">
            <th scope="col" className="w-24 p-3 text-xs text-slate-500">Horas</th>
            {weekdays.slice(0, dayCount).map(day => <th key={day} scope="col" className="border-l border-white/10 p-3 text-center text-xs text-slate-400">{day}</th>)}
          </tr></thead>
          <tbody>{rows.map(row => <tr key={`${row.start}|${row.end}`}>
            <th scope="row" className="border-t border-white/10 p-3 align-top font-bold text-slate-300">
              <span className="block">{row.start}</span><span className="mt-1 block text-xs text-slate-500">{row.end}</span>
            </th>
            {weekdays.slice(0, dayCount).map((day, dayIndex) => <td key={day} className="border-l border-t border-white/10 p-2 align-top">
              {slots.filter(slot => slot.weekday === dayIndex + 1 && slot.startTime === row.start && slot.endTime === row.end).map(slot => {
                const destination = destinations.find(item => item.assignment.id === slot.teachingAssignmentId)!
                const assignmentId = destination.assignment.id
                const selected = selectedAssignmentIds.includes(assignmentId)
                const modules = snapshot.modules.filter(module => module.active && module.teachingAssignmentId === assignmentId)
                const plans = snapshot.planifications.filter(plan => plan.active && plan.teachingAssignmentId === assignmentId && modules.some(module => module.id === plan.moduleId))
                const complete = modules.length > 0 && modules.every(module => plans.some(plan => plan.moduleId === module.id))
                const status = selected ? (needsReview ? 'Destino escolhido · por rever' : 'Destino escolhido')
                  : complete ? 'Planificação associada' : plans.length ? 'Planificação parcial' : 'Sem planificação'
                const tone = draggedOver === slot.id ? 'border-cyan-200 bg-cyan-300/20'
                  : selected && needsReview ? 'border-amber-300/50 bg-amber-300/10'
                    : selected ? 'border-cyan-200 bg-cyan-300/15'
                      : complete ? 'border-emerald-300/30 bg-emerald-300/[0.07]'
                        : 'border-cyan-300/20 bg-cyan-300/[0.05]'
                return <button key={slot.id} type="button" data-planification-assignment={assignmentId}
                  aria-label={`${destination.label} · ${day} ${slot.startTime} · ${status}`}
                  aria-pressed={selected} disabled={disabled}
                  className={`mb-2 w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-50 ${tone}`}
                  onClick={() => {
                    if (hasDocument) onSelect(assignmentId)
                    else { pendingAssignment.current = assignmentId; fileInput.current?.click() }
                  }}
                  onDragOver={event => {
                    event.preventDefault()
                    if (disabled) { event.dataTransfer.dropEffect = 'none'; return }
                    event.dataTransfer.dropEffect = 'copy'
                    setDraggedOver(slot.id)
                  }}
                  onDragLeave={() => setDraggedOver('')}
                  onDrop={event => {
                    event.preventDefault()
                    event.stopPropagation()
                    setDraggedOver('')
                    if (disabled) return
                    if (event.dataTransfer.files.length !== 1) { onError('Adicione uma planificação de cada vez.'); return }
                    onFile(event.dataTransfer.files[0], assignmentId)
                  }}>
                  <span className="block font-black text-white">{destination.subject.name}</span>
                  <span className="mt-1 block font-bold text-slate-300">{destination.group.name}</span>
                  {destination.group.courseName ? <span className="mt-1 block text-xs text-slate-400">{destination.group.courseName}</span> : null}
                  <span className={`mt-2 block text-xs ${selected && needsReview ? 'text-amber-200' : complete ? 'text-emerald-200' : 'text-slate-400'}`}>{status}</span>
                </button>
              })}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {hasDocument ? <p className="mt-2 text-xs text-slate-400">Clique noutra célula para corrigir o destino antes de importar.</p> : null}
    </section>
  )
}
