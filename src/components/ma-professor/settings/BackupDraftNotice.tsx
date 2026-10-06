import { useEffect, useState } from 'react'
import { listMAProfessorDailyDrafts, MA_PROFESSOR_DAILY_DRAFT_CHANGED_EVENT } from '../daily/dailyDraftStorage'
import { maProfessorDb, openMAProfessorDatabase } from '../db'
import { MA_PROFESSOR_OPEN_DAILY_EVENT, type MAProfessorOpenDailyDetail } from '../setup/setupReadiness'

interface DraftLesson extends MAProfessorOpenDailyDetail {
  id: string
  startTime: string
  endTime: string
  label: string
  canOpen: boolean
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(date)
}

async function loadDraftLessons(accountEmail: string): Promise<DraftLesson[]> {
  const drafts = await listMAProfessorDailyDrafts(accountEmail)
  let rows: DraftLesson[] = drafts.map(draft => ({
    id: draft.id,
    academicYearId: draft.academicYearId,
    lessonId: draft.lessonId,
    date: draft.date,
    startTime: draft.lesson.startTime,
    endTime: draft.lesson.endTime,
    label: '',
    canOpen: false
  }))
  if (!rows.length) return rows

  try {
    await openMAProfessorDatabase()
    const [lessons, years] = await Promise.all([
      maProfessorDb.lessons.bulkGet(rows.map(row => row.lessonId)),
      maProfessorDb.academicYears.toArray()
    ])
    const assignments = await maProfessorDb.teachingAssignments.bulkGet(
      [...new Set(lessons.flatMap(lesson => lesson ? [lesson.teachingAssignmentId] : []))]
    )
    const [groups, subjects] = await Promise.all([
      maProfessorDb.groups.bulkGet([...new Set(assignments.flatMap(item => item ? [item.groupId] : []))]),
      maProfessorDb.subjects.bulkGet([...new Set(assignments.flatMap(item => item ? [item.subjectId] : []))])
    ])
    rows = rows.map((row, index) => {
      const lesson = lessons[index]
      const assignment = assignments.find(item => item?.id === lesson?.teachingAssignmentId)
      const group = groups.find(item => item?.id === assignment?.groupId)
      const subject = subjects.find(item => item?.id === assignment?.subjectId)
      const year = years.find(item => item.id === row.academicYearId)
      const label = [group?.name, subject?.name].filter(Boolean).join(' · ') || assignment?.displayName || ''
      const canOpen = Boolean(year?.active && lesson?.academicYearId === row.academicYearId && lesson?.date === row.date)
      const unavailableLabel = !year?.active
        ? `${year?.name ? `${year.name} · ` : ''}Ano letivo inativo`
        : 'Aula indisponível'
      return { ...row, label: canOpen ? label : [label, unavailableLabel].filter(Boolean).join(' · '), canOpen }
    })
  } catch {
    // A data e a hora continuam visíveis se os dados da aula não puderem ser consultados.
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
}

export default function BackupDraftNotice({ accountEmail }: { accountEmail: string }) {
  const [lessons, setLessons] = useState<DraftLesson[]>([])
  useEffect(() => {
    let cancelled = false
    let readEpoch = 0
    setLessons([])
    const update = async () => {
      const epoch = ++readEpoch
      try {
        const nextLessons = await loadDraftLessons(accountEmail)
        if (!cancelled && epoch === readEpoch) setLessons(nextLessons)
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
  const count = lessons.length
  if (!count) return null
  return (
    <div role="status" className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-3 text-sm leading-6 text-amber-100">
      <p>
        {count === 1 ? 'Existe' : 'Existem'} {count} {count === 1 ? 'aula com alterações por guardar' : 'aulas com alterações por guardar'}.
        {' '}Os rascunhos não entram nesta cópia. Guarde essas aulas em Hoje antes de fazer a cópia para incluir as alterações.
      </p>
      <ul className="mt-2 space-y-2">
        {lessons.map(lesson => {
          const description = <><time dateTime={lesson.date}>{formatDate(lesson.date)}</time> · {lesson.startTime}–{lesson.endTime}{lesson.label ? ` · ${lesson.label}` : ''}</>
          return (
            <li key={lesson.id}>
              {lesson.canOpen ? (
                <button type="button" className="text-left font-bold underline decoration-amber-200/50 underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
                  onClick={() => window.dispatchEvent(new window.CustomEvent<MAProfessorOpenDailyDetail>(MA_PROFESSOR_OPEN_DAILY_EVENT, {
                    detail: { academicYearId: lesson.academicYearId, date: lesson.date, lessonId: lesson.lessonId }
                  }))}>
                  {description} — Abrir em Hoje
                </button>
              ) : <span>{description}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
