import { useEffect, useState } from 'react'
import { countMAProfessorDailyDrafts, MA_PROFESSOR_DAILY_DRAFT_CHANGED_EVENT } from '../daily/dailyDraftStorage'

export default function BackupDraftNotice({ accountEmail }: { accountEmail: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    let readEpoch = 0
    setCount(0)
    const update = async () => {
      const epoch = ++readEpoch
      try {
        const nextCount = await countMAProfessorDailyDrafts(accountEmail)
        if (!cancelled && epoch === readEpoch) setCount(nextCount)
      } catch {
        // O aviso geral sobre dados guardados mantém-se se a leitura falhar.
      }
    }
    void update()
    window.addEventListener(MA_PROFESSOR_DAILY_DRAFT_CHANGED_EVENT, update)
    window.addEventListener('focus', update)
    return () => {
      cancelled = true
      window.removeEventListener(MA_PROFESSOR_DAILY_DRAFT_CHANGED_EVENT, update)
      window.removeEventListener('focus', update)
    }
  }, [accountEmail])
  if (!count) return null
  return (
    <p role="status" className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-3 text-sm leading-6 text-amber-100">
      {count === 1 ? 'Existe' : 'Existem'} {count} {count === 1 ? 'aula com alterações por guardar' : 'aulas com alterações por guardar'}.
      {' '}Os rascunhos não entram nesta cópia. Guarde essas aulas em Hoje antes de fazer a cópia para incluir as alterações.
    </p>
  )
}
