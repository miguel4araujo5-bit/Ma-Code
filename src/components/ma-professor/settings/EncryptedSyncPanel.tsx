import CloudBackupPreview from '../sync/CloudBackupPreview'
import CloudBackupPreferencePanel from '../sync/CloudBackupPreferencePanel'
import CloudBackupReauthentication from '../sync/CloudBackupReauthentication'
import { createPortal } from 'react-dom'
import { ProblemReportDialog } from '../support/ProblemReportDialog'
import { useCloudBackupCooldown } from '../sync/cloudBackupCooldown'
import {
  useCloudBackupPreference
} from '../sync/cloudBackupPreference'

import {
  MA_PROFESSOR_OPAQUE_KEY_EVENT,
  readMAProfessorOpaqueExportKey
} from '../access/accessStorage'

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

import {
  useMAProfessorAccess
} from '../access/AccessGate'

import {
  inspectMAProfessorCloudBackup,
  deleteMAProfessorCloudBackup,
  MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT,
  MAProfessorCloudBackupAuthenticationRequiredError,
  uploadAndVerifyCompatibleMAProfessorCloudBackup,
  type MAProfessorCloudBackupAuthenticationRequiredDetail,
  type MAProfessorCloudBackupStatus
} from '../sync/cloudBackupService'

import {
  writeMAProfessorCloudBackupTrust,
  useMAProfessorAutomaticBackupError
} from '../sync/cloudBackupTrust'

import type {
  MAProfessorBackup
} from '../types'

import {
  createMAProfessorBackup,
  createMAProfessorLocalBackupSignature
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

  const preference =
    useCloudBackupPreference(
      session
    )

  const automaticError = useMAProfessorAutomaticBackupError(session)
  const cooldown = useCloudBackupCooldown(session.email)
  const operationRunning = useRef(false)
  const [deleteStatus, setDeleteStatus] = useState<MAProfessorCloudBackupStatus | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const deletePreviousFocus = useRef<HTMLElement | null>(null)
  const deleteOpen = Boolean(deleteStatus)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState('Falha ao guardar a cópia online V3')

  useEffect(() => {
    if (!deleteOpen) return
    return () => {
      if (deletePreviousFocus.current?.isConnected) deletePreviousFocus.current.focus()
      deletePreviousFocus.current = null
    }
  }, [deleteOpen])

  const [
    keyAvailable,
    setKeyAvailable
  ] =
    useState(
      () =>
        Boolean(
          readMAProfessorOpaqueExportKey(
            session.email
          )
        )
    )

  const [
    reauthenticationRequired,
    setReauthenticationRequired
  ] =
    useState(false)

  useEffect(() => {
    const updateKeyAvailability =
      () => {
        const available =
          Boolean(
            readMAProfessorOpaqueExportKey(
              session.email
            )
          )

        setKeyAvailable(
          available
        )

        if (available) {
          setReauthenticationRequired(
            false
          )
        }
      }

    const requireReauthentication =
      (event: Event) => {
        const detail =
          (event as CustomEvent<MAProfessorCloudBackupAuthenticationRequiredDetail>).detail

        if (
          detail.email ===
            session.email &&
          (
            detail.token ===
              undefined ||
            (
              detail.token ===
                session.token &&
              detail.deviceId ===
                session.deviceId
            )
          )
        ) {
          setReauthenticationRequired(
            true
          )
        }
      }

    updateKeyAvailability()

    window.addEventListener(
      MA_PROFESSOR_OPAQUE_KEY_EVENT,
      updateKeyAvailability
    )
    window.addEventListener(
      MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT,
      requireReauthentication
    )

    return () => {
      window.removeEventListener(
        MA_PROFESSOR_OPAQUE_KEY_EVENT,
        updateKeyAvailability
      )
      window.removeEventListener(
        MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT,
        requireReauthentication
      )
    }
  }, [
    session.deviceId,
    session.email,
    session.token
  ])

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
    preparedBackup,
    setPreparedBackup
  ] =
    useState<MAProfessorBackup | null>(
      null
    )

  const [uploadConfirmed, setUploadConfirmed] = useState(false)

  const [
    feedback,
    setFeedback
  ] =
    useState<Feedback | null>(
      null
    )

  const [
    statusError,
    setStatusError
  ] =
    useState('')

  const statusRequestId =
    useRef(0)

  const needsReauthentication =
    !keyAvailable ||
    reauthenticationRequired

  const refreshStatus =
    useCallback(
      async () => {
        const requestId =
          ++statusRequestId.current

        setChecking(true)

        try {
          const nextStatus =
            await inspectMAProfessorCloudBackup(
              session
            )

          if (
            statusRequestId.current !==
              requestId
          ) {
            return
          }

          setStatus(nextStatus)
          setStatusError('')
        } catch (error) {
          if (
            statusRequestId.current !==
              requestId
          ) {
            return
          }

          setStatus(null)

          if (
            error instanceof
              MAProfessorCloudBackupAuthenticationRequiredError
          ) {
            setStatusError('')
            return
          }

          setStatusError(
            getErrorMessage(
              error
            )
          )
        } finally {
          if (
            statusRequestId.current ===
              requestId
          ) {
            setChecking(false)
          }
        }
      },
      [session]
    )

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const handlePrepareBackup =
    async () => {
      // Apenas lê os dados locais; também é chamado logo após confirmar a password.
      if (busy || operationRunning.current) {
        return
      }

      operationRunning.current = true
      setBusy(true)
      setFeedback(null)
      setUploadConfirmed(false)

      try {
        const backup =
          await createMAProfessorBackup()

        setPreparedBackup(
          backup
        )
      } catch (error) {
        setReportType('Falha ao preparar a cópia online V3')
        setPreparedBackup(null)
        setFeedback({
          tone: 'error',
          message:
            `Não foi possível preparar a cópia. ${getErrorMessage(error)}`
        })
      } finally {
        operationRunning.current = false
        setBusy(false)
      }
    }

  const handleUpload =
    async () => {
      if (
        busy ||
        needsReauthentication ||
        cooldown || operationRunning.current ||
        !preparedBackup ||
        !uploadConfirmed
      ) {
        return
      }

      operationRunning.current = true
      setBusy(true)
      setFeedback(null)
      setUploadConfirmed(false)

      try {
        const beforeStatus =
          await inspectMAProfessorCloudBackup(
            session
          )
        const previousServerRevision =
          beforeStatus.serverRevision
        const previousRecordRevision =
          beforeStatus.backup.recordRevision ??
          0

        const result =
          await uploadAndVerifyCompatibleMAProfessorCloudBackup(
            session,
            preparedBackup,
            {
              expectedServerRevision:
                previousServerRevision
            }
          )

        if (
          result.serverRevision !==
            previousServerRevision + 1 ||
          result.recordRevision !==
            previousRecordRevision + 1
        ) {
          throw new Error(
            'O servidor não confirmou o avanço esperado da revisão.'
          )
        }

        const confirmedStatus =
          await inspectMAProfessorCloudBackup(
            session
          )

        if (
          confirmedStatus.serverRevision !==
            result.serverRevision ||
          !confirmedStatus.backup.found ||
          confirmedStatus.backup.recordRevision !==
            result.recordRevision ||
          confirmedStatus.backup.updatedAt !==
            result.updatedAt
        ) {
          throw new Error(
            'A nova revisão não pôde ser confirmada no servidor.'
          )
        }

        let changedSincePreview = true
        let pendingChangesMessage = ''
        try {
          const currentBackup = await createMAProfessorBackup()
          changedSincePreview =
            createMAProfessorLocalBackupSignature(currentBackup) !==
            createMAProfessorLocalBackupSignature(preparedBackup)
          if (changedSincePreview) {
            pendingChangesMessage = ' Há alterações posteriores ao quadro que ainda não estão nesta cópia.'
          }
        } catch {
          // A cópia remota foi verificada; se a leitura local falhar, manter alterações pendentes.
          pendingChangesMessage = ' Não foi possível verificar se existem alterações posteriores ao quadro. Os dados atuais continuam pendentes de cópia.'
        }

        writeMAProfessorCloudBackupTrust(
          session,
          {
            serverRevision:
              result.serverRevision,
            recordRevision:
              result.recordRevision,
            updatedAt:
              result.updatedAt,
            dirtyAt: changedSincePreview ? new Date().toISOString() : null
          }
        )

        setStatus(
          confirmedStatus
        )
        setStatusError('')
        setPreparedBackup(null)
        setFeedback({
          tone: 'success',
          message:
            `Cópia de segurança cifrada, enviada e confirmada no servidor como revisão ${result.recordRevision}.${pendingChangesMessage}`
        })
      } catch (error) {
        setReportType('Falha ao guardar a cópia online V3')
        if (
          error instanceof
            MAProfessorCloudBackupAuthenticationRequiredError
        ) {
          setFeedback({
            tone: 'error',
            message:
              'A nova cópia não foi guardada. Confirme novamente a sua password e volte a tentar.'
          })
          return
        }

        setFeedback({
          tone: 'error',
          message:
            `Não foi possível confirmar que a nova cópia ficou guardada. Não considere a operação concluída. ${getErrorMessage(error)}`
        })

        await refreshStatus()
      } finally {
        operationRunning.current = false
        setBusy(false)
      }
    }

  const handleDelete = async () => {
    if (busy || operationRunning.current || !deleteStatus || deleteConfirmation !== 'APAGAR') return
    operationRunning.current = true
    setBusy(true)
    setFeedback(null)
    try {
      const result = await deleteMAProfessorCloudBackup(session, deleteStatus, deleteConfirmation)
      setStatus(result)
      setDeleteStatus(null)
      setDeleteConfirmation('')
      setPreparedBackup(null)
      setUploadConfirmed(false)
      writeMAProfessorCloudBackupTrust(session, {
        serverRevision: result.serverRevision, recordRevision: null, updatedAt: null,
        dirtyAt: new Date().toISOString()
      })
      setFeedback({ tone: 'success', message: 'Cópia online eliminada. Os dados deste dispositivo e a configuração dos lembretes foram mantidos.' })
    } catch (error) {
      setReportType('Falha ao eliminar a cópia online V3')
      setFeedback({ tone: 'error', message: getErrorMessage(error) })
      setDeleteStatus(null)
      await refreshStatus()
    } finally {
      operationRunning.current = false
      setBusy(false)
    }
  }

  const found =
    status?.backup.found === true

  return (
    <section className="ma-professor-cloud-backup-panel h-full rounded-3xl border border-violet-300/20 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/20 p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
        Nuvem
      </p>

      <h3 className="mt-2 text-xl font-black text-white">
        Fazer cópia de segurança para a nuvem
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        Reveja o quadro com os dados guardados neste dispositivo. Só depois da sua confirmação é que esta cópia é cifrada e enviada para a nuvem.
      </p>

      {needsReauthentication ? (
        <div className="mt-4">
          <CloudBackupReauthentication
            forceRequired
            embedded
            onConfirmed={() => {
              setUploadConfirmed(false)
              if (!preparedBackup) void handlePrepareBackup()
              setFeedback({
                tone: 'success',
                message: 'Password confirmada. Reveja o quadro e confirme o envio da cópia preparada.'
              })
            }}
          />
        </div>
      ) : (
        <>
          {automaticError ? (
            <p role="alert" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              A última cópia online não foi concluída: {automaticError} Os dados continuam neste dispositivo. Pode voltar a tentar pelo aviso ou preparar uma cópia manual.
            </p>
          ) : null}
          {!preparedBackup ? (
            <button
              type="button"
              disabled={busy || cooldown}
              onClick={() =>
                void handlePrepareBackup()
              }
              className="mt-5 w-full rounded-2xl bg-violet-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              {busy
                ? 'A preparar cópia…'
                : 'Guardar cópia online'}
            </button>
          ) : null}

          {preparedBackup ? (
            <CloudBackupPreview
              preparedBackup={preparedBackup}
              busy={busy}
              uploadBlocked={cooldown}
              uploadConfirmed={uploadConfirmed}
              onConfirmationChange={setUploadConfirmed}
              onConfirm={() => void handleUpload()}
              onRefresh={() => void handlePrepareBackup()}
              onCancel={() => {
                setPreparedBackup(null)
                setUploadConfirmed(false)
                setFeedback(null)
              }}
            />
          ) : null}

          {cooldown ? <p role="status" className="mt-3 text-xs text-amber-100">Aguarde 30 segundos entre envios de cópias online.</p> : null}

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
              <span>
                <strong className="text-slate-200">
                  Estado:
                </strong>{' '}
                {checking
                  ? 'A verificar…'
                  : !status
                    ? 'por confirmar'
                    : found
                      ? 'cópia online disponível'
                      : 'sem cópia online'}
              </span>

              <span>
                <strong className="text-slate-200">
                  Última cópia:
                </strong>{' '}
                {checking || !status
                  ? '—'
                  : formatDateTime(
                      status.backup.updatedAt
                    )}
              </span>

              {found ? (
                <>
                  <span>
                    <strong className="text-slate-200">
                      Revisão:
                    </strong>{' '}
                    {status?.backup.recordRevision ??
                      '—'}
                  </span>
                  <span>
                    <strong className="text-slate-200">
                      Tamanho:
                    </strong>{' '}
                    {formatBytes(
                      status?.backup.ciphertextBytes ??
                        null
                    )}
                  </span>
                </>
              ) : null}
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              {preference === 'enabled'
                ? 'Os lembretes estão ativos. A cópia online só é enviada depois de rever o quadro e confirmar o envio.'
                : 'Os lembretes estão desativados neste dispositivo. A preparação acima não envia dados até confirmar o envio.'}
            </p>
            {found ? <button type="button" disabled={busy} onClick={() => {
              deletePreviousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
              setDeleteConfirmation(''); setFeedback(null); setDeleteStatus(status)
            }} className="mt-4 rounded-xl border border-rose-300/30 px-4 py-2.5 text-sm font-bold text-rose-200 disabled:opacity-50">Eliminar cópia online</button> : null}
          </div>

          {statusError ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"
            >
              {statusError}
            </p>
          ) : null}

          <div className="mt-4">
            <CloudBackupPreferencePanel />
          </div>
        </>
      )}

      {feedback ? (
        <p
          role={feedback.tone === 'success' ? 'status' : undefined}
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'
              : 'border-rose-300/20 bg-rose-300/[0.06] text-rose-200'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
      {feedback?.tone === 'error' ? <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" disabled={busy || cooldown} onClick={() => { void handlePrepareBackup() }} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white disabled:opacity-50">Tentar novamente</button>
        <button type="button" disabled={busy} onClick={() => setReportOpen(true)} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white">Enviar relatório</button>
        <button type="button" disabled={busy} onClick={() => { setFeedback(null); setPreparedBackup(null); setUploadConfirmed(false) }} className="rounded-xl px-4 py-2 text-sm text-slate-300">Ignorar</button>
      </div> : null}
      {deleteStatus ? createPortal(<div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/80 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="delete-cloud-backup-title" onKeyDown={event => {
          if (event.key === 'Escape' && !busy) {
            event.preventDefault()
            setDeleteStatus(null)
          }
          if (event.key !== 'Tab') return
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])'))
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (!first || !last) { event.preventDefault(); return }
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
        }} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-rose-300/30 bg-slate-900 p-5 text-white">
          <h2 id="delete-cloud-backup-title" className="text-lg font-black">Eliminar cópia online</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">Esta ação elimina a cópia cifrada e o respetivo histórico no servidor. Os dados deste dispositivo não são apagados. A proteção da conta e os lembretes mantêm-se.</p>
          <label className="mt-4 block text-sm">Escreva APAGAR para confirmar.
            <input autoFocus value={deleteConfirmation} disabled={busy} onChange={event => setDeleteConfirmation(event.target.value)} className="mt-2 block w-full rounded-xl border border-white/20 bg-slate-950 p-3" />
          </label>
          <div className="mt-4 flex gap-3">
            <button type="button" disabled={busy || deleteConfirmation !== 'APAGAR'} onClick={() => { void handleDelete() }} className="rounded-xl bg-rose-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? 'A eliminar…' : 'Eliminar definitivamente'}</button>
            <button type="button" disabled={busy} onClick={() => setDeleteStatus(null)} className="rounded-xl border border-white/20 px-4 py-2 text-sm">Cancelar</button>
          </div>
        </section>
      </div>, document.body) : null}
      <ProblemReportDialog open={reportOpen} errorSummary={reportType} onClose={() => setReportOpen(false)} />
    </section>
  )
}
