import type {
  MAProfessorAccessSession
} from '../access/accessTypes'

import {
  MA_PROFESSOR_DATABASE_NAME,
  MA_PROFESSOR_DATABASE_VERSION
} from '../db'

import {
  downloadMAProfessorCloudBackupV3,
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

function sortSnapshotRecordsById(
  records:
    Array<{
      id: string
    }>
) {
  return [
    ...records
  ].sort(
    (
      left,
      right
    ) =>
      left.id.localeCompare(
        right.id
      )
  )
}

function backupToDatabaseSnapshot(
  backup:
    MAProfessorDownloadedCloudBackup['backup']
): MAProfessorDatabaseSnapshot {
  /*
   * createMAProfessorDatabaseSnapshot() normaliza cada tabela por id.
   * A cópia JSON não garante a mesma ordem física dos registos, por isso
   * normalizamos também o lado remoto antes do restauro/verificação.
   * Sem isto, dois conjuntos de dados iguais podiam falhar apenas porque
   * vinham numa ordem diferente.
   */
  const tables =
    Object.fromEntries(
      Object.entries(
        { ...backup.data, paaActivities: backup.data.paaActivities ?? [] }
      ).map(
        ([
          tableName,
          records
        ]) => [
          tableName,
          sortSnapshotRecordsById(
            records as Array<{
              id: string
            }>
          )
        ]
      )
    ) as unknown as
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
      downloadMAProfessorCloudBackupV3(
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
    await downloadMAProfessorCloudBackupV3(
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
