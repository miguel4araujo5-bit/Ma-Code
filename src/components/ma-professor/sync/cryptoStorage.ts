import {
  createMAProfessorCryptoMaterial,
  hashMAProfessorDeviceId,
  unlockMAProfessorMasterKeyWithDevice,
  type MAProfessorCryptoProfilePayload,
  type MAProfessorDeviceCryptoPayload,
  type MAProfessorGeneratedCryptoMaterial
} from './cryptoService'

const DATABASE_NAME =
  'ma-professor-crypto'

const DATABASE_VERSION = 1

const DEVICE_STORE_NAME =
  'device_material'

const LOCAL_CRYPTO_VERSION = 1 as const

const textEncoder =
  new TextEncoder()

interface StoredCryptoMaterial {
  id: string

  accountScopeId: string
  deviceIdHash: string

  localCryptoVersion:
    typeof LOCAL_CRYPTO_VERSION

  cryptoVersion: number

  createdAt: string
  updatedAt: string

  devicePrivateKey: CryptoKey

  profile:
    MAProfessorCryptoProfilePayload

  device:
    MAProfessorDeviceCryptoPayload
}

export interface MAProfessorLocalCryptoMaterial {
  accountScopeId: string
  deviceIdHash: string

  cryptoVersion: number

  createdAt: string
  updatedAt: string

  profile:
    MAProfessorCryptoProfilePayload

  device:
    MAProfessorDeviceCryptoPayload
}

export interface MAProfessorNewCryptoSetup {
  recoveryCode: string

  masterKey: CryptoKey

  local:
    MAProfessorLocalCryptoMaterial
}

function assertIndexedDbAvailable() {
  if (
    !globalThis.indexedDB
  ) {
    throw new Error(
      'Este browser não permite guardar a chave segura do MA-Professor.'
    )
  }
}

function assertWebCryptoAvailable() {
  if (
    !globalThis.crypto ||
    !globalThis.crypto.subtle
  ) {
    throw new Error(
      'Este browser não suporta a proteção criptográfica necessária ao MA-Professor.'
    )
  }
}

function normalizeEmail(
  email: string
) {
  const normalized =
    email
      .trim()
      .toLowerCase()

  if (
    !normalized ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalized
    )
  ) {
    throw new Error(
      'O email da conta não é válido.'
    )
  }

  return normalized
}

function normalizeDeviceId(
  deviceId: string
) {
  const normalized =
    deviceId.trim()

  if (!normalized) {
    throw new Error(
      'O identificador do dispositivo não é válido.'
    )
  }

  return normalized
}

function toArrayBuffer(
  value: Uint8Array
): ArrayBuffer {
  const copy =
    new Uint8Array(
      value.byteLength
    )

  copy.set(value)

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
    offset < bytes.length;
    offset += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        offset,
        Math.min(
          offset + chunkSize,
          bytes.length
        )
      )

    binary +=
      String.fromCharCode(
        ...chunk
      )
  }

  return globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function createAccountScopeId(
  email: string
) {
  assertWebCryptoAvailable()

  const normalizedEmail =
    normalizeEmail(email)

  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      toArrayBuffer(
        textEncoder.encode(
          `ma-professor-local-account-v1:${normalizedEmail}`
        )
      )
    )

  return bytesToBase64Url(
    new Uint8Array(
      digest
    )
  )
}

async function createStorageIdentity(
  email: string,
  deviceId: string
) {
  const normalizedDeviceId =
    normalizeDeviceId(
      deviceId
    )

  const [
    accountScopeId,
    deviceIdHash
  ] =
    await Promise.all([
      createAccountScopeId(
        email
      ),

      hashMAProfessorDeviceId(
        normalizedDeviceId
      )
    ])

  return {
    id:
      `${accountScopeId}:${deviceIdHash}`,

    accountScopeId,
    deviceIdHash
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
    !Array.isArray(value)
  )
}

function isCryptoKey(
  value: unknown
): value is CryptoKey {
  return (
    typeof CryptoKey !==
      'undefined' &&
    value instanceof
      CryptoKey
  )
}

function isProfilePayload(
  value: unknown
): value is MAProfessorCryptoProfilePayload {
  if (!isObject(value)) {
    return false
  }

  return (
    value.cryptoVersion === 1 &&
    value.recoveryKdfAlgorithm ===
      'PBKDF2-HMAC-SHA-256' &&
    typeof value.recoveryKdfSalt ===
      'string' &&
    Boolean(
      value.recoveryKdfSalt
    ) &&
    typeof value.recoveryKdfParameters ===
      'string' &&
    Boolean(
      value.recoveryKdfParameters
    ) &&
    value.recoveryKeyWrapAlgorithm ===
      'AES-256-GCM' &&
    typeof value.recoveryWrappedMasterKey ===
      'string' &&
    Boolean(
      value.recoveryWrappedMasterKey
    ) &&
    typeof value.recoveryWrappedMasterKeyNonce ===
      'string' &&
    Boolean(
      value.recoveryWrappedMasterKeyNonce
    )
  )
}

function isDevicePayload(
  value: unknown
): value is MAProfessorDeviceCryptoPayload {
  if (!isObject(value)) {
    return false
  }

  return (
    typeof value.deviceIdHash ===
      'string' &&
    Boolean(
      value.deviceIdHash
    ) &&
    typeof value.devicePublicKey ===
      'string' &&
    Boolean(
      value.devicePublicKey
    ) &&
    value.keyWrapAlgorithm ===
      'RSA-OAEP-3072-SHA-256' &&
    typeof value.wrappedMasterKey ===
      'string' &&
    Boolean(
      value.wrappedMasterKey
    ) &&
    value.wrappedMasterKeyNonce ===
      ''
  )
}

function isStoredCryptoMaterial(
  value: unknown
): value is StoredCryptoMaterial {
  if (!isObject(value)) {
    return false
  }

  if (
    typeof value.id !==
      'string' ||
    !value.id ||
    typeof value.accountScopeId !==
      'string' ||
    !value.accountScopeId ||
    typeof value.deviceIdHash !==
      'string' ||
    !value.deviceIdHash ||
    value.localCryptoVersion !==
      LOCAL_CRYPTO_VERSION ||
    typeof value.cryptoVersion !==
      'number' ||
    !Number.isInteger(
      value.cryptoVersion
    ) ||
    typeof value.createdAt !==
      'string' ||
    !value.createdAt ||
    typeof value.updatedAt !==
      'string' ||
    !value.updatedAt ||
    !isCryptoKey(
      value.devicePrivateKey
    ) ||
    !isProfilePayload(
      value.profile
    ) ||
    !isDevicePayload(
      value.device
    )
  ) {
    return false
  }

  return (
    value.deviceIdHash ===
      value.device.deviceIdHash &&
    value.devicePrivateKey.type ===
      'private' &&
    value.devicePrivateKey.extractable ===
      false &&
    value.devicePrivateKey.algorithm.name ===
      'RSA-OAEP'
  )
}

function requestToPromise<T>(
  request: IDBRequest<T>
): Promise<T> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      request.onsuccess =
        () => {
          resolve(
            request.result
          )
        }

      request.onerror =
        () => {
          reject(
            request.error ??
              new Error(
                'Não foi possível concluir a operação na base segura local.'
              )
          )
        }
    }
  )
}

function transactionToPromise(
  transaction:
    IDBTransaction
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      transaction.oncomplete =
        () => {
          resolve()
        }

      transaction.onabort =
        () => {
          reject(
            transaction.error ??
              new Error(
                'A operação na base segura local foi cancelada.'
              )
          )
        }

      transaction.onerror =
        () => {
          reject(
            transaction.error ??
              new Error(
                'Ocorreu um erro na base segura local.'
              )
          )
        }
    }
  )
}

function openCryptoDatabase():
  Promise<IDBDatabase> {
  assertIndexedDbAvailable()

  return new Promise(
    (
      resolve,
      reject
    ) => {
      const request =
        globalThis.indexedDB.open(
          DATABASE_NAME,
          DATABASE_VERSION
        )

      request.onupgradeneeded =
        () => {
          const database =
            request.result

          if (
            !database.objectStoreNames.contains(
              DEVICE_STORE_NAME
            )
          ) {
            const store =
              database.createObjectStore(
                DEVICE_STORE_NAME,
                {
                  keyPath: 'id'
                }
              )

            store.createIndex(
              'accountScopeId',
              'accountScopeId',
              {
                unique: false
              }
            )

            store.createIndex(
              'deviceIdHash',
              'deviceIdHash',
              {
                unique: false
              }
            )
          }
        }

      request.onsuccess =
        () => {
          const database =
            request.result

          database.onversionchange =
            () => {
              database.close()
            }

          resolve(database)
        }

      request.onerror =
        () => {
          reject(
            request.error ??
              new Error(
                'Não foi possível abrir a base segura local.'
              )
          )
        }

      request.onblocked =
        () => {
          reject(
            new Error(
              'A atualização da proteção local está bloqueada por outra janela do MA-Professor.'
            )
          )
        }
    }
  )
}

function toLocalMaterial(
  stored:
    StoredCryptoMaterial
): MAProfessorLocalCryptoMaterial {
  return {
    accountScopeId:
      stored.accountScopeId,

    deviceIdHash:
      stored.deviceIdHash,

    cryptoVersion:
      stored.cryptoVersion,

    createdAt:
      stored.createdAt,

    updatedAt:
      stored.updatedAt,

    profile:
      stored.profile,

    device:
      stored.device
  }
}

async function readStoredCryptoMaterial(
  email: string,
  deviceId: string
): Promise<StoredCryptoMaterial | null> {
  const identity =
    await createStorageIdentity(
      email,
      deviceId
    )

  const database =
    await openCryptoDatabase()

  try {
    const transaction =
      database.transaction(
        DEVICE_STORE_NAME,
        'readonly'
      )

    const completed =
      transactionToPromise(
        transaction
      )

    const request =
      transaction
        .objectStore(
          DEVICE_STORE_NAME
        )
        .get(
          identity.id
        )

    const result =
      await requestToPromise(
        request
      )

    await completed

    if (
      typeof result ===
        'undefined'
    ) {
      return null
    }

    if (
      !isStoredCryptoMaterial(
        result
      )
    ) {
      throw new Error(
        'A proteção local desta conta está incompleta ou danificada.'
      )
    }

    if (
      result.accountScopeId !==
        identity.accountScopeId ||
      result.deviceIdHash !==
        identity.deviceIdHash
    ) {
      throw new Error(
        'A proteção local não corresponde a esta conta ou dispositivo.'
      )
    }

    return result
  } finally {
    database.close()
  }
}

async function addStoredCryptoMaterial(
  stored:
    StoredCryptoMaterial
) {
  const database =
    await openCryptoDatabase()

  try {
    const transaction =
      database.transaction(
        DEVICE_STORE_NAME,
        'readwrite'
      )

    const completed =
      transactionToPromise(
        transaction
      )

    const request =
      transaction
        .objectStore(
          DEVICE_STORE_NAME
        )
        .add(stored)

    try {
      await requestToPromise(
        request
      )

      await completed
    } catch (error) {
      if (
        error instanceof
          DOMException &&
        error.name ===
          'ConstraintError'
      ) {
        throw new Error(
          'Este dispositivo já possui uma chave segura para esta conta.'
        )
      }

      throw error
    }
  } finally {
    database.close()
  }
}

export async function hasMAProfessorLocalCryptoMaterial(
  email: string,
  deviceId: string
) {
  return (
    await readStoredCryptoMaterial(
      email,
      deviceId
    )
  ) !== null
}

export async function readMAProfessorLocalCryptoMaterial(
  email: string,
  deviceId: string
): Promise<MAProfessorLocalCryptoMaterial | null> {
  const stored =
    await readStoredCryptoMaterial(
      email,
      deviceId
    )

  return stored
    ? toLocalMaterial(
        stored
      )
    : null
}

export async function createAndStoreMAProfessorCryptoMaterial(
  email: string,
  deviceId: string
): Promise<MAProfessorNewCryptoSetup> {
  const identity =
    await createStorageIdentity(
      email,
      deviceId
    )

  const existing =
    await readStoredCryptoMaterial(
      email,
      deviceId
    )

  if (existing) {
    throw new Error(
      'Este dispositivo já possui uma chave segura para esta conta.'
    )
  }

  const generated =
    await createMAProfessorCryptoMaterial(
      deviceId
    )

  if (
    generated.device.deviceIdHash !==
      identity.deviceIdHash
  ) {
    throw new Error(
      'A chave criada não corresponde a este dispositivo.'
    )
  }

  const timestamp =
    new Date().toISOString()

  const stored:
    StoredCryptoMaterial = {
      id:
        identity.id,

      accountScopeId:
        identity.accountScopeId,

      deviceIdHash:
        identity.deviceIdHash,

      localCryptoVersion:
        LOCAL_CRYPTO_VERSION,

      cryptoVersion:
        generated.cryptoVersion,

      createdAt:
        generated.createdAt,

      updatedAt:
        timestamp,

      devicePrivateKey:
        generated.devicePrivateKey,

      profile:
        generated.profile,

      device:
        generated.device
    }

  await addStoredCryptoMaterial(
    stored
  )

  return {
    recoveryCode:
      generated.recoveryCode,

    masterKey:
      generated.masterKey,

    local:
      toLocalMaterial(
        stored
      )
  }
}

export async function unlockMAProfessorLocalMasterKey(
  email: string,
  deviceId: string
) {
  const stored =
    await readStoredCryptoMaterial(
      email,
      deviceId
    )

  if (!stored) {
    throw new Error(
      'Este dispositivo ainda não possui uma chave segura para esta conta.'
    )
  }

  return unlockMAProfessorMasterKeyWithDevice(
    stored.devicePrivateKey,
    stored.device.wrappedMasterKey
  )
}

export async function deleteMAProfessorLocalCryptoMaterial(
  email: string,
  deviceId: string
) {
  const identity =
    await createStorageIdentity(
      email,
      deviceId
    )

  const database =
    await openCryptoDatabase()

  try {
    const transaction =
      database.transaction(
        DEVICE_STORE_NAME,
        'readwrite'
      )

    const completed =
      transactionToPromise(
        transaction
      )

    const request =
      transaction
        .objectStore(
          DEVICE_STORE_NAME
        )
        .delete(
          identity.id
        )

    await requestToPromise(
      request
    )

    await completed
  } finally {
    database.close()
  }
}

export function getMAProfessorGeneratedCryptoPayloads(
  generated:
    MAProfessorGeneratedCryptoMaterial
) {
  return {
    profile:
      generated.profile,

    device:
      generated.device
  }
}
