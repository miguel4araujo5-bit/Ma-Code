import { useEffect, useRef, useState } from 'react'
import ExtraLessonDialog from '../calendar/ExtraLessonDialog'
import LessonEditorDialog from '../calendar/LessonEditorDialog'
import { calendarWorkspaceRepository, type CalendarLessonEditorContext } from '../calendar/calendarWorkspaceRepository'
import { extraLessonRepository, type ExtraLessonCreateContext } from '../calendar/extraLessonRepository'
import { isLessonAnticipation } from '../settings/backupValidation'
import type { EntityId, ISODate, Lesson } from '../types'

export function useCalendarExtraLesson(
  academicYearId: EntityId,
  anchorDate: ISODate,
  teachingAssignmentId: EntityId | null,
  onCreated: (lesson: Lesson) => void | Promise<void>
) {
  const [context, setContext] = useState<ExtraLessonCreateContext | null>(null)
  const [moveContext, setMoveContext] = useState<{
    editor: CalendarLessonEditorContext
    position?: Pick<Lesson, 'date' | 'startTime' | 'endTime'>
    cancelAnticipation?: boolean
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const requestSequence = useRef(0)

  useEffect(() => () => { requestSequence.current += 1 }, [])

  async function createLesson(requestedDate?: ISODate, position?: Pick<Lesson, 'startTime' | 'endTime'>) {
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
      if (request === requestSequence.current) setContext({
        ...next,
        defaultStartTime: position?.startTime,
        defaultEndTime: position?.endTime
      })
    } catch (cause) {
      if (request === requestSequence.current) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a aula extra.')
      }
    } finally {
      busy.current = false
      if (request === requestSequence.current) setLoading(false)
    }
  }

  async function openMoveLesson(lessonId: EntityId, position?: Pick<Lesson, 'date' | 'startTime' | 'endTime'>, cancelAnticipation = false) {
    if (busy.current) return
    busy.current = true
    const request = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const editor = await calendarWorkspaceRepository.getLessonEditorContext(lessonId)
      if (cancelAnticipation && !isLessonAnticipation(editor.lessonRow.lesson.anticipation)) throw new Error('Esta aula já não possui uma antecipação para cancelar. Atualize a grelha.')
      if (request === requestSequence.current) setMoveContext({ editor, position: cancelAnticipation ? editor.lessonRow.lesson.anticipation?.returnPosition : position, cancelAnticipation })
    } catch (cause) {
      if (request === requestSequence.current) setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a alteração da aula.')
    } finally {
      busy.current = false
      if (request === requestSequence.current) setLoading(false)
    }
  }

  const dialog = <>
    {error ? (
      <div role="alert" className="m-4 rounded-2xl border border-amber-300/20 bg-slate-950 p-4 text-amber-100">
        <p>Não foi possível preparar a aula: {error}</p>
        <button type="button" className="mt-2 font-bold" onClick={() => setError('')}>Fechar aviso</button>
      </div>
    ) : null}
    {loading ? (
      <div role="status" className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 p-5 text-white">
        A preparar a aula…
      </div>
    ) : null}
    {context ? (
      <ExtraLessonDialog
        context={context}
        onClose={() => setContext(null)}
        onCreated={async lesson => {
          setContext(null)
          await onCreated(lesson)
        }}
      />
    ) : null}
    {moveContext ? (
      <LessonEditorDialog
        context={moveContext.editor}
        initialPosition={moveContext.position}
        moveOnly={Boolean(moveContext.position)}
        cancelAnticipation={moveContext.cancelAnticipation}
        onClose={() => setMoveContext(null)}
        onOpenLesson={lessonId => openMoveLesson(lessonId)}
        onSaved={async lesson => {
          setMoveContext(null)
          await onCreated(lesson)
        }}
      />
    ) : null}
  </>

  return { createLesson, openMoveLesson, cancelAnticipation: (lessonId: EntityId) => openMoveLesson(lessonId, undefined, true), dialog }
}
