import {
  useCallback,
  useEffect,
  useState
} from 'react'

import { ScheduleWorkspaceView } from '../schedule/ScheduleWorkspaceView'
import {
  scheduleWorkspaceRepository,
  type ScheduleSlotChanges,
  type ScheduleSlotDraft,
  type ScheduleWorkspaceFilters,
  type ScheduleWorkspaceSnapshot,
  type SchoolCalendarEventChanges,
  type SchoolCalendarEventDraft
} from '../schedule/scheduleWorkspaceRepository'
import type { EntityId } from '../types'

interface ScheduleProductWorkspaceProps {
  academicYearId: EntityId
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar o horário.'
}

export function ScheduleProductWorkspace({
  academicYearId
}: ScheduleProductWorkspaceProps) {
  const [snapshot, setSnapshot] =
    useState<ScheduleWorkspaceSnapshot | null>(null)
  const [filters, setFilters] =
    useState<ScheduleWorkspaceFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(
    async (nextFilters = filters) => {
      setLoading(true)
      setError('')

      try {
        const nextSnapshot =
          await scheduleWorkspaceRepository.getWorkspace(
            academicYearId,
            nextFilters
          )
        setSnapshot(nextSnapshot)
        setFilters(nextSnapshot.filters)
      } catch (loadError) {
        setError(getErrorMessage(loadError))
      } finally {
        setLoading(false)
      }
    },
    [academicYearId, filters]
  )

  useEffect(() => {
    void load({})
    // O ano letivo é a única dependência que deve reiniciar os filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId])

  const mutate = async (operation: () => Promise<unknown>) => {
    setError('')

    try {
      await operation()
      await load()
    } catch (mutationError) {
      setError(getErrorMessage(mutationError))
      throw mutationError
    }
  }

  const handleFiltersChange = (
    nextFilters: ScheduleWorkspaceFilters
  ) => {
    setFilters(nextFilters)
    void load(nextFilters)
  }

  if (!snapshot) {
    return (
      <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-4 py-10 text-white">
        <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-900 p-8 text-center">
          {loading ? (
            <>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
              <p className="mt-4 text-sm font-semibold text-slate-400">
                A preparar o horário e o calendário escolar…
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-black">
                Não foi possível abrir os horários
              </h1>
              <p className="mt-3 text-sm text-rose-200">
                {error || 'Verifique a configuração do ano letivo.'}
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-5 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"
              >
                Tentar novamente
              </button>
            </>
          )}
        </section>
      </main>
    )
  }

  return (
    <ScheduleWorkspaceView
      snapshot={snapshot}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onFiltersChange={handleFiltersChange}
      onCreateScheduleSlot={(input: ScheduleSlotDraft) =>
        mutate(() =>
          scheduleWorkspaceRepository.createScheduleSlot(input)
        )
      }
      onUpdateScheduleSlot={(
        slotId: EntityId,
        changes: ScheduleSlotChanges
      ) =>
        mutate(() =>
          scheduleWorkspaceRepository.updateScheduleSlot(
            slotId,
            changes
          )
        )
      }
      onDeleteScheduleSlot={(slotId: EntityId) =>
        mutate(() =>
          scheduleWorkspaceRepository.deleteScheduleSlot(slotId)
        )
      }
      onCreateSchoolCalendarEvent={(
        input: SchoolCalendarEventDraft
      ) =>
        mutate(() =>
          scheduleWorkspaceRepository.createSchoolCalendarEvent(
            input
          )
        )
      }
      onUpdateSchoolCalendarEvent={(
        eventId: EntityId,
        changes: SchoolCalendarEventChanges
      ) =>
        mutate(() =>
          scheduleWorkspaceRepository.updateSchoolCalendarEvent(
            eventId,
            changes
          )
        )
      }
      onDeleteSchoolCalendarEvent={(eventId: EntityId) =>
        mutate(() =>
          scheduleWorkspaceRepository.deleteSchoolCalendarEvent(
            eventId
          )
        )
      }
    />
  )
}
