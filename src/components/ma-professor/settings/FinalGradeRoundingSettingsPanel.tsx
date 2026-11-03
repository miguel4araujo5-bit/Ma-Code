import { useEffect, useRef, useState } from 'react'
import type { FinalGradeRounding } from '../types'
import { useMAProfessorUnsavedWorkspaceProtection } from '../navigation/useUnsavedWorkspaceProtection'
import { loadFinalGradeRounding, saveFinalGradeRounding } from './absenceGradeSettingsRepository'

export function FinalGradeRoundingSettingsPanel({ onDataChanged }: { onDataChanged?: () => void }) {
  const [saved, setSaved] = useState<FinalGradeRounding | null>(null)
  const [rounding, setRounding] = useState<FinalGradeRounding>('nearest')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const dirty = saved !== null && rounding !== saved
  useMAProfessorUnsavedWorkspaceProtection(dirty, rootRef)

  useEffect(() => {
    let active = true
    void loadFinalGradeRounding().then(value => {
      if (active) { setSaved(value); setRounding(value) }
    }).catch(error => {
      if (active) setFeedback(error instanceof Error ? error.message : 'Não foi possível ler o arredondamento.')
    })
    return () => { active = false }
  }, [])

  return <div ref={rootRef} className="mt-4 rounded-xl border border-white/10 p-4">
    <h3 className="text-sm font-bold text-slate-200">Arredondamento final — todas as disciplinas</h3>
    <p className="mt-2 text-sm text-slate-400">Regra única para todas as disciplinas, módulos, UC e UFCD do ensino profissional, com ou sem ACS.</p>
    <label className="mt-4 block text-sm font-bold text-slate-200">Notas finais de 0 a 20
      <select aria-label="Arredondamento da nota final" value={rounding} disabled={saving || saved === null}
        onChange={event => { setRounding(event.target.value as FinalGradeRounding); setFeedback('') }}
        className="mt-2 w-full rounded-xl bg-slate-950 p-3 font-normal text-slate-300">
        <option value="nearest">Ao inteiro mais próximo (0–20)</option>
        <option value="up">Sempre para cima (0–20)</option>
      </select>
    </label>
    <p className="mt-3 text-sm text-slate-300">{rounding === 'up'
      ? 'Qualquer parte decimal sobe para o inteiro seguinte: 0,1 → 1; 1,1 → 2; 9,1 → 10; 19,1 → 20. As notas inteiras mantêm-se.'
      : 'Uma parte decimal inferior a 0,5 desce; a partir de 0,5 sobe. Exemplos: 9,1 → 9; 9,5 → 10. As notas inteiras mantêm-se.'}</p>
    <p className="mt-3 text-sm text-slate-400">O arredondamento é aplicado apenas no cálculo da nota final. As médias decimais e as notas finais já confirmadas mantêm-se.</p>
    <button type="button" disabled={saving || !dirty} className="mt-4 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40"
      onClick={async () => {
        setSaving(true); setFeedback('')
        try {
          await saveFinalGradeRounding(rounding)
          setSaved(rounding); onDataChanged?.(); setFeedback('Arredondamento guardado. Sugestões de nota final recalculadas.')
        } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível guardar o arredondamento.') }
        finally { setSaving(false) }
      }}>Guardar arredondamento</button>
    {feedback ? <p role="status" className="mt-3 text-sm text-slate-200">{feedback}</p> : null}
  </div>
}
