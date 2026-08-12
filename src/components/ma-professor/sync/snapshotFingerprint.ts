import type {
  MAProfessorDatabaseSnapshot
} from './databaseSnapshotService'

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

function isPristineDefaultSettingsOnly(
  snapshot:
    MAProfessorDatabaseSnapshot
) {
  const totalRecords =
    Object
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

  if (
    totalRecords !== 1 ||
    snapshot.recordCounts
      .settings !== 1
  ) {
    return false
  }

  const settings =
    snapshot.tables
      .settings[0]

  if (!settings) {
    return false
  }

  return (
    settings.id ===
      'default' &&
    settings.defaultPeriodMinutes ===
      50 &&
    settings.defaultAbsentAssessmentScore ===
      0 &&
    settings.defaultExemptAssessmentScore ===
      10 &&
    settings.absenceWarningPercent ===
      8 &&
    settings.learningRecoveryThresholdPercent ===
      10 &&
    settings.weekStartsOn ===
      1 &&
    settings.locale ===
      'pt-PT' &&
    settings.theme ===
      'dark' &&
    settings.createdAt ===
      settings.updatedAt
  )
}

export function countMAProfessorSnapshotRecords(
  snapshot:
    MAProfessorDatabaseSnapshot
) {
  const totalRecords =
    Object
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

  if (
    isPristineDefaultSettingsOnly(
      snapshot
    )
  ) {
    return 0
  }

  return totalRecords
}

export function getMAProfessorSnapshotBytes(
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

export async function createMAProfessorSnapshotFingerprint(
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
