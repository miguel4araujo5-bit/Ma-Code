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

import type {
  MAProfessorBackupV3EncryptedData
} from './cloudBackupV3Crypto'

const API_PREFIX =
  '/api/ma-professor/cloud-backup'

const RECORD_ID =
  'database-v1'

const CRYPTO_VERSION =
  3 as const

const ENCRYPTION_ALGORITHM =
  'AES-256-GCM' as const

const MAX_REQUEST_BYTES =
  1_500_000

const textEncoder =
  new TextEncoder()

const textDecoder =
  new TextDecoder()

export interface MAProfessorCloudBackupStatus {
  success: true
  serverRevision: number
  cryptoVersion: typeof CRYPTO_VERSION | null
  updatedAt: string | null
  protection: import('./cloudBackupV3Crypto').MAProfessorBackupV3WrappedMasterKey | null
  backup: {
    found: boolean
    recordRevision: number | null
    updatedAt: string | null
    ciphertextBytes: number | null
  }
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
  cryptoVersion: typeof CRYPTO_VERSION
  recordRevision: number
  updatedAt: string
  encrypted: MAProfessorBackupV3EncryptedData
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
      'A cópia online mudou durante a gravação. Volte a tentar guardar.'
  ) {
    super(message)
    this.name =
      'MAProfessorCloudBackupRevisionConflictError'
  }
}

export const MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT =
  'ma-professor-backup-auth-required'

export interface MAProfessorCloudBackupAuthenticationRequiredDetail {
  email: string
  token?: string
  deviceId?: string
}

export class MAProfessorCloudBackupAuthenticationRequiredError
  extends Error {
  constructor(
    email: string,
    message =
      'Confirme novamente a sua password em Segurança e recuperação para continuar a usar as cópias online.',
    requestSession?: MAProfessorAccessSession
  ) {
    super(message)
    this.name =
      'MAProfessorCloudBackupAuthenticationRequiredError'

    if (
      typeof window !==
      'undefined'
    ) {
      window.dispatchEvent(
        new window.CustomEvent<MAProfessorCloudBackupAuthenticationRequiredDetail>(
          MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT,
          {
            detail: {
              email,
              token:
                requestSession?.token,
              deviceId:
                requestSession?.deviceId
            }
          }
        )
      )
    }
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
  session: MAProfessorAccessSession
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
  session: MAProfessorAccessSession
) {
  assertSession(session)

  return {
    token: session.token,
    deviceId: session.deviceId
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

export class MAProfessorCloudBackupPermanentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MAProfessorCloudBackupPermanentError'
  }
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
  authSession?: MAProfessorAccessSession
) {
  const serialized =
    JSON.stringify(body)

  if (
    textEncoder.encode(serialized)
      .byteLength >
    MAX_REQUEST_BYTES
  ) {
    throw new MAProfessorCloudBackupPermanentError(
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
          cache: 'no-store',
          body: serialized
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
    data = null
  }

  if (!response.ok) {
    const message =
      isObject(data) &&
      typeof data.message === 'string' &&
      data.message.trim()
        ? data.message.trim()
        : fallbackMessage

    if (
      response.status === 401 &&
      authSession
    ) {
      throw new MAProfessorCloudBackupAuthenticationRequiredError(
        authSession.email,
        message,
        authSession
      )
    }

    if (
      response.status === 409 &&
      [
        '/initialize-v3',
        '/push-v3'
      ].includes(path)
    ) {
      throw new MAProfessorCloudBackupRevisionConflictError(
        message
      )
    }

    if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
      throw new MAProfessorCloudBackupPermanentError(message)
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
    value.cryptoVersion ===
      CRYPTO_VERSION &&
    value.recoveryKdfAlgorithm ===
      'OPAQUE-RFC9807-EXPORT-HKDF-SHA256' &&
    typeof value.recoveryKdfSalt === 'string' &&
    value.recoveryKdfSalt.length > 0 &&
    typeof value.recoveryKdfParameters === 'string' &&
    value.recoveryKdfParameters.length > 0 &&
    value.recoveryKeyWrapAlgorithm ===
      'AES-256-GCM' &&
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
    !(
      value.cryptoVersion === null ||
      value.cryptoVersion ===
        CRYPTO_VERSION
    ) ||
    !(
      value.updatedAt === null ||
      (
        typeof value.updatedAt === 'string' &&
        value.updatedAt
      )
    ) ||
    !isObject(value.backup)
  ) {
    throw new Error(
      'O serviço devolveu um estado de cópia incompatível com a proteção v3.'
    )
  }

  if (
    value.cryptoVersion ===
      CRYPTO_VERSION
      ? !isValidV3Protection(
          value.protection
        )
      : value.protection !== null
  ) {
    throw new Error(
      'O serviço devolveu uma proteção de cópia incompatível com a versão v3.'
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
      isPositiveInteger(
        recordRevision
      )
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

  if (
    value.cryptoVersion === null &&
    (
      value.serverRevision !== 0 ||
      value.updatedAt !== null ||
      found ||
      recordRevision !== null ||
      backupUpdatedAt !== null ||
      ciphertextBytes !== null
    )
  ) {
    throw new Error(
      'O estado inicial da cópia online não é válido.'
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
      value.protection as
        MAProfessorCloudBackupStatus['protection'],
    backup: {
      found,
      recordRevision,
      updatedAt:
        backupUpdatedAt,
      ciphertextBytes
    }
  }
}

function parseV3EncryptedRecord(
  value: unknown
): MAProfessorBackupV3EncryptedData {
  if (
    !isObject(value) ||
    value.encryptionVersion !==
      CRYPTO_VERSION ||
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
      'O serviço devolveu uma cópia v3 cifrada inválida.'
    )
  }

  return {
    encryptionVersion:
      CRYPTO_VERSION,
    encryptionAlgorithm:
      ENCRYPTION_ALGORITHM,
    nonce: value.nonce,
    ciphertext: value.ciphertext,
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
      recordId: RECORD_ID,
      serverRevision:
        value.serverRevision
    }
  }

  if (
    value.cryptoVersion !==
      CRYPTO_VERSION ||
    !isPositiveInteger(
      value.recordRevision
    ) ||
    typeof value.updatedAt !== 'string' ||
    !value.updatedAt
  ) {
    throw new Error(
      'O serviço devolveu metadados incompatíveis com uma cópia v3.'
    )
  }

  return {
    success: true,
    found: true,
    recordId: RECORD_ID,
    serverRevision:
      value.serverRevision,
    cryptoVersion:
      CRYPTO_VERSION,
    recordRevision:
      value.recordRevision,
    updatedAt:
      value.updatedAt,
    encrypted:
      parseV3EncryptedRecord(
        value.encrypted
      )
  }
}

function parseV3WriteResult(
  value: unknown
) {
  if (
    !isObject(value) ||
    value.success !== true ||
    value.cryptoVersion !==
      CRYPTO_VERSION ||
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
      'O serviço devolveu uma resposta inválida ao guardar a cópia v3.'
    )
  }

  return {
    cryptoVersion:
      CRYPTO_VERSION,
    serverRevision:
      value.serverRevision,
    recordRevision:
      value.recordRevision,
    updatedAt:
      value.updatedAt
  }
}

async function readStatus(
  session: MAProfessorAccessSession
) {
  const data =
    await postJson(
      '/status',
      sessionBody(session),
      'Não foi possível verificar a cópia online.',
      session
    )

  return parseStatus(data)
}

async function getEncryptedBackup(
  session: MAProfessorAccessSession
) {
  const data =
    await postJson(
      '/get',
      {
        ...sessionBody(session),
        recordId: RECORD_ID
      },
      'Não foi possível descarregar a cópia cifrada.',
      session
    )

  return parseGetResult(data)
}

export async function inspectMAProfessorCloudBackup(
  session: MAProfessorAccessSession
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
    throw new MAProfessorCloudBackupAuthenticationRequiredError(
      session.email,
      undefined,
      session
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
      'A validação local da cópia v3 falhou. Nenhuma cópia online foi alterada.'
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
      'A validação local da cópia v3 não encontrou dados JSON válidos. Nenhuma cópia online foi alterada.'
    )
  }

  const validation =
    validateMAProfessorBackup(
      parsed
    )

  if (!validation.valid) {
    throw new Error(
      'A validação local da cópia v3 encontrou dados incompatíveis. Nenhuma cópia online foi alterada.'
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
        encrypted.ciphertext.length *
          3 /
          4
      )
  }
}

function assertUploadAllowed(
  options:
    MAProfessorCloudBackupUploadOptions
) {
  if (
    options.canUpload &&
    !options.canUpload()
  ) {
    throw new Error(
      'A gravação desta cópia foi cancelada. Não foram enviados novos dados.'
    )
  }
}

async function initializeAndVerifyMAProfessorCloudBackupV3(
  session: MAProfessorAccessSession,
  backup: MAProfessorBackup,
  options: MAProfessorCloudBackupUploadOptions
): Promise<MAProfessorUploadedCloudBackup> {
  assertUploadAllowed(options)

  const prepared =
    await prepareMAProfessorCloudBackupV3Promotion(
      session,
      backup
    )

  assertUploadAllowed(options)

  const pushed =
    parseV3WriteResult(
      await postJson(
        '/initialize-v3',
        {
          ...sessionBody(session),
          recordId: RECORD_ID,
          expectedServerRevision: 0,
          expectedRecordRevision: 0,
          profile: prepared.profile,
          encrypted:
            prepared.encrypted
        },
        'Não foi possível criar a primeira cópia protegida.',
        session
      )
    )

  const verified =
    await downloadMAProfessorCloudBackupV3(
      session
    )

  if (
    !verified ||
    verified.serverRevision !==
      pushed.serverRevision ||
    verified.recordRevision !==
      pushed.recordRevision ||
    verified.plaintextHash !==
      prepared.plaintextHash
  ) {
    throw new MAProfessorCloudBackupRevisionConflictError(
      'A primeira cópia foi enviada, mas mudou durante a verificação. Atualize o estado antes de continuar.'
    )
  }

  return {
    serverRevision:
      pushed.serverRevision,
    recordRevision:
      pushed.recordRevision,
    updatedAt:
      pushed.updatedAt,
    plaintextBytes:
      prepared.plaintextBytes,
    encryptedBytes:
      prepared.encryptedBytes
  }
}

export async function uploadAndVerifyMAProfessorCloudBackupV3(
  session: MAProfessorAccessSession,
  backup: MAProfessorBackup,
  options:
    MAProfessorCloudBackupUploadOptions = {}
): Promise<MAProfessorUploadedCloudBackup> {
  assertUploadAllowed(options)

  const status =
    await readStatus(session)

  if (
    status.cryptoVersion !==
      CRYPTO_VERSION ||
    !status.protection ||
    !status.backup.found ||
    !isPositiveInteger(
      status.backup.recordRevision
    )
  ) {
    throw new Error(
      'A proteção v3 da cópia online não está pronta para receber novos dados.'
    )
  }

  if (
    options.expectedServerRevision !==
      undefined &&
    status.serverRevision !==
      options.expectedServerRevision
  ) {
    throw new MAProfessorCloudBackupRevisionConflictError()
  }

  const exportKey =
    readMAProfessorOpaqueExportKey(
      session.email
    )

  if (!exportKey) {
    throw new MAProfessorCloudBackupAuthenticationRequiredError(
      session.email,
      undefined,
      session
    )
  }

  assertUploadAllowed(options)

  const masterKey =
    await unwrapMAProfessorBackupV3MasterKey(
      exportKey,
      status.protection
    )
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
  const encrypted =
    await encryptMAProfessorBackupV3Data(
      masterKey,
      compressed,
      RECORD_ID
    )

  assertUploadAllowed(options)

  const pushed =
    parseV3WriteResult(
      await postJson(
        '/push-v3',
        {
          ...sessionBody(session),
          recordId: RECORD_ID,
          expectedServerRevision:
            status.serverRevision,
          expectedRecordRevision:
            status.backup.recordRevision,
          encrypted
        },
        'Não foi possível guardar a cópia cifrada v3.',
        session
      )
    )

  const verified =
    await downloadMAProfessorCloudBackupV3(
      session
    )

  if (
    !verified ||
    verified.serverRevision !==
      pushed.serverRevision ||
    verified.recordRevision !==
      pushed.recordRevision ||
    verified.plaintextHash !==
      plaintextHash
  ) {
    throw new MAProfessorCloudBackupRevisionConflictError(
      'A cópia v3 foi enviada, mas a verificação local não corresponde aos dados enviados.'
    )
  }

  return {
    serverRevision:
      pushed.serverRevision,
    recordRevision:
      pushed.recordRevision,
    updatedAt:
      pushed.updatedAt,
    plaintextBytes:
      plaintext.byteLength,
    encryptedBytes:
      Math.floor(
        encrypted.ciphertext.length *
          3 /
          4
      )
  }
}

export async function uploadAndVerifyCompatibleMAProfessorCloudBackup(
  session: MAProfessorAccessSession,
  backup: MAProfessorBackup,
  options:
    MAProfessorCloudBackupUploadOptions = {}
): Promise<MAProfessorUploadedCloudBackup> {
  const status =
    await readStatus(session)

  if (
    options.expectedServerRevision !==
      undefined &&
    status.serverRevision !==
      options.expectedServerRevision
  ) {
    throw new MAProfessorCloudBackupRevisionConflictError()
  }

  const forwardedOptions = {
    ...options,
    expectedServerRevision:
      status.serverRevision
  }

  if (
    status.cryptoVersion === null
  ) {
    return initializeAndVerifyMAProfessorCloudBackupV3(
      session,
      backup,
      forwardedOptions
    )
  }

  return uploadAndVerifyMAProfessorCloudBackupV3(
    session,
    backup,
    forwardedOptions
  )
}

export async function downloadMAProfessorCloudBackupV3(
  session: MAProfessorAccessSession
): Promise<MAProfessorDownloadedCloudBackup | null> {
  const status =
    await readStatus(session)

  if (
    status.cryptoVersion === null
  ) {
    return null
  }

  if (
    !status.protection
  ) {
    throw new Error(
      'A cópia online não utiliza uma proteção v3 válida.'
    )
  }

  const remote =
    await getEncryptedBackup(session)

  if (remote.found === false) {
    return null
  }

  if (
    status.serverRevision !==
      remote.serverRevision ||
    status.backup.recordRevision !==
      remote.recordRevision
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
    throw new MAProfessorCloudBackupAuthenticationRequiredError(
      session.email,
      undefined,
      session
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
      remote.encrypted,
      RECORD_ID
    )

  let plaintext: Uint8Array

  try {
    plaintext =
      unzlibSync(decrypted)
  } catch {
    throw new Error(
      'A cópia v3 decifrada não contém dados comprimidos válidos.'
    )
  }

  let backup: MAProfessorBackup

  try {
    backup =
      JSON.parse(
        textDecoder.decode(
          plaintext
        )
      ) as MAProfessorBackup
  } catch {
    throw new Error(
      'A cópia v3 decifrada não contém JSON válido.'
    )
  }

  const validation =
    validateMAProfessorBackup(
      backup
    )

  if (!validation.valid) {
    throw new Error(
      'A cópia v3 decifrada não passou a validação estrutural.'
    )
  }

  return {
    backup,
    validation,
    serverRevision:
      remote.serverRevision,
    recordRevision:
      remote.recordRevision,
    updatedAt:
      remote.updatedAt,
    ciphertextHash:
      remote.encrypted.ciphertextHash,
    plaintextHash:
      await sha256Base64(
        plaintext
      )
  }
}

export async function downloadCompatibleMAProfessorCloudBackup(
  session: MAProfessorAccessSession
): Promise<MAProfessorDownloadedCloudBackup | null> {
  return downloadMAProfessorCloudBackupV3(
    session
  )
}
