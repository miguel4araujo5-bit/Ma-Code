import {
  createMAProfessorDatabaseSnapshot,
  downloadEncryptedMAProfessorDatabaseSnapshot,
  uploadEncryptedMAProfessorDatabaseSnapshot,
  type MAProfessorDatabaseSnapshot
} from './databaseSnapshotService'

import {
  countMAProfessorSnapshotRecords,
  createMAProfessorSnapshotFingerprint,
  getMAProfessorSnapshotBytes
} from './snapshotFingerprint'

import {
  readMAProfessorManualSyncState,
  saveMAProfessorManualSyncState
} from './syncStateStorage'

export type MAProfessorManualSyncStatus =
  | 'not-synced'
  | 'synced'
  | 'local-changes'
  | 'remote-newer'
  | 'remote-unverified'
  | 'status-outdated'

export interface MAProfessorManualSyncOverview {
  status:
    MAProfessorManualSyncStatus

  serverRevision:
    number

  serverUpdatedAt:
    string | null

  localFingerprint:
    string

  localRecords:
    number

  localBytes:
    number

  lastSyncedAt:
    string | null

  lastVerifiedAt:
    string | null
}

export interface MAProfessorManualSyncOptions {
  token: string
  email: string
  deviceId: string
  serverRevision: number
  serverUpdatedAt?: string | null
}

export interface MAProfessorManualSyncVerificationFound {
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

  remoteServerRevision:
    number

  remoteUpdatedAt:
    string
}

export interface MAProfessorManualSyncVerificationNotFound {
  found: false

  localFingerprint:
    string

  localRecords:
    number

  remoteServerRevision:
    number
}

export type MAProfessorManualSyncVerification =
  | MAProfessorManualSyncVerificationFound
  | MAProfessorManualSyncVerificationNotFound

export class MAProfessorManualSyncSafetyError
  extends Error {
  constructor(
    message: string
  ) {
    super(message)

    this.name =
      'MAProfessorManualSyncSafetyError'
  }
}

function assertServerRevision(
  value: number
) {
  if (
    !Number.isInteger(
      value
    ) ||
    value < 0
  ) {
    throw new Error(
      'A revisão da cópia online não é válida.'
    )
  }
}

function createOverview(
  snapshot:
    MAProfessorDatabaseSnapshot,
  fingerprint: string,
  email: string,
  deviceId: string,
  serverRevision: number,
  serverUpdatedAt:
    string | null
): MAProfessorManualSyncOverview {
  const localState =
    readMAProfessorManualSyncState(
      email,
      deviceId
    )

  let status:
    MAProfessorManualSyncStatus

  if (
    serverRevision === 0
  ) {
    status =
      'not-synced'
  } else if (
    !localState
  ) {
    status =
      'remote-unverified'
  } else if (
    serverRevision >
    localState.serverRevision
  ) {
    status =
      'remote-newer'
  } else if (
    serverRevision <
    localState.serverRevision
  ) {
    status =
      'status-outdated'
  } else if (
    fingerprint ===
    localState.fingerprint
  ) {
    status =
      'synced'
  } else {
    status =
      'local-changes'
  }

  return {
    status,

    serverRevision,

    serverUpdatedAt,

    localFingerprint:
      fingerprint,

    localRecords:
      countMAProfessorSnapshotRecords(
        snapshot
      ),

    localBytes:
      getMAProfessorSnapshotBytes(
        snapshot
      ),

    lastSyncedAt:
      localState
        ?.syncedAt ??
      null,

    lastVerifiedAt:
      localState
        ?.verifiedAt ??
      null
  }
}

export async function inspectMAProfessorManualSync(
  options: {
    email: string
    deviceId: string
    serverRevision: number
    serverUpdatedAt?: string | null
  }
): Promise<MAProfessorManualSyncOverview> {
  assertServerRevision(
    options.serverRevision
  )

  const snapshot =
    await createMAProfessorDatabaseSnapshot()

  const fingerprint =
    await createMAProfessorSnapshotFingerprint(
      snapshot
    )

  return createOverview(
    snapshot,
    fingerprint,
    options.email,
    options.deviceId,
    options.serverRevision,
    options.serverUpdatedAt ??
      null
  )
}

export async function uploadAndVerifyMAProfessorManualSync(
  options:
    MAProfessorManualSyncOptions
) {
  assertServerRevision(
    options.serverRevision
  )

  const previousState =
    readMAProfessorManualSyncState(
      options.email,
      options.deviceId
    )

  /*
   * Se este dispositivo nunca confirmou a versão que já existe no
   * servidor, não permitimos que a substitua silenciosamente.
   */
  if (
    options.serverRevision >
      0 &&
    (
      !previousState ||
      previousState.serverRevision !==
        options.serverRevision
    )
  ) {
    throw new MAProfessorManualSyncSafetyError(
      'Existe uma cópia online que este dispositivo ainda não confirmou. Verifique primeiro a cópia antes de substituir qualquer conteúdo.'
    )
  }

  /*
   * uploadEncryptedMAProfessorDatabaseSnapshot devolve exatamente
   * o snapshot que foi cifrado e enviado.
   *
   * A impressão digital deve ser calculada sobre esse snapshot e
   * não sobre uma leitura anterior da base, porque os dados podem
   * mudar enquanto o envio está em curso.
   */
  const upload =
    await uploadEncryptedMAProfessorDatabaseSnapshot({
      token:
        options.token,

      email:
        options.email,

      deviceId:
        options.deviceId,

      expectedServerRevision:
        options.serverRevision
    })

  const uploadedFingerprint =
    await createMAProfessorSnapshotFingerprint(
      upload.snapshot
    )

  const verifiedAt =
    new Date()
      .toISOString()

  saveMAProfessorManualSyncState(
    options.email,
    options.deviceId,
    {
      serverRevision:
        upload.remote
          .serverRevision,

      fingerprint:
        uploadedFingerprint,

      syncedAt:
        upload.remote
          .updatedAt,

      verifiedAt,

      lastOperation:
        'upload'
    }
  )

  /*
   * Voltamos a consultar a base local depois da confirmação.
   *
   * Se o professor tiver alterado alguma coisa enquanto o upload
   * decorria, o estado deve passar imediatamente a "alterações por
   * guardar" em vez de apresentar uma falsa indicação de sincronizado.
   */
  const currentSnapshot =
    await createMAProfessorDatabaseSnapshot()

  const currentFingerprint =
    await createMAProfessorSnapshotFingerprint(
      currentSnapshot
    )

  return {
    upload,

    overview:
      createOverview(
        currentSnapshot,
        currentFingerprint,
        options.email,
        options.deviceId,
        upload.remote
          .serverRevision,
        upload.remote
          .updatedAt
      )
  }
}

export async function verifyMAProfessorManualSync(
  options:
    MAProfessorManualSyncOptions
): Promise<MAProfessorManualSyncVerification> {
  assertServerRevision(
    options.serverRevision
  )

  const localSnapshot =
    await createMAProfessorDatabaseSnapshot()

  const localFingerprint =
    await createMAProfessorSnapshotFingerprint(
      localSnapshot
    )

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
    return {
      found:
        false,

      localFingerprint,

      localRecords:
        countMAProfessorSnapshotRecords(
          localSnapshot
        ),

      remoteServerRevision:
        downloaded
          .serverRevision
    }
  }

  const remoteFingerprint =
    await createMAProfessorSnapshotFingerprint(
      downloaded.snapshot
    )

  const matchesLocal =
    remoteFingerprint ===
      localFingerprint

  const verifiedAt =
    new Date()
      .toISOString()

  if (matchesLocal) {
    saveMAProfessorManualSyncState(
      options.email,
      options.deviceId,
      {
        serverRevision:
          downloaded.remote
            .serverRevision,

        fingerprint:
          localFingerprint,

        syncedAt:
          downloaded.remote
            .updatedAt,

        verifiedAt,

        lastOperation:
          'verify'
      }
    )
  }

  return {
    found:
      true,

    matchesLocal,

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

    remoteServerRevision:
      downloaded.remote
        .serverRevision,

    remoteUpdatedAt:
      downloaded.remote
        .updatedAt
  }
}
