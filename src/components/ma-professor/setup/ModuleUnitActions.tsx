import { useRef, useState } from 'react'
import { maProfessorRepository } from '../repository'
import type { ModuleUnit } from '../types'
import { useMAProfessorUnsavedWorkspaceProtection } from '../navigation/useUnsavedWorkspaceProtection'

interface Props {
  module: ModuleUnit
  disabled?: boolean
  beforeOpen?: () => boolean
  onChanged: () => Promise<unknown> | void
}

export default function ModuleUnitActions({ module, disabled, beforeOpen, onChanged }: Props) {
  const [action, setAction] = useState<'delete' | 'replace' | null>(null)
  const [draft, setDraft] = useState({ code: '', name: '', plannedPeriods: '' })
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const saving = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useMAProfessorUnsavedWorkspaceProtection(Boolean(action), rootRef,
    'Existe uma alteração de UFCD, módulo ou UC por confirmar. Pretende sair sem a guardar?')

  if (module.regularAnnual) return null

  function open(next: 'delete' | 'replace') {
    if (beforeOpen && !beforeOpen()) return
    setDraft({ code: module.code, name: module.name, plannedPeriods: String(module.plannedPeriods) })
    setConfirmation('')
    setError('')
    setSuccess('')
    setAction(next)
  }

  async function save() {
    if (saving.current || !action || confirmation !== (action === 'delete' ? 'APAGAR' : 'SUBSTITUIR')) return
    saving.current = true
    setBusy(true)
    setError('')
    let committed = false
    try {
      if (action === 'delete') {
        await maProfessorRepository.deleteModule(module.id, module.updatedAt)
      } else {
        await maProfessorRepository.replaceModule(module.id, module.updatedAt, {
          code: draft.code, name: draft.name, plannedPeriods: Number(draft.plannedPeriods)
        })
      }
      committed = true
      setAction(null)
      setSuccess(action === 'delete' ? 'A unidade foi eliminada.' : 'A unidade foi substituída. Pode agora criar ou importar a respetiva planificação.')
      await onChanged()
    } catch (failure) {
      setError(committed
        ? 'A alteração foi guardada, mas a lista não foi atualizada. Recarregue a página.'
        : failure instanceof Error ? failure.message : 'Não foi possível alterar a unidade.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  const field = 'mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white'
  const word = action === 'delete' ? 'APAGAR' : 'SUBSTITUIR'
  return <div ref={rootRef} className="mt-3">
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled || busy} onClick={() => open('replace')}
        className="rounded-xl border border-cyan-300/25 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-40">Substituir unidade</button>
      <button type="button" disabled={disabled || busy} onClick={() => open('delete')}
        className="rounded-xl border border-rose-300/25 px-3 py-2 text-xs font-bold text-rose-100 disabled:opacity-40">Eliminar unidade</button>
    </div>
    {action ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4">
      <div role="dialog" aria-modal="true" aria-label={action === 'delete' ? 'Eliminar unidade curricular' : 'Substituir unidade curricular'}
        className="max-h-[90dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl border border-white/20 bg-slate-950 p-5 shadow-2xl">
        <h3 className="text-lg font-black text-white">{action === 'delete' ? 'Eliminar' : 'Substituir'} UFCD, módulo ou UC</h3>
        <p className="text-sm font-bold text-cyan-100">{module.code} — {module.name}</p>
        <p className="text-sm leading-6 text-slate-300">Esta ação remove a unidade inteira, a sua planificação e os seus critérios específicos. A turma, a disciplina, os critérios gerais e o horário mantêm-se. A operação será bloqueada se existirem aulas com trabalho guardado, faltas, avaliações ou recuperações.</p>
        {action === 'replace' ? <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-300">Novo código<input autoFocus className={field} value={draft.code} disabled={busy}
            onChange={event => setDraft(current => ({ ...current, code: event.target.value }))} /></label>
          <label className="text-sm text-slate-300">Tempos<input className={field} type="number" min="1" step="1" value={draft.plannedPeriods} disabled={busy}
            onChange={event => setDraft(current => ({ ...current, plannedPeriods: event.target.value }))} /></label>
          <label className="text-sm text-slate-300 sm:col-span-2">Nova designação<input className={field} value={draft.name} disabled={busy}
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></label>
          <p className="text-xs text-slate-400 sm:col-span-2">A nova unidade ocupa a mesma posição na sequência. Depois pode importar a sua planificação.</p>
        </div> : null}
        <label className="block text-sm text-slate-300">Escreva {word} para confirmar
          <input autoFocus={action === 'delete'} className={field} value={confirmation} disabled={busy} autoComplete="off"
            onChange={event => setConfirmation(event.target.value)} /></label>
        {error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => setAction(null)} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white">Cancelar</button>
          <button type="button" disabled={busy || confirmation !== word || (action === 'replace' && (!draft.name.trim() || !Number.isInteger(Number(draft.plannedPeriods)) || Number(draft.plannedPeriods) <= 0))}
            onClick={() => void save()} className="rounded-xl bg-rose-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40">{busy ? 'A guardar...' : action === 'delete' ? 'Eliminar unidade' : 'Substituir unidade'}</button>
        </div>
      </div>
    </div> : null}
    {!action && error ? <p role="alert" className="mt-2 text-sm text-rose-200">{error}</p> : null}
    {!action && success ? <p role="status" className="mt-2 text-sm text-emerald-200">{success}</p> : null}
  </div>
}
