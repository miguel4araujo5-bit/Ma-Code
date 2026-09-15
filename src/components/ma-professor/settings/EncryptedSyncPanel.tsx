import {
  useCallback,
  useEffect,
  useState
} from 'react'

import {
  useMAProfessorAccess
} from '../access/AccessGate'

import {
  inspectMAProfessorCloudBackup,
  uploadAndVerifyMAProfessorCloudBackup,
  type MAProfessorCloudBackupStatus
} from '../sync/cloudBackupService'

import {
  writeMAProfessorCloudBackupTrust
} from '../sync/cloudBackupTrust'

import {
  createMAProfessorBackup
} from './backupRepository'

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
  value: string | null
) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
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
  bytes: number | null
) {
  if (
    bytes ===
      null
  ) {
    return '—'
  }

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

export function EncryptedSyncPanel() {
  const {
    session
  } =
    useMAProfessorAccess()

  const [
    status,
    setStatus
  ] =
    useState<MAProfessorCloudBackupStatus | null>(
      null
    )

  const [
    checking,
    setChecking
  ] =
    useState(true)

  const [
    busy,
    setBusy
  ] =
    useState(false)

  const [
    feedback,
    setFeedback
  ] =
    useState<Feedback | null>(
      null
    )

  const refreshStatus =
    useCallback(
      async () => {
        setChecking(
          true
        )

        try {
          const next =
            await inspectMAProfessorCloudBackup(
              session
            )

          setStatus(
            next
          )
        } catch (
          error
        ) {
          setStatus(
            null
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
          setChecking(
            false
          )
        }
      },
      [
        session
      ]
    )

  useEffect(() => {
    void refreshStatus()
  }, [
    refreshStatus
  ])

  const handleUpload =
    async () => {
      if (busy) {
        return
      }

      setBusy(
        true
      )
      setFeedback(
        null
      )

      try {
        const backup =
          await createMAProfessorBackup()

        const result =
          await uploadAndVerifyMAProfessorCloudBackup(
            session,
            backup
          )

        writeMAProfessorCloudBackupTrust(
          session,
          {
            serverRevision:
              result.serverRevision,
            recordRevision:
              result.recordRevision,
            updatedAt:
              result.updatedAt
          }
        )

        setFeedback({
          tone:
            'success',

          message:
            `Cópia cifrada guardada e verificada com sucesso. Revisão ${result.recordRevision}.`
        })

        await refreshStatus()
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

        await refreshStatus()
      } finally {
        setBusy(
          false
        )
      }
    }

  const found =
    status?.backup.found ===
      true

  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/20 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Cópia cifrada online
          </p>

          <h2 className="mt-2 text-xl font-black text-white">
            Proteção online disponível
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Os dados são cifrados neste dispositivo antes de saírem do browser. A nuvem recebe apenas conteúdo cifrado. Depois de uma alteração, o MA-Professor pode atualizar automaticamente a cópia quando este dispositivo continua alinhado com a última revisão online.
          </p>
        </div>

        <div className="shrink-0 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3">
          <p className="text-xs font-black text-emerald-200">
            Sessão protegida
          </p>

          <p className="mt-1 text-[0.68rem] text-emerald-100/70">
            Automático + manual
          </p>
        </div>
      </div>

      {checking ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <p className="text-sm font-semibold text-slate-400">
            A verificar a sua cópia online…
          </p>
        </div>
      ) : status ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Estado
            </p>

            <p className={`mt-2 text-sm font-black ${
              found
                ? 'text-emerald-300'
                : 'text-cyan-300'
            }`}>
              {found
                ? 'Cópia guardada'
                : 'Sem cópia online'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Última cópia
            </p>

            <p className="mt-2 text-sm font-black text-white">
              {formatDateTime(
                status.backup.updatedAt
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Tamanho cifrado
            </p>

            <p className="mt-2 text-sm font-black text-white">
              {formatBytes(
                status.backup.ciphertextBytes
              )}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={
            busy ||
            checking ||
            !status
          }
          onClick={() =>
            void handleUpload()
          }
          className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
        >
          {busy
            ? 'A cifrar, enviar e verificar…'
            : found
              ? 'Atualizar cópia cifrada agora'
              : 'Guardar primeira cópia cifrada agora'}
        </button>

        <button
          type="button"
          disabled={
            busy ||
            checking
          }
          onClick={() => {
            setFeedback(
              null
            )
            void refreshStatus()
          }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:border-cyan-300/30 disabled:cursor-wait disabled:opacity-60"
        >
          Atualizar estado
        </button>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Sem polling: as alterações são agrupadas no próprio browser. A cópia automática espera um curto período de estabilidade e nunca envia mais do que uma atualização automática a cada 10 minutos. Se outro dispositivo tiver atualizado a nuvem, o automático pára para não sobrescrever essa versão.
      </p>

      {feedback ? (
        <p
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone ===
            'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'
              : feedback.tone ===
                  'warning'
                ? 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200'
                : 'border-rose-300/20 bg-rose-300/[0.06] text-rose-200'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  )
}
