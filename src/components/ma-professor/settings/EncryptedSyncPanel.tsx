import CloudBackupPreferencePanel from '../sync/CloudBackupPreferencePanel'
import { useCloudBackupPreference } from '../sync/cloudBackupPreference'

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
  uploadAndVerifyCompatibleMAProfessorCloudBackup,
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
  | 'error'

interface Feedback {
  tone: FeedbackTone
  message: string
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
    return 'Ainda sem cópia'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      dateStyle: 'medium',
      timeStyle: 'short'
    }
  ).format(date)
}

function formatBytes(
  bytes: number | null
) {
  if (bytes === null) {
    return '—'
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (
    bytes <
      1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`
}

export function EncryptedSyncPanel() {
  const {
    session
  } =
    useMAProfessorAccess()

  const preference = useCloudBackupPreference(session)

  const [
    status,
    setStatus
  ] =
    useState<MAProfessorCloudBackupStatus | null>(null)

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
    useState<Feedback | null>(null)

  const refreshStatus =
    useCallback(
      async () => {
        setChecking(true)

        try {
          setStatus(
            await inspectMAProfessorCloudBackup(
              session
            )
          )
        } catch (error) {
          setStatus(null)
          setFeedback({
            tone: 'error',
            message:
              getErrorMessage(error)
          })
        } finally {
          setChecking(false)
        }
      },
      [session]
    )

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const handleUpload =
    async () => {
      if (busy) {
        return
      }

      setBusy(true)
      setFeedback(null)

      try {
        const backup =
          await createMAProfessorBackup()

        const result =
          await uploadAndVerifyCompatibleMAProfessorCloudBackup(
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
          tone: 'success',
          message:
            'Cópia de segurança cifrada, enviada e verificada com sucesso.'
        })

        await refreshStatus()
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            getErrorMessage(error)
        })

        await refreshStatus()
      } finally {
        setBusy(false)
      }
    }

  const found =
    status?.backup.found === true

  return (
    <section className="h-full rounded-3xl border border-violet-300/20 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/20 p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
        Nuvem
      </p>

      <h3 className="mt-2 text-xl font-black text-white">
        Fazer cópia de segurança para a nuvem
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        Cria uma cópia dos dados atuais, cifra-a neste dispositivo e só depois a envia para a nuvem. No final, o MA-Professor confirma que a cópia ficou guardada corretamente.
      </p>

      <div className="mt-4">
        <CloudBackupPreferencePanel />
      </div>

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
        className="mt-5 w-full rounded-2xl bg-violet-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {busy
          ? 'A cifrar, enviar e verificar…'
          : 'Fazer cópia de segurança para a nuvem'}
      </button>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
          <span>
            <strong className="text-slate-200">
              Estado:
            </strong>{' '}
            {checking
              ? 'A verificar…'
              : found
                ? 'cópia online disponível'
                : 'sem cópia online'}
          </span>

          <span>
            <strong className="text-slate-200">
              Última cópia:
            </strong>{' '}
            {checking
              ? '—'
              : formatDateTime(
                  status?.backup.updatedAt ?? null
                )}
          </span>

          {found ? (
            <span>
              <strong className="text-slate-200">
                Tamanho:
              </strong>{' '}
              {formatBytes(
                status?.backup.ciphertextBytes ?? null
              )}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          {preference === 'enabled'
            ? 'A cópia automática continua ativa em segundo plano quando este dispositivo está alinhado com a última revisão online.'
            : 'A cópia automática está desativada neste dispositivo. O botão acima envia apenas uma cópia manual.'}
        </p>
      </div>

      {feedback ? (
        <p
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'
              : 'border-rose-300/20 bg-rose-300/[0.06] text-rose-200'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  )
}
