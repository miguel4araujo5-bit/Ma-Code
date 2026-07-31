import {
  useCallback,
  useEffect,
  useState
} from 'react'

import { AttendanceWorkspaceView } from '../attendance/AttendanceWorkspaceView'
import {
  attendanceWorkspaceRepository,
  type AttendanceWorkspaceFilters,
  type AttendanceWorkspaceSnapshot,
  type CreateWorkspaceRecoveryInput
} from '../attendance/attendanceWorkspaceRepository'
import type { EntityId } from '../types'
import type { LearningRecoveryChanges } from '../attendance/attendanceRepository'

interface AttendanceProductWorkspaceProps {
  academicYearId: EntityId
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar a assiduidade.'
}

export function AttendanceProductWorkspace({
  academicYearId
}: AttendanceProductWorkspaceProps) {
  const [snapshot, setSnapshot] =
    useState<AttendanceWorkspaceSnapshot | null>(null)
  const [filters, setFilters] =
    useState<AttendanceWorkspaceFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(
    async (nextFilters = filters) => {
      setLoading(true)
      setError('')

      try {
        const nextSnapshot =
          await attendanceWorkspaceRepository.getWorkspace(
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
      const message = getErrorMessage(mutationError)
      setError(message)
      throw mutationError
    }
  }

  const handleFiltersChange = (
    nextFilters: AttendanceWorkspaceFilters
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
                A preparar o controlo de faltas…
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-black">
                Não foi possível abrir as faltas
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
    <AttendanceWorkspaceView
      snapshot={snapshot}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onFiltersChange={handleFiltersChange}
      onCreateRecovery={(input: CreateWorkspaceRecoveryInput) =>
        mutate(() =>
          attendanceWorkspaceRepository.createRecovery(input)
        )
      }
      onUpdateRecovery={(
        recoveryId: EntityId,
        changes: LearningRecoveryChanges
      ) =>
        mutate(() =>
          attendanceWorkspaceRepository.updateRecovery(
            recoveryId,
            changes
          )
        )
      }
      onDeletePendingRecovery={(recoveryId: EntityId) =>
        mutate(() =>
          attendanceWorkspaceRepository.deletePendingRecovery(
            recoveryId
          )
        )
      }
      onSynchronizeRecoveries={(moduleId: EntityId) =>
        mutate(() =>
          attendanceWorkspaceRepository.synchronizeModuleRecoveries(
            moduleId
          )
        )
      }
    />
  )
}
