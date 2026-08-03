const CRYPTO_VERSION = 1 as const
const RECORD_ENCRYPTION_VERSION = 1 as const

const MASTER_KEY_ALGORITHM = 'AES-GCM' as const
const MASTER_KEY_LENGTH = 256
const AES_GCM_IV_BYTES = 12

const DEVICE_KEY_ALGORITHM = 'RSA-OAEP' as const
const DEVICE_KEY_MODULUS_LENGTH = 3072
const DEVICE_KEY_HASH = 'SHA-256' as const

const RECOVERY_KDF_ALGORITHM =
  'PBKDF2-HMAC-SHA-256' as const
const RECOVERY_KDF_HASH = 'SHA-256' as const
const RECOVERY_KDF_ITERATIONS = 600_000
const RECOVERY_SALT_BYTES = 16
const RECOVERY_SECRET_BYTES = 20
const RECOVERY_PREFIX = 'MA-PROF'

const RECOVERY_WRAP_ALGORITHM =
  'AES-256-GCM' as const
const DEVICE_WRAP_ALGORITHM =
  'RSA-OAEP-3072-SHA-256' as const
const RECORD_ENCRYPTION_ALGORITHM =
  'AES-256-GCM' as const

const RECOVERY_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export interface MAProfessorRecoveryKdfParameters {
  iterations: number
  hash: typeof RECOVERY_KDF_HASH
  saltBytes: number
}

export interface MAProfessorCryptoProfilePayload {
  cryptoVersion: typeof CRYPTO_VERSION
  recoveryKdfAlgorithm:
    typeof RECOVERY_KDF_ALGORITHM
  recoveryKdfSalt: string
  recoveryKdfParameters: string
  recoveryKeyWrapAlgorithm:
    typeof RECOVERY_WRAP_ALGORITHM
  recoveryWrappedMasterKey: string
  recoveryWrappedMasterKeyNonce: string
}

export interface MAProfessorDeviceCryptoPayload {
  deviceIdHash: string
  devicePublicKey: string
  keyWrapAlgorithm:
    typeof DEVICE_WRAP_ALGORITHM
  wrappedMasterKey: string
  wrappedMasterKeyNonce: ''
}

export interface MAProfessorGeneratedCryptoMaterial {
  cryptoVersion: typeof CRYPTO_VERSION
  createdAt: string
  recoveryCode: string
  masterKey: CryptoKey
  devicePrivateKey: CryptoKey
  profile: MAProfessorCryptoProfilePayload
  device: MAProfessorDeviceCryptoPayload
}

export interface MAProfessorEncryptedRecord {
  encryptionVersion:
    typeof RECORD_ENCRYPTION_VERSION
  encryptionAlgorithm:
    typeof RECORD_ENCRYPTION_ALGORITHM
  nonce: string
  ciphertext: string
  ciphertextHash: string
}

interface WrappedRecordEnvelope<T> {
  version: typeof RECORD_ENCRYPTION_VERSION
  recordId: string
  value: T
}

function assertWebCryptoAvailable() {
  if (
    !globalThis.crypto ||
    !globalThis.crypto.subtle ||
    typeof globalThis.crypto.getRandomValues !==
      'function'
  ) {
    throw new Error(
      'Este browser não suporta a proteção criptográfica necessária ao MA-Professor.'
    )
  }
}

function getRandomBytes(length: number) {
  assertWebCryptoAvailable()

  return globalThis.crypto.getRandomValues(
    new Uint8Array(length)
  )
}

function toArrayBuffer(
  value: Uint8Array
): ArrayBuffer {
  const copy = new Uint8Array(
    value.byteLength
  )

  copy.set(value)

  return copy.buffer
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    const chunk = bytes.subarray(
      offset,
      Math.min(
        offset + chunkSize,
        bytes.length
      )
    )

    binary += String.fromCharCode(
      ...chunk
    )
  }

  return globalThis.btoa(binary)
}

function arrayBufferToBase64(
  value: ArrayBuffer
) {
  return bytesToBase64(
    new Uint8Array(value)
  )
}

function base64ToBytes(value: string) {
  let binary: string

  try {
    binary = globalThis.atob(value)
  } catch {
    throw new Error(
      'Os dados cifrados não têm um formato válido.'
    )
  }

  const bytes = new Uint8Array(
    binary.length
  )

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index)
  }

  return bytes
}

function bytesToBase32(bytes: Uint8Array) {
  let output = ''
  let buffer = 0
  let bits = 0

  for (const byte of bytes) {
    buffer =
      (buffer << 8) | byte
    bits += 8

    while (bits >= 5) {
      output +=
        RECOVERY_ALPHABET[
          (buffer >>> (bits - 5)) & 31
        ]

      bits -= 5
    }
  }

  if (bits > 0) {
    output +=
      RECOVERY_ALPHABET[
        (buffer << (5 - bits)) & 31
      ]
  }

  return output
}

function formatRecoveryCode(
  compactSecret: string
) {
  const groups =
    compactSecret.match(/.{1,4}/g) || []

  return [
    RECOVERY_PREFIX,
    ...groups
  ].join('-')
}

function normalizeRecoverySecret(
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
          RECOVERY_PREFIX.length + 1
        )
      : normalized

  const compact =
    withoutPrefix.replace(
      /[\s-]+/g,
      ''
    )

  if (
    compact.length !== 32 ||
    [...compact].some(
      character =>
        !RECOVERY_ALPHABET.includes(
          character
        )
    )
  ) {
    throw new Error(
      'A chave de recuperação não é válida.'
    )
  }

  return compact
}

function createRecoveryCode() {
  return formatRecoveryCode(
    bytesToBase32(
      getRandomBytes(
        RECOVERY_SECRET_BYTES
      )
    )
  )
}

async function hashBytes(
  value: Uint8Array
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      toArrayBuffer(value)
    )

  return new Uint8Array(digest)
}

async function deriveRecoveryWrappingKey(
  recoveryCode: string,
  salt: Uint8Array,
  parameters: MAProfessorRecoveryKdfParameters
) {
  const compactSecret =
    normalizeRecoverySecret(
      recoveryCode
    )

  const baseKey =
    await globalThis.crypto.subtle.importKey(
      'raw',
      textEncoder.encode(
        compactSecret
      ),
      'PBKDF2',
      false,
      ['deriveKey']
    )

  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(
        salt
      ),
      iterations:
        parameters.iterations,
      hash: parameters.hash
    },
    baseKey,
    {
      name: MASTER_KEY_ALGORITHM,
      length: MASTER_KEY_LENGTH
    },
    false,
    [
      'wrapKey',
      'unwrapKey'
    ]
  )
}

async function generateDeviceKeyPair() {
  const result =
    await globalThis.crypto.subtle.generateKey(
      {
        name: DEVICE_KEY_ALGORITHM,
        modulusLength:
          DEVICE_KEY_MODULUS_LENGTH,
        publicExponent:
          new Uint8Array([1, 0, 1]),
        hash: DEVICE_KEY_HASH
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
    !('publicKey' in result) ||
    !('privateKey' in result)
  ) {
    throw new Error(
      'Não foi possível criar a chave deste dispositivo.'
    )
  }

  return result
}

async function importMasterKeyFromDeviceWrap(
  wrappedMasterKey: ArrayBuffer,
  privateKey: CryptoKey
) {
  return globalThis.crypto.subtle.unwrapKey(
    'raw',
    wrappedMasterKey,
    privateKey,
    {
      name: DEVICE_KEY_ALGORITHM
    },
    {
      name: MASTER_KEY_ALGORITHM,
      length: MASTER_KEY_LENGTH
    },
    false,
    [
      'encrypt',
      'decrypt'
    ]
  )
}

export async function hashMAProfessorDeviceId(
  deviceId: string
) {
  assertWebCryptoAvailable()

  const normalized =
    deviceId.trim()

  if (!normalized) {
    throw new Error(
      'O identificador do dispositivo não é válido.'
    )
  }

  const digest =
    await hashBytes(
      textEncoder.encode(
        `ma-professor-device-v1:${normalized}`
      )
    )

  return bytesToBase64(digest)
}

export async function createMAProfessorCryptoMaterial(
  deviceId: string
): Promise<MAProfessorGeneratedCryptoMaterial> {
  assertWebCryptoAvailable()

  const normalizedDeviceId =
    deviceId.trim()

  if (!normalizedDeviceId) {
    throw new Error(
      'O identificador do dispositivo não é válido.'
    )
  }

  const recoveryCode =
    createRecoveryCode()

  const recoverySalt =
    getRandomBytes(
      RECOVERY_SALT_BYTES
    )

  const recoveryNonce =
    getRandomBytes(
      AES_GCM_IV_BYTES
    )

  const recoveryParameters:
    MAProfessorRecoveryKdfParameters = {
      iterations:
        RECOVERY_KDF_ITERATIONS,
      hash:
        RECOVERY_KDF_HASH,
      saltBytes:
        RECOVERY_SALT_BYTES
    }

  const recoveryWrappingKey =
    await deriveRecoveryWrappingKey(
      recoveryCode,
      recoverySalt,
      recoveryParameters
    )

  const deviceKeyPair =
    await generateDeviceKeyPair()

  const extractableMasterKey =
    await globalThis.crypto.subtle.generateKey(
      {
        name: MASTER_KEY_ALGORITHM,
        length: MASTER_KEY_LENGTH
      },
      true,
      [
        'encrypt',
        'decrypt'
      ]
    )

  if (
    !(
      extractableMasterKey instanceof
      CryptoKey
    )
  ) {
    throw new Error(
      'Não foi possível criar a chave principal.'
    )
  }

  const recoveryWrappedMasterKey =
    await globalThis.crypto.subtle.wrapKey(
      'raw',
      extractableMasterKey,
      recoveryWrappingKey,
      {
        name: MASTER_KEY_ALGORITHM,
        iv: recoveryNonce,
        tagLength: 128
      }
    )

  const deviceWrappedMasterKey =
    await globalThis.crypto.subtle.wrapKey(
      'raw',
      extractableMasterKey,
      deviceKeyPair.publicKey,
      {
        name: DEVICE_KEY_ALGORITHM
      }
    )

  const masterKey =
    await importMasterKeyFromDeviceWrap(
      deviceWrappedMasterKey,
      deviceKeyPair.privateKey
    )

  const publicKeyJwk =
    await globalThis.crypto.subtle.exportKey(
      'jwk',
      deviceKeyPair.publicKey
    )

  const deviceIdHash =
    await hashMAProfessorDeviceId(
      normalizedDeviceId
    )

  return {
    cryptoVersion:
      CRYPTO_VERSION,
    createdAt:
      new Date().toISOString(),
    recoveryCode,
    masterKey,
    devicePrivateKey:
      deviceKeyPair.privateKey,
    profile: {
      cryptoVersion:
        CRYPTO_VERSION,
      recoveryKdfAlgorithm:
        RECOVERY_KDF_ALGORITHM,
      recoveryKdfSalt:
        bytesToBase64(
          recoverySalt
        ),
      recoveryKdfParameters:
        JSON.stringify(
          recoveryParameters
        ),
      recoveryKeyWrapAlgorithm:
        RECOVERY_WRAP_ALGORITHM,
      recoveryWrappedMasterKey:
        arrayBufferToBase64(
          recoveryWrappedMasterKey
        ),
      recoveryWrappedMasterKeyNonce:
        bytesToBase64(
          recoveryNonce
        )
    },
    device: {
      deviceIdHash,
      devicePublicKey:
        JSON.stringify(
          publicKeyJwk
        ),
      keyWrapAlgorithm:
        DEVICE_WRAP_ALGORITHM,
      wrappedMasterKey:
        arrayBufferToBase64(
          deviceWrappedMasterKey
        ),
      wrappedMasterKeyNonce: ''
    }
  }
}

export async function unlockMAProfessorMasterKeyWithDevice(
  privateKey: CryptoKey,
  wrappedMasterKey: string
) {
  assertWebCryptoAvailable()

  if (
    privateKey.type !== 'private' ||
    privateKey.algorithm.name !==
      DEVICE_KEY_ALGORITHM
  ) {
    throw new Error(
      'A chave privada deste dispositivo não é válida.'
    )
  }

  return importMasterKeyFromDeviceWrap(
    base64ToBytes(
      wrappedMasterKey
    ).buffer,
    privateKey
  )
}

export async function unlockMAProfessorMasterKeyWithRecoveryCode(
  recoveryCode: string,
  profile: MAProfessorCryptoProfilePayload
) {
  assertWebCryptoAvailable()

  if (
    profile.cryptoVersion !==
      CRYPTO_VERSION ||
    profile.recoveryKdfAlgorithm !==
      RECOVERY_KDF_ALGORITHM ||
    profile.recoveryKeyWrapAlgorithm !==
      RECOVERY_WRAP_ALGORITHM
  ) {
    throw new Error(
      'Esta versão da proteção de dados ainda não é suportada.'
    )
  }

  let parameters:
    MAProfessorRecoveryKdfParameters

  try {
    parameters = JSON.parse(
      profile.recoveryKdfParameters
    ) as MAProfessorRecoveryKdfParameters
  } catch {
    throw new Error(
      'A configuração da chave de recuperação não é válida.'
    )
  }

  if (
    parameters.iterations < 1 ||
    parameters.hash !==
      RECOVERY_KDF_HASH ||
    parameters.saltBytes !==
      RECOVERY_SALT_BYTES
  ) {
    throw new Error(
      'A configuração da chave de recuperação não é suportada.'
    )
  }

  const recoveryWrappingKey =
    await deriveRecoveryWrappingKey(
      recoveryCode,
      base64ToBytes(
        profile.recoveryKdfSalt
      ),
      parameters
    )

  try {
    return await globalThis.crypto.subtle.unwrapKey(
      'raw',
      base64ToBytes(
        profile.recoveryWrappedMasterKey
      ),
      recoveryWrappingKey,
      {
        name: MASTER_KEY_ALGORITHM,
        iv: base64ToBytes(
          profile.recoveryWrappedMasterKeyNonce
        ),
        tagLength: 128
      },
      {
        name: MASTER_KEY_ALGORITHM,
        length: MASTER_KEY_LENGTH
      },
      false,
      [
        'encrypt',
        'decrypt'
      ]
    )
  } catch {
    throw new Error(
      'A chave de recuperação está incorreta ou os dados foram alterados.'
    )
  }
}

export async function encryptMAProfessorRecord<T>(
  masterKey: CryptoKey,
  recordId: string,
  value: T
): Promise<MAProfessorEncryptedRecord> {
  assertWebCryptoAvailable()

  const normalizedRecordId =
    recordId.trim()

  if (!normalizedRecordId) {
    throw new Error(
      'O identificador do registo não é válido.'
    )
  }

  if (
    masterKey.type !== 'secret' ||
    masterKey.algorithm.name !==
      MASTER_KEY_ALGORITHM
  ) {
    throw new Error(
      'A chave principal não é válida.'
    )
  }

  const nonce =
    getRandomBytes(
      AES_GCM_IV_BYTES
    )

  const additionalData =
    textEncoder.encode(
      `ma-professor-record-v1:${normalizedRecordId}`
    )

  const envelope:
    WrappedRecordEnvelope<T> = {
      version:
        RECORD_ENCRYPTION_VERSION,
      recordId:
        normalizedRecordId,
      value
    }

  const ciphertext =
    await globalThis.crypto.subtle.encrypt(
      {
        name: MASTER_KEY_ALGORITHM,
        iv: nonce,
        additionalData,
        tagLength: 128
      },
      masterKey,
      textEncoder.encode(
        JSON.stringify(envelope)
      )
    )

  const ciphertextBytes =
    new Uint8Array(ciphertext)

  const ciphertextHash =
    await hashBytes(
      ciphertextBytes
    )

  return {
    encryptionVersion:
      RECORD_ENCRYPTION_VERSION,
    encryptionAlgorithm:
      RECORD_ENCRYPTION_ALGORITHM,
    nonce:
      bytesToBase64(nonce),
    ciphertext:
      bytesToBase64(
        ciphertextBytes
      ),
    ciphertextHash:
      bytesToBase64(
        ciphertextHash
      )
  }
}

function equalBytes(
  left: Uint8Array,
  right: Uint8Array
) {
  if (
    left.length !== right.length
  ) {
    return false
  }

  let difference = 0

  for (
    let index = 0;
    index < left.length;
    index += 1
  ) {
    difference |=
      left[index] ^ right[index]
  }

  return difference === 0
}

export async function decryptMAProfessorRecord<T>(
  masterKey: CryptoKey,
  recordId: string,
  encrypted: MAProfessorEncryptedRecord
): Promise<T> {
  assertWebCryptoAvailable()

  const normalizedRecordId =
    recordId.trim()

  if (!normalizedRecordId) {
    throw new Error(
      'O identificador do registo não é válido.'
    )
  }

  if (
    encrypted.encryptionVersion !==
      RECORD_ENCRYPTION_VERSION ||
    encrypted.encryptionAlgorithm !==
      RECORD_ENCRYPTION_ALGORITHM
  ) {
    throw new Error(
      'Esta versão do registo cifrado ainda não é suportada.'
    )
  }

  const ciphertext =
    base64ToBytes(
      encrypted.ciphertext
    )

  const expectedHash =
    base64ToBytes(
      encrypted.ciphertextHash
    )

  const actualHash =
    await hashBytes(
      ciphertext
    )

  if (
    !equalBytes(
      expectedHash,
      actualHash
    )
  ) {
    throw new Error(
      'O registo cifrado foi alterado ou está incompleto.'
    )
  }

  const additionalData =
    textEncoder.encode(
      `ma-professor-record-v1:${normalizedRecordId}`
    )

  let plaintext: ArrayBuffer

  try {
    plaintext =
      await globalThis.crypto.subtle.decrypt(
        {
          name: MASTER_KEY_ALGORITHM,
          iv: base64ToBytes(
            encrypted.nonce
          ),
          additionalData,
          tagLength: 128
        },
        masterKey,
        ciphertext
      )
  } catch {
    throw new Error(
      'Não foi possível desencriptar este registo.'
    )
  }

  let envelope: unknown

  try {
    envelope = JSON.parse(
      textDecoder.decode(
        plaintext
      )
    )
  } catch {
    throw new Error(
      'O conteúdo desencriptado não é válido.'
    )
  }

  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    Array.isArray(envelope) ||
    !('version' in envelope) ||
    envelope.version !==
      RECORD_ENCRYPTION_VERSION ||
    !('recordId' in envelope) ||
    envelope.recordId !==
      normalizedRecordId ||
    !('value' in envelope)
  ) {
    throw new Error(
      'O conteúdo desencriptado não corresponde ao registo solicitado.'
    )
  }

  return envelope.value as T
}
