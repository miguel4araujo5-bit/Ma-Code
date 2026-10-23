import { useMAProfessorUnsavedWorkspaceProtection } from '../navigation/useUnsavedWorkspaceProtection'
import { useEffect, useRef, useState } from 'react'
import type { AssessmentProfile, EntityId } from '../types'
import { loadAbsenceGradeSettings, saveAbsenceGradeSettings } from './absenceGradeSettingsRepository'

export function AbsenceGradeSettingsPanel({ academicYearId, onDataChanged }: { academicYearId: EntityId; onDataChanged?: () => void }) {
  const [configuration, setConfiguration] = useState<Awaited<ReturnType<typeof loadAbsenceGradeSettings>> | null>(null)
  const [assignmentId, setAssignmentId] = useState('')
  const [profile, setProfile] = useState<AssessmentProfile>('general')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [dirty, setDirty] = useState(false)
  const rootRef = useRef<HTMLDetailsElement | null>(null)
  useMAProfessorUnsavedWorkspaceProtection(dirty, rootRef)
  const load = async () => {
    const next = await loadAbsenceGradeSettings(academicYearId)
    setConfiguration(next)
    setAssignmentId(current => next.assignments.some(row => row.id === current) ? current : next.assignments[0]?.id ?? '')
    setValues(Object.fromEntries(next.rows.map(row => [row.criterion.id, row.criterion.absenceGrade == null ? '' : String(row.criterion.absenceGrade)])))
    setDirty(false)
  }
  useEffect(() => { let active = true; void loadAbsenceGradeSettings(academicYearId).then(next => {
    if (!active) return
    setConfiguration(next); setAssignmentId(next.assignments[0]?.id ?? '')
    setValues(Object.fromEntries(next.rows.map(row => [row.criterion.id, row.criterion.absenceGrade == null ? '' : String(row.criterion.absenceGrade)])))
  }).catch(error => { if (active) setFeedback(error instanceof Error ? error.message : 'Não foi possível ler os critérios.') }); return () => { active = false } }, [academicYearId])
  const rows = configuration?.rows.filter(row => row.teachingAssignmentId === assignmentId && row.profile === profile) ?? []
  const choose = (change: () => void) => {
    if (dirty && !window.confirm('Existem notas de falta por guardar. Pretende descartar essas alterações?')) return
    if (configuration) setValues(Object.fromEntries(configuration.rows.map(row => [row.criterion.id, row.criterion.absenceGrade == null ? '' : String(row.criterion.absenceGrade)])))
    setDirty(false); setFeedback(''); change()
  }
  return <details ref={rootRef} className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
    <summary className="cursor-pointer text-sm font-bold text-slate-200">Notas quando o aluno falta — por critério</summary>
    <p className="mt-4 text-sm text-slate-400">Por defeito, não contar na média. Uma nota entre 0 e 20 aplica-se às avaliações já registadas e futuras deste critério. Alterar ou remover a nota recalcula as médias e sugestões; as classificações finais confirmadas mantêm-se.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="text-sm text-slate-300">Disciplina e turma<select aria-label="Disciplina e turma para notas de falta" disabled={saving || !configuration} value={assignmentId} onChange={event => choose(() => setAssignmentId(event.target.value))} className="mt-2 w-full rounded-xl bg-slate-950 p-3">{configuration?.assignments.map(row => <option key={row.id} value={row.id}>{row.displayName}</option>)}</select></label>
      <label className="text-sm text-slate-300">Perfil de avaliação<select aria-label="Perfil para notas de falta" disabled={saving} value={profile} onChange={event => choose(() => setProfile(event.target.value as AssessmentProfile))} className="mt-2 w-full rounded-xl bg-slate-950 p-3"><option value="general">Sem ACS</option><option value="acs">Com ACS</option></select></label>
    </div>
    <form className="mt-4 space-y-4" onSubmit={async event => {
      event.preventDefault(); setSaving(true); setFeedback('')
      try {
        await saveAbsenceGradeSettings(academicYearId, assignmentId, profile, rows.map(({ criterion }) => ({ criterionId: criterion.id, expectedUpdatedAt: criterion.updatedAt, grade: (values[criterion.id] ?? '').trim() === '' ? null : Number(values[criterion.id]) })))
        await load(); onDataChanged?.(); setFeedback('Notas de falta guardadas. Médias e sugestões recalculadas automaticamente.')
      } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível guardar.') } finally { setSaving(false) }
    }}>
      {rows.map(({ criterion, schemeLabel }) => <label key={criterion.id} className="block text-sm text-slate-200"><span className="block">{criterion.name} · {criterion.weightPercent}%</span><span className="text-xs text-slate-400">{schemeLabel}</span><input type="number" min="0" max="20" step="0.1" aria-label={`Nota quando faltou — ${criterion.name} — ${schemeLabel}`} placeholder="Não contar na média" value={values[criterion.id] ?? ''} disabled={saving} onChange={event => { setValues(current => ({ ...current, [criterion.id]: event.target.value })); setDirty(true); setFeedback('') }} className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 p-3" /></label>)}
      {configuration && rows.length === 0 ? <p className="text-sm text-slate-400">Não existem critérios configurados para esta disciplina e perfil.</p> : null}
      <button type="submit" disabled={saving || !dirty || rows.length === 0} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">Guardar notas de falta</button>
      {feedback ? <p role="status" className="text-sm text-slate-200">{feedback}</p> : null}
    </form>
  </details>
}
