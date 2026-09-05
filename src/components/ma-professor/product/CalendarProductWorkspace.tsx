import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

import {
  calendarRepository
} from '../calendar/calendarRepository'
import CalendarWorkspaceView from '../calendar/CalendarWorkspaceView'
import {
  calendarWorkspaceRepository,
  type CalendarViewMode,
  type CalendarWorkspaceFilters,
  type CalendarWorkspaceSnapshot
} from '../calendar/calendarWorkspaceRepository'
import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'
import type {
  EntityId,
  ISODate,
  SchoolCalendarEvent
} from '../types'

interface CalendarProductWorkspaceProps {
  academicYearId: EntityId
  onOpenLesson: (date: ISODate, lessonId: EntityId) => void
}

const EVENT_EDITOR_DISCARD_MESSAGE =
  'Existem alterações por guardar neste evento. Se continuar, essas alterações serão perdidas. Pretende continuar?'

function todayISO(): ISODate {
  const date = new Date()

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar o calendário.'
}

function isDutyEvent(
  event: SchoolCalendarEvent
) {
  return event.type ===
      'school_activity' &&
    event.scope ===
      'all' &&
    event.title.startsWith(
      'Cargo · '
    )
}

function getDutyDetails(
  event: SchoolCalendarEvent
) {
  const parts =
    event.title.split(' · ')

  return {
    name:
      parts[1] ??
      event.title,
    time:
      parts[2] ??
      ''
  }
}

function formatDate(
  value: ISODate
) {
  const [
    year,
    month,
    day
  ] = value
    .split('-')
    .map(Number)

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  ).format(
    new Date(
      year,
      month - 1,
      day
    )
  )
}

export function CalendarProductWorkspace({
  academicYearId,
  onOpenLesson
}: CalendarProductWorkspaceProps) {
  const [mode, setMode] = useState<CalendarViewMode>('week')
  const [anchorDate, setAnchorDate] = useState<ISODate>(todayISO)
  const [filters, setFilters] = useState<CalendarWorkspaceFilters>({})
  const [snapshot, setSnapshot] =
    useState<CalendarWorkspaceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [selectedEvent, setSelectedEvent] =
    useState<SchoolCalendarEvent | null>(null)
  const [eventText, setEventText] = useState('')
  const [eventSaving, setEventSaving] = useState(false)
  const [eventError, setEventError] = useState('')
  const eventEditorRef = useRef<HTMLDivElement>(null)

  const hasUnsavedEventText = Boolean(
    selectedEvent &&
    eventText !== selectedEvent.description
  )

  useMAProfessorUnsavedWorkspaceProtection(
    hasUnsavedEventText,
    eventEditorRef,
    EVENT_EDITOR_DISCARD_MESSAGE
  )

  const loadCalendar = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const nextSnapshot =
        await calendarWorkspaceRepository.getWorkspace(
          academicYearId,
          mode,
          anchorDate,
          filters
        )

      setSnapshot(nextSnapshot)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [academicYearId, anchorDate, filters, mode])

  useEffect(() => {
    void loadCalendar()
  }, [loadCalendar, refreshToken])

  function handleLessonSelect(lessonId: EntityId) {
    const lessonRow = snapshot?.days
      .flatMap(day => day.lessons)
      .find(row => row.lesson.id === lessonId)

    if (!lessonRow) {
      return
    }

    onOpenLesson(lessonRow.lesson.date, lessonId)
  }

  function handleEventSelect(eventId: EntityId) {
    const eventRow = snapshot?.days
      .flatMap(day => day.events)
      .find(row => row.event.id === eventId)

    if (!eventRow) {
      return
    }

    setSelectedEvent(
      eventRow.event
    )
    setEventText(
      eventRow.event.description
    )
    setEventError('')
  }

  function closeEventEditor() {
    setSelectedEvent(null)
    setEventText('')
    setEventError('')
  }

  function confirmDiscardEventTextChanges() {
    return !hasUnsavedEventText ||
      window.confirm(
        EVENT_EDITOR_DISCARD_MESSAGE
      )
  }

  function requestCloseEventEditor() {
    if (
      eventSaving ||
      !confirmDiscardEventTextChanges()
    ) {
      return
    }

    closeEventEditor()
  }

  async function saveEventText() {
    if (
      !selectedEvent ||
      eventSaving
    ) {
      return
    }

    setEventSaving(true)
    setEventError('')

    try {
      const updated =
        await calendarRepository.updateEvent(
          selectedEvent.id,
          {
            description:
              eventText
          }
        )

      setSelectedEvent(updated)
      setEventText(updated.description)
      setRefreshToken(
        current =>
          current + 1
      )
      setSelectedEvent(null)
    } catch (saveError) {
      setEventError(
        getErrorMessage(saveError)
      )
    } finally {
      setEventSaving(false)
    }
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-[calc(100vh-58px)] items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-md text-center">
          {loading ? (
            <>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

              <p className="mt-4 text-sm font-semibold text-slate-400">
                A preparar o calendário…
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-rose-200">
                {error || 'Não foi possível abrir o calendário.'}
              </p>

              <button
                type="button"
                onClick={() => setRefreshToken(current => current + 1)}
                className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
              >
                Tentar novamente
              </button>
            </>
          )}
        </div>
      </main>
    )
  }

  const duty =
    selectedEvent &&
    isDutyEvent(selectedEvent)
      ? getDutyDetails(selectedEvent)
      : null

  return (
    <>
      <CalendarWorkspaceView
        snapshot={snapshot}
        loading={loading}
        error={error}
        onRefresh={() => setRefreshToken(current => current + 1)}
        onModeChange={nextMode => setMode(nextMode)}
        onNavigate={nextAnchorDate => setAnchorDate(nextAnchorDate)}
        onGoToday={() => setAnchorDate(todayISO())}
        onFiltersChange={nextFilters => setFilters(nextFilters)}
        onLessonSelect={handleLessonSelect}
        onEventSelect={handleEventSelect}
      />

      {selectedEvent ? (
        <div
          ref={eventEditorRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ma-professor-event-editor-title"
        >
          <section className="w-full max-w-2xl rounded-[2rem] border border-violet-300/20 bg-slate-950 p-5 text-white shadow-2xl shadow-black/50 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">
                  {duty
                    ? 'Cargo / componente não letiva'
                    : 'Evento escolar'}
                </p>

                <h2
                  id="ma-professor-event-editor-title"
                  className="mt-3 text-2xl font-black"
                >
                  {duty
                    ? duty.name
                    : selectedEvent.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {formatDate(
                    selectedEvent.startDate
                  )}
                  {duty?.time
                    ? ` · ${duty.time}`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={requestCloseEventEditor}
                disabled={eventSaving}
                aria-label="Fechar"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-black text-white">
                {duty
                  ? 'Sumário'
                  : 'Descrição'}
              </span>

              <textarea
                value={eventText}
                onChange={event =>
                  setEventText(
                    event.target.value
                  )
                }
                disabled={eventSaving}
                rows={7}
                placeholder={
                  duty
                    ? 'Escreva o sumário desta ocorrência. Pode fazê-lo agora para programar uma data futura, ou preencher no próprio dia.'
                    : 'Descrição do evento.'
                }
                className="w-full resize-y rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50 focus:ring-4 focus:ring-violet-300/10 disabled:opacity-60"
              />
            </label>

            {duty ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Este registo é independente das aulas, módulos, alunos e avaliações. Alterar o sumário desta ocorrência não modifica as restantes semanas.
              </p>
            ) : null}

            {eventError ? (
              <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm leading-6 text-rose-100">
                {eventError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={requestCloseEventEditor}
                disabled={eventSaving}
                className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-bold text-slate-300 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveEventText()
                }
                disabled={eventSaving}
                className="rounded-xl border border-violet-200/30 bg-gradient-to-r from-violet-300 to-fuchsia-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-60"
              >
                {eventSaving
                  ? 'A guardar…'
                  : duty
                    ? 'Guardar sumário'
                    : 'Guardar descrição'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
