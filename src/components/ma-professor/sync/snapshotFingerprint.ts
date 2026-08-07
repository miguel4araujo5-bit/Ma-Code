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

export function countMAProfessorSnapshotRecords(
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

  /*
   * A data de criação não faz parte da impressão digital.
   *
   * Dois snapshots criados em momentos diferentes mas com exatamente
   * os mesmos dados devem produzir a mesma impressão digital.
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
