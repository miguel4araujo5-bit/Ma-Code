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

import {
  readMAProfessorOpaqueExportKey
} from '../access/accessStorage'

import {
  createMAProfessorBackupV3KeyMaterial,
  decryptMAProfessorBackupV3Data,
  encryptMAProfessorBackupV3Data,
  unwrapMAProfessorBackupV3MasterKey
} from './cloudBackupV3Crypto'

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
  protection: import('./cloudBackupV3Crypto').MAProfessorBackupV3WrappedMasterKey | null
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
  cryptoVersion: number
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

export interface MAProfessorPreparedCloudBackupV3Promotion {
  profile: Awaited<
    ReturnType<
      typeof createMAProfessorBackupV3KeyMaterial
    >
  >['wrapped']
  encrypted: Awaited<
    ReturnType<
      typeof encryptMAProfessorBackupV3Data
    >
  >
  plaintextHash: string
  plaintextBytes: number
  encryptedBytes: number
}

export interface MAProfessorCloudBackupUploadOptions {
  expectedServerRevision?: number
  canUpload?: () => boolean
}

export class MAProfessorCloudBackupRevisionConflictError
  extends Error {
  constructor(
    message =
      'Existe uma cópia online mais recente. Por segurança, a cópia automática foi interrompida.'
  ) {
    super(message)
    this.name =
      'MAProfessorCloudBackupRevisionConflictError'
  }
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

    if (
      response.status === 409 &&
      path === '/promote-v3'
    ) {
      throw new MAProfessorCloudBackupRevisionConflictError(
        message
      )
    }

    throw new Error(message)
  }

  return data
}

function isValidV3Protection(
  value: unknown
): value is import('./cloudBackupV3Crypto').MAProfessorBackupV3WrappedMasterKey {
  return (
    isObject(value) &&
    value.cryptoVersion === 3 &&
    value.recoveryKdfAlgorithm === 'OPAQUE-RFC9807-EXPORT-HKDF-SHA256' &&
    typeof value.recoveryKdfSalt === 'string' &&
    value.recoveryKdfSalt.length > 0 &&
    typeof value.recoveryKdfParameters === 'string' &&
    value.recoveryKdfParameters.length > 0 &&
    value.recoveryKeyWrapAlgorithm === 'AES-256-GCM' &&
    typeof value.recoveryWrappedMasterKey === 'string' &&
    value.recoveryWrappedMasterKey.length > 0 &&
    typeof value.recoveryWrappedMasterKeyNonce === 'string' &&
    value.recoveryWrappedMasterKeyNonce.length > 0
  )
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
    !(
      value.protection === null ||
      isObject(value.protection)
    ) ||
    !isObject(value.backup)
  ) {
    throw new Error(
      'O serviço devolveu um estado de cópia inválido.'
    )
  }

  if (
    ![2, 3].includes(
      value.cryptoVersion
    ) ||
    (
      value.cryptoVersion === 3
        ? !isValidV3Protection(value.protection)
        : value.protection !== null
    )
  ) {
    throw new Error(
      'O serviço devolveu uma proteção de cópia incompatível com a versão criptográfica.'
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
    protection:
      value.protection as MAProfessorCloudBackupStatus['protection'],
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
      value.cryptoVersion
    ) ||
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
    cryptoVersion:
      value.cryptoVersion,
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

function parsePromoteV3Result(
  value: unknown
) {
  if (
    !isObject(value) ||
    value.success !== true ||
    value.cryptoVersion !== 3 ||
    value.recordId !== RECORD_ID ||
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
      'O serviço devolveu uma resposta inválida ao promover a cópia v3.'
    )
  }

  return {
    cryptoVersion: 3 as const,
    serverRevision:
      value.serverRevision,
    recordRevision:
      value.recordRevision,
    updatedAt:
      value.updatedAt
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

export async function prepareMAProfessorCloudBackupV3Promotion(
  session: MAProfessorAccessSession,
  backup: MAProfessorBackup
): Promise<MAProfessorPreparedCloudBackupV3Promotion> {
  assertSession(session)

  const exportKey =
    readMAProfessorOpaqueExportKey(
      session.email
    )

  if (!exportKey) {
    throw new Error(
      'A sessão OPAQUE necessária para proteger a cópia v3 já não está disponível. Inicie sessão novamente antes de migrar a cópia.'
    )
  }

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
  const plaintextHash =
    await sha256Base64(
      plaintext
    )
  const keyMaterial =
    await createMAProfessorBackupV3KeyMaterial(
      exportKey
    )
  const encrypted =
    await encryptMAProfessorBackupV3Data(
      keyMaterial.masterKey,
      compressed,
      RECORD_ID
    )
  const decryptedCompressed =
    await decryptMAProfessorBackupV3Data(
      keyMaterial.masterKey,
      encrypted,
      RECORD_ID
    )
  const decrypted =
    unzlibSync(
      decryptedCompressed
    )
  const decryptedHash =
    await sha256Base64(
      decrypted
    )

  if (
    decryptedHash !==
      plaintextHash
  ) {
    throw new Error(
      'A validação local da cópia v3 falhou. A cópia online anterior foi preservada.'
    )
  }

  let parsed: unknown

  try {
    parsed =
      JSON.parse(
        textDecoder.decode(
          decrypted
        )
      )
  } catch {
    throw new Error(
      'A validação local da cópia v3 não encontrou dados JSON válidos. A cópia online anterior foi preservada.'
    )
  }

  const validation =
    validateMAProfessorBackup(
      parsed
    )

  if (!validation.valid) {
    throw new Error(
      'A validação local da cópia v3 encontrou dados incompatíveis. A cópia online anterior foi preservada.'
    )
  }

  return {
    profile:
      keyMaterial.wrapped,
    encrypted,
    plaintextHash,
    plaintextBytes:
      plaintext.byteLength,
    encryptedBytes:
      Math.floor(
        encrypted.ciphertext.length * 3 / 4
      )
  }
}

export async function promotePreparedMAProfessorCloudBackupV3(
  session: MAProfessorAccessSession,
  prepared: MAProfessorPreparedCloudBackupV3Promotion,
  expectedServerRevision: number,
  expectedRecordRevision: number
) {
  assertSession(session)

  if (
    !isNonNegativeInteger(
      expectedServerRevision
    ) ||
    !isNonNegativeInteger(
      expectedRecordRevision
    )
  ) {
    throw new Error(
      'A revisão esperada da cópia v3 não é válida.'
    )
  }

  const data =
    await postJson(
      '/promote-v3',
      {
        ...sessionBody(session),
        recordId:
          RECORD_ID,
        expectedServerRevision,
        expectedRecordRevision,
        profile:
          prepared.profile,
        encrypted:
          prepared.encrypted
      },
      'Não foi possível promover a cópia protegida para v3.'
    )

  return parsePromoteV3Result(
    data
  )
}

export async function uploadAndVerifyMAProfessorCloudBackup(
  session:
    MAProfessorAccessSession,
  backup:
    MAProfessorBackup,
  options:
    MAProfessorCloudBackupUploadOptions = {}
): Promise<MAProfessorUploadedCloudBackup> {
  const assertUploadAllowed = () => {
    if (options.canUpload && !options.canUpload()) {
      throw new Error('A cópia automática foi desativada. Não foram enviados novos dados.')
    }
  }

  assertUploadAllowed()

  const expectedServerRevision =
    options.expectedServerRevision

  if (
    expectedServerRevision !== undefined &&
    !isNonNegativeInteger(
      expectedServerRevision
    )
  ) {
    throw new Error(
      'A revisão esperada da cópia online não é válida.'
    )
  }

  const status =
    await readStatus(session)

  if (
    expectedServerRevision !== undefined &&
    status.serverRevision !==
      expectedServerRevision
  ) {
    throw new MAProfessorCloudBackupRevisionConflictError()
  }

  assertUploadAllowed()

  const key =
    await importBackupKey(session)
  assertUploadAllowed()

  const prepared =
    await encryptBackup(
      backup,
      key
    )

  // A escolha pode mudar enquanto o browser cifra uma cópia grande.
  assertUploadAllowed()

  let pushData:
    ReturnType<typeof parsePushResult>

  try {
    pushData =
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
  } catch (error) {
    if (
      expectedServerRevision !== undefined &&
      error instanceof Error &&
      error.message.includes(
        'cópia online mais recente'
      )
    ) {
      throw new MAProfessorCloudBackupRevisionConflictError(
        error.message
      )
    }

    throw error
  }

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
    if (
      expectedServerRevision !== undefined
    ) {
      throw new MAProfessorCloudBackupRevisionConflictError(
        'A cópia online foi atualizada noutro dispositivo durante a verificação. A cópia automática foi interrompida.'
      )
    }

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

export async function migrateMAProfessorCloudBackupV2ToV3(
  session: MAProfessorAccessSession
): Promise<MAProfessorDownloadedCloudBackup | null> {
  const status =
    await readStatus(session)

  if (status.cryptoVersion !== 2) {
    throw new Error(
      'A migração v3 só pode começar a partir de uma cópia v2 válida.'
    )
  }

  if (!status.backup.found) {
    return null
  }

  if (!isNonNegativeInteger(status.backup.recordRevision)) {
    throw new Error(
      'A revisão da cópia v2 não é válida para iniciar a migração.'
    )
  }

  const expectedRecordRevision =
    status.backup.recordRevision

  const legacy =
    await downloadMAProfessorCloudBackup(
      session
    )

  if (!legacy) {
    throw new MAProfessorCloudBackupRevisionConflictError(
      'A cópia v2 deixou de estar disponível durante a preparação da migração.'
    )
  }

  if (
    legacy.serverRevision !== status.serverRevision ||
    legacy.recordRevision !== expectedRecordRevision
  ) {
    throw new MAProfessorCloudBackupRevisionConflictError(
      'A cópia v2 mudou durante a preparação da migração.'
    )
  }

  const prepared =
    await prepareMAProfessorCloudBackupV3Promotion(
      session,
      legacy.backup
    )

  const promoted =
    await promotePreparedMAProfessorCloudBackupV3(
      session,
      prepared,
      legacy.serverRevision,
      legacy.recordRevision
    )

  const verified =
    await downloadMAProfessorCloudBackupV3(
      session
    )

  if (
    !verified ||
    verified.serverRevision !== promoted.serverRevision ||
    verified.recordRevision !== promoted.recordRevision ||
    verified.plaintextHash !== prepared.plaintextHash
  ) {
    throw new Error(
      'A promoção v3 terminou, mas a verificação local da cópia promovida não corresponde aos dados preparados.'
    )
  }

  return verified
}

export async function downloadCompatibleMAProfessorCloudBackup(
  session: MAProfessorAccessSession
): Promise<MAProfessorDownloadedCloudBackup | null> {
  const status =
    await readStatus(session)

  if (status.cryptoVersion === 3) {
    return downloadMAProfessorCloudBackupV3(
      session
    )
  }

  if (status.cryptoVersion === 2) {
    return downloadMAProfessorCloudBackup(
      session
    )
  }

  throw new Error(
    'A cópia online utiliza uma versão de proteção não suportada.'
  )
}

export async function downloadMAProfessorCloudBackupV3(
  session: MAProfessorAccessSession
): Promise<MAProfessorDownloadedCloudBackup | null> {
  const [status, remote] =
    await Promise.all([
      readStatus(session),
      getEncryptedBackup(session)
    ])

  if (remote.found === false) {
    return null
  }

  if (
    status.cryptoVersion !== 3 ||
    remote.cryptoVersion !== 3 ||
    !status.protection
  ) {
    throw new Error(
      'A cópia online não utiliza uma proteção v3 válida.'
    )
  }

  if (
    status.serverRevision !== remote.serverRevision ||
    status.backup.recordRevision !== remote.recordRevision
  ) {
    throw new MAProfessorCloudBackupRevisionConflictError(
      'A cópia online mudou durante a leitura. Atualize o estado antes de voltar a abrir.'
    )
  }

  const exportKey =
    readMAProfessorOpaqueExportKey(
      session.email
    )

  if (!exportKey) {
    throw new Error(
      'A sessão OPAQUE necessária para abrir a cópia v3 já não está disponível. Inicie sessão novamente.'
    )
  }

  const masterKey =
    await unwrapMAProfessorBackupV3MasterKey(
      exportKey,
      status.protection
    )
  const decrypted =
    await decryptMAProfessorBackupV3Data(
      masterKey,
      remote.encrypted as import('./cloudBackupV3Crypto').MAProfessorBackupV3EncryptedData,
      RECORD_ID
    )

  let plaintext: Uint8Array

  try {
    plaintext = unzlibSync(decrypted)
  } catch {
    throw new Error(
      'A cópia v3 decifrada não contém dados comprimidos válidos.'
    )
  }

  let backup: MAProfessorBackup

  try {
    backup = JSON.parse(
      textDecoder.decode(plaintext)
    ) as MAProfessorBackup
  } catch {
    throw new Error(
      'A cópia v3 decifrada não contém JSON válido.'
    )
  }

  const validation =
    validateMAProfessorBackup(backup)

  if (!validation.valid) {
    throw new Error(
      'A cópia v3 decifrada não passou a validação estrutural.'
    )
  }

  return {
    backup,
    validation,
    serverRevision: remote.serverRevision,
    recordRevision: remote.recordRevision,
    updatedAt: remote.updatedAt,
    ciphertextHash: remote.encrypted.ciphertextHash,
    plaintextHash: await sha256Base64(plaintext)
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

  if (
    remote.cryptoVersion !== 2
  ) {
    throw new Error(
      'Esta cópia online usa proteção v3 e não pode ser aberta pelo fluxo legado v2.'
    )
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
