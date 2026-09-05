import {
  useEffect,
  useState
} from 'react'

import {
  MA_PROFESSOR_SNAPSHOT_CAPACITY_EVENT,
  readMAProfessorSnapshotPushCapacity,
  type MAProfessorSnapshotPushCapacity
} from './snapshotCapacityPolicy'

function formatUsage(
  value: number
) {
  return `${Math.min(
    999,
    Math.max(
      0,
      Math.round(value)
    )
  )}%`
}

export default function SnapshotCapacityNotice() {
  const [
    capacity,
    setCapacity
  ] =
    useState<MAProfessorSnapshotPushCapacity | null>(
      () =>
        readMAProfessorSnapshotPushCapacity()
    )

  useEffect(
    () => {
      const handleCapacity =
        (
          event: Event
        ) => {
          const customEvent =
            event as CustomEvent<MAProfessorSnapshotPushCapacity>

          setCapacity(
            customEvent.detail
          )
        }

      window.addEventListener(
        MA_PROFESSOR_SNAPSHOT_CAPACITY_EVENT,
        handleCapacity
      )

      return () => {
        window.removeEventListener(
          MA_PROFESSOR_SNAPSHOT_CAPACITY_EVENT,
          handleCapacity
        )
      }
    },
    []
  )

  if (
    !capacity ||
    capacity.level ===
      'normal'
  ) {
    return null
  }

  const usage =
    formatUsage(
      capacity.usagePercent
    )

  if (
    capacity.level ===
      'blocked'
  ) {
    return (
      <div className="border-b border-rose-300/20 bg-rose-950/95 px-4 py-3 text-rose-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 text-sm sm:px-2">
          <p className="font-black">
            A cópia online não foi enviada.
          </p>

          <p className="text-rose-100/80">
            O tamanho atual corresponde a cerca de {usage} do limite técnico. Os dados permanecem neste dispositivo. Exporte uma cópia local segura e contacte o suporte antes de voltar a tentar.
          </p>
        </div>
      </div>
    )
  }

  const critical =
    capacity.level ===
      'critical'

  return (
    <div
      className={`border-b px-4 py-3 ${
        critical
          ? 'border-amber-300/25 bg-amber-950/95 text-amber-100'
          : 'border-yellow-300/20 bg-yellow-950/90 text-yellow-100'
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-1 text-sm sm:px-2">
        <p className="font-black">
          {critical
            ? 'A cópia online está muito próxima do limite técnico.'
            : 'A cópia online está a aproximar-se do limite técnico.'}
        </p>

        <p className="opacity-80">
          A última preparação utilizou cerca de {usage} da capacidade disponível. A cópia foi enviada, mas recomenda-se manter também uma cópia local segura.
        </p>
      </div>
    </div>
  )
}
