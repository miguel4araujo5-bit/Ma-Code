import {
  useState
} from 'react'

import {
  useMAProfessorAccess
} from '../access/AccessGate'

import {
  previewMAProfessorOnlineRestore,
  restoreMAProfessorOnlineSnapshot,
  type MAProfessorOnlineRestorePreview
} from '../sync/onlineRestoreService'

import {
  createMAProfessorBackup,
  getBackupFileName
} from './backupRepository'

import {
  downloadTextFile
} from './csvExport'

interface OnlineRestorePanelProps {
  onDataChanged?: () => void
}

type FeedbackTone =
  | 'success'
  | 'warning'
  | 'error'

interface Feedback {
  tone:
    FeedbackTone

  message:
    string
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Data desconhecida'
  }

  return new Intl
    .DateTimeFormat(
      'pt-PT',
      {
        dateStyle:
          'medium',

        timeStyle:
          'short'
      }
    )
    .format(
      date
    )
}

function formatBytes(
  bytes: number
) {
  if (
    bytes <
      1024
  ) {
    return `${bytes} B`
  }

  if (
    bytes <
      1024 *
        1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(
      1
    )} KB`
  }

  return `${(
    bytes /
    (
      1024 *
      1024
    )
  ).toFixed(
    1
  )} MB`
}

export function OnlineRestorePanel({
  onDataChanged
}: OnlineRestorePanelProps) {
  const {
    session,
    syncStatus,
    refreshSyncStatus
  } =
    useMAProfessorAccess()

  const [
    preview,
    setPreview
  ] =
    useState<MAProfessorOnlineRestorePreview | null>(
      null
    )

  const [
    busy,
    setBusy
  ] =
    useState<
      '' |
      'preview' |
      'backup' |
      'restore'
    >('')

  const [
    backupSaved,
    setBackupSaved
  ] =
    useState(false)

  const [
    confirmation,
    setConfirmation
  ] =
    useState('')

  const [
    feedback,
    setFeedback
  ] =
    useState<Feedback | null>(
      null
    )

  const [
    restored,
    setRestored
  ] =
    useState(false)

  if (
    !syncStatus ||
    !syncStatus.profileExists ||
    syncStatus.serverRevision <
      1
  ) {
    return null
  }

  const foundPreview =
    preview?.found ===
      true
      ? preview
      : null

  const confirmationValid =
    confirmation
      .trim()
      .toUpperCase() ===
    'RESTAURAR ONLINE'

  const canRestore =
    Boolean(
      foundPreview &&
      !foundPreview.matchesLocal &&
      backupSaved &&
      confirmationValid &&
      !busy
    )

  const handlePreview =
    async () => {
      if (busy) {
        return
      }

      setBusy(
        'preview'
      )

      setFeedback(null)
      setBackupSaved(false)
      setConfirmation('')
      setRestored(false)

      try {
        const result =
          await previewMAProfessorOnlineRestore({
            token:
              session.token,

            email:
              session.email,

            deviceId:
              session.deviceId
          })

        setPreview(
          result
        )

        if (
          result.found ===
            false
        ) {
          setFeedback({
            tone:
              'warning',

            message:
              'Não foi encontrada uma cópia cifrada para recuperar.'
          })

          return
        }

        if (
          result.matchesLocal
        ) {
          setFeedback({
            tone:
              'success',

            message:
              'A cópia online corresponde exatamente aos dados deste dispositivo. Não é necessário restaurar.'
          })
        }
      } catch (
        error
      ) {
        setPreview(null)

        setFeedback({
          tone:
            'error',

          message:
            getErrorMessage(
              error
            )
        })
      } finally {
        setBusy('')
      }
    }

  const handleSafetyBackup =
    async () => {
      if (
        busy ||
        !foundPreview
      ) {
        return
      }

      setBusy(
        'backup'
      )

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

        setBackupSaved(
          true
        )

        setFeedback({
          tone:
            'success',

          message:
            'Cópia local atual descarregada. Guarde o ficheiro num local seguro antes de continuar.'
        })
      } catch (
        error
      ) {
        setBackupSaved(
          false
        )

        setFeedback({
          tone:
            'error',

          message:
            getErrorMessage(
              error
            )
        })
      } finally {
        setBusy('')
      }
    }

  const handleRestore =
    async () => {
      if (
        !foundPreview ||
        foundPreview.matchesLocal ||
        !backupSaved ||
        !confirmationValid ||
        busy
      ) {
        return
      }

      setBusy(
        'restore'
      )

      setFeedback(null)

      try {
        const result =
          await restoreMAProfessorOnlineSnapshot({
            token:
              session.token,

            email:
              session.email,

            deviceId:
              session.deviceId,

            expectedServerRevision:
              foundPreview.serverRevision,

            expectedRemoteFingerprint:
              foundPreview.remoteFingerprint,

            expectedLocalContentSignature:
              foundPreview.localContentSignature
          })

        setRestored(
          true
        )

        setConfirmation('')

        setFeedback({
          tone:
            'success',

          message:
            `Cópia online recuperada com sucesso. Foram restaurados ${result.restore.totalRecords} registos.`
        })

        onDataChanged?.()

        await refreshSyncStatus()
      } catch (
        error
      ) {
        setFeedback({
          tone:
            'error',

          message:
            getErrorMessage(
              error
            )
        })
      } finally {
        setBusy('')
      }
    }

  return (
    <section className="rounded-3xl border border-violet-300/15 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/20 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
            Recuperação online
          </p>

          <h2 className="mt-2 text-xl font-black text-white">
            Recuperar uma cópia guardada online
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Compare primeiro a cópia online com os dados deste dispositivo. Nada é substituído durante a comparação.
          </p>
        </div>

        <div className="shrink-0 rounded-2xl border border-violet-300/20 bg-violet-300/[0.06] px-4 py-3">
          <p className="text-xs font-black text-violet-200">
            Restauro protegido
          </p>

          <p className="mt-1 text-[0.68rem] text-violet-100/70">
            Confirmação obrigatória
          </p>
        </div>
      </div>

      {!preview ? (
        <button
          type="button"
          disabled={
            Boolean(
              busy
            )
          }
          onClick={() =>
            void handlePreview()
          }
          className="mt-5 rounded-2xl border border-violet-300/25 bg-violet-300/10 px-5 py-3 text-sm font-black text-violet-100 transition hover:bg-violet-300/15 disabled:cursor-wait disabled:opacity-50"
        >
          {busy ===
          'preview'
            ? 'A comparar…'
            : 'Comparar com a cópia online'}
        </button>
      ) : null}

      {preview?.found ===
      false ? (
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
          <p className="text-sm font-black text-amber-200">
            Cópia não encontrada
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            O servidor indica uma revisão da conta, mas não foi encontrado o snapshot de dados esperado.
          </p>

          <button
            type="button"
            disabled={
              Boolean(
                busy
              )
            }
            onClick={() =>
              void handlePreview()
            }
            className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
          >
            Verificar novamente
          </button>
        </div>
      ) : null}

      {foundPreview ? (
        <>
          <div
            className={`mt-5 rounded-2xl border p-4 ${
              foundPreview.matchesLocal
                ? 'border-emerald-300/20 bg-emerald-300/[0.06]'
                : 'border-amber-300/20 bg-amber-300/[0.06]'
            }`}
          >
            <p
              className={`text-xs font-black uppercase tracking-[0.16em] ${
                foundPreview.matchesLocal
                  ? 'text-emerald-300'
                  : 'text-amber-300'
              }`}
            >
              {foundPreview.matchesLocal
                ? 'Cópias iguais'
                : 'Cópias diferentes'}
            </p>

            <p className="mt-2 text-base font-black text-white">
              {foundPreview.matchesLocal
                ? 'Este dispositivo já contém os mesmos dados.'
                : 'A cópia online contém uma versão diferente dos dados.'}
            </p>

            <p className="mt-1.5 text-sm leading-6 text-slate-400">
              {foundPreview.matchesLocal
                ? 'Não é necessário substituir nada.'
                : 'Pode recuperar a versão online, mas os dados atualmente guardados neste browser serão substituídos.'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
                Neste dispositivo
              </p>

              <p className="mt-2 text-xl font-black text-white">
                {foundPreview.localRecords}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                registos · {formatBytes(
                  foundPreview.localBytes
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] p-4">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-violet-300">
                Cópia online
              </p>

              <p className="mt-2 text-xl font-black text-white">
                {foundPreview.remoteRecords}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                registos · {formatBytes(
                  foundPreview.remoteBytes
                )}
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {formatDateTime(
                  foundPreview.remoteUpdatedAt
                )}
              </p>
            </div>
          </div>

          {!foundPreview.matchesLocal ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-amber-300/20 bg-amber-300/[0.05]">
              <div className="p-4">
                <p className="text-sm font-black text-amber-100">
                  1. Guarde primeiro os dados atuais
                </p>

                <p className="mt-2 text-xs leading-5 text-amber-100/75">
                  Antes do restauro, descarregue uma cópia completa do que está atualmente neste dispositivo. Assim poderá voltar atrás caso tenha escolhido a versão errada.
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Atenção: o ficheiro descarregado contém dados escolares em formato legível. Guarde-o num local seguro.
                </p>

                <button
                  type="button"
                  disabled={
                    Boolean(
                      busy
                    ) ||
                    backupSaved
                  }
                  onClick={() =>
                    void handleSafetyBackup()
                  }
                  className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-2.5 text-xs font-black text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ===
                  'backup'
                    ? 'A preparar cópia…'
                    : backupSaved
                      ? '✓ Cópia local guardada'
                      : 'Descarregar cópia local atual'}
                </button>
              </div>

              <div className="border-t border-amber-200/10 bg-slate-950/20 p-4">
                <p className="text-sm font-black text-white">
                  2. Confirme o restauro
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Para substituir os dados deste dispositivo pela versão online, escreva:
                </p>

                <code className="mt-2 inline-block rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-black tracking-wide text-violet-200">
                  RESTAURAR ONLINE
                </code>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    value={
                      confirmation
                    }
                    onChange={
                      event =>
                        setConfirmation(
                          event.target.value
                        )
                    }
                    disabled={
                      Boolean(
                        busy
                      ) ||
                      !backupSaved
                    }
                    placeholder="Escreva RESTAURAR ONLINE"
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50 disabled:cursor-not-allowed disabled:opacity-50"
                  />

                  <button
                    type="button"
                    disabled={
                      !canRestore
                    }
                    onClick={() =>
                      void handleRestore()
                    }
                    className="rounded-xl bg-violet-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ===
                    'restore'
                      ? 'A recuperar…'
                      : 'Recuperar versão online'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={
              Boolean(
                busy
              )
            }
            onClick={() =>
              void handlePreview()
            }
            className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-black text-slate-300 transition hover:border-white/20 hover:text-white disabled:opacity-50"
          >
            Comparar novamente
          </button>
        </>
      ) : null}

      {feedback ? (
        <p
          role="status"
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.tone ===
              'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200'
              : feedback.tone ===
                  'warning'
                ? 'border-amber-300/20 bg-amber-300/[0.07] text-amber-200'
                : 'border-rose-300/20 bg-rose-300/[0.07] text-rose-200'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      {restored ? (
        <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
          <p className="text-sm font-black text-emerald-200">
            Restauro concluído
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            A base local foi substituída e verificada. Recarregue a aplicação para que todos os ecrãs utilizem os dados recuperados.
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-4 rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-200"
          >
            Recarregar MA-Professor
          </button>
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        O restauro nunca é automático. A cópia online é novamente descarregada e verificada imediatamente antes de qualquer substituição.
      </p>
    </section>
  )
}

export default OnlineRestorePanel
