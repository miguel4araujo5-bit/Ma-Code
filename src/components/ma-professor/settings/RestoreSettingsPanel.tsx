import {
  type ChangeEvent,
  useRef,
  useState
} from 'react'

import {
  useMAProfessorAccess
} from '../access/AccessGate'

import type {
  BackupValidationResult,
  MAProfessorBackup
} from '../types'

import {
  clearMAProfessorCloudBackupTrust
} from '../sync/cloudBackupTrust'

import {
  parseMAProfessorBackupFile,
  restoreMAProfessorBackup
} from './backupRepository'

import {
  OnlineRestorePanel
} from './OnlineRestorePanel'

interface RestoreSettingsPanelProps {
  onDataChanged?: () => void
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível concluir o restauro.'
}

export function RestoreSettingsPanel({
  onDataChanged
}: RestoreSettingsPanelProps) {
  const {
    session
  } =
    useMAProfessorAccess()

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  const [
    busy,
    setBusy
  ] =
    useState<'' | 'validate' | 'restore'>('')

  const [
    pendingBackup,
    setPendingBackup
  ] =
    useState<MAProfessorBackup | null>(null)

  const [
    validation,
    setValidation
  ] =
    useState<BackupValidationResult | null>(null)

  const [
    confirmation,
    setConfirmation
  ] =
    useState('')

  const [
    feedback,
    setFeedback
  ] =
    useState<{
      tone: 'success' | 'error'
      message: string
    } | null>(null)

  const handleFile =
    async (
      event: ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target.files?.[0]

      event.target.value = ''

      if (!file) {
        return
      }

      setBusy('validate')
      setPendingBackup(null)
      setValidation(null)
      setConfirmation('')
      setFeedback(null)

      try {
        const parsed =
          await parseMAProfessorBackupFile(file)

        setPendingBackup(parsed.backup)
        setValidation(parsed.validation)

        if (!parsed.validation.valid) {
          setFeedback({
            tone: 'error',
            message:
              'O ficheiro foi lido, mas contém erros que impedem o restauro.'
          })
        }
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

  const handleLocalRestore =
    async () => {
      if (
        !pendingBackup ||
        !validation?.valid ||
        busy
      ) {
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

      setBusy('restore')
      setFeedback(null)

      try {
        await restoreMAProfessorBackup(
          pendingBackup
        )

        clearMAProfessorCloudBackupTrust(
          session
        )

        setPendingBackup(null)
        setValidation(null)
        setConfirmation('')
        setFeedback({
          tone: 'success',
          message:
            'Cópia deste dispositivo restaurada com sucesso.'
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
    <div className="space-y-5">
      <OnlineRestorePanel
        onDataChanged={
          onDataChanged
        }
      />

      <section className="rounded-3xl border border-emerald-300/15 bg-slate-900/70 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
          Dispositivo
        </p>
        <h3 className="mt-2 text-xl font-black text-white">
          Restaurar cópia do seu dispositivo
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Escolha uma cópia guardada no iPhone, Mac, iCloud Drive, Downloads ou outro local acessível neste dispositivo. O ficheiro é validado antes de qualquer dado ser substituído.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={event =>
            void handleFile(event)
          }
        />

        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() =>
            fileInputRef.current?.click()
          }
          className="mt-5 w-full rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {busy === 'validate'
            ? 'A validar…'
            : 'Escolher cópia do dispositivo'}
        </button>

        {validation ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="grid gap-3 text-center sm:grid-cols-4">
              <div>
                <p className="text-2xl font-black text-white">
                  {validation.summary.academicYears}
                </p>
                <p className="text-xs text-slate-500">
                  Anos letivos
                </p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">
                  {validation.summary.students}
                </p>
                <p className="text-xs text-slate-500">
                  Alunos
                </p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">
                  {validation.summary.lessons}
                </p>
                <p className="text-xs text-slate-500">
                  Aulas
                </p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">
                  {validation.summary.assessmentResults}
                </p>
                <p className="text-xs text-slate-500">
                  Resultados
                </p>
              </div>
            </div>

            {validation.issues.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {validation.issues.map(
                  (
                    issue,
                    index
                  ) => (
                    <li
                      key={`${issue.path}-${index}`}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                        issue.severity === 'error'
                          ? 'bg-rose-400/10 text-rose-200'
                          : 'bg-amber-400/10 text-amber-200'
                      }`}
                    >
                      {issue.path}: {issue.message}
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="mt-4 text-sm font-bold text-emerald-300">
                Ficheiro válido e pronto a restaurar.
              </p>
            )}

            {validation.valid ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={confirmation}
                  onChange={event =>
                    setConfirmation(
                      event.target.value
                    )
                  }
                  placeholder="Escreva RESTAURAR"
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/50"
                />
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void handleLocalRestore()
                  }
                  className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-black text-slate-950 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy === 'restore'
                    ? 'A restaurar…'
                    : 'Restaurar esta cópia'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

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
    </div>
  )
}
