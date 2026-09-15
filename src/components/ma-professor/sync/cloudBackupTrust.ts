import type {
  MAProfessorAccessSession
} from '../access/accessTypes'

import type {
  MAProfessorBackup
} from '../types'

const STORAGE_PREFIX =
  'ma-professor-cloud-backup-trust-v1'

export const MA_PROFESSOR_CLOUD_BACKUP_TRUST_EVENT =
  'ma-professor-cloud-backup-trust-changed'

export interface MAProfessorCloudBackupTrust {
  serverRevision: number
  recordRevision: number | null
  updatedAt: string | null
  dirtyAt?: string | null
}

function getStorageKey(
  session:
    Pick<
      MAProfessorAccessSession,
      'email' | 'deviceId'
    >
) {
  return [
    STORAGE_PREFIX,
    encodeURIComponent(
      session.email
        .trim()
        .toLowerCase()
    ),
    encodeURIComponent(
      session.deviceId.trim()
    )
  ].join(':')
}

function isTrust(
  value: unknown
): value is MAProfessorCloudBackupTrust {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false
  }

  const record =
    value as Record<string, unknown>

  return (
    typeof record.serverRevision === 'number' &&
    Number.isInteger(
      record.serverRevision
    ) &&
    record.serverRevision >= 0 &&
    (
      record.recordRevision === null ||
      (
        typeof record.recordRevision === 'number' &&
        Number.isInteger(
          record.recordRevision
        ) &&
        record.recordRevision >= 1
      )
    ) &&
    (
      record.updatedAt === null ||
      typeof record.updatedAt === 'string'
    ) &&
    (
      record.dirtyAt === undefined ||
      record.dirtyAt === null ||
      typeof record.dirtyAt === 'string'
    )
  )
}

function notifyTrustChanged() {
  if (
    typeof window === 'undefined'
  ) {
    return
  }

  window.dispatchEvent(
    new Event(
      MA_PROFESSOR_CLOUD_BACKUP_TRUST_EVENT
    )
  )
}

function storeTrust(
  session:
    Pick<
      MAProfessorAccessSession,
      'email' | 'deviceId'
    >,
  trust:
    MAProfessorCloudBackupTrust,
  notify: boolean
) {
  if (
    typeof window === 'undefined'
  ) {
    return false
  }

  try {
    window.localStorage.setItem(
      getStorageKey(session),
      JSON.stringify(trust)
    )
  } catch {
    return false
  }

  if (notify) {
    notifyTrustChanged()
  }

  return true
}

export function readMAProfessorCloudBackupTrust(
  session:
    Pick<
      MAProfessorAccessSession,
      'email' | 'deviceId'
    >
): MAProfessorCloudBackupTrust | null {
  if (
    typeof window === 'undefined'
  ) {
    return null
  }

  let raw: string | null =
    null

  try {
    raw =
      window.localStorage.getItem(
        getStorageKey(session)
      )
  } catch {
    return null
  }

  if (!raw) {
    return null
  }

  try {
    const parsed =
      JSON.parse(raw) as unknown

    return isTrust(parsed)
      ? parsed
      : null
  } catch {
    return null
  }
}

export function writeMAProfessorCloudBackupTrust(
  session:
    Pick<
      MAProfessorAccessSession,
      'email' | 'deviceId'
    >,
  trust:
    MAProfessorCloudBackupTrust
) {
  storeTrust(
    session,
    {
      ...trust,
      dirtyAt:
        null
    },
    true
  )
}

export function markMAProfessorCloudBackupDirty(
  session:
    Pick<
      MAProfessorAccessSession,
      'email' | 'deviceId'
    >,
  dirtyAt =
    new Date().toISOString()
) {
  const trust =
    readMAProfessorCloudBackupTrust(
      session
    )

  if (!trust) {
    return
  }

  storeTrust(
    session,
    {
      ...trust,
      dirtyAt
    },
    false
  )
}

export function clearMAProfessorCloudBackupTrust(
  session:
    Pick<
      MAProfessorAccessSession,
      'email' | 'deviceId'
    >
) {
  if (
    typeof window === 'undefined'
  ) {
    return
  }

  try {
    window.localStorage.removeItem(
      getStorageKey(session)
    )
  } catch {
    return
  }

  notifyTrustChanged()
}

export function createMAProfessorBackupContentSignature(
  backup:
    MAProfessorBackup
) {
  return JSON.stringify({
    product:
      backup.product,
    schemaVersion:
      backup.schemaVersion,
    data:
      backup.data
  })
}
