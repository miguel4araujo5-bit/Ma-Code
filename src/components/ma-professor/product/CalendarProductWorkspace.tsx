import { useCallback, useEffect, useState } from 'react'

import CalendarWorkspaceView from '../calendar/CalendarWorkspaceView'
import {
  calendarWorkspaceRepository,
  type CalendarViewMode,
  type CalendarWorkspaceFilters,
  type CalendarWorkspaceSnapshot
} from '../calendar/calendarWorkspaceRepository'
import type { EntityId, ISODate } from '../types'

interface CalendarProductWorkspaceProps {
  academicYearId: EntityId
  onOpenLesson: (date: ISODate, lessonId: EntityId) => void
}

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

  return (
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
    />
  )
}
