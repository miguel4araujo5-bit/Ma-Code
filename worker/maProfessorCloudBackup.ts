import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

export const MA_PROFESSOR_CLOUD_BACKUP_API_PREFIX =
  '/api/ma-professor/cloud-backup'

const ACCESS_VERIFY_PATH =
  '/api/ma-professor/access/verify'
const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'
const RECORD_ID =
  'database-v1'
const CRYPTO_VERSION = 3
const KDF_ALGORITHM =
  'OPAQUE-RFC9807-EXPORT-HKDF-SHA256'
const KEY_WRAP_ALGORITHM =
  'AES-256-GCM'
const ENCRYPTION_ALGORITHM =
  'AES-256-GCM'
const UPLOAD_INTERVAL_MS = 30_000
const MAX_BODY_BYTES = 1_500_000
const MAX_CIPHERTEXT_BYTES = 1_000_000
const NONCE_BYTES = 12
const HASH_BYTES = 32
const KDF_SALT_BYTES = 32
const WRAPPED_MASTER_KEY_BYTES = 48
const KDF_PARAMETERS = JSON.stringify({
  version: 1,
  hash: 'SHA-256',
  context:
    'MA-CODE/MA-Professor/cloud-backup/v3/wrapping-key'
})

type JsonBody =
  Record<string, unknown>
type JsonObject =
  Record<string, unknown>

interface D1ResultLike {
  success: boolean
  meta?: {
    changes?: number
  }
}

interface D1PreparedStatementLike {
  bind(
    ...values: unknown[]
  ): D1PreparedStatementLike
  first<T = Record<string, unknown>>():
    Promise<T | null>
  run(): Promise<D1ResultLike>
}

interface D1DatabaseLike {
  prepare(
    query: string
  ): D1PreparedStatementLike
  batch(
    statements: D1PreparedStatementLike[]
  ): Promise<D1ResultLike[]>
}

export interface MaProfessorCloudBackupEnv
  extends MaProfessorAccessEnv {
  MA_PROFESSOR_DB: D1DatabaseLike
}

interface AccessLicense {
  email: string
  status:
    | 'inactive'
    | 'active'
    | 'expiring'
    | 'renewal_pending'
    | 'expired'
    | 'revoked'
}

interface AccessVerifySuccess {
  success: true
  license: AccessLicense
}

interface AccessVerifyError {
  success: false
  message?: string
}

type AccessVerifyResult =
  | AccessVerifySuccess
  | AccessVerifyError

interface SessionProfileRow {
  server_revision: number
  crypto_version: number
  recovery_kdf_algorithm: string
  recovery_kdf_salt: string
  recovery_kdf_parameters: string
  recovery_key_wrap_algorithm: string
  recovery_wrapped_master_key: string
  recovery_wrapped_master_key_nonce: string
  updated_at: number
}

interface ExistingRecordRow {
  record_revision: number
}

interface EncryptedRecordRow {
  server_revision: number
  record_revision: number
  encryption_version: number
  encryption_algorithm: string
  nonce: string
  ciphertext: string
  ciphertext_hash: string
  updated_at: number
}

interface RecordMetadataRow {
  record_revision: number
  updated_at: number
  ciphertext_bytes: number
}

interface EncryptedPayload {
  encryptionVersion: typeof CRYPTO_VERSION
  encryptionAlgorithm: typeof ENCRYPTION_ALGORITHM
  nonce: string
  ciphertext: string
  ciphertextHash: string
}

interface V3Profile {
  cryptoVersion: typeof CRYPTO_VERSION
  recoveryKdfAlgorithm: typeof KDF_ALGORITHM
  recoveryKdfSalt: string
  recoveryKdfParameters: string
  recoveryKeyWrapAlgorithm: typeof KEY_WRAP_ALGORITHM
  recoveryWrappedMasterKey: string
  recoveryWrappedMasterKeyNonce: string
}

class CloudBackupApiError
  extends Error {
  readonly status: number
  readonly details?:
    Record<string, unknown>

  constructor(
    message: string,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name =
      'CloudBackupApiError'
    this.status = status
    this.details = details
  }
}

const securityHeaders:
  Record<string, string> = {
    'Cache-Control': 'no-store',
    'Content-Security-Policy':
      "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options':
      'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow'
  }

function json(
  body: unknown,
  status = 200,
  extraHeaders:
    Record<string, string> = {}
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        ...securityHeaders,
        ...extraHeaders
      }
    }
  )
}

function normalizeOrigin(
  value: string
) {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function isAllowedOrigin(
  request: Request
) {
  const requestOrigin =
    new URL(request.url).origin
  const origin =
    normalizeOrigin(
      request.headers.get('Origin') || ''
    )
  const referer =
    normalizeOrigin(
      request.headers.get('Referer') || ''
    )
  const candidate =
    origin || referer

  if (!candidate) {
    return false
  }

  const allowed =
    new Set([
      requestOrigin,
      'https://ma-code.pt',
      'https://www.ma-code.pt'
    ])

  try {
    const hostname =
      new URL(candidate).hostname

    if (
      [
        'localhost',
        '127.0.0.1',
        '0.0.0.0'
      ].includes(hostname)
    ) {
      return true
    }
  } catch {
    return false
  }

  return allowed.has(candidate)
}

function isObject(
  value: unknown
): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function normalizeId(
  value: unknown,
  maxLength = 256
) {
  return typeof value === 'string'
    ? value.trim().slice(0, maxLength)
    : ''
}

function isUsableLicenseStatus(
  status: AccessLicense['status']
) {
  return (
    status === 'active' ||
    status === 'expiring' ||
    status === 'renewal_pending'
  )
}

function bytesToBase64(
  bytes: Uint8Array
) {
  let binary = ''

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(byte)
  }

  return btoa(binary)
}

function base64UrlByteLength(
  value: string
) {
  const normalized =
    value.trim()

  if (
    !normalized ||
    !/^[A-Za-z0-9_-]+$/.test(
      normalized
    )
  ) {
    return -1
  }

  const padding =
    '='.repeat(
      (4 - (normalized.length % 4)) % 4
    )

  try {
    return atob(
      normalized
        .split('-').join('+')
        .split('_').join('/') +
      padding
    ).length
  } catch {
    return -1
  }
}

async function createAccountId(
  email: string
) {
  const normalizedEmail =
    email.trim().toLowerCase()
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        `ma-professor-account-v1:${normalizedEmail}`
      )
    )

  return `account-${Array.from(
    new Uint8Array(digest),
    byte =>
      byte
        .toString(16)
        .padStart(2, '0')
  ).join('')}`
}

async function hashDeviceId(
  deviceId: string
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        `ma-professor-device-v1:${deviceId}`
      )
    )

  return bytesToBase64(
    new Uint8Array(digest)
  )
}

async function readBody(
  request: Request
): Promise<JsonBody> {
  const contentType =
    request.headers.get(
      'content-type'
    ) || ''

  if (
    !contentType
      .toLowerCase()
      .includes(
        'application/json'
      )
  ) {
    throw new CloudBackupApiError(
      'Formato de pedido inválido.',
      400
    )
  }

  const contentLength =
    Number(
      request.headers.get(
        'content-length'
      ) || 0
    )

  if (
    Number.isFinite(
      contentLength
    ) &&
    contentLength >
      MAX_BODY_BYTES
  ) {
    throw new CloudBackupApiError(
      'A cópia cifrada é demasiado grande.',
      413
    )
  }

  const text =
    await request.text()

  if (
    new TextEncoder()
      .encode(text)
      .byteLength >
    MAX_BODY_BYTES
  ) {
    throw new CloudBackupApiError(
      'A cópia cifrada é demasiado grande.',
      413
    )
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new CloudBackupApiError(
      'O pedido enviado não contém JSON válido.',
      400
    )
  }

  if (!isObject(parsed)) {
    throw new CloudBackupApiError(
      'O pedido enviado não é válido.',
      400
    )
  }

  return parsed
}

async function verifyAccessSession(
  body: JsonBody,
  env: MaProfessorCloudBackupEnv
) {
  const token =
    normalizeId(body.token)
  const deviceId =
    normalizeId(
      body.deviceId,
      180
    )

  if (!token || !deviceId) {
    throw new CloudBackupApiError(
      'A sessão não é válida.',
      401
    )
  }

  const durableObjectId =
    env.MA_PROFESSOR_ACCESS.idFromName(
      ACCESS_DURABLE_OBJECT_NAME
    )
  const durableObject =
    env.MA_PROFESSOR_ACCESS.get(
      durableObjectId
    )

  const response =
    await durableObject.fetch(
      new Request(
        `https://ma-professor.internal${ACCESS_VERIFY_PATH}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Accept:
              'application/json'
          },
          body: JSON.stringify({
            token,
            deviceId
          })
        }
      )
    )

  let result:
    AccessVerifyResult | null = null

  try {
    result =
      await response.json() as
        AccessVerifyResult
  } catch {
    result = null
  }

  if (
    !response.ok ||
    !result ||
    result.success !== true
  ) {
    const message =
      result &&
      result.success === false &&
      typeof result.message === 'string'
        ? result.message
        : 'A sessão já não é válida.'

    throw new CloudBackupApiError(
      message,
      response.status === 403
        ? 403
        : 401
    )
  }

  if (
    !isUsableLicenseStatus(
      result.license.status
    )
  ) {
    throw new CloudBackupApiError(
      'A licença não permite utilizar a cópia online neste momento.',
      403
    )
  }

  return {
    accountId:
      await createAccountId(
        result.license.email
      ),
    deviceId
  }
}

async function readProfile(
  accountId: string,
  env: MaProfessorCloudBackupEnv
) {
  return env.MA_PROFESSOR_DB
    .prepare(
      `
        SELECT
          server_revision,
          crypto_version,
          recovery_kdf_algorithm,
          recovery_kdf_salt,
          recovery_kdf_parameters,
          recovery_key_wrap_algorithm,
          recovery_wrapped_master_key,
          recovery_wrapped_master_key_nonce,
          updated_at
        FROM ma_professor_sync_profiles
        WHERE account_id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `
    )
    .bind(accountId)
    .first<SessionProfileRow>()
}

async function readExistingProfile(
  accountId: string,
  env: MaProfessorCloudBackupEnv
) {
  const existing =
    await readProfile(
      accountId,
      env
    )

  if (!existing) {
    throw new CloudBackupApiError(
      'A proteção da cópia online não está disponível.',
      409
    )
  }

  return existing
}

function assertV3StoredProfile(
  profile: SessionProfileRow
) {
  if (
    profile.crypto_version !==
      CRYPTO_VERSION ||
    profile.recovery_kdf_algorithm !==
      KDF_ALGORITHM ||
    profile.recovery_kdf_parameters !==
      KDF_PARAMETERS ||
    profile.recovery_key_wrap_algorithm !==
      KEY_WRAP_ALGORITHM ||
    base64UrlByteLength(
      profile.recovery_kdf_salt
    ) !== KDF_SALT_BYTES ||
    base64UrlByteLength(
      profile.recovery_wrapped_master_key
    ) !== WRAPPED_MASTER_KEY_BYTES ||
    base64UrlByteLength(
      profile.recovery_wrapped_master_key_nonce
    ) !== NONCE_BYTES
  ) {
    throw new CloudBackupApiError(
      'A proteção online existente não é compatível com a versão v3 atual.',
      409
    )
  }

  return profile
}

async function readRecordMetadata(
  accountId: string,
  env: MaProfessorCloudBackupEnv
) {
  return env.MA_PROFESSOR_DB
    .prepare(
      `
        SELECT
          record_revision,
          updated_at,
          CAST((LENGTH(ciphertext) * 3) / 4 AS INTEGER)
            - CASE
                WHEN ciphertext LIKE '%==' THEN 2
                WHEN ciphertext LIKE '%=' THEN 1
                ELSE 0
              END AS ciphertext_bytes
        FROM ma_professor_encrypted_records
        WHERE account_id = ?
          AND record_id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `
    )
    .bind(
      accountId,
      RECORD_ID
    )
    .first<RecordMetadataRow>()
}

async function readExistingRecord(
  accountId: string,
  env: MaProfessorCloudBackupEnv
) {
  return env.MA_PROFESSOR_DB
    .prepare(
      `
        SELECT record_revision
        FROM ma_professor_encrypted_records
        WHERE account_id = ?
          AND record_id = ?
        LIMIT 1
      `
    )
    .bind(
      accountId,
      RECORD_ID
    )
    .first<ExistingRecordRow>()
}

async function readRecord(
  accountId: string,
  env: MaProfessorCloudBackupEnv
) {
  return env.MA_PROFESSOR_DB
    .prepare(
      `
        SELECT
          server_revision,
          record_revision,
          encryption_version,
          encryption_algorithm,
          nonce,
          ciphertext,
          ciphertext_hash,
          updated_at
        FROM ma_professor_encrypted_records
        WHERE account_id = ?
          AND record_id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `
    )
    .bind(
      accountId,
      RECORD_ID
    )
    .first<EncryptedRecordRow>()
}

function parseExpectedRevision(
  value: unknown
) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new CloudBackupApiError(
      'A revisão da cópia não é válida.',
      400
    )
  }

  return value
}

function parseV3Profile(
  value: unknown
): V3Profile {
  if (
    !isObject(value) ||
    value.cryptoVersion !==
      CRYPTO_VERSION ||
    value.recoveryKdfAlgorithm !==
      KDF_ALGORITHM ||
    typeof value.recoveryKdfSalt !== 'string' ||
    !value.recoveryKdfSalt ||
    value.recoveryKdfParameters !==
      KDF_PARAMETERS ||
    value.recoveryKeyWrapAlgorithm !==
      KEY_WRAP_ALGORITHM ||
    typeof value.recoveryWrappedMasterKey !== 'string' ||
    !value.recoveryWrappedMasterKey ||
    typeof value.recoveryWrappedMasterKeyNonce !== 'string' ||
    !value.recoveryWrappedMasterKeyNonce ||
    base64UrlByteLength(
      value.recoveryKdfSalt
    ) !== KDF_SALT_BYTES ||
    base64UrlByteLength(
      value.recoveryWrappedMasterKey
    ) !== WRAPPED_MASTER_KEY_BYTES ||
    base64UrlByteLength(
      value.recoveryWrappedMasterKeyNonce
    ) !== NONCE_BYTES
  ) {
    throw new CloudBackupApiError(
      'O perfil criptográfico v3 enviado não é válido.',
      400
    )
  }

  return {
    cryptoVersion:
      CRYPTO_VERSION,
    recoveryKdfAlgorithm:
      KDF_ALGORITHM,
    recoveryKdfSalt:
      value.recoveryKdfSalt,
    recoveryKdfParameters:
      KDF_PARAMETERS,
    recoveryKeyWrapAlgorithm:
      KEY_WRAP_ALGORITHM,
    recoveryWrappedMasterKey:
      value.recoveryWrappedMasterKey,
    recoveryWrappedMasterKeyNonce:
      value.recoveryWrappedMasterKeyNonce
  }
}

function parseV3EncryptedPayload(
  value: unknown
): EncryptedPayload {
  if (
    !isObject(value) ||
    value.encryptionVersion !==
      CRYPTO_VERSION ||
    value.encryptionAlgorithm !==
      ENCRYPTION_ALGORITHM ||
    typeof value.nonce !== 'string' ||
    typeof value.ciphertext !== 'string' ||
    !value.ciphertext ||
    typeof value.ciphertextHash !== 'string'
  ) {
    throw new CloudBackupApiError(
      'A cópia cifrada v3 enviada não é válida.',
      400
    )
  }

  if (
    base64UrlByteLength(
      value.nonce
    ) !== NONCE_BYTES ||
    base64UrlByteLength(
      value.ciphertextHash
    ) !== HASH_BYTES
  ) {
    throw new CloudBackupApiError(
      'A cópia cifrada v3 enviada tem parâmetros inválidos.',
      400
    )
  }

  const ciphertextBytes =
    base64UrlByteLength(
      value.ciphertext
    )

  if (
    ciphertextBytes < 16 ||
    ciphertextBytes >
      MAX_CIPHERTEXT_BYTES
  ) {
    throw new CloudBackupApiError(
      'A cópia cifrada v3 ultrapassa o limite permitido.',
      413
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

async function handleInitializeV3(
  body: JsonBody,
  env: MaProfessorCloudBackupEnv
) {
  const authenticated =
    await verifyAccessSession(
      body,
      env
    )

  if (
    normalizeId(
      body.recordId,
      80
    ) !== RECORD_ID ||
    parseExpectedRevision(
      body.expectedServerRevision
    ) !== 0 ||
    parseExpectedRevision(
      body.expectedRecordRevision
    ) !== 0
  ) {
    throw new CloudBackupApiError(
      'A revisão inicial da cópia não é válida.',
      400
    )
  }

  const profile =
    parseV3Profile(
      body.profile
    )
  const encrypted =
    parseV3EncryptedPayload(
      body.encrypted
    )
  const timestamp =
    Date.now()
  const deviceHash =
    await hashDeviceId(
      authenticated.deviceId
    )

  try {
    await env.MA_PROFESSOR_DB.batch([
      env.MA_PROFESSOR_DB
        .prepare(
          `
            INSERT INTO ma_professor_sync_profiles (
              account_id, server_revision, crypto_version,
              recovery_kdf_algorithm, recovery_kdf_salt,
              recovery_kdf_parameters, recovery_key_wrap_algorithm,
              recovery_wrapped_master_key,
              recovery_wrapped_master_key_nonce,
              created_at, updated_at, deleted_at
            ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          `
        )
        .bind(
          authenticated.accountId,
          profile.cryptoVersion,
          profile.recoveryKdfAlgorithm,
          profile.recoveryKdfSalt,
          profile.recoveryKdfParameters,
          profile.recoveryKeyWrapAlgorithm,
          profile.recoveryWrappedMasterKey,
          profile.recoveryWrappedMasterKeyNonce,
          timestamp,
          timestamp
        ),
      env.MA_PROFESSOR_DB
        .prepare(
          `
            INSERT INTO ma_professor_encrypted_records (
              account_id, record_id, server_revision, record_revision,
              source_device_id_hash, encryption_version,
              encryption_algorithm, nonce, ciphertext, ciphertext_hash,
              created_at, updated_at, deleted_at
            ) VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          `
        )
        .bind(
          authenticated.accountId,
          RECORD_ID,
          deviceHash,
          encrypted.encryptionVersion,
          encrypted.encryptionAlgorithm,
          encrypted.nonce,
          encrypted.ciphertext,
          encrypted.ciphertextHash,
          timestamp,
          timestamp
        )
    ])
  } catch (error) {
    if (
      error instanceof Error &&
      /UNIQUE constraint|PRIMARY KEY/i.test(
        error.message
      )
    ) {
      throw new CloudBackupApiError(
        'Já existe uma proteção online para esta conta. Atualize o estado antes de voltar a guardar.',
        409
      )
    }

    throw error
  }

  return json({
    success: true,
    cryptoVersion:
      CRYPTO_VERSION,
    recordId: RECORD_ID,
    serverRevision: 1,
    recordRevision: 1,
    updatedAt:
      new Date(
        timestamp
      ).toISOString()
  })
}

async function handleStatus(
  body: JsonBody,
  env: MaProfessorCloudBackupEnv
) {
  const authenticated =
    await verifyAccessSession(
      body,
      env
    )
  const profile =
    await readProfile(
      authenticated.accountId,
      env
    )

  if (!profile) {
    return json({
      success: true,
      serverRevision: 0,
      cryptoVersion: null,
      protection: null,
      updatedAt: null,
      backup: {
        found: false,
        recordRevision: null,
        updatedAt: null,
        ciphertextBytes: null
      }
    })
  }

  assertV3StoredProfile(profile)

  const metadata =
    await readRecordMetadata(
      authenticated.accountId,
      env
    )

  return json({
    success: true,
    serverRevision:
      profile.server_revision,
    cryptoVersion:
      CRYPTO_VERSION,
    protection: {
      cryptoVersion:
        CRYPTO_VERSION,
      recoveryKdfAlgorithm:
        profile.recovery_kdf_algorithm,
      recoveryKdfSalt:
        profile.recovery_kdf_salt,
      recoveryKdfParameters:
        profile.recovery_kdf_parameters,
      recoveryKeyWrapAlgorithm:
        profile.recovery_key_wrap_algorithm,
      recoveryWrappedMasterKey:
        profile.recovery_wrapped_master_key,
      recoveryWrappedMasterKeyNonce:
        profile.recovery_wrapped_master_key_nonce
    },
    retryAfterSeconds: Math.max(0, Math.ceil((profile.updated_at + UPLOAD_INTERVAL_MS - Date.now()) / 1000)),
    updatedAt:
      new Date(
        profile.updated_at
      ).toISOString(),
    backup: {
      found:
        metadata !== null,
      recordRevision:
        metadata?.record_revision ??
        null,
      updatedAt:
        metadata
          ? new Date(
              metadata.updated_at
            ).toISOString()
          : null,
      ciphertextBytes:
        metadata?.ciphertext_bytes ??
        null
    }
  })
}

async function handleGet(
  body: JsonBody,
  env: MaProfessorCloudBackupEnv
) {
  const recordId =
    normalizeId(
      body.recordId,
      80
    )

  if (recordId !== RECORD_ID) {
    throw new CloudBackupApiError(
      'O identificador da cópia não é válido.',
      400
    )
  }

  const authenticated =
    await verifyAccessSession(
      body,
      env
    )
  const profile =
    assertV3StoredProfile(
      await readExistingProfile(
        authenticated.accountId,
        env
      )
    )
  const record =
    await readRecord(
      authenticated.accountId,
      env
    )

  if (!record) {
    return json({
      success: true,
      found: false,
      recordId: RECORD_ID,
      serverRevision:
        profile.server_revision
    })
  }

  if (
    record.encryption_version !==
      CRYPTO_VERSION ||
    record.encryption_algorithm !==
      ENCRYPTION_ALGORITHM
  ) {
    throw new CloudBackupApiError(
      'A cópia cifrada existente não é compatível com a proteção v3 atual.',
      409
    )
  }

  return json({
    success: true,
    found: true,
    recordId: RECORD_ID,
    serverRevision:
      profile.server_revision,
    cryptoVersion:
      CRYPTO_VERSION,
    recordRevision:
      record.record_revision,
    updatedAt:
      new Date(
        record.updated_at
      ).toISOString(),
    encrypted: {
      encryptionVersion:
        CRYPTO_VERSION,
      encryptionAlgorithm:
        ENCRYPTION_ALGORITHM,
      nonce: record.nonce,
      ciphertext: record.ciphertext,
      ciphertextHash:
        record.ciphertext_hash
    }
  })
}

async function handlePushV3(
  body: JsonBody,
  env: MaProfessorCloudBackupEnv
) {
  const recordId =
    normalizeId(
      body.recordId,
      80
    )

  if (recordId !== RECORD_ID) {
    throw new CloudBackupApiError(
      'O identificador da cópia não é válido.',
      400
    )
  }

  const expectedServerRevision =
    parseExpectedRevision(
      body.expectedServerRevision
    )
  const expectedRecordRevision =
    parseExpectedRevision(
      body.expectedRecordRevision
    )
  const encrypted =
    parseV3EncryptedPayload(
      body.encrypted
    )
  const authenticated =
    await verifyAccessSession(
      body,
      env
    )
  const profile =
    assertV3StoredProfile(
      await readExistingProfile(
        authenticated.accountId,
        env
      )
    )

  if (
    profile.server_revision !==
      expectedServerRevision
  ) {
    throw new CloudBackupApiError(
      'Existe uma cópia online mais recente. Atualize o estado antes de voltar a guardar.',
      409,
      {
        currentServerRevision:
          profile.server_revision
      }
    )
  }

  const retryAfterSeconds = Math.ceil((profile.updated_at + UPLOAD_INTERVAL_MS - Date.now()) / 1000)
  if (retryAfterSeconds > 0) {
    throw new CloudBackupApiError('Aguarde 30 segundos entre cópias online.', 429, { retryAfterSeconds })
  }

  const existing =
    await readExistingRecord(
      authenticated.accountId,
      env
    )
  const currentRecordRevision =
    existing?.record_revision ?? 0

  if (
    currentRecordRevision !==
      expectedRecordRevision
  ) {
    throw new CloudBackupApiError(
      'Existe uma versão mais recente dos dados cifrados. Atualize o estado antes de voltar a guardar.',
      409,
      {
        currentRecordRevision
      }
    )
  }

  const nextServerRevision =
    expectedServerRevision + 1
  const nextRecordRevision =
    expectedRecordRevision + 1
  const timestamp =
    Date.now()
  const sourceDeviceIdHash =
    await hashDeviceId(
      authenticated.deviceId
    )

  const results =
    await env.MA_PROFESSOR_DB.batch([
      existing ? env.MA_PROFESSOR_DB
        .prepare(
          `
            UPDATE ma_professor_encrypted_records
            SET
              server_revision = ?,
              record_revision = ?,
              source_device_id_hash = ?,
              encryption_version = ?,
              encryption_algorithm = ?,
              nonce = ?,
              ciphertext = ?,
              ciphertext_hash = ?,
              updated_at = ?,
              deleted_at = NULL
            WHERE account_id = ?
              AND record_id = ?
              AND server_revision = ?
              AND record_revision = ?
              AND encryption_version = ?
              AND deleted_at IS NULL
              AND EXISTS (
                SELECT 1
                FROM ma_professor_sync_profiles
                WHERE account_id = ?
                  AND server_revision = ?
                  AND crypto_version = ?
                  AND recovery_kdf_algorithm = ?
                  AND recovery_key_wrap_algorithm = ?
                  AND deleted_at IS NULL
                  AND updated_at <= ?
              )
          `
        )
        .bind(
          nextServerRevision,
          nextRecordRevision,
          sourceDeviceIdHash,
          encrypted.encryptionVersion,
          encrypted.encryptionAlgorithm,
          encrypted.nonce,
          encrypted.ciphertext,
          encrypted.ciphertextHash,
          timestamp,
          authenticated.accountId,
          RECORD_ID,
          expectedServerRevision,
          expectedRecordRevision,
          CRYPTO_VERSION,
          authenticated.accountId,
          expectedServerRevision,
          CRYPTO_VERSION,
          KDF_ALGORITHM,
          KEY_WRAP_ALGORITHM,
          timestamp - UPLOAD_INTERVAL_MS
        ) : env.MA_PROFESSOR_DB.prepare(`
          INSERT INTO ma_professor_encrypted_records (
            account_id, record_id, server_revision, record_revision,
            source_device_id_hash, encryption_version, encryption_algorithm,
            nonce, ciphertext, ciphertext_hash, created_at, updated_at, deleted_at
          )
          SELECT ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, NULL
          WHERE EXISTS (
            SELECT 1 FROM ma_professor_sync_profiles
            WHERE account_id = ? AND server_revision = ? AND crypto_version = ?
              AND recovery_kdf_algorithm = ? AND recovery_key_wrap_algorithm = ?
              AND deleted_at IS NULL AND updated_at <= ?
          ) AND NOT EXISTS (
            SELECT 1 FROM ma_professor_encrypted_records WHERE account_id = ? AND record_id = ?
          )
        `).bind(
          authenticated.accountId, RECORD_ID, nextServerRevision, sourceDeviceIdHash,
          encrypted.encryptionVersion, encrypted.encryptionAlgorithm,
          encrypted.nonce, encrypted.ciphertext, encrypted.ciphertextHash, timestamp, timestamp,
          authenticated.accountId, expectedServerRevision, CRYPTO_VERSION, KDF_ALGORITHM,
          KEY_WRAP_ALGORITHM, timestamp - UPLOAD_INTERVAL_MS, authenticated.accountId, RECORD_ID
        ),
      env.MA_PROFESSOR_DB
        .prepare(
          `
            UPDATE ma_professor_sync_profiles
            SET
              server_revision = ?,
              updated_at = ?
            WHERE account_id = ?
              AND server_revision = ?
              AND crypto_version = ?
              AND recovery_kdf_algorithm = ?
              AND recovery_key_wrap_algorithm = ?
              AND deleted_at IS NULL
              AND EXISTS (
                SELECT 1
                FROM ma_professor_encrypted_records
                WHERE account_id = ?
                  AND record_id = ?
                  AND server_revision = ?
                  AND record_revision = ?
                  AND encryption_version = ?
                  AND ciphertext_hash = ?
                  AND deleted_at IS NULL
              )
          `
        )
        .bind(
          nextServerRevision,
          timestamp,
          authenticated.accountId,
          expectedServerRevision,
          CRYPTO_VERSION,
          KDF_ALGORITHM,
          KEY_WRAP_ALGORITHM,
          authenticated.accountId,
          RECORD_ID,
          nextServerRevision,
          nextRecordRevision,
          encrypted.encryptionVersion,
          encrypted.ciphertextHash
        )
    ])

  // D1 counts trigger writes too: archiving/pruning previous ciphertext can
  // produce more than one change for this single-record conditional update.
  const recordChanged =
    results[0]?.success === true &&
    (results[0]?.meta?.changes ?? 0) > 0
  const profileChanged =
    results[1]?.success === true &&
    (results[1]?.meta?.changes ?? 0) > 0

  if (
    !recordChanged ||
    !profileChanged
  ) {
    const latest =
      await readProfile(
        authenticated.accountId,
        env
      )

    throw new CloudBackupApiError(
      'Existe uma cópia online mais recente. Atualize o estado antes de voltar a guardar.',
      409,
      {
        currentServerRevision:
          latest?.server_revision ??
          profile.server_revision
      }
    )
  }

  return json({
    success: true,
    recordId: RECORD_ID,
    cryptoVersion:
      CRYPTO_VERSION,
    serverRevision:
      nextServerRevision,
    recordRevision:
      nextRecordRevision,
    updatedAt:
      new Date(
        timestamp
      ).toISOString()
  })
}


async function handleDeleteV3(body: JsonBody, env: MaProfessorCloudBackupEnv) {
  if (body.confirmation !== 'APAGAR' || body.recordId !== RECORD_ID) {
    throw new CloudBackupApiError('Escreva APAGAR para confirmar a eliminação da cópia online.', 400)
  }
  const expectedServerRevision = parseExpectedRevision(body.expectedServerRevision)
  const expectedRecordRevision = parseExpectedRevision(body.expectedRecordRevision)
  const authenticated = await verifyAccessSession(body, env)
  const profile = assertV3StoredProfile(await readExistingProfile(authenticated.accountId, env))
  const record = await readExistingRecord(authenticated.accountId, env)
  if (profile.server_revision !== expectedServerRevision || (record?.record_revision ?? 0) !== expectedRecordRevision) {
    throw new CloudBackupApiError('A cópia online mudou. Atualize o estado antes de confirmar a eliminação.', 409)
  }

  // A revisão avança na mesma transação que elimina o conteúdo e o histórico.
  // O perfil OPAQUE/V3 e o instante do último envio permanecem intactos.
  const results = await env.MA_PROFESSOR_DB.batch([
    env.MA_PROFESSOR_DB.prepare(`
      DELETE FROM ma_professor_encrypted_records
      WHERE account_id = ? AND record_id = ? AND server_revision = ? AND record_revision = ?
        AND EXISTS (SELECT 1 FROM ma_professor_sync_profiles WHERE account_id = ? AND server_revision = ? AND deleted_at IS NULL)
    `).bind(authenticated.accountId, RECORD_ID, expectedServerRevision, expectedRecordRevision, authenticated.accountId, expectedServerRevision),
    env.MA_PROFESSOR_DB.prepare(`
      DELETE FROM ma_professor_encrypted_record_history
      WHERE account_id = ? AND record_id = ?
        AND EXISTS (SELECT 1 FROM ma_professor_sync_profiles WHERE account_id = ? AND server_revision = ? AND deleted_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM ma_professor_encrypted_records WHERE account_id = ? AND record_id = ?)
    `).bind(authenticated.accountId, RECORD_ID, authenticated.accountId, expectedServerRevision, authenticated.accountId, RECORD_ID),
    env.MA_PROFESSOR_DB.prepare(`
      UPDATE ma_professor_sync_profiles SET server_revision = server_revision + 1
      WHERE account_id = ? AND server_revision = ? AND crypto_version = ? AND deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM ma_professor_encrypted_records WHERE account_id = ? AND record_id = ?)
    `).bind(authenticated.accountId, expectedServerRevision, CRYPTO_VERSION, authenticated.accountId, RECORD_ID)
  ])
  if (results.some(result => !result.success) || results[2]?.meta?.changes !== 1) {
    throw new CloudBackupApiError('A cópia online mudou. Atualize o estado antes de confirmar a eliminação.', 409)
  }
  return handleStatus(body, env)
}

function getErrorDetails(
  error: unknown
) {
  if (
    error instanceof
      CloudBackupApiError
  ) {
    return {
      status: error.status,
      message: error.message,
      details: error.details
    }
  }

  console.error(
    'MA-Professor cloud backup request failed',
    {
      message:
        error instanceof Error
          ? error.message
          : String(error)
    }
  )

  return {
    status: 500,
    message:
      'Não foi possível contactar o serviço de cópias cifradas.',
    details: undefined
  }
}

export function isMAProfessorCloudBackupApiPath(
  pathname: string
) {
  return (
    pathname ===
      MA_PROFESSOR_CLOUD_BACKUP_API_PREFIX ||
    pathname.startsWith(
      `${MA_PROFESSOR_CLOUD_BACKUP_API_PREFIX}/`
    )
  )
}

export async function handleMAProfessorCloudBackupApiRequest(
  request: Request,
  env: MaProfessorCloudBackupEnv
) {
  const origin =
    normalizeOrigin(
      request.headers.get('Origin') || ''
    )
  const corsHeaders:
    Record<string, string> = {}

  if (
    origin &&
    isAllowedOrigin(request)
  ) {
    corsHeaders[
      'Access-Control-Allow-Origin'
    ] = origin
    corsHeaders.Vary =
      'Origin'
  }

  if (
    request.method ===
      'OPTIONS'
  ) {
    if (!isAllowedOrigin(request)) {
      return json(
        {
          success: false,
          message:
            'Pedido bloqueado por origem inválida.'
        },
        403
      )
    }

    return new Response(
      null,
      {
        status: 204,
        headers: {
          ...securityHeaders,
          ...corsHeaders,
          'Access-Control-Allow-Headers':
            'Content-Type',
          'Access-Control-Allow-Methods':
            'POST, OPTIONS',
          'Access-Control-Max-Age':
            '86400'
        }
      }
    )
  }

  if (
    request.method !== 'POST'
  ) {
    return json(
      {
        success: false,
        message:
          'Método não permitido.'
      },
      405,
      {
        ...corsHeaders,
        Allow:
          'POST, OPTIONS'
      }
    )
  }

  if (!isAllowedOrigin(request)) {
    return json(
      {
        success: false,
        message:
          'Pedido bloqueado por origem inválida.'
      },
      403,
      corsHeaders
    )
  }

  const url =
    new URL(request.url)
  const action =
    url.pathname.slice(
      MA_PROFESSOR_CLOUD_BACKUP_API_PREFIX.length
    ) || '/'

  try {
    const body =
      await readBody(request)

    switch (action) {
      case '/status':
        return await handleStatus(
          body,
          env
        )
      case '/get':
        return await handleGet(
          body,
          env
        )
      case '/initialize-v3':
        return await handleInitializeV3(
          body,
          env
        )
      case '/delete-v3':
        return await handleDeleteV3(body, env)
      case '/push-v3':
        return await handlePushV3(
          body,
          env
        )
      default:
        return json(
          {
            success: false,
            message:
              'Endpoint não encontrado.'
          },
          404,
          corsHeaders
        )
    }
  } catch (error) {
    const details =
      getErrorDetails(error)

    return json(
      {
        success: false,
        message:
          details.message,
        ...details.details
      },
      details.status,
      corsHeaders
    )
  }
}
