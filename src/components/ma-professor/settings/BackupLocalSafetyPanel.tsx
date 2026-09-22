import {
  useEffect,
  useState
} from 'react'

import {
  getMAProfessorStorageStatus,
  requestPersistentMAProfessorStorage,
  type MAProfessorStorageStatus
} from '../db'

function formatStorageAmount(
  value: number
) {
  if (value < 1024) {
    return `${value} B`
  }

  const kilobytes =
    value / 1024

  if (kilobytes < 1024) {
    return `${new Intl.NumberFormat(
      'pt-PT',
      {
        maximumFractionDigits: 1
      }
    ).format(kilobytes)} KB`
  }

  const megabytes =
    kilobytes / 1024

  if (megabytes < 1024) {
    return `${new Intl.NumberFormat(
      'pt-PT',
      {
        maximumFractionDigits: 1
      }
    ).format(megabytes)} MB`
  }

  return `${new Intl.NumberFormat(
    'pt-PT',
    {
      maximumFractionDigits: 2
    }
  ).format(
    megabytes / 1024
  )} GB`
}

export function BackupLocalSafetyPanel() {
  const [
    storageStatus,
    setStorageStatus
  ] =
    useState<MAProfessorStorageStatus | null>(
      null
    )

  useEffect(() => {
    let active = true

    void (async () => {
      await requestPersistentMAProfessorStorage({
        forceRetry: true
      })

      const nextStatus =
        await getMAProfessorStorageStatus()

      if (active) {
        setStorageStatus(
          nextStatus
        )
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const storageUsageLabel =
    storageStatus?.usage !== null &&
    storageStatus?.usage !== undefined &&
    storageStatus.quota !== null
      ? `${formatStorageAmount(
          storageStatus.usage
        )} de ${formatStorageAmount(
          storageStatus.quota
        )}`
      : null

  return (
    <section className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
        Proteja o trabalho
      </p>

      <h2 className="mt-2 text-xl font-black text-white">
        Em janela privada, guarde uma cópia antes de fechar
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100">
        Em navegação privada ou anónima, o browser pode eliminar os dados locais quando a janela ou a sessão privada termina. Para não perder o trabalho, use a opção de cópia local ou a cópia cifrada online disponíveis abaixo.
      </p>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
        Uma cópia JSON local não está cifrada e pode conter nomes de alunos, faltas, avaliações e outros dados escolares. Guarde estes ficheiros apenas num local seguro.
      </p>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Um restauro substitui os dados atualmente guardados neste browser. Antes de restaurar, pode criar uma cópia do estado atual na opção de cópia local abaixo.
      </p>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">
          Proteção do armazenamento local
        </p>

        {storageStatus === null ? (
          <p className="mt-2 text-sm leading-6 text-slate-400">
            A verificar se o browser protege o armazenamento local contra remoção automática.
          </p>
        ) : storageStatus.persisted === true ? (
          <p className="mt-2 text-sm leading-6 text-emerald-200">
            Armazenamento persistente ativo. O browser marcou os dados locais deste site para não serem removidos automaticamente por pressão de espaço.
          </p>
        ) : storageStatus.persisted === false ? (
          <p className="mt-2 text-sm leading-6 text-amber-100">
            O browser não concedeu armazenamento persistente. Os dados locais podem continuar sujeitos a remoção automática em situações de pressão de espaço; mantenha cópias JSON regulares num local seguro.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Este browser não permite confirmar se o armazenamento local está marcado como persistente. Mantenha cópias JSON regulares num local seguro.
          </p>
        )}

        {storageUsageLabel ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Armazenamento estimado deste site: {storageUsageLabel}. Os valores são aproximados e incluem o armazenamento da origem, não apenas o MA-Professor.
          </p>
        ) : null}
      </div>
    </section>
  )
}
