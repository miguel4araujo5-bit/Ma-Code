import {
  useState
} from 'react'

import {
  createMAProfessorBackup,
  getBackupFileName
} from './backupRepository'

import {
  downloadTextFile
} from './csvExport'

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível criar a cópia do estado atual.'
}

export function BackupLocalSafetyPanel() {
  const [
    busy,
    setBusy
  ] =
    useState(false)

  const [
    feedback,
    setFeedback
  ] =
    useState<{
      tone:
        | 'success'
        | 'error'
      message: string
    } | null>(null)

  const handleDownloadCurrentState =
    async () => {
      if (busy) {
        return
      }

      setBusy(true)
      setFeedback(null)

      try {
        const backup =
          await createMAProfessorBackup()

        downloadTextFile(
          getBackupFileName(
            backup.exportedAt
          ),
          JSON.stringify(
            backup,
            null,
            2
          ),
          'application/json;charset=utf-8'
        )

        setFeedback({
          tone: 'success',
          message:
            'Estado atual descarregado. Guarde o ficheiro num local seguro antes de avançar com um restauro.'
        })
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            getErrorMessage(error)
        })
      } finally {
        setBusy(false)
      }
    }

  return (
    <section className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
        Segurança das cópias locais
      </p>

      <h2 className="mt-2 text-xl font-black text-white">
        Antes de restaurar, preserve o estado atual
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
        Uma cópia JSON local não está cifrada e pode conter nomes de alunos, faltas, avaliações e outros dados escolares. Guarde estes ficheiros apenas num local seguro.
      </p>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Um restauro substitui os dados atualmente guardados neste browser. Pode descarregar primeiro uma cópia do estado atual para ter um ponto de retorno controlado por si.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void handleDownloadCurrentState()
        }}
        className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-wait disabled:opacity-60"
      >
        {busy
          ? 'A criar cópia…'
          : 'Descarregar estado atual antes de restaurar'}
      </button>

      {feedback ? (
        <p
          className={`mt-4 rounded-xl border px-3 py-2 text-xs font-semibold ${
            feedback.tone === 'success'
              ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
              : 'border-rose-300/20 bg-rose-300/10 text-rose-200'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  )
}
