import Dexie from 'dexie'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useMAProfessorAccess } from '../access/AccessGate'
import { MA_PROFESSOR_OPAQUE_KEY_EVENT, readMAProfessorOpaqueExportKey } from '../access/accessStorage'
import { MA_PROFESSOR_DATABASE_NAME } from '../db'
import type { MAProfessorBackup } from '../types'
import CloudBackupPreview from './CloudBackupPreview'
import { createMAProfessorBackup } from '../settings/backupRepository'
import { uploadAndVerifyCompatibleMAProfessorCloudBackup } from './cloudBackupService'
import {
  markCloudBackupReminderShown,
  readCloudBackupPreference,
  readCloudBackupReminderTimestamp,
  useCloudBackupPreference,
  writeCloudBackupPreference
} from './cloudBackupPreference'
import {
  markMAProfessorCloudBackupDirty,
  MA_PROFESSOR_CLOUD_BACKUP_TRUST_EVENT,
  readMAProfessorCloudBackupTrust,
  writeMAProfessorCloudBackupTrust
} from './cloudBackupTrust'

const AUTO_BACKUP_DEBOUNCE_MS = 90 * 1000
const AUTO_BACKUP_MAX_DIRTY_MS = 5 * 60 * 1000
const AUTO_BACKUP_MIN_INTERVAL_MS = 10 * 60 * 1000

type Choice = 'save' | 'confirm' | 'skip' | 'disable'
type Feedback = { tone: 'success' | 'error'; message: string }

function readTimestamp(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

function isMAProfessorMutation(changedParts: unknown) {
  if (typeof changedParts !== 'object' || changedParts === null) return false
  const prefix = `idb://${MA_PROFESSOR_DATABASE_NAME}/`
  return Object.keys(changedParts).some(part => part.startsWith(prefix))
}

export default function AutomaticCloudBackup() {
  const { session } = useMAProfessorAccess()
  const preference = useCloudBackupPreference(session)
  const answer = useRef<((choice: Choice) => void) | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [preparedBackup, setPreparedBackup] = useState<MAProfessorBackup | null>(null)
  const prepared = useRef<MAProfessorBackup | null>(null)
  const confirmed = useRef(false)
  const preparationSequence = useRef(0)
  const [uploadConfirmed, setUploadConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [keyAvailable, setKeyAvailable] = useState(() => Boolean(readMAProfessorOpaqueExportKey(session.email)))

  useEffect(() => {
    const update = () => setKeyAvailable(Boolean(readMAProfessorOpaqueExportKey(session.email)))
    update()
    window.addEventListener(MA_PROFESSOR_OPAQUE_KEY_EVENT, update)
    return () => window.removeEventListener(MA_PROFESSOR_OPAQUE_KEY_EVENT, update)
  }, [session.email])

  // Observar edições também com lembretes desligados, sem rede nem temporizadores.
  useEffect(() => {
    let resetSuspended = false
    const handleTrustCleared = () => {
      if (!readMAProfessorCloudBackupTrust(session)) resetSuspended = true
    }
    const trackMutation = (changedParts: unknown) => {
      // Apagar tudo desativa os lembretes e limpa a confiança antes da transação.
      // Essa transação não é uma edição por guardar e não deve recriar a marca.
      if (resetSuspended && readCloudBackupPreference(session) !== 'enabled') return
      resetSuspended = false
      if (isMAProfessorMutation(changedParts)) markMAProfessorCloudBackupDirty(session)
    }
    Dexie.on('storagemutated', trackMutation)
    window.addEventListener(MA_PROFESSOR_CLOUD_BACKUP_TRUST_EVENT, handleTrustCleared)
    return () => {
      Dexie.on('storagemutated').unsubscribe(trackMutation)
      window.removeEventListener(MA_PROFESSOR_CLOUD_BACKUP_TRUST_EVENT, handleTrustCleared)
    }
  }, [session.email, session.deviceId])

  useEffect(() => {
    setPromptOpen(false)
    prepared.current = null
    confirmed.current = false
    setPreparedBackup(null)
    setUploadConfirmed(false)
    setBusy(false)
    setFeedback(null)
    if (preference !== 'enabled') return

    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const initialTrust = readMAProfessorCloudBackupTrust(session)
    let dirtySince: number | null = readTimestamp(initialTrust?.dirtyAt) || null
    let lastMutationAt = dirtySince === null ? null : Date.now()
    let mutationSequence = 0
    let running = false
    let reminderOpen = false
    let lastReminderAt = readCloudBackupReminderTimestamp(session)

    const canRun = () => !disposed && readCloudBackupPreference(session) === 'enabled'
    const isForeground = () => document.visibilityState !== 'hidden' && document.hasFocus()
    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
    }

    function scheduleReminder() {
      clearTimer()
      if (!canRun() || running || reminderOpen || dirtySince === null) return

      const now = Date.now()
      const trust = readMAProfessorCloudBackupTrust(session)
      const previousBackupAt = trust?.recordRevision ? readTimestamp(trust.updatedAt) : 0
      const previousReminderAt = Math.max(lastReminderAt, readCloudBackupReminderTimestamp(session))
      let dueAt = Math.min((lastMutationAt ?? now) + AUTO_BACKUP_DEBOUNCE_MS, dirtySince + AUTO_BACKUP_MAX_DIRTY_MS)
      if (previousBackupAt) dueAt = Math.max(dueAt, previousBackupAt + AUTO_BACKUP_MIN_INTERVAL_MS)
      if (previousReminderAt) dueAt = Math.max(dueAt, previousReminderAt + AUTO_BACKUP_MIN_INTERVAL_MS)
      timer = setTimeout(showReminder, Math.max(0, dueAt - now))
    }

    function showReminder() {
      timer = null
      if (!canRun() || running || reminderOpen || dirtySince === null) return
      // Uma janela em segundo plano espera por foco, sem polling nem acesso à nuvem.
      if (!isForeground() || !readMAProfessorOpaqueExportKey(session.email)) return
      // Não interromper um editor ou outra confirmação que já esteja aberta.
      if (document.querySelector('[aria-modal="true"], dialog[open]')) {
        timer = setTimeout(showReminder, AUTO_BACKUP_DEBOUNCE_MS)
        return
      }
      const elsewhere = readCloudBackupReminderTimestamp(session)
      if (elsewhere > lastReminderAt && Date.now() < elsewhere + AUTO_BACKUP_MIN_INTERVAL_MS) {
        lastReminderAt = elsewhere
        scheduleReminder()
        return
      }
      lastReminderAt = markCloudBackupReminderShown(session)
      prepared.current = null
      confirmed.current = false
      setPreparedBackup(null)
      setUploadConfirmed(false)
      reminderOpen = true
      setFeedback(null)
      setPromptOpen(true)
    }

    async function choose(choice: Choice) {
      if (!canRun() || running || !reminderOpen) return
      if (choice === 'disable' && !writeCloudBackupPreference(session, 'disabled')) {
        setFeedback({ tone: 'error', message: 'Não foi possível guardar a escolha. Tente novamente.' })
        return
      }
      if (choice === 'skip' || choice === 'disable') {
        prepared.current = null
        confirmed.current = false
        setPreparedBackup(null)
        setUploadConfirmed(false)
        lastReminderAt = markCloudBackupReminderShown(session)
        reminderOpen = false
        setPromptOpen(false)
        setFeedback(null)
        scheduleReminder()
        return
      }

      if (choice === 'confirm' && (!prepared.current || !confirmed.current)) return
      running = true
      confirmed.current = false
      setUploadConfirmed(false)
      setBusy(true)
      setFeedback(null)
      const sequenceAtStart = mutationSequence
      try {
        if (choice === 'save') {
          // Sim e Atualizar apenas preparam localmente; exigem confirmação posterior.
          prepared.current = null
          setPreparedBackup(null)
          const backup = await createMAProfessorBackup()
          if (!canRun()) return
          prepared.current = backup
          preparationSequence.current = sequenceAtStart
          setPreparedBackup(backup)
          return
        }
        const backup = prepared.current!
        const result = await uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { canUpload: canRun })
        if (!canRun()) return

        const changedDuringUpload = mutationSequence !== preparationSequence.current
        dirtySince = changedDuringUpload ? lastMutationAt ?? Date.now() : null
        if (!changedDuringUpload) lastMutationAt = null
        writeMAProfessorCloudBackupTrust(session, {
          serverRevision: result.serverRevision,
          recordRevision: result.recordRevision,
          updatedAt: result.updatedAt,
          dirtyAt: dirtySince === null ? null : new Date(dirtySince).toISOString()
        })
        lastReminderAt = markCloudBackupReminderShown(session)
        reminderOpen = false
        setPromptOpen(false)
        prepared.current = null
        setPreparedBackup(null)
        setFeedback({ tone: 'success', message: changedDuringUpload ? 'Cópia online guardada e verificada. Há alterações posteriores ao quadro por guardar.' : 'Cópia online guardada e verificada.' })
      } catch (error) {
        if (!canRun()) return
        const message = error instanceof Error ? error.message : 'Tente novamente.'
        setFeedback({ tone: 'error', message: `Não foi possível confirmar a gravação da cópia online. ${message}` })
        const trust = readMAProfessorCloudBackupTrust(session)
        if (trust) writeMAProfessorCloudBackupTrust(session, { ...trust, automaticError: message })
        // Uma nova tentativa exige outra escolha explícita de Sim.
      } finally {
        running = false
        if (canRun()) {
          setBusy(false)
          scheduleReminder()
        }
      }
    }
    answer.current = choice => { void choose(choice) }

    const handleStorageMutation = (changedParts: unknown) => {
      if (!canRun() || !isMAProfessorMutation(changedParts)) return
      const now = Date.now()
      mutationSequence += 1
      lastMutationAt = now
      if (dirtySince === null) dirtySince = now
      scheduleReminder()
    }
    const handleTrustChanged = () => {
      if (!canRun() || running) return
      const trust = readMAProfessorCloudBackupTrust(session)
      if (trust?.dirtyAt && dirtySince === null) {
        dirtySince = readTimestamp(trust.dirtyAt) || null
        lastMutationAt = dirtySince
      }
      if (trust && !trust.dirtyAt) {
        dirtySince = null
        lastMutationAt = null
        reminderOpen = false
        setPromptOpen(false)
      }
      scheduleReminder()
    }
    const handleForeground = () => {
      if (!canRun() || running) return
      if (!isForeground() && reminderOpen) {
        reminderOpen = false
        setPromptOpen(false)
      }
      if (isForeground()) scheduleReminder()
    }
    const handleOtherWindow = () => {
      if (!canRun()) {
        clearTimer()
        setPromptOpen(false)
        return
      }
      const elsewhere = readCloudBackupReminderTimestamp(session)
      if (!running && elsewhere > lastReminderAt) {
        lastReminderAt = elsewhere
        reminderOpen = false
        setPromptOpen(false)
      }
      handleTrustChanged()
    }

    Dexie.on('storagemutated', handleStorageMutation)
    window.addEventListener('focus', handleForeground)
    window.addEventListener('blur', handleForeground)
    document.addEventListener('visibilitychange', handleForeground)
    window.addEventListener('storage', handleOtherWindow)
    window.addEventListener(MA_PROFESSOR_CLOUD_BACKUP_TRUST_EVENT, handleTrustChanged)
    scheduleReminder()

    return () => {
      disposed = true
      answer.current = null
      clearTimer()
      Dexie.on('storagemutated').unsubscribe(handleStorageMutation)
      window.removeEventListener('focus', handleForeground)
      window.removeEventListener('blur', handleForeground)
      document.removeEventListener('visibilitychange', handleForeground)
      window.removeEventListener('storage', handleOtherWindow)
      window.removeEventListener(MA_PROFESSOR_CLOUD_BACKUP_TRUST_EVENT, handleTrustChanged)
    }
  }, [keyAvailable, preference, session.deviceId, session.email, session.token])

  useEffect(() => {
    if (!promptOpen) return
    const previousFocus = document.activeElement
    dialog.current?.querySelector<HTMLElement>('[data-skip], input[type=checkbox]')?.focus()
    return () => {
      if (previousFocus instanceof window.HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [promptOpen, preparedBackup])

  useEffect(() => {
    if (feedback?.tone !== 'success') return
    const timer = setTimeout(() => setFeedback(null), 5000)
    return () => clearTimeout(timer)
  }, [feedback])

  if (!promptOpen) {
    return feedback?.tone === 'success' ? (
      <p role="status" className="fixed bottom-5 left-4 right-4 z-[100] rounded-xl border border-emerald-300/30 bg-slate-900 p-4 text-sm text-emerald-100 shadow-xl sm:left-auto sm:right-5">
        {feedback.message}
      </p>
    ) : null
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-backup-reminder-title"
        aria-describedby="cloud-backup-reminder-description"
        aria-busy={busy}
        className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-violet-300/25 bg-slate-900 p-5 shadow-2xl sm:p-6"
        onKeyDown={event => {
          if (event.key === 'Escape' && !busy) {
            event.preventDefault()
            answer.current?.('skip')
          }
          if (event.key === 'Tab') {
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
            const lastButton = buttons[buttons.length - 1]
            const target = event.shiftKey ? lastButton : buttons[0]
            const boundary = event.shiftKey ? buttons[0] : lastButton
            if (document.activeElement === boundary || buttons.length === 0) {
              event.preventDefault()
              target?.focus()
            }
          }
        }}
      >
        <h2 id="cloud-backup-reminder-title" className="text-lg font-black text-white">
          Tem alterações significativas por guardar. Deseja guardar o seu progresso?
        </h2>
        <p id="cloud-backup-reminder-description" className="mt-3 text-sm leading-6 text-slate-300">
          Ao escolher Sim, poderá rever o quadro e confirmar a substituição da cópia online pelos dados deste dispositivo. Os seus dados continuam guardados neste dispositivo.
        </p>
        {busy ? <p role="status" className="mt-3 text-sm text-violet-200">A preparar ou guardar a cópia…</p> : null}
        {feedback?.tone === 'error' ? <p role="alert" className="mt-3 text-sm text-rose-200">{feedback.message}</p> : null}
        {preparedBackup ? (
          <CloudBackupPreview
            preparedBackup={preparedBackup}
            busy={busy}
            uploadConfirmed={uploadConfirmed}
            onConfirmationChange={value => {
              confirmed.current = value
              setUploadConfirmed(value)
            }}
            onConfirm={() => answer.current?.('confirm')}
            onRefresh={() => answer.current?.('save')}
            onCancel={() => answer.current?.('skip')}
          />
        ) : <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => answer.current?.('save')} className="rounded-xl bg-violet-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:opacity-60">Sim</button>
          <button type="button" data-skip disabled={busy} onClick={() => answer.current?.('skip')} className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/5 disabled:opacity-60">Não</button>
          <button type="button" disabled={busy} onClick={() => answer.current?.('disable')} className="rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:text-white disabled:opacity-60">Não voltar a perguntar</button>
        </div>}
      </div>
    </div>,
    document.body
  )
}
