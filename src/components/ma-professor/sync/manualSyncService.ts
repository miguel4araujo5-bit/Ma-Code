import {
  createMAProfessorDatabaseSnapshot,
  downloadEncryptedMAProfessorDatabaseSnapshot,
  uploadEncryptedMAProfessorDatabaseSnapshot,
  type MAProfessorDatabaseSnapshot
} from './databaseSnapshotService'

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

function toArrayBuffer(
  value: Uint8Array
): ArrayBuffer {
  const copy =
    new Uint8Array(
      value.byteLength
    )

  copy.set(
    value
  )

  return copy.buffer
}

function bytesToBase64Url(
  bytes: Uint8Array
) {
  let binary = ''

  const chunkSize =
    0x8000

  for (
    let offset = 0;
    offset <
      bytes.length;
    offset +=
      chunkSize
  ) {
    const chunk =
      bytes.subarray(
        offset,
        Math.min(
          offset +
            chunkSize,
          bytes.length
        )
      )

    binary +=
      String.fromCharCode(
        ...chunk
      )
  }

  return globalThis
    .btoa(
      binary
    )
    .replace(
      /\+/g,
      '-'
    )
    .replace(
      /\//g,
      '_'
    )
    .replace(
      /=+$/g,
      ''
    )
}

function countRecords(
  snapshot:
    MAProfessorDatabaseSnapshot
) {
  return Object
    .values(
      snapshot.recordCounts
    )
    .reduce(
      (
        total,
        count
      ) =>
        total +
        count,
      0
    )
}

function getSnapshotBytes(
  snapshot:
    MAProfessorDatabaseSnapshot
) {
  return new TextEncoder()
    .encode(
      JSON.stringify(
        snapshot
      )
    )
    .byteLength
}

async function createSnapshotFingerprint(
  snapshot:
    MAProfessorDatabaseSnapshot
) {
  if (
    !globalThis.crypto ||
    !globalThis.crypto.subtle
  ) {
    throw new Error(
      'Este browser não suporta a verificação segura da cópia.'
    )
  }

  /*
   * createdAt não entra no fingerprint.
   *
   * A criação de um novo snapshot não deve fazer parecer que os
   * dados mudaram quando o conteúdo das tabelas continua igual.
   */
  const canonical =
    JSON.stringify({
      format:
        snapshot.format,

      formatVersion:
        snapshot.formatVersion,

      databaseName:
        snapshot.databaseName,

      databaseVersion:
        snapshot.databaseVersion,

      tables:
        snapshot.tables,

      recordCounts:
        snapshot.recordCounts
    })

  const digest =
    await globalThis
      .crypto
      .subtle
      .digest(
        'SHA-256',

        toArrayBuffer(
          new TextEncoder()
            .encode(
              canonical
            )
        )
      )

  return bytesToBase64Url(
    new Uint8Array(
      digest
    )
  )
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
      countRecords(
        snapshot
      ),

    localBytes:
      getSnapshotBytes(
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
    await createSnapshotFingerprint(
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
   * Um dispositivo que nunca confirmou a cópia que já existe no
   * servidor não a pode substituir silenciosamente.
   *
   * Primeiro terá de a verificar.
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

  const localSnapshot =
    await createMAProfessorDatabaseSnapshot()

  const localFingerprint =
    await createSnapshotFingerprint(
      localSnapshot
    )

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

  /*
   * Fazemos uma leitura completa imediatamente depois do upload.
   *
   * Só consideramos a cópia confirmada neste dispositivo se:
   * 1. conseguir ser descarregada;
   * 2. conseguir ser desencriptada;
   * 3. corresponder exatamente ao conteúdo enviado;
   * 4. continuar na mesma revisão que acabámos de criar.
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
    throw new Error(
      'A cópia foi enviada, mas não foi possível confirmá-la no servidor.'
    )
  }

  const remoteFingerprint =
    await createSnapshotFingerprint(
      downloaded.snapshot
    )

  if (
    downloaded.remote
      .serverRevision !==
      upload.remote
        .serverRevision ||
    remoteFingerprint !==
      localFingerprint
  ) {
    throw new Error(
      'A cópia online mudou durante a verificação. Nenhuma versão será considerada confirmada neste dispositivo.'
    )
  }

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
        localFingerprint,

      syncedAt:
        upload.remote
          .updatedAt,

      verifiedAt,

      lastOperation:
        'upload'
    }
  )

  return {
    upload,

    overview:
      createOverview(
        localSnapshot,
        localFingerprint,
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
    await createSnapshotFingerprint(
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
        countRecords(
          localSnapshot
        ),

      remoteServerRevision:
        downloaded
          .serverRevision
    }
  }

  const remoteFingerprint =
    await createSnapshotFingerprint(
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
      countRecords(
        localSnapshot
      ),

    remoteRecords:
      countRecords(
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
