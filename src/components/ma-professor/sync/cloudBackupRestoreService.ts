import type {
  MAProfessorAccessSession
} from '../access/accessTypes'

import {
  MA_PROFESSOR_DATABASE_NAME,
  MA_PROFESSOR_DATABASE_VERSION
} from '../db'

import {
  downloadMAProfessorCloudBackup,
  type MAProfessorDownloadedCloudBackup
} from './cloudBackupService'

import {
  createMAProfessorDatabaseSnapshot,
  type MAProfessorDatabaseSnapshot
} from './databaseSnapshotService'

import {
  createMAProfessorSnapshotContentSignature,
  restoreMAProfessorDatabaseSnapshotIfLocalUnchanged
} from './guardedSnapshotRestore'

export interface MAProfessorCloudRestorePreview
  extends MAProfessorDownloadedCloudBackup {
  localContentSignature:
    string
}

export interface MAProfessorCloudRestoreOptions {
  expectedServerRevision:
    number
  expectedRecordRevision:
    number
  expectedCiphertextHash:
    string
  expectedPlaintextHash:
    string
  expectedLocalContentSignature:
    string
}

function backupToDatabaseSnapshot(
  backup:
    MAProfessorDownloadedCloudBackup['backup']
): MAProfessorDatabaseSnapshot {
  const tables =
    backup.data as
      MAProfessorDatabaseSnapshot['tables']

  const recordCounts =
    Object.fromEntries(
      Object.entries(tables).map(
        ([tableName, records]) => [
          tableName,
          records.length
        ]
      )
    ) as
      MAProfessorDatabaseSnapshot['recordCounts']

  return {
    format:
      'ma-professor-database-snapshot',
    formatVersion:
      1,
    databaseName:
      MA_PROFESSOR_DATABASE_NAME,
    databaseVersion:
      MA_PROFESSOR_DATABASE_VERSION,
    createdAt:
      backup.exportedAt,
    tables,
    recordCounts
  }
}

export async function previewMAProfessorCloudRestore(
  session:
    MAProfessorAccessSession
): Promise<MAProfessorCloudRestorePreview | null> {
  const [
    localSnapshot,
    remote
  ] =
    await Promise.all([
      createMAProfessorDatabaseSnapshot(),
      downloadMAProfessorCloudBackup(
        session
      )
    ])

  if (!remote) {
    return null
  }

  return {
    ...remote,
    localContentSignature:
      createMAProfessorSnapshotContentSignature(
        localSnapshot
      )
  }
}

export async function restoreMAProfessorCloudRestore(
  session:
    MAProfessorAccessSession,
  options:
    MAProfessorCloudRestoreOptions
) {
  const freshRemote =
    await downloadMAProfessorCloudBackup(
      session
    )

  if (!freshRemote) {
    throw new Error(
      'A cópia online deixou de estar disponível. Os dados deste dispositivo não foram alterados.'
    )
  }

  if (
    freshRemote.serverRevision !==
      options.expectedServerRevision ||
    freshRemote.recordRevision !==
      options.expectedRecordRevision ||
    freshRemote.ciphertextHash !==
      options.expectedCiphertextHash ||
    freshRemote.plaintextHash !==
      options.expectedPlaintextHash
  ) {
    throw new Error(
      'A cópia online foi atualizada depois da sua verificação. Compare novamente antes de restaurar.'
    )
  }

  return restoreMAProfessorDatabaseSnapshotIfLocalUnchanged(
    backupToDatabaseSnapshot(
      freshRemote.backup
    ),
    options.expectedLocalContentSignature
  )
}
