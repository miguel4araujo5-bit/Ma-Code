import type {
  MAProfessorEncryptedRecord
} from './cryptoService'

import {
  assertMAProfessorSnapshotPushCapacity,
  inspectMAProfessorSnapshotPushCapacity,
  publishMAProfessorSnapshotPushCapacity,
  type MAProfessorSnapshotPushCapacity
} from './snapshotCapacityPolicy'

const API_PREFIX =
  '/api/ma-professor/snapshot'

const MAX_RECORD_ID_LENGTH = 128
const MAX_BODY_BYTES = 1_500_000

const textEncoder =
  new TextEncoder()

export interface MAProfessorSnapshotPushResult {
  success: true
  recordId: string
  serverRevision: number
  recordRevision: number
  updatedAt: string
  capacity:
    MAProfessorSnapshotPushCapacity
}

export interface MAProfessorSnapshotNotFoundResult {
  success: true
  found: false
  recordId: string
  serverRevision: number
}

export interface MAProfessorSnapshotFoundResult {
  success: true
  found: true
  recordId: string
  serverRevision: number
  recordRevision: number
  recordServerRevision: number
  createdAt: string
  updatedAt: string
  encrypted:
    MAProfessorEncryptedRecord
}

export type MAProfessorSnapshotGetResult =
  | MAProfessorSnapshotNotFoundResult
  | MAProfessorSnapshotFoundResult

export class MAProfessorSnapshotRequestError
  extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number
  ) {
    super(message)

    this.name =
      'MAProfessorSnapshotRequestError'

    this.status =
      status
  }
}

export class MAProfessorSnapshotConflictError
  extends MAProfessorSnapshotRequestError {
  readonly currentServerRevision:
    number

  constructor(
    message: string,
    currentServerRevision: number
  ) {
    super(
      message,
      409
    )

    this.name =
      'MAProfessorSnapshotConflictError'

    this.currentServerRevision =
      currentServerRevision
  }
}

function isObject(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}

function isNonNegativeInteger(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isInteger(
      value
    ) &&
    value >= 0
  )
}

function isPositiveInteger(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isInteger(
      value
    ) &&
    value >= 1
  )
}

function parseDateString(
  value: unknown,
  message: string
) {
  if (
    typeof value !==
      'string' ||
    !value.trim()
  ) {
    throw new Error(
      message
    )
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      message
    )
  }

  return value
}

function normalizeRecordId(
  recordId: string
) {
  const normalized =
    recordId.trim()

  if (
    !normalized ||
    normalized.length >
      MAX_RECORD_ID_LENGTH ||
    !/^[a-z0-9][a-z0-9._:-]*$/i.test(
      normalized
    )
  ) {
    throw new Error(
      'O identificador da cópia cifrada não é válido.'
    )
  }

  return normalized
}

function validateSessionValue(
  value: string,
  label: string
) {
  const normalized =
    value.trim()

  if (!normalized) {
    throw new Error(
      `${label} não está disponível.`
    )
  }

  return normalized
}

function parseEncryptedRecord(
  value: unknown
): MAProfessorEncryptedRecord {
  if (
    !isObject(
      value
    ) ||
    value.encryptionVersion !==
      1 ||
    value.encryptionAlgorithm !==
      'AES-256-GCM' ||
    typeof value.nonce !==
      'string' ||
    !value.nonce ||
    typeof value.ciphertext !==
      'string' ||
    !value.ciphertext ||
    typeof value.ciphertextHash !==
      'string' ||
    !value.ciphertextHash
  ) {
    throw new Error(
      'O serviço devolveu uma cópia cifrada inválida.'
    )
  }

  return {
    encryptionVersion:
      1,

    encryptionAlgorithm:
      'AES-256-GCM',

    nonce:
      value.nonce,

    ciphertext:
      value.ciphertext,

    ciphertextHash:
      value.ciphertextHash
  }
}

function parsePushResult(
  value: unknown
) {
  if (
    !isObject(
      value
    ) ||
    value.success !==
      true ||
    typeof value.recordId !==
      'string' ||
    !value.recordId ||
    !isPositiveInteger(
      value.serverRevision
    ) ||
    !isPositiveInteger(
      value.recordRevision
    )
  ) {
    throw new Error(
      'O serviço devolveu uma resposta inválida ao guardar a cópia cifrada.'
    )
  }

  return {
    success:
      true as const,

    recordId:
      normalizeRecordId(
        value.recordId
      ),

    serverRevision:
      value.serverRevision,

    recordRevision:
      value.recordRevision,

    updatedAt:
      parseDateString(
        value.updatedAt,
        'O serviço devolveu uma data de atualização inválida.'
      )
  }
}

function parseGetResult(
  value: unknown
): MAProfessorSnapshotGetResult {
  if (
    !isObject(
      value
    ) ||
    value.success !==
      true ||
    typeof value.found !==
      'boolean' ||
    typeof value.recordId !==
      'string' ||
    !value.recordId ||
    !isNonNegativeInteger(
      value.serverRevision
    )
  ) {
    throw new Error(
      'O serviço devolveu uma resposta inválida ao consultar a cópia cifrada.'
    )
  }

  const recordId =
    normalizeRecordId(
      value.recordId
    )

  if (
    value.found ===
      false
  ) {
    return {
      success:
        true,

      found:
        false,

      recordId,

      serverRevision:
        value.serverRevision
    }
  }

  if (
    !isPositiveInteger(
      value.recordRevision
    ) ||
    !isPositiveInteger(
      value.recordServerRevision
    )
  ) {
    throw new Error(
      'A revisão da cópia cifrada devolvida não é válida.'
    )
  }

  return {
    success:
      true,

    found:
      true,

    recordId,

    serverRevision:
      value.serverRevision,

    recordRevision:
      value.recordRevision,

    recordServerRevision:
      value.recordServerRevision,

    createdAt:
      parseDateString(
        value.createdAt,
        'O serviço devolveu uma data de criação inválida.'
      ),

    updatedAt:
      parseDateString(
        value.updatedAt,
        'O serviço devolveu uma data de atualização inválida.'
      ),

    encrypted:
      parseEncryptedRecord(
        value.encrypted
      )
  }
}

async function postJson(
  path: string,
  body: Record<
    string,
    unknown
  >,
  fallbackMessage: string
) {
  const serializedBody =
    JSON.stringify(
      body
    )

  const bodyBytes =
    textEncoder
      .encode(
        serializedBody
      )
      .byteLength

  if (
    bodyBytes >
    MAX_BODY_BYTES
  ) {
    throw new MAProfessorSnapshotRequestError(
      'O registo cifrado ultrapassa o limite permitido pelo serviço de cópias.',
      413
    )
  }

  let response: Response

  try {
    response =
      await fetch(
        `${API_PREFIX}${path}`,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',

            Accept:
              'application/json'
          },

          cache:
            'no-store',

          body:
            serializedBody
        }
      )
  } catch {
    throw new MAProfessorSnapshotRequestError(
      'Não foi possível ligar ao serviço de cópias cifradas. Os dados continuam guardados neste dispositivo.',
      0
    )
  }

  let data: unknown =
    null

  try {
    data =
      await response.json()
  } catch {
    data =
      null
  }

  if (!response.ok) {
    const message =
      isObject(
        data
      ) &&
      typeof data.message ===
        'string' &&
      data.message.trim()
        ? data.message.trim()
        : fallbackMessage

    if (
      response.status ===
        409 &&
      isObject(
        data
      ) &&
      isNonNegativeInteger(
        data.currentServerRevision
      )
    ) {
      throw new MAProfessorSnapshotConflictError(
        message,
        data.currentServerRevision
      )
    }

    throw new MAProfessorSnapshotRequestError(
      message,
      response.status
    )
  }

  return data
}

export async function pushMAProfessorEncryptedSnapshot(
  token: string,
  deviceId: string,
  recordId: string,
  expectedServerRevision: number,
  encrypted:
    MAProfessorEncryptedRecord
): Promise<MAProfessorSnapshotPushResult> {
  const normalizedToken =
    validateSessionValue(
      token,
      'A sessão'
    )

  const normalizedDeviceId =
    validateSessionValue(
      deviceId,
      'O identificador do dispositivo'
    )

  const normalizedRecordId =
    normalizeRecordId(
      recordId
    )

  if (
    !isNonNegativeInteger(
      expectedServerRevision
    )
  ) {
    throw new Error(
      'A revisão esperada da sincronização não é válida.'
    )
  }

  const capacity =
    inspectMAProfessorSnapshotPushCapacity({
      token:
        normalizedToken,

      deviceId:
        normalizedDeviceId,

      recordId:
        normalizedRecordId,

      expectedServerRevision,

      encrypted
    })

  publishMAProfessorSnapshotPushCapacity(
    capacity
  )

  assertMAProfessorSnapshotPushCapacity(
    capacity
  )

  const data =
    await postJson(
      '/push',

      {
        token:
          normalizedToken,

        deviceId:
          normalizedDeviceId,

        recordId:
          normalizedRecordId,

        expectedServerRevision,

        encrypted
      },

      'Não foi possível guardar a cópia cifrada.'
    )

  return {
    ...parsePushResult(
      data
    ),

    capacity
  }
}

export async function getMAProfessorEncryptedSnapshot(
  token: string,
  deviceId: string,
  recordId: string
) {
  const normalizedToken =
    validateSessionValue(
      token,
      'A sessão'
    )

  const normalizedDeviceId =
    validateSessionValue(
      deviceId,
      'O identificador do dispositivo'
    )

  const normalizedRecordId =
    normalizeRecordId(
      recordId
    )

  const data =
    await postJson(
      '/get',

      {
        token:
          normalizedToken,

        deviceId:
          normalizedDeviceId,

        recordId:
          normalizedRecordId
      },

      'Não foi possível consultar a cópia cifrada.'
    )

  return parseGetResult(
    data
  )
}
