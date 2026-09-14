import {
  unzlibSync,
  zlibSync
} from 'fflate'

import type {
  MAProfessorAccessSession
} from '../access/accessTypes'

import type {
  BackupValidationResult,
  MAProfessorBackup
} from '../types'

import {
  validateMAProfessorBackup
} from '../settings/backupRepository'

const API_PREFIX =
  '/api/ma-professor/cloud-backup'

const RECORD_ID =
  'database-v1'

const ENCRYPTION_VERSION =
  1 as const

const ENCRYPTION_ALGORITHM =
  'AES-256-GCM' as const

const AAD =
  'MA-PROF-CLOUD-BACKUP-1'

const MAX_REQUEST_BYTES =
  1_500_000

const textEncoder =
  new TextEncoder()

const textDecoder =
  new TextDecoder()

export interface MAProfessorCloudBackupStatus {
  success: true
  serverRevision: number
  cryptoVersion: number
  updatedAt: string
  backup: {
    found: boolean
    recordRevision: number | null
    updatedAt: string | null
    ciphertextBytes: number | null
  }
}

interface CloudBackupKeyResult {
  success: true
  cryptoVersion: number
  keyAlgorithm: typeof ENCRYPTION_ALGORITHM
  key: string
}

interface EncryptedCloudBackupRecord {
  encryptionVersion:
    typeof ENCRYPTION_VERSION
  encryptionAlgorithm:
    typeof ENCRYPTION_ALGORITHM
  nonce: string
  ciphertext: string
  ciphertextHash: string
}

interface CloudBackupGetNotFound {
  success: true
  found: false
  recordId: string
  serverRevision: number
}

interface CloudBackupGetFound {
  success: true
  found: true
  recordId: string
  serverRevision: number
  recordRevision: number
  updatedAt: string
  encrypted:
    EncryptedCloudBackupRecord
}

type CloudBackupGetResult =
  | CloudBackupGetNotFound
  | CloudBackupGetFound

export interface MAProfessorDownloadedCloudBackup {
  backup: MAProfessorBackup
  validation: BackupValidationResult
  serverRevision: number
  recordRevision: number
  updatedAt: string
  ciphertextHash: string
  plaintextHash: string
}

export interface MAProfessorUploadedCloudBackup {
  serverRevision: number
  recordRevision: number
  updatedAt: string
  plaintextBytes: number
  encryptedBytes: number
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isNonNegativeInteger(
  value: unknown
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0
  )
}

function isPositiveInteger(
  value: unknown
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1
  )
}

function assertSession(
  session:
    MAProfessorAccessSession
) {
  if (
    !session.token.trim() ||
    !session.deviceId.trim() ||
    !session.email.trim()
  ) {
    throw new Error(
      'A sessão do MA-Professor não está disponível.'
    )
  }
}

function sessionBody(
  session:
    MAProfessorAccessSession
) {
  assertSession(session)

  return {
    token:
      session.token,
    deviceId:
      session.deviceId
  }
}

function bytesToBase64(
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

  return globalThis.btoa(binary)
}

function base64ToBytes(
  value: string
) {
  let binary: string

  try {
    binary =
      globalThis.atob(value)
  } catch {
    throw new Error(
      'A cópia cifrada recebida não tem um formato válido.'
    )
  }

  const bytes =
    new Uint8Array(
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

function toArrayBuffer(
  bytes: Uint8Array
): ArrayBuffer {
  const copy =
    new Uint8Array(
      bytes.byteLength
    )

  copy.set(bytes)

  return copy.buffer
}

async function sha256Base64(
  bytes: Uint8Array
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      toArrayBuffer(bytes)
    )

  return bytesToBase64(
    new Uint8Array(digest)
  )
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
  fallbackMessage: string
) {
  const serialized =
    JSON.stringify(body)

  if (
    textEncoder.encode(serialized)
      .byteLength >
    MAX_REQUEST_BYTES
  ) {
    throw new Error(
      'A cópia cifrada ultrapassa o limite permitido para o envio online.'
    )
  }

  let response: Response

  try {
    response =
      await fetch(
        `${API_PREFIX}${path}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Accept:
              'application/json'
          },
          cache:
            'no-store',
          body:
            serialized
        }
      )
  } catch {
    throw new Error(
      'Não foi possível ligar ao serviço de cópias cifradas. Os dados continuam guardados neste dispositivo.'
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
      isObject(data) &&
      typeof data.message === 'string' &&
      data.message.trim()
        ? data.message.trim()
        : fallbackMessage

    throw new Error(message)
  }

  return data
}

function parseStatus(
  value: unknown
): MAProfessorCloudBackupStatus {
  if (
    !isObject(value) ||
    value.success !== true ||
    !isNonNegativeInteger(
      value.serverRevision
    ) ||
    !isPositiveInteger(
      value.cryptoVersion
    ) ||
    typeof value.updatedAt !== 'string' ||
    !value.updatedAt ||
    !isObject(value.backup)
  ) {
    throw new Error(
      'O serviço devolveu um estado de cópia inválido.'
    )
  }

  const backup =
    value.backup
  const found =
    backup.found
  const recordRevision =
    backup.recordRevision
  const backupUpdatedAt =
    backup.updatedAt
  const ciphertextBytes =
    backup.ciphertextBytes

  if (
    typeof found !== 'boolean' ||
    !(
      recordRevision === null ||
      isPositiveInteger(recordRevision)
    ) ||
    !(
      backupUpdatedAt === null ||
      typeof backupUpdatedAt === 'string'
    ) ||
    !(
      ciphertextBytes === null ||
      isNonNegativeInteger(
        ciphertextBytes
      )
    )
  ) {
    throw new Error(
      'O serviço devolveu metadados de cópia inválidos.'
    )
  }

  return {
    success: true,
    serverRevision:
      value.serverRevision,
    cryptoVersion:
      value.cryptoVersion,
    updatedAt:
      value.updatedAt,
    backup: {
      found,
      recordRevision,
      updatedAt:
        backupUpdatedAt,
      ciphertextBytes
    }
  }
}

function parseKey(
  value: unknown
): CloudBackupKeyResult {
  if (
    !isObject(value) ||
    value.success !== true ||
    !isPositiveInteger(
      value.cryptoVersion
    ) ||
    value.keyAlgorithm !==
      ENCRYPTION_ALGORITHM ||
    typeof value.key !== 'string' ||
    !value.key
  ) {
    throw new Error(
      'O serviço devolveu uma chave de cópia inválida.'
    )
  }

  if (
    base64ToBytes(value.key)
      .byteLength !== 32
  ) {
    throw new Error(
      'A chave de cópia devolvida não tem o tamanho esperado.'
    )
  }

  return {
    success: true,
    cryptoVersion:
      value.cryptoVersion,
    keyAlgorithm:
      ENCRYPTION_ALGORITHM,
    key:
      value.key
  }
}

function parseEncryptedRecord(
  value: unknown
): EncryptedCloudBackupRecord {
  if (
    !isObject(value) ||
    value.encryptionVersion !==
      ENCRYPTION_VERSION ||
    value.encryptionAlgorithm !==
      ENCRYPTION_ALGORITHM ||
    typeof value.nonce !== 'string' ||
    !value.nonce ||
    typeof value.ciphertext !== 'string' ||
    !value.ciphertext ||
    typeof value.ciphertextHash !== 'string' ||
    !value.ciphertextHash
  ) {
    throw new Error(
      'O serviço devolveu uma cópia cifrada inválida.'
    )
  }

  return {
    encryptionVersion:
      ENCRYPTION_VERSION,
    encryptionAlgorithm:
      ENCRYPTION_ALGORITHM,
    nonce:
      value.nonce,
    ciphertext:
      value.ciphertext,
    ciphertextHash:
      value.ciphertextHash
  }
}

function parseGetResult(
  value: unknown
): CloudBackupGetResult {
  if (
    !isObject(value) ||
    value.success !== true ||
    typeof value.found !== 'boolean' ||
    value.recordId !== RECORD_ID ||
    !isNonNegativeInteger(
      value.serverRevision
    )
  ) {
    throw new Error(
      'O serviço devolveu uma resposta inválida ao consultar a cópia.'
    )
  }

  if (value.found === false) {
    return {
      success: true,
      found: false,
      recordId:
        RECORD_ID,
      serverRevision:
        value.serverRevision
    }
  }

  if (
    !isPositiveInteger(
      value.recordRevision
    ) ||
    typeof value.updatedAt !== 'string' ||
    !value.updatedAt
  ) {
    throw new Error(
      'O serviço devolveu metadados inválidos para a cópia.'
    )
  }

  return {
    success: true,
    found: true,
    recordId:
      RECORD_ID,
    serverRevision:
      value.serverRevision,
    recordRevision:
      value.recordRevision,
    updatedAt:
      value.updatedAt,
    encrypted:
      parseEncryptedRecord(
        value.encrypted
      )
  }
}

function parsePushResult(
  value: unknown
) {
  if (
    !isObject(value) ||
    value.success !== true ||
    !isPositiveInteger(
      value.serverRevision
    ) ||
    !isPositiveInteger(
      value.recordRevision
    ) ||
    typeof value.updatedAt !== 'string' ||
    !value.updatedAt
  ) {
    throw new Error(
      'O serviço devolveu uma resposta inválida ao guardar a cópia.'
    )
  }

  return {
    serverRevision:
      value.serverRevision,
    recordRevision:
      value.recordRevision,
    updatedAt:
      value.updatedAt
  }
}

async function readStatus(
  session:
    MAProfessorAccessSession
) {
  const data =
    await postJson(
      '/status',
      sessionBody(session),
      'Não foi possível verificar a cópia online.'
    )

  return parseStatus(data)
}

async function readKey(
  session:
    MAProfessorAccessSession
) {
  const data =
    await postJson(
      '/key',
      sessionBody(session),
      'Não foi possível abrir a proteção da cópia.'
    )

  return parseKey(data)
}

async function importBackupKey(
  session:
    MAProfessorAccessSession
) {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Este browser não suporta a proteção criptográfica necessária.'
    )
  }

  const keyResult =
    await readKey(session)

  return globalThis.crypto.subtle.importKey(
    'raw',
    toArrayBuffer(
      base64ToBytes(
        keyResult.key
      )
    ),
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    [
      'encrypt',
      'decrypt'
    ]
  )
}

async function encryptBackup(
  backup:
    MAProfessorBackup,
  key:
    CryptoKey
) {
  const plaintext =
    textEncoder.encode(
      JSON.stringify(backup)
    )

  const compressed =
    zlibSync(
      plaintext,
      {
        level: 6
      }
    )

  const nonce =
    globalThis.crypto.getRandomValues(
      new Uint8Array(12)
    )

  const encryptedBuffer =
    await globalThis.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData:
          textEncoder.encode(AAD),
        tagLength: 128
      },
      key,
      toArrayBuffer(compressed)
    )

  const ciphertext =
    new Uint8Array(
      encryptedBuffer
    )

  return {
    plaintextBytes:
      plaintext.byteLength,
    plaintextHash:
      await sha256Base64(plaintext),
    encryptedBytes:
      ciphertext.byteLength,
    encrypted: {
      encryptionVersion:
        ENCRYPTION_VERSION,
      encryptionAlgorithm:
        ENCRYPTION_ALGORITHM,
      nonce:
        bytesToBase64(nonce),
      ciphertext:
        bytesToBase64(ciphertext),
      ciphertextHash:
        await sha256Base64(
          ciphertext
        )
    } satisfies
      EncryptedCloudBackupRecord
  }
}

async function decryptBackup(
  encrypted:
    EncryptedCloudBackupRecord,
  key:
    CryptoKey
) {
  const nonce =
    base64ToBytes(
      encrypted.nonce
    )

  if (nonce.byteLength !== 12) {
    throw new Error(
      'A cópia cifrada contém um nonce inválido.'
    )
  }

  const ciphertext =
    base64ToBytes(
      encrypted.ciphertext
    )

  const actualHash =
    await sha256Base64(
      ciphertext
    )

  if (
    actualHash !==
    encrypted.ciphertextHash
  ) {
    throw new Error(
      'A integridade da cópia cifrada não pôde ser confirmada.'
    )
  }

  let compressedBuffer:
    ArrayBuffer

  try {
    compressedBuffer =
      await globalThis.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          additionalData:
            textEncoder.encode(AAD),
          tagLength: 128
        },
        key,
        toArrayBuffer(ciphertext)
      )
  } catch {
    throw new Error(
      'Não foi possível decifrar a cópia com esta sessão.'
    )
  }

  let plaintext:
    Uint8Array

  try {
    plaintext =
      unzlibSync(
        new Uint8Array(
          compressedBuffer
        )
      )
  } catch {
    throw new Error(
      'A cópia cifrada está danificada ou incompleta.'
    )
  }

  let parsed: unknown

  try {
    parsed =
      JSON.parse(
        textDecoder.decode(
          plaintext
        )
      )
  } catch {
    throw new Error(
      'A cópia decifrada não contém dados JSON válidos.'
    )
  }

  const validation =
    validateMAProfessorBackup(parsed)

  if (!validation.valid) {
    throw new Error(
      'A cópia online foi decifrada, mas contém erros que impedem o restauro.'
    )
  }

  return {
    backup:
      parsed as MAProfessorBackup,
    validation,
    plaintextHash:
      await sha256Base64(plaintext)
  }
}

async function getEncryptedBackup(
  session:
    MAProfessorAccessSession
) {
  const data =
    await postJson(
      '/get',
      {
        ...sessionBody(session),
        recordId:
          RECORD_ID
      },
      'Não foi possível descarregar a cópia cifrada.'
    )

  return parseGetResult(data)
}

export async function inspectMAProfessorCloudBackup(
  session:
    MAProfessorAccessSession
) {
  return readStatus(session)
}

export async function uploadAndVerifyMAProfessorCloudBackup(
  session:
    MAProfessorAccessSession,
  backup:
    MAProfessorBackup
): Promise<MAProfessorUploadedCloudBackup> {
  const status =
    await readStatus(session)
  const key =
    await importBackupKey(session)
  const prepared =
    await encryptBackup(
      backup,
      key
    )

  const pushData =
    parsePushResult(
      await postJson(
        '/push',
        {
          ...sessionBody(session),
          recordId:
            RECORD_ID,
          expectedServerRevision:
            status.serverRevision,
          encrypted:
            prepared.encrypted
        },
        'Não foi possível guardar a cópia cifrada.'
      )
    )

  const remote =
    await getEncryptedBackup(session)

  if (remote.found === false) {
    throw new Error(
      'A cópia foi enviada, mas não pôde ser confirmada no servidor.'
    )
  }

  if (
    remote.serverRevision !==
      pushData.serverRevision ||
    remote.recordRevision !==
      pushData.recordRevision
  ) {
    throw new Error(
      'A cópia online foi atualizada noutro dispositivo durante a verificação. Atualize o estado antes de continuar.'
    )
  }

  const verified =
    await decryptBackup(
      remote.encrypted,
      key
    )

  if (
    verified.plaintextHash !==
      prepared.plaintextHash
  ) {
    throw new Error(
      'A cópia guardada no servidor não corresponde aos dados enviados.'
    )
  }

  return {
    serverRevision:
      pushData.serverRevision,
    recordRevision:
      pushData.recordRevision,
    updatedAt:
      pushData.updatedAt,
    plaintextBytes:
      prepared.plaintextBytes,
    encryptedBytes:
      prepared.encryptedBytes
  }
}

export async function downloadMAProfessorCloudBackup(
  session:
    MAProfessorAccessSession
): Promise<MAProfessorDownloadedCloudBackup | null> {
  const remote =
    await getEncryptedBackup(session)

  if (remote.found === false) {
    return null
  }

  const key =
    await importBackupKey(session)
  const decrypted =
    await decryptBackup(
      remote.encrypted,
      key
    )

  return {
    backup:
      decrypted.backup,
    validation:
      decrypted.validation,
    serverRevision:
      remote.serverRevision,
    recordRevision:
      remote.recordRevision,
    updatedAt:
      remote.updatedAt,
    ciphertextHash:
      remote.encrypted.ciphertextHash,
    plaintextHash:
      decrypted.plaintextHash
  }
}
