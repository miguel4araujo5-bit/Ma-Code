import { useSyncExternalStore } from 'react'

import type { MAProfessorAccessSession } from '../access/accessTypes'
import { markMAProfessorCloudBackupDirty } from './cloudBackupTrust'

type BackupIdentity = Pick<MAProfessorAccessSession, 'email' | 'deviceId'>
export type CloudBackupPreference = 'enabled' | 'disabled' | 'unset'

const STORAGE_PREFIX = 'ma-professor-cloud-backup-choice-v1'
const PREFERENCE_EVENT = 'ma-professor-cloud-backup-choice-changed'

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
    return value === 'enabled' || value === 'disabled' ? value : 'unset'
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
    window.localStorage.setItem(storageKey(session), preference)
    if (preference === 'enabled') {
      // Inclui alterações feitas enquanto a cópia automática esteve desativada.
      markMAProfessorCloudBackupDirty(session)
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT))
    return true
  } catch {
    return false
  }
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
  return useSyncExternalStore(
    subscribe,
    () => readCloudBackupPreference(session),
    () => 'unset' as const
  )
}
