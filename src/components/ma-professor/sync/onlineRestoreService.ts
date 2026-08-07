import {
  createMAProfessorDatabaseSnapshot,
  downloadEncryptedMAProfessorDatabaseSnapshot,
  restoreMAProfessorDatabaseSnapshot,
  type MAProfessorRestoreSnapshotResult
} from './databaseSnapshotService'

import {
  countMAProfessorSnapshotRecords,
  createMAProfessorSnapshotFingerprint,
  getMAProfessorSnapshotBytes
} from './snapshotFingerprint'

import {
  saveMAProfessorManualSyncState
} from './syncStateStorage'

export interface MAProfessorOnlineRestoreOptions {
  token: string
  email: string
  deviceId: string
}

export interface MAProfessorOnlineRestorePreviewNotFound {
  found: false
  serverRevision: number
}

export interface MAProfessorOnlineRestorePreviewFound {
  found: true

  matchesLocal: boolean

  localFingerprint:
    string

  remoteFingerprint:
    string

  localRecords:
    number

  remoteRecords:
    number

  localBytes:
    number

  remoteBytes:
    number

  serverRevision:
    number

  recordRevision:
    number

  remoteCreatedAt:
    string

  remoteUpdatedAt:
    string
}

export type MAProfessorOnlineRestorePreview =
  | MAProfessorOnlineRestorePreviewNotFound
  | MAProfessorOnlineRestorePreviewFound

export interface MAProfessorRestoreOnlineOptions
  extends MAProfessorOnlineRestoreOptions {
  expectedServerRevision:
    number

  expectedRemoteFingerprint:
    string
}

export interface MAProfessorOnlineRestoreResult {
  restore:
    MAProfessorRestoreSnapshotResult

  serverRevision:
    number

  fingerprint:
    string

  restoredAt:
    string

  remoteUpdatedAt:
    string
}

export class MAProfessorOnlineRestoreSafetyError
  extends Error {
  constructor(
    message: string
  ) {
    super(message)

    this.name =
      'MAProfessorOnlineRestoreSafetyError'
  }
}

function assertRevision(
  value: number
) {
  if (
    !Number.isInteger(
      value
    ) ||
    value < 1
  ) {
    throw new MAProfessorOnlineRestoreSafetyError(
      'A versão da cópia online não é válida.'
    )
  }
}

function assertFingerprint(
  value: string
) {
  const normalized =
    value.trim()

  if (!normalized) {
    throw new MAProfessorOnlineRestoreSafetyError(
      'A verificação da cópia online não é válida.'
    )
  }

  return normalized
}

export async function previewMAProfessorOnlineRestore(
  options:
    MAProfessorOnlineRestoreOptions
): Promise<MAProfessorOnlineRestorePreview> {
  const [
    localSnapshot,
    downloaded
  ] =
    await Promise.all([
      createMAProfessorDatabaseSnapshot(),

      downloadEncryptedMAProfessorDatabaseSnapshot({
        token:
          options.token,

        email:
          options.email,

        deviceId:
          options.deviceId
      })
    ])

  if (
    downloaded.found ===
      false
  ) {
    return {
      found:
        false,

      serverRevision:
        downloaded.serverRevision
    }
  }

  const [
    localFingerprint,
    remoteFingerprint
  ] =
    await Promise.all([
      createMAProfessorSnapshotFingerprint(
        localSnapshot
      ),

      createMAProfessorSnapshotFingerprint(
        downloaded.snapshot
      )
    ])

  return {
    found:
      true,

    matchesLocal:
      localFingerprint ===
      remoteFingerprint,

    localFingerprint,

    remoteFingerprint,

    localRecords:
      countMAProfessorSnapshotRecords(
        localSnapshot
      ),

    remoteRecords:
      countMAProfessorSnapshotRecords(
        downloaded.snapshot
      ),

    localBytes:
      getMAProfessorSnapshotBytes(
        localSnapshot
      ),

    remoteBytes:
      getMAProfessorSnapshotBytes(
        downloaded.snapshot
      ),

    serverRevision:
      downloaded.remote
        .serverRevision,

    recordRevision:
      downloaded.remote
        .recordRevision,

    remoteCreatedAt:
      downloaded.remote
        .createdAt,

    remoteUpdatedAt:
      downloaded.remote
        .updatedAt
  }
}

export async function restoreMAProfessorOnlineSnapshot(
  options:
    MAProfessorRestoreOnlineOptions
): Promise<MAProfessorOnlineRestoreResult> {
  assertRevision(
    options.expectedServerRevision
  )

  const expectedFingerprint =
    assertFingerprint(
      options.expectedRemoteFingerprint
    )

  /*
   * Voltamos obrigatoriamente a descarregar a cópia imediatamente
   * antes do restauro.
   *
   * Não reutilizamos o objeto obtido no preview porque outro
   * dispositivo pode ter criado uma versão nova entretanto.
   */
  const downloaded =
    await downloadEncryptedMAProfessorDatabaseSnapshot({
      token:
        options.token,

      email:
        options.email,

      deviceId:
        options.deviceId
    })

  if (
    downloaded.found ===
      false
  ) {
    throw new MAProfessorOnlineRestoreSafetyError(
      'A cópia online deixou de estar disponível. Os dados deste dispositivo não foram alterados.'
    )
  }

  if (
    downloaded.remote
      .serverRevision !==
      options.expectedServerRevision
  ) {
    throw new MAProfessorOnlineRestoreSafetyError(
      'A cópia online foi atualizada depois da sua verificação. Por segurança, os dados deste dispositivo não foram substituídos. Compare novamente antes de restaurar.'
    )
  }

  const remoteFingerprint =
    await createMAProfessorSnapshotFingerprint(
      downloaded.snapshot
    )

  if (
    remoteFingerprint !==
      expectedFingerprint
  ) {
    throw new MAProfessorOnlineRestoreSafetyError(
      'O conteúdo da cópia online mudou depois da sua verificação. Os dados deste dispositivo não foram alterados.'
    )
  }

  /*
   * databaseSnapshotService valida integralmente o snapshot antes
   * de iniciar o restauro e substitui as tabelas dentro de uma única
   * transação IndexedDB.
   */
  const restore =
    await restoreMAProfessorDatabaseSnapshot(
      downloaded.snapshot
    )

  /*
   * Depois do commit local, fazemos uma leitura independente da base
   * para confirmar que o conteúdo restaurado corresponde ao snapshot
   * que acabou de ser desencriptado.
   */
  const verifiedSnapshot =
    await createMAProfessorDatabaseSnapshot()

  const verifiedFingerprint =
    await createMAProfessorSnapshotFingerprint(
      verifiedSnapshot
    )

  if (
    verifiedFingerprint !==
      remoteFingerprint
  ) {
    throw new Error(
      'Os dados foram restaurados, mas a verificação final não corresponde à cópia online. Não faça novas alterações até recarregar a aplicação e verificar os dados.'
    )
  }

  const restoredAt =
    new Date()
      .toISOString()

  saveMAProfessorManualSyncState(
    options.email,
    options.deviceId,
    {
      serverRevision:
        downloaded.remote
          .serverRevision,

      fingerprint:
        remoteFingerprint,

      syncedAt:
        downloaded.remote
          .updatedAt,

      verifiedAt:
        restoredAt,

      lastOperation:
        'restore'
    }
  )

  return {
    restore,

    serverRevision:
      downloaded.remote
        .serverRevision,

    fingerprint:
      remoteFingerprint,

    restoredAt,

    remoteUpdatedAt:
      downloaded.remote
        .updatedAt
  }
}
