import { useEffect, useRef, useState } from 'react'
import type { SetupSnapshot } from '../repository'
import type { SchoolCalendarEvent } from '../types'
import { useMAProfessorUnsavedWorkspaceProtection } from '../navigation/useUnsavedWorkspaceProtection'
import { calendarRepository, getSchoolCalendarEventTypeLabel } from './calendarRepository'
import {
  confirmOtherSchoolCalendar, getOtherSchoolCalendarBase,
  type OtherSchoolCalendarRow
} from './otherSchoolCalendar'

const fieldClass = 'w-full min-w-0 rounded-xl border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-white'

export default function OtherSchoolCalendarSetup({ snapshot, onConfirmed }: {
  snapshot: SetupSnapshot
  onConfirmed: (snapshot: SetupSnapshot) => void
}) {
  const year = snapshot.academicYear
  const rootRef = useRef<HTMLElement>(null)
  const [rows, setRows] = useState<OtherSchoolCalendarRow[]>([])
  const [existing, setExisting] = useState<SchoolCalendarEvent[]>([])
  const [startDate, setStartDate] = useState(year.startDate)
  const [endDate, setEndDate] = useState(year.endDate)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')

  useMAProfessorUnsavedWorkspaceProtection(dirty && !saving, rootRef)

  useEffect(() => {
    let cancelled = false
    void calendarRepository.listEvents({ academicYearId: year.id }).then(events => {
      if (cancelled) return
      setExisting(events)
      // Never seed over an existing or restored calendar.
      setRows(events.length ? events : getOtherSchoolCalendarBase(year))
      if (!events.length && getOtherSchoolCalendarBase(year).length && year.startDate < '2026-09-11') {
        setStartDate('2026-09-11')
      }
      setLoading(false)
    }).catch(reason => {
      if (cancelled) return
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o calendário.')
      // Keep confirmation unavailable when the current events could not be read.
    })
    return () => { cancelled = true }
  }, [year.id])

  function updateRow(index: number, changes: Partial<OtherSchoolCalendarRow>) {
    setRows(current => current.map((row, i) => i === index ? { ...row, ...changes } : row))
    setDirty(true)
  }

  async function confirm() {
    if (saving || loading) return
    setSaving(true)
    setError('')
    try {
      const next = await confirmOtherSchoolCalendar({
        academicYearId: year.id, startDate, endDate, rows, expectedEvents: existing
      })
      setDirty(false)
      onConfirmed(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível guardar o calendário.')
    } finally {
      setSaving(false)
    }
  }

  const hasNationalBase = getOtherSchoolCalendarBase(year).length > 0

  return (
    <section ref={rootRef} className="mx-auto max-w-5xl rounded-3xl border border-cyan-300/20 bg-slate-950/80 p-5 text-white sm:p-8">
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-200">Outra escola · Calendário · {year.name}</p>
      <h1 className="mt-3 text-2xl font-black">Reveja o calendário da sua escola</h1>
      <p className="mt-3 text-sm leading-7 text-slate-300">Deseja ajustar alguma data ou acrescentar um feriado local? Confirme o calendário antes de importar ou preencher o horário.</p>
      <p className="mt-2 text-sm leading-7 text-slate-400">
        {existing.length ? 'O calendário já guardado foi mantido para revisão.' : hasNationalBase
          ? 'Base nacional de Portugal continental. Reveja as interrupções de acordo com o calendário aprovado pela sua escola.'
          : 'Não existe uma base nacional pré-preenchida para este ano. Introduza os feriados e interrupções do calendário da sua escola.'}
      </p>
      {hasNationalBase && !existing.length ? <p className="mt-2 text-sm leading-7 text-slate-400">Em 2026/2027, a janela nacional de início aplicável ao Profissional é de 11 a 15 de setembro. Acrescente também a interrupção de verão definida pela escola.</p> : null}
      <fieldset disabled={loading || saving} className="mt-6 space-y-5 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Início das aulas<input className={`${fieldClass} mt-2`} type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setDirty(true) }} /></label>
          <label className="block text-sm">Fim do ano letivo<input className={`${fieldClass} mt-2`} type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setDirty(true) }} /></label>
        </div>
        {loading ? <p>A abrir calendário…</p> : null}
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} data-calendar-review-row className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="mb-3 text-xs font-bold text-slate-400">{getSchoolCalendarEventTypeLabel(row.type)}</p>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                <label className="min-w-0 text-xs">Designação<input aria-label={`Designação ${index + 1}`} className={`${fieldClass} mt-2`} value={row.title} onChange={e => updateRow(index, { title: e.target.value })} /></label>
                <label className="min-w-0 text-xs">Início<input aria-label={`Início ${index + 1}`} className={`${fieldClass} mt-2`} type="date" value={row.startDate} onChange={e => updateRow(index, { startDate: e.target.value })} /></label>
                <label className="min-w-0 text-xs">Fim<input aria-label={`Fim ${index + 1}`} className={`${fieldClass} mt-2`} type="date" value={row.endDate} onChange={e => updateRow(index, { endDate: e.target.value })} /></label>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={row.blocksLessons} onChange={e => updateRow(index, { blocksLessons: e.target.checked })} />Sem aulas neste intervalo</label>
                <button type="button" className="rounded-lg border border-white/15 px-3 py-2 text-xs" onClick={() => { setRows(current => current.filter((_, i) => i !== index)); setDirty(true) }}>Retirar</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {(['holiday', 'school_break'] as const).map(type => <button key={type} type="button" className="rounded-xl border border-cyan-300/30 px-4 py-3 text-sm font-bold" onClick={() => {
            setRows(current => [...current, { academicYearId: year.id, type, scope: 'all', title: '', startDate, endDate: startDate, blocksLessons: true }])
            setDirty(true)
          }}>{type === 'holiday' ? 'Acrescentar feriado' : 'Acrescentar interrupção'}</button>)}
        </div>
        <button type="button" onClick={() => void confirm()} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">{saving ? 'A guardar…' : 'Confirmar calendário e continuar'}</button>
      </fieldset>
      {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-300/30 p-4 text-sm text-rose-100">{error}</p> : null}
    </section>
  )
}
