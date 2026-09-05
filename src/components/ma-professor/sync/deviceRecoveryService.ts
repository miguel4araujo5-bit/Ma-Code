import {
  hashMAProfessorDeviceId,
  type MAProfessorCryptoProfilePayload,
  type MAProfessorDeviceCryptoPayload
} from './cryptoService'

import {
  unlockMAProfessorLocalMasterKey
} from './cryptoStorage'

import {
  authorizeMAProfessorRecoveredDevice,
  getMAProfessorRecoveryProfile,
  registerMAProfessorRecoveryVerifier
} from './recoveryApi'

import {
  createMAProfessorDatabaseSnapshot,
  downloadEncryptedMAProfessorDatabaseSnapshot
} from './databaseSnapshotService'

import {
  createMAProfessorSnapshotContentSignature,
  MAProfessorLocalSnapshotChangedError,
  restoreMAProfessorDatabaseSnapshotIfLocalUnchanged
} from './guardedSnapshotRestore'

import {
  countMAProfessorSnapshotRecords,
  createMAProfessorSnapshotFingerprint
} from './snapshotFingerprint'

import {
  saveMAProfessorManualSyncState
} from './syncStateStorage'

const CRYPTO_DATABASE_NAME =
  'ma-professor-crypto'

const CRYPTO_DATABASE_VERSION =
  1

const DEVICE_STORE_NAME =
  'device_material'

const LOCAL_CRYPTO_VERSION =
  1 as const

const RECOVERY_PREFIX =
  'MA-PROF'

const RECOVERY_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const RECOVERY_ITERATIONS =
  600_000

const RECOVERY_SALT_BYTES =
  16

const MASTER_KEY_LENGTH =
  256

const DEVICE_KEY_MODULUS_LENGTH =
  3072

const DEVICE_KEY_HASH =
  'SHA-256'

const VERIFIER_IV =
  new Uint8Array([
    0x4d,
    0x41,
    0x50,
    0x52,
    0x4f,
    0x46,
    0x56,
    0x31,
    0xa5,
    0x5a,
    0x13,
    0x7c
  ])

const VERIFIER_PLAINTEXT =
  new TextEncoder()
    .encode(
      'ma-professor-master-verifier-v1'
    )

const VERIFIER_ADDITIONAL_DATA =
  new TextEncoder()
    .encode(
      'ma-professor-recovery-verifier-domain-v1'
    )

const textEncoder =
  new TextEncoder()

interface RecoveryKdfParameters {
  iterations: number
  hash: 'SHA-256'
  saltBytes: number
}

interface StoredRecoveredCryptoMaterial {
  id: string

  accountScopeId:
    string

  deviceIdHash:
    string

  localCryptoVersion:
    typeof LOCAL_CRYPTO_VERSION

  cryptoVersion:
    number

  createdAt:
    string

  updatedAt:
    string

  devicePrivateKey:
    CryptoKey

  profile:
    MAProfessorCryptoProfilePayload

  device:
    MAProfessorDeviceCryptoPayload
}

interface PreparedRecoveredDevice {
  recoveryVerifier:
    string

  privateKey:
    CryptoKey

  profile:
    MAProfessorCryptoProfilePayload

  device:
    MAProfessorDeviceCryptoPayload
}

export type MAProfessorNewDeviceDataStatus =
  | 'restored'
  | 'already-current'
  | 'manual-restore-required'
  | 'no-online-copy'
  | 'restore-deferred'

export interface MAProfessorNewDeviceRecoveryResult {
  authorized:
    true

  dataStatus:
    MAProfessorNewDeviceDataStatus

  serverRevision:
    number

  restoredRecords:
    number

  message:
    string
}

function assertWebCryptoAvailable() {
  if (
    !globalThis.crypto ||
    !globalThis.crypto.subtle ||
    typeof globalThis.crypto
      .getRandomValues !==
      'function'
  ) {
    throw new Error(
      'Este browser não suporta a proteção necessária para recuperar os seus dados.'
    )
  }
}

function assertIndexedDbAvailable() {
  if (
    !globalThis.indexedDB
  ) {
    throw new Error(
      'Este browser não permite guardar a chave segura deste dispositivo.'
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

function bytesToBase64(
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

  return globalThis.btoa(
    binary
  )
}

function bytesToBase64Url(
  bytes: Uint8Array
) {
  return bytesToBase64(
    bytes
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

function base64ToBytes(
  value: string
) {
  let binary: string

  try {
    binary =
      globalThis.atob(
        value
      )
  } catch {
    throw new Error(
      'A configuração de recuperação não tem um formato válido.'
    )
  }

  const bytes =
    new Uint8Array(
      binary.length
    )

  for (
    let index = 0;
    index <
      binary.length;
    index += 1
  ) {
    bytes[
      index
    ] =
      binary.charCodeAt(
        index
      )
  }

  return bytes
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
      'O identificador deste dispositivo não é válido.'
    )
  }

  return normalized
}

function normalizeRecoveryCode(
  recoveryCode: string
) {
  const normalized =
    recoveryCode
      .trim()
      .toUpperCase()

  const withoutPrefix =
    normalized.startsWith(
      `${RECOVERY_PREFIX}-`
    )
      ? normalized.slice(
          RECOVERY_PREFIX
            .length +
            1
        )
      : normalized

  const compact =
    withoutPrefix.replace(
      /[\s-]+/g,
      ''
    )

  if (
    compact.length !==
      32 ||
    [
      ...compact
    ].some(
      character =>
        !RECOVERY_ALPHABET.includes(
          character
        )
    )
  ) {
    throw new Error(
      'A chave de recuperação não é válida. Verifique os caracteres e tente novamente.'
    )
  }

  return compact
}

function parseRecoveryParameters(
  profile:
    MAProfessorCryptoProfilePayload
): RecoveryKdfParameters {
  if (
    profile.cryptoVersion !==
      1 ||
    profile.recoveryKdfAlgorithm !==
      'PBKDF2-HMAC-SHA-256' ||
    profile.recoveryKeyWrapAlgorithm !==
      'AES-256-GCM'
  ) {
    throw new Error(
      'Esta versão da proteção dos dados não é suportada neste dispositivo.'
    )
  }

  let value: unknown

  try {
    value =
      JSON.parse(
        profile
          .recoveryKdfParameters
      )
  } catch {
    value =
      null
  }

  if (
    typeof value !==
      'object' ||
    value === null ||
    Array.isArray(
      value
    )
  ) {
    throw new Error(
      'A configuração da chave de recuperação está incompleta.'
    )
  }

  const parameters =
    value as Record<
      string,
      unknown
    >

  if (
    parameters.iterations !==
      RECOVERY_ITERATIONS ||
    parameters.hash !==
      'SHA-256' ||
    parameters.saltBytes !==
      RECOVERY_SALT_BYTES
  ) {
    throw new Error(
      'Os parâmetros desta chave de recuperação não são suportados.'
    )
  }

  return {
    iterations:
      RECOVERY_ITERATIONS,

    hash:
      'SHA-256',

    saltBytes:
      RECOVERY_SALT_BYTES
  }
}

async function createAccountScopeId(
  email: string
) {
  const normalizedEmail =
    normalizeEmail(
      email
    )

  const digest =
    await globalThis
      .crypto
      .subtle
      .digest(
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

async function unwrapMasterKeyWithRecoveryCode(
  recoveryCode: string,
  profile:
    MAProfessorCryptoProfilePayload
) {
  assertWebCryptoAvailable()

  const compactRecoveryCode =
    normalizeRecoveryCode(
      recoveryCode
    )

  const parameters =
    parseRecoveryParameters(
      profile
    )

  const salt =
    base64ToBytes(
      profile
        .recoveryKdfSalt
    )

  if (
    salt.byteLength !==
      RECOVERY_SALT_BYTES
  ) {
    throw new Error(
      'A configuração da chave de recuperação está incompleta.'
    )
  }

  const baseKey =
    await globalThis
      .crypto
      .subtle
      .importKey(
        'raw',

        toArrayBuffer(
          textEncoder.encode(
            compactRecoveryCode
          )
        ),

        'PBKDF2',

        false,

        [
          'deriveKey'
        ]
      )

  const wrappingKey =
    await globalThis
      .crypto
      .subtle
      .deriveKey(
        {
          name:
            'PBKDF2',

          salt:
            toArrayBuffer(
              salt
            ),

          iterations:
            parameters
              .iterations,

          hash:
            parameters
              .hash
        },

        baseKey,

        {
          name:
            'AES-GCM',

          length:
            MASTER_KEY_LENGTH
        },

        false,

        [
          'unwrapKey'
        ]
      )

  try {
    return await globalThis
      .crypto
      .subtle
      .unwrapKey(
        'raw',

        toArrayBuffer(
          base64ToBytes(
            profile
              .recoveryWrappedMasterKey
          )
        ),

        wrappingKey,

        {
          name:
            'AES-GCM',

          iv:
            toArrayBuffer(
              base64ToBytes(
                profile
                  .recoveryWrappedMasterKeyNonce
              )
            ),

          tagLength:
            128
        },

        {
          name:
            'AES-GCM',

          length:
            MASTER_KEY_LENGTH
        },

        true,

        [
          'encrypt',
          'decrypt'
        ]
      )
  } catch {
    throw new Error(
      'A chave de recuperação está incorreta. Confirme a chave guardada e tente novamente.'
    )
  }
}

async function createMasterRecoveryVerifier(
  masterKey: CryptoKey
) {
  assertWebCryptoAvailable()

  if (
    masterKey.type !==
      'secret' ||
    masterKey.algorithm
      .name !==
      'AES-GCM'
  ) {
    throw new Error(
      'A chave principal recuperada não é válida.'
    )
  }

  const encrypted =
    await globalThis
      .crypto
      .subtle
      .encrypt(
        {
          name:
            'AES-GCM',

          iv:
            toArrayBuffer(
              VERIFIER_IV
            ),

          additionalData:
            toArrayBuffer(
              VERIFIER_ADDITIONAL_DATA
            ),

          tagLength:
            128
        },

        masterKey,

        toArrayBuffer(
          VERIFIER_PLAINTEXT
        )
      )

  const digest =
    await globalThis
      .crypto
      .subtle
      .digest(
        'SHA-256',
        encrypted
      )

  return bytesToBase64(
    new Uint8Array(
      digest
    )
  )
}

async function generateRecoveredDevice(
  masterKey: CryptoKey,
  deviceId: string
) {
  const normalizedDeviceId =
    normalizeDeviceId(
      deviceId
    )

  const generated =
    await globalThis
      .crypto
      .subtle
      .generateKey(
        {
          name:
            'RSA-OAEP',

          modulusLength:
            DEVICE_KEY_MODULUS_LENGTH,

          publicExponent:
            new Uint8Array([
              1,
              0,
              1
            ]),

          hash:
            DEVICE_KEY_HASH
        },

        false,

        [
          'encrypt',
          'decrypt',
          'wrapKey',
          'unwrapKey'
        ]
      )

  if (
    !(
      'publicKey' in
        generated
    ) ||
    !(
      'privateKey' in
        generated
    )
  ) {
    throw new Error(
      'Não foi possível criar a proteção deste dispositivo.'
    )
  }

  const wrappedMasterKey =
    await globalThis
      .crypto
      .subtle
      .wrapKey(
        'raw',

        masterKey,

        generated.publicKey,

        {
          name:
            'RSA-OAEP'
        }
      )

  const publicKeyJwk =
    await globalThis
      .crypto
      .subtle
      .exportKey(
        'jwk',
        generated.publicKey
      )

  const deviceIdHash =
    await hashMAProfessorDeviceId(
      normalizedDeviceId
    )

  const device:
    MAProfessorDeviceCryptoPayload = {
    deviceIdHash,

    devicePublicKey:
      JSON.stringify(
        publicKeyJwk
      ),

    keyWrapAlgorithm:
      'RSA-OAEP-3072-SHA-256',

    wrappedMasterKey:
      bytesToBase64(
        new Uint8Array(
          wrappedMasterKey
        )
      ),

    wrappedMasterKeyNonce:
      ''
  }

  return {
    privateKey:
      generated.privateKey,

    device
  }
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
                'Não foi possível guardar a proteção deste dispositivo.'
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
                'O armazenamento da chave deste dispositivo foi cancelado.'
              )
          )
        }

      transaction.onerror =
        () => {
          reject(
            transaction.error ??
              new Error(
                'Não foi possível concluir o armazenamento seguro deste dispositivo.'
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
          CRYPTO_DATABASE_NAME,
          CRYPTO_DATABASE_VERSION
        )

      request.onupgradeneeded =
        () => {
          const database =
            request.result

          if (
            !database
              .objectStoreNames
              .contains(
                DEVICE_STORE_NAME
              )
          ) {
            const store =
              database
                .createObjectStore(
                  DEVICE_STORE_NAME,
                  {
                    keyPath:
                      'id'
                  }
                )

            store.createIndex(
              'accountScopeId',
              'accountScopeId',
              {
                unique:
                  false
              }
            )

            store.createIndex(
              'deviceIdHash',
              'deviceIdHash',
              {
                unique:
                  false
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

          resolve(
            database
          )
        }

      request.onerror =
        () => {
          reject(
            request.error ??
              new Error(
                'Não foi possível abrir o armazenamento seguro deste dispositivo.'
              )
          )
        }

      request.onblocked =
        () => {
          reject(
            new Error(
              'Feche outras janelas do MA-Professor e tente novamente.'
            )
          )
        }
    }
  )
}

async function storeRecoveredDeviceMaterial(
  email: string,
  deviceId: string,
  prepared:
    PreparedRecoveredDevice
) {
  const [
    accountScopeId,
    expectedDeviceIdHash
  ] =
    await Promise.all([
      createAccountScopeId(
        email
      ),

      hashMAProfessorDeviceId(
        normalizeDeviceId(
          deviceId
        )
      )
    ])

  if (
    prepared.device
      .deviceIdHash !==
      expectedDeviceIdHash
  ) {
    throw new Error(
      'A chave recuperada não corresponde a este dispositivo.'
    )
  }

  const now =
    new Date()
      .toISOString()

  const stored:
    StoredRecoveredCryptoMaterial = {
    id:
      `${accountScopeId}:${expectedDeviceIdHash}`,

    accountScopeId,

    deviceIdHash:
      expectedDeviceIdHash,

    localCryptoVersion:
      LOCAL_CRYPTO_VERSION,

    cryptoVersion:
      prepared.profile
        .cryptoVersion,

    createdAt:
      now,

    updatedAt:
      now,

    devicePrivateKey:
      prepared.privateKey,

    profile:
      prepared.profile,

    device:
      prepared.device
  }

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
        .put(
          stored
        )

    await requestToPromise(
      request
    )

    await completed
  } finally {
    database.close()
  }
}

async function prepareRecoveredDevice(
  recoveryCode: string,
  profile:
    MAProfessorCryptoProfilePayload,
  deviceId: string
): Promise<PreparedRecoveredDevice> {
  const masterKey =
    await unwrapMasterKeyWithRecoveryCode(
      recoveryCode,
      profile
    )

  const [
    recoveryVerifier,
    recoveredDevice
  ] =
    await Promise.all([
      createMasterRecoveryVerifier(
        masterKey
      ),

      generateRecoveredDevice(
        masterKey,
        deviceId
      )
    ])

  return {
    recoveryVerifier,

    privateKey:
      recoveredDevice
        .privateKey,

    profile,

    device:
      recoveredDevice
        .device
  }
}

export async function ensureMAProfessorRecoveryVerifier(
  token: string,
  email: string,
  deviceId: string
) {
  const masterKey =
    await unlockMAProfessorLocalMasterKey(
      email,
      deviceId
    )

  const recoveryVerifier =
    await createMasterRecoveryVerifier(
      masterKey
    )

  return registerMAProfessorRecoveryVerifier(
    token,
    deviceId,
    recoveryVerifier
  )
}

export async function recoverMAProfessorOnNewDevice(
  token: string,
  email: string,
  deviceId: string,
  recoveryCode: string
): Promise<MAProfessorNewDeviceRecoveryResult> {
  /*
   * O código de recuperação nunca é enviado ao Worker.
   *
   * Primeiro recebemos apenas os parâmetros públicos necessários
   * para desencriptar localmente a chave principal.
   */
  const recoveryProfile =
    await getMAProfessorRecoveryProfile(
      token,
      deviceId
    )

  const prepared =
    await prepareRecoveredDevice(
      recoveryCode,
      recoveryProfile.profile,
      deviceId
    )

  /*
   * O Worker recebe apenas uma prova derivada da chave principal.
   * A chave de recuperação e a chave principal nunca são enviadas.
   */
  const authorization =
    await authorizeMAProfessorRecoveredDevice(
      token,
      deviceId,
      prepared.recoveryVerifier,
      prepared.device
    )

  /*
   * Só guardamos a chave local depois de o servidor confirmar que
   * este dispositivo foi autorizado.
   */
  await storeRecoveredDeviceMaterial(
    email,
    deviceId,
    prepared
  )

  /*
   * A autorização do dispositivo está concluída neste ponto.
   * A partir daqui, qualquer falha de rede não deve apagar a chave
   * local nem fazer o utilizador repetir a recuperação.
   */
  let downloaded:
    Awaited<
      ReturnType<
        typeof downloadEncryptedMAProfessorDatabaseSnapshot
      >
    >

  try {
    downloaded =
      await downloadEncryptedMAProfessorDatabaseSnapshot({
        token,
        email,
        deviceId
      })
  } catch {
    return {
      authorized:
        true,

      dataStatus:
        'restore-deferred',

      serverRevision:
        authorization
          .serverRevision,

      restoredRecords:
        0,

      message:
        'Este dispositivo ficou autorizado, mas não foi possível descarregar a cópia online agora. Pode recuperá-la mais tarde em Definições → Dados e cópias.'
    }
  }

  if (
    downloaded.found ===
      false
  ) {
    return {
      authorized:
        true,

      dataStatus:
        'no-online-copy',

      serverRevision:
        authorization
          .serverRevision,

      restoredRecords:
        0,

      message:
        'Este dispositivo ficou autorizado. Ainda não existe uma cópia de dados online para recuperar.'
    }
  }

  const localSnapshot =
    await createMAProfessorDatabaseSnapshot()

  const localContentSignature =
    createMAProfessorSnapshotContentSignature(
      localSnapshot
    )

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

  const localRecords =
    countMAProfessorSnapshotRecords(
      localSnapshot
    )

  if (
    localFingerprint ===
      remoteFingerprint
  ) {
    const verifiedAt =
      new Date()
        .toISOString()

    saveMAProfessorManualSyncState(
      email,
      deviceId,
      {
        serverRevision:
          downloaded.remote
            .serverRevision,

        fingerprint:
          remoteFingerprint,

        syncedAt:
          downloaded.remote
            .updatedAt,

        verifiedAt,

        lastOperation:
          'restore'
      }
    )

    return {
      authorized:
        true,

      dataStatus:
        'already-current',

      serverRevision:
        downloaded.remote
          .serverRevision,

      restoredRecords:
        countMAProfessorSnapshotRecords(
          downloaded.snapshot
        ),

      message:
        'Este dispositivo ficou autorizado e já possui os mesmos dados da cópia online.'
    }
  }

  /*
   * Num browser realmente novo a base está vazia.
   *
   * Nesse caso é seguro recuperar automaticamente a cópia.
   * Se já houver qualquer registo local, nunca o substituímos sem
   * uma confirmação posterior do utilizador.
   */
  if (
    localRecords >
      0
  ) {
    return {
      authorized:
        true,

      dataStatus:
        'manual-restore-required',

      serverRevision:
        downloaded.remote
          .serverRevision,

      restoredRecords:
        0,

      message:
        'Este dispositivo ficou autorizado, mas já contém dados locais diferentes. Por segurança, nada foi substituído. Compare as cópias em Definições → Dados e cópias.'
    }
  }

  let restored

  try {
    restored =
      await restoreMAProfessorDatabaseSnapshotIfLocalUnchanged(
        downloaded.snapshot,
        localContentSignature
      )
  } catch (error) {
    if (
      error instanceof
        MAProfessorLocalSnapshotChangedError
    ) {
      return {
        authorized:
          true,

        dataStatus:
          'manual-restore-required',

        serverRevision:
          downloaded.remote
            .serverRevision,

        restoredRecords:
          0,

        message:
          'Este dispositivo ficou autorizado, mas os dados locais foram alterados durante a recuperação. Por segurança, nada foi substituído. Compare as cópias em Definições → Dados e cópias.'
      }
    }

    throw error
  }

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
      'A cópia foi restaurada, mas a verificação final não corresponde aos dados online. Recarregue a aplicação antes de fazer alterações.'
    )
  }

  const verifiedAt =
    new Date()
      .toISOString()

  saveMAProfessorManualSyncState(
    email,
    deviceId,
    {
      serverRevision:
        downloaded.remote
          .serverRevision,

      fingerprint:
        remoteFingerprint,

      syncedAt:
        downloaded.remote
          .updatedAt,

      verifiedAt,

      lastOperation:
        'restore'
    }
  )

  return {
    authorized:
      true,

    dataStatus:
      'restored',

    serverRevision:
      downloaded.remote
        .serverRevision,

    restoredRecords:
      restored.totalRecords,

    message:
      `Este dispositivo ficou autorizado e foram recuperados ${restored.totalRecords} registos da sua cópia online.`
  }
}
