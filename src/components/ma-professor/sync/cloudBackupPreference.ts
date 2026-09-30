import { useEffect, useSyncExternalStore } from 'react'

import type { MAProfessorAccessSession } from '../access/accessTypes'
import { markMAProfessorCloudBackupDirty } from './cloudBackupTrust'

type BackupIdentity = Pick<MAProfessorAccessSession, 'email' | 'deviceId'>
export type CloudBackupPreference = 'enabled' | 'disabled' | 'unset'

const STORAGE_PREFIX = 'ma-professor-cloud-backup-choice-v1'
const PREFERENCE_EVENT = 'ma-professor-cloud-backup-choice-changed'
const REMINDER_TIMESTAMP_PREFIX = 'ma-professor-cloud-backup-reminder-v1'

// O aviso público descreve a proteção atual sem expor versões internas da implementação.
export const CLOUD_BACKUP_PRIVACY_NOTICE =
  'A cópia online inclui os dados escolares guardados neste dispositivo, como nomes de alunos, faltas, avaliações e sumários. Os dados são cifrados neste dispositivo antes do envio. A MA-CODE não recebe a sua password pessoal nem guarda no servidor o material necessário para ler a cópia. O restauro é feito através da sua conta.'

function storageKey(session: BackupIdentity) {
  return [
    STORAGE_PREFIX,
    encodeURIComponent(session.email.trim().toLowerCase()),
    encodeURIComponent(session.deviceId.trim())
  ].join(':')
}

export function readCloudBackupPreference(
  session: BackupIdentity
): CloudBackupPreference {
  try {
    const value = window.localStorage.getItem(storageKey(session))
    if (value === 'reminders' || value === 'enabled') return 'enabled'
    return value === 'disabled' ? 'disabled' : 'unset'
  } catch {
    // Sem uma escolha legível, nunca autorizar envios automáticos.
    return 'unset'
  }
}

export function writeCloudBackupPreference(
  session: BackupIdentity,
  preference: Exclude<CloudBackupPreference, 'unset'>
) {
  try {
    // As janelas com a versão antiga deixam de reconhecer autorização para envio automático.
    window.localStorage.setItem(storageKey(session), preference === 'enabled' ? 'reminders' : preference)
    if (preference === 'enabled') {
      // Inclui alterações feitas enquanto os lembretes estiveram desativados.
      markMAProfessorCloudBackupDirty(session)
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT))
    return true
  } catch {
    return false
  }
}

export function readCloudBackupReminderTimestamp(session: BackupIdentity) {
  try {
    const timestamp = Number(window.localStorage.getItem(`${REMINDER_TIMESTAMP_PREFIX}:${storageKey(session)}`))
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
  } catch {
    return 0
  }
}

export function markCloudBackupReminderShown(session: BackupIdentity) {
  const timestamp = Date.now()
  try {
    window.localStorage.setItem(`${REMINDER_TIMESTAMP_PREFIX}:${storageKey(session)}`, String(timestamp))
  } catch {
    // O aviso continua a funcionar nesta janela quando o armazenamento não está disponível.
  }
  return timestamp
}

function subscribe(listener: () => void) {
  window.addEventListener(PREFERENCE_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(PREFERENCE_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

export function useCloudBackupPreference(session: BackupIdentity) {
  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey(session)) === 'enabled') {
        window.localStorage.setItem(storageKey(session), 'reminders')
        window.dispatchEvent(new Event(PREFERENCE_EVENT))
      }
    } catch {
      // Sem preferência legível, o observador permanece desativado.
    }
  }, [session.email, session.deviceId])

  return useSyncExternalStore(
    subscribe,
    () => readCloudBackupPreference(session),
    () => 'unset' as const
  )
}
