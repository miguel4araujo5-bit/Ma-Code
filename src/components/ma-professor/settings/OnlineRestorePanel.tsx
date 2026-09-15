import {
  useState
} from 'react'

import {
  useMAProfessorAccess
} from '../access/AccessGate'

import {
  previewMAProfessorCloudRestore,
  restoreMAProfessorCloudRestore,
  type MAProfessorCloudRestorePreview
} from '../sync/cloudBackupRestoreService'

import {
  writeMAProfessorCloudBackupTrust
} from '../sync/cloudBackupTrust'

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
  value: string
) {
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

export function OnlineRestorePanel({
  onDataChanged
}: OnlineRestorePanelProps) {
  const {
    session
  } =
    useMAProfessorAccess()

  const [
    preview,
    setPreview
  ] =
    useState<MAProfessorCloudRestorePreview | null>(
      null
    )
  const [
    busy,
    setBusy
  ] =
    useState<'' | 'preview' | 'restore'>('')
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

  const handlePreview =
    async () => {
      if (busy) {
        return
      }

      setBusy('preview')
      setFeedback(null)
      setPreview(null)
      setConfirmation('')

      try {
        const foundPreview =
          await previewMAProfessorCloudRestore(
            session
          )

        if (!foundPreview) {
          setFeedback({
            tone: 'warning',
            message:
              'Ainda não existe uma cópia cifrada online para esta conta.'
          })
          return
        }

        setPreview(
          foundPreview
        )
        setFeedback({
          tone: 'success',
          message:
            'A cópia foi descarregada, decifrada neste dispositivo e validada. Nada foi restaurado ainda.'
        })
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            getErrorMessage(error)
        })
      } finally {
        setBusy('')
      }
    }

  const handleRestore =
    async () => {
      if (!preview || busy) {
        return
      }

      if (
        confirmation
          .trim()
          .toUpperCase() !==
        'RESTAURAR'
      ) {
        setFeedback({
          tone: 'error',
          message:
            'Escreva RESTAURAR para confirmar.'
        })
        return
      }

      const foundPreview =
        preview

      setBusy('restore')
      setFeedback(null)

      try {
        const safetyBackup =
          await createMAProfessorBackup()

        downloadTextFile(
          getBackupFileName(
            safetyBackup.exportedAt
          ).replace(
            '.json',
            '-antes-restauro.json'
          ),
          JSON.stringify(
            safetyBackup,
            null,
            2
          ),
          'application/json;charset=utf-8'
        )

        await restoreMAProfessorCloudRestore(
          session,
          {
            expectedServerRevision:
              foundPreview.serverRevision,
            expectedRecordRevision:
              foundPreview.recordRevision,
            expectedCiphertextHash:
              foundPreview.ciphertextHash,
            expectedPlaintextHash:
              foundPreview.plaintextHash,
            expectedLocalContentSignature:
              foundPreview.localContentSignature
          }
        )

        writeMAProfessorCloudBackupTrust(
          session,
          {
            serverRevision:
              foundPreview.serverRevision,
            recordRevision:
              foundPreview.recordRevision,
            updatedAt:
              foundPreview.updatedAt
          }
        )

        setPreview(null)
        setConfirmation('')
        setFeedback({
          tone: 'success',
          message:
            'Cópia online restaurada. Foi também descarregada uma cópia local de segurança dos dados que existiam antes do restauro. Este dispositivo ficou alinhado para futuras cópias automáticas.'
        })
        onDataChanged?.()
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            getErrorMessage(error)
        })
      } finally {
        setBusy('')
      }
    }

  return (
    <section className="rounded-3xl border border-violet-300/15 bg-slate-900/70 p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
        Restauro da nuvem
      </p>
      <h2 className="mt-2 text-xl font-black text-white">
        Decifrar e restaurar a sua cópia
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        A cópia só é decifrada neste dispositivo depois de a sessão da sua conta MA-Professor ser validada. Pode inspecioná-la antes de substituir qualquer dado local.
      </p>

      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() =>
          void handlePreview()
        }
        className="mt-5 rounded-2xl border border-violet-300/30 bg-violet-300/10 px-5 py-3 text-sm font-black text-violet-100 transition hover:bg-violet-300/15 disabled:cursor-wait disabled:opacity-60"
      >
        {busy === 'preview'
          ? 'A decifrar e validar…'
          : 'Decifrar e preparar restauro'}
      </button>

      {preview ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/65 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">
                Cópia pronta a restaurar
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Guardada em {formatDateTime(
                  preview.updatedAt
                )} · revisão {preview.recordRevision}
              </p>
            </div>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-200">
              Validada
            </span>
          </div>

          <div className="mt-4 grid gap-3 text-center sm:grid-cols-4">
            <div className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-xl font-black text-white">
                {preview.validation.summary.academicYears}
              </p>
              <p className="text-[0.68rem] text-slate-500">
                Anos letivos
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-xl font-black text-white">
                {preview.validation.summary.students}
              </p>
              <p className="text-[0.68rem] text-slate-500">
                Alunos
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-xl font-black text-white">
                {preview.validation.summary.lessons}
              </p>
              <p className="text-[0.68rem] text-slate-500">
                Aulas
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-xl font-black text-white">
                {preview.validation.summary.assessmentResults}
              </p>
              <p className="text-[0.68rem] text-slate-500">
                Resultados
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-amber-200/85">
            Antes do restauro será descarregada automaticamente uma cópia JSON dos dados que estão agora neste dispositivo.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={confirmation}
              onChange={event =>
                setConfirmation(
                  event.target.value
                )
              }
              placeholder="Escreva RESTAURAR"
              className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300/50"
            />
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                void handleRestore()
              }
              className="rounded-xl bg-violet-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-60"
            >
              {busy === 'restore'
                ? 'A restaurar…'
                : 'Restaurar cópia'}
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'
              : feedback.tone === 'warning'
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
