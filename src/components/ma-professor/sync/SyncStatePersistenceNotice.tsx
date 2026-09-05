import {
  useEffect,
  useState
} from 'react'

import {
  MA_PROFESSOR_SYNC_STATE_PERSISTENCE_EVENT,
  readMAProfessorSyncStatePersistenceState,
  type MAProfessorSyncStatePersistenceState
} from './syncStateStorage'

function getCompletedOperationLabel(
  state:
    MAProfessorSyncStatePersistenceState
) {
  switch (
    state.operation
  ) {
    case 'upload':
      return 'A cópia online foi concluída.'

    case 'verify':
      return 'A verificação da cópia online foi concluída.'

    case 'restore':
      return 'O restauro ou recuperação foi concluído.'

    default:
      return 'A operação foi concluída.'
  }
}

export default function SyncStatePersistenceNotice() {
  const [
    state,
    setState
  ] = useState<MAProfessorSyncStatePersistenceState>(
    () =>
      readMAProfessorSyncStatePersistenceState()
  )

  useEffect(() => {
    const update = (
      event: Event
    ) => {
      const next =
        (
          event as CustomEvent<MAProfessorSyncStatePersistenceState>
        ).detail

      if (
        next?.status === 'saved' ||
        next?.status === 'warning'
      ) {
        setState(next)
      }
    }

    setState(
      readMAProfessorSyncStatePersistenceState()
    )

    window.addEventListener(
      MA_PROFESSOR_SYNC_STATE_PERSISTENCE_EVENT,
      update
    )

    return () => {
      window.removeEventListener(
        MA_PROFESSOR_SYNC_STATE_PERSISTENCE_EVENT,
        update
      )
    }
  }, [])

  if (
    state.status !==
      'warning'
  ) {
    return null
  }

  return (
    <div className="border-b border-amber-300/20 bg-amber-300/[0.08] px-4 py-2 text-amber-50">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-5">
          <strong>
            {getCompletedOperationLabel(
              state
            )}
          </strong>{' '}
          Este dispositivo não conseguiu guardar a confirmação técnica no browser. Os dados não serão repetidos automaticamente. Atualize o estado antes da próxima sincronização.
        </p>

        <button
          type="button"
          onClick={() =>
            window.location.reload()
          }
          className="shrink-0 rounded-lg border border-amber-200/30 bg-amber-200/10 px-3 py-1.5 font-black text-amber-50 transition hover:bg-amber-200/15"
        >
          Atualizar estado
        </button>
      </div>
    </div>
  )
}
