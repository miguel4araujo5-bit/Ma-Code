import { useSyncExternalStore } from 'react'

import type { MAProfessorAccessSession } from '../access/accessTypes'
import { markMAProfessorCloudBackupDirty } from './cloudBackupTrust'

type BackupIdentity = Pick<MAProfessorAccessSession, 'email' | 'deviceId'>
export type CloudBackupPreference = 'enabled' | 'disabled' | 'unset'

const STORAGE_PREFIX = 'ma-professor-cloud-backup-choice-v1'
const PREFERENCE_EVENT = 'ma-professor-cloud-backup-choice-changed'

// O aviso público distingue a proteção v3 da compatibilidade v2; qualquer alteração deve preservar essa diferença.
export const CLOUD_BACKUP_PRIVACY_NOTICE =
  'A cópia online inclui os dados escolares guardados neste dispositivo, como nomes de alunos, faltas, avaliações e sumários. É cifrada neste dispositivo antes do envio. Nas cópias com proteção v3, a MA-CODE não recebe a sua password pessoal nem guarda no servidor o material necessário para decifrar os dados. Nas cópias antigas com proteção v2, os servidores da MA-CODE conservam material técnico que permite decifrá-las, até serem migradas para v3. A primeira cópia de uma conta nova utiliza diretamente a proteção v3. O restauro é feito através da sua conta.'

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
