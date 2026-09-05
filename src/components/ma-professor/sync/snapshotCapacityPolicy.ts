import type {
  MAProfessorEncryptedRecord
} from './cryptoService'

export const MA_PROFESSOR_SNAPSHOT_MAX_BODY_BYTES =
  1_500_000

export const MA_PROFESSOR_SNAPSHOT_MAX_CIPHERTEXT_CHARACTERS =
  1_480_000

export const MA_PROFESSOR_SNAPSHOT_CAPACITY_EVENT =
  'ma-professor-snapshot-capacity'

const WARNING_RATIO =
  0.75

const CRITICAL_RATIO =
  0.9

const textEncoder =
  new TextEncoder()

export type MAProfessorSnapshotCapacityLevel =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'blocked'

export interface MAProfessorSnapshotPushCapacity {
  level:
    MAProfessorSnapshotCapacityLevel

  bodyBytes:
    number

  ciphertextCharacters:
    number

  bodyUsagePercent:
    number

  ciphertextUsagePercent:
    number

  usagePercent:
    number
}

export interface MAProfessorSnapshotPushCapacityInput {
  token:
    string

  deviceId:
    string

  recordId:
    string

  expectedServerRevision:
    number

  encrypted:
    MAProfessorEncryptedRecord
}

let currentCapacity:
  MAProfessorSnapshotPushCapacity | null =
    null

function classifyUsage(
  ratio: number
): MAProfessorSnapshotCapacityLevel {
  if (
    ratio > 1
  ) {
    return 'blocked'
  }

  if (
    ratio >=
      CRITICAL_RATIO
  ) {
    return 'critical'
  }

  if (
    ratio >=
      WARNING_RATIO
  ) {
    return 'warning'
  }

  return 'normal'
}

export function inspectMAProfessorSnapshotPushCapacity(
  input:
    MAProfessorSnapshotPushCapacityInput
): MAProfessorSnapshotPushCapacity {
  const body = {
    token:
      input.token.trim(),

    deviceId:
      input.deviceId.trim(),

    recordId:
      input.recordId.trim(),

    expectedServerRevision:
      input.expectedServerRevision,

    encrypted:
      input.encrypted
  }

  const bodyBytes =
    textEncoder
      .encode(
        JSON.stringify(
          body
        )
      )
      .byteLength

  const ciphertextCharacters =
    input.encrypted
      .ciphertext.length

  const bodyRatio =
    bodyBytes /
    MA_PROFESSOR_SNAPSHOT_MAX_BODY_BYTES

  const ciphertextRatio =
    ciphertextCharacters /
    MA_PROFESSOR_SNAPSHOT_MAX_CIPHERTEXT_CHARACTERS

  const usageRatio =
    Math.max(
      bodyRatio,
      ciphertextRatio
    )

  return {
    level:
      classifyUsage(
        usageRatio
      ),

    bodyBytes,

    ciphertextCharacters,

    bodyUsagePercent:
      bodyRatio * 100,

    ciphertextUsagePercent:
      ciphertextRatio * 100,

    usagePercent:
      usageRatio * 100
  }
}

export function readMAProfessorSnapshotPushCapacity() {
  return currentCapacity
}

export function publishMAProfessorSnapshotPushCapacity(
  capacity:
    MAProfessorSnapshotPushCapacity
) {
  currentCapacity =
    capacity

  if (
    typeof window ===
      'undefined'
  ) {
    return
  }

  window.dispatchEvent(
    new CustomEvent(
      MA_PROFESSOR_SNAPSHOT_CAPACITY_EVENT,
      {
        detail:
          capacity
      }
    )
  )
}

export class MAProfessorSnapshotCapacityError
  extends Error {
  readonly capacity:
    MAProfessorSnapshotPushCapacity

  constructor(
    capacity:
      MAProfessorSnapshotPushCapacity
  ) {
    super(
      'A cópia cifrada excede o limite técnico do serviço e não foi enviada. Os dados continuam guardados neste dispositivo. Exporte uma cópia local e contacte o suporte antes de voltar a tentar.'
    )

    this.name =
      'MAProfessorSnapshotCapacityError'

    this.capacity =
      capacity
  }
}

export function assertMAProfessorSnapshotPushCapacity(
  capacity:
    MAProfessorSnapshotPushCapacity
) {
  if (
    capacity.level ===
      'blocked'
  ) {
    throw new MAProfessorSnapshotCapacityError(
      capacity
    )
  }
}
