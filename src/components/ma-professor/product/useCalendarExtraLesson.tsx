import { useEffect, useRef, useState } from 'react'
import ExtraLessonDialog from '../calendar/ExtraLessonDialog'
import { extraLessonRepository, type ExtraLessonCreateContext } from '../calendar/extraLessonRepository'
import type { EntityId, ISODate, Lesson } from '../types'

export function useCalendarExtraLesson(
  academicYearId: EntityId,
  anchorDate: ISODate,
  teachingAssignmentId: EntityId | null,
  onCreated: (lesson: Lesson) => void
) {
  const [context, setContext] = useState<ExtraLessonCreateContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const requestSequence = useRef(0)

  useEffect(() => () => { requestSequence.current += 1 }, [])

  async function createLesson(requestedDate?: ISODate) {
    if (busy.current) return
    busy.current = true
    const request = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const next = await extraLessonRepository.getCreateContext(
        academicYearId,
        requestedDate ?? anchorDate,
        teachingAssignmentId
      )
      if (request === requestSequence.current) setContext(next)
    } catch (cause) {
      if (request === requestSequence.current) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a aula extra.')
      }
    } finally {
      busy.current = false
      if (request === requestSequence.current) setLoading(false)
    }
  }

  const dialog = <>
    {error ? (
      <div role="alert" className="m-4 rounded-2xl border border-amber-300/20 bg-slate-950 p-4 text-amber-100">
        <p>Não foi possível preparar a aula extra: {error}</p>
        <button type="button" className="mt-2 font-bold" onClick={() => setError('')}>Fechar aviso</button>
      </div>
    ) : null}
    {loading ? (
      <div role="status" className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 p-5 text-white">
        A preparar a aula extra…
      </div>
    ) : null}
    {context ? (
      <ExtraLessonDialog
        context={context}
        onClose={() => setContext(null)}
        onCreated={lesson => {
          setContext(null)
          onCreated(lesson)
        }}
      />
    ) : null}
  </>

  return { createLesson, dialog }
}
