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

const CRYPTO_VERSION =
  2

const SESSION_KDF_MARKER =
  'SESSION-AUTH-V1'

const SESSION_KEY_MARKER =
  'RAW-AES-256-GCM-SESSION-V1'

const ENCRYPTION_VERSION =
  1

const ENCRYPTION_ALGORITHM =
  'AES-256-GCM'

const MAX_BODY_BYTES =
  1_500_000

const MAX_CIPHERTEXT_BYTES =
  1_000_000

const KEY_BYTES =
  32

const NONCE_BYTES =
  12

const HASH_BYTES =
  32

type JsonBody =
  Record<
    string,
    unknown
  >

type JsonObject =
  Record<
    string,
    unknown
  >

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

  run():
    Promise<D1ResultLike>
}

interface D1DatabaseLike {
  prepare(
    query: string
  ): D1PreparedStatementLike

  batch(
    statements:
      D1PreparedStatementLike[]
  ):
    Promise<D1ResultLike[]>
}

export interface MaProfessorCloudBackupEnv
  extends MaProfessorAccessEnv {
  MA_PROFESSOR_DB:
    D1DatabaseLike
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
  license:
    AccessLicense
}

interface AccessVerifyError {
  success: false
  message?: string
}

type AccessVerifyResult =
  | AccessVerifySuccess
  | AccessVerifyError

interface SessionProfileRow {
  server_revision:
    number

  crypto_version:
    number

  recovery_kdf_algorithm:
    string

  recovery_key_wrap_algorithm:
    string

  recovery_wrapped_master_key:
    string

  updated_at:
    number
}

interface EncryptedRecordRow {
  server_revision:
    number

  record_revision:
    number

  encryption_version:
    number

  encryption_algorithm:
    string

  nonce:
    string

  ciphertext:
    string

  ciphertext_hash:
    string

  updated_at:
    number
}

interface RecordMetadataRow {
  record_revision:
    number

  updated_at:
    number

  ciphertext_bytes:
    number
}

interface EncryptedPayload {
  encryptionVersion:
    number

  encryptionAlgorithm:
    string

  nonce:
    string

  ciphertext:
    string

  ciphertextHash:
    string
}

class CloudBackupApiError
  extends Error {
  readonly status:
    number

  constructor(
    message: string,
    status: number
  ) {
    super(
      message
    )

    this.name =
      'CloudBackupApiError'

    this.status =
      status
  }
}

const securityHeaders:
  Record<
    string,
    string
  > = {
    'Cache-Control':
      'no-store',

    'Content-Security-Policy':
      "default-src 'none'; frame-ancestors 'none'",

    'X-Content-Type-Options':
      'nosniff',

    'X-Frame-Options':
      'DENY',

    'Referrer-Policy':
      'no-referrer',

    'X-Robots-Tag':
      'noindex, nofollow'
  }

function json(
  body: unknown,
  status = 200,
  extraHeaders:
    Record<
      string,
      string
    > = {}
) {
  return new Response(
    JSON.stringify(
      body
    ),
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
    return new URL(
      value
    ).origin
  } catch {
    return ''
  }
}

function isAllowedOrigin(
  request: Request
) {
  const requestOrigin =
    new URL(
      request.url
    ).origin

  const origin =
    normalizeOrigin(
      request.headers.get(
        'Origin'
      ) || ''
    )

  const referer =
    normalizeOrigin(
      request.headers.get(
        'Referer'
      ) || ''
    )

  const candidate =
    origin ||
    referer

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
      new URL(
        candidate
      ).hostname

    if (
      [
        'localhost',
        '127.0.0.1',
        '0.0.0.0'
      ].includes(
        hostname
      )
    ) {
      return true
    }
  } catch {
    return false
  }

  return allowed.has(
    candidate
  )
}

function isObject(
  value: unknown
): value is JsonObject {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value
    )
  )
}

function normalizeId(
  value: unknown,
  maxLength = 256
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .slice(
          0,
          maxLength
        )
    : ''
}

function isUsableLicenseStatus(
  status:
    AccessLicense['status']
) {
  return (
    status ===
      'active' ||
    status ===
      'expiring' ||
    status ===
      'renewal_pending'
  )
}

function bytesToBase64(
  bytes: Uint8Array
) {
  let binary = ''

  for (
    const byte of
    bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      )
  }

  return btoa(
    binary
  )
}

function base64ByteLength(
  value: string
) {
  try {
    return atob(
      value
    ).length
  } catch {
    return -1
  }
}

function createSessionKey() {
  const bytes =
    new Uint8Array(
      KEY_BYTES
    )

  globalThis.crypto
    .getRandomValues(
      bytes
    )

  return bytesToBase64(
    bytes
  )
}

async function createAccountId(
  email: string
) {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase()

  const digest =
    await globalThis
      .crypto
      .subtle
      .digest(
        'SHA-256',

        new TextEncoder()
          .encode(
            [
              'ma-professor-account-v1',
              normalizedEmail
            ].join(
              ':'
            )
          )
      )

  const value =
    Array.from(
      new Uint8Array(
        digest
      ),
      byte =>
        byte
          .toString(
            16
          )
          .padStart(
            2,
            '0'
          )
    ).join('')

  return `account-${value}`
}

async function hashDeviceId(
  deviceId: string
) {
  const digest =
    await globalThis
      .crypto
      .subtle
      .digest(
        'SHA-256',
        new TextEncoder()
          .encode(
            `ma-professor-device-v1:${deviceId}`
          )
      )

  return bytesToBase64(
    new Uint8Array(
      digest
    )
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
      ) ||
      0
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
      .encode(
        text
      )
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
    parsed =
      JSON.parse(
        text
      )
  } catch {
    throw new CloudBackupApiError(
      'O pedido enviado não contém JSON válido.',
      400
    )
  }

  if (
    !isObject(
      parsed
    )
  ) {
    throw new CloudBackupApiError(
      'O pedido enviado não é válido.',
      400
    )
  }

  return parsed
}

async function verifyAccessSession(
  body: JsonBody,
  env:
    MaProfessorCloudBackupEnv
) {
  const token =
    normalizeId(
      body.token
    )

  const deviceId =
    normalizeId(
      body.deviceId,
      180
    )

  if (
    !token ||
    !deviceId
  ) {
    throw new CloudBackupApiError(
      'A sessão não é válida.',
      401
    )
  }

  const durableObjectId =
    env
      .MA_PROFESSOR_ACCESS
      .idFromName(
        ACCESS_DURABLE_OBJECT_NAME
      )

  const durableObject =
    env
      .MA_PROFESSOR_ACCESS
      .get(
        durableObjectId
      )

  const response =
    await durableObject.fetch(
      new Request(
        `https://ma-professor.internal${ACCESS_VERIFY_PATH}`,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',

            Accept:
              'application/json'
          },

          body:
            JSON.stringify({
              token,
              deviceId
            })
        }
      )
    )

  let result:
    AccessVerifyResult | null =
      null

  try {
    result =
      await response
        .json() as
        AccessVerifyResult
  } catch {
    result =
      null
  }

  if (
    !response.ok ||
    !result ||
    result.success !==
      true
  ) {
    const message =
      result &&
      result.success ===
        false &&
      typeof result.message ===
        'string'
        ? result.message
        : 'A sessão já não é válida.'

    throw new CloudBackupApiError(
      message,
      response.status ===
        403
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
  env:
    MaProfessorCloudBackupEnv
) {
  return env
    .MA_PROFESSOR_DB
    .prepare(
      `
        SELECT
          server_revision,
          crypto_version,
          recovery_kdf_algorithm,
          recovery_key_wrap_algorithm,
          recovery_wrapped_master_key,
          updated_at
        FROM ma_professor_sync_profiles
        WHERE account_id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `
    )
    .bind(
      accountId
    )
    .first<SessionProfileRow>()
}

function assertSessionProfile(
  profile:
    SessionProfileRow
) {
  if (
    profile.crypto_version !==
      CRYPTO_VERSION ||
    profile.recovery_kdf_algorithm !==
      SESSION_KDF_MARKER ||
    profile.recovery_key_wrap_algorithm !==
      SESSION_KEY_MARKER ||
    base64ByteLength(
      profile.recovery_wrapped_master_key
    ) !==
      KEY_BYTES
  ) {
    throw new CloudBackupApiError(
      'Esta conta já possui uma proteção online de uma versão anterior. A cópia existente não foi alterada.',
      409
    )
  }

  return profile
}

async function ensureSessionProfile(
  accountId: string,
  env:
    MaProfessorCloudBackupEnv
) {
  const existing =
    await readProfile(
      accountId,
      env
    )

  if (existing) {
    return assertSessionProfile(
      existing
    )
  }

  const timestamp =
    Date.now()

  const sessionKey =
    createSessionKey()

  try {
    const result =
      await env
        .MA_PROFESSOR_DB
        .prepare(
          `
            INSERT INTO ma_professor_sync_profiles (
              account_id,
              server_revision,
              crypto_version,
              recovery_kdf_algorithm,
              recovery_kdf_salt,
              recovery_kdf_parameters,
              recovery_key_wrap_algorithm,
              recovery_wrapped_master_key,
              recovery_wrapped_master_key_nonce,
              created_at,
              updated_at,
              deleted_at
            ) VALUES (
              ?,
              0,
              ?,
              ?,
              '',
              '{}',
              ?,
              ?,
              '',
              ?,
              ?,
              NULL
            )
          `
        )
        .bind(
          accountId,
          CRYPTO_VERSION,
          SESSION_KDF_MARKER,
          SESSION_KEY_MARKER,
          sessionKey,
          timestamp,
          timestamp
        )
        .run()

    if (
      result.success !==
        true
    ) {
      throw new Error(
        'D1 insert failed'
      )
    }
  } catch {
    const concurrent =
      await readProfile(
        accountId,
        env
      )

    if (concurrent) {
      return assertSessionProfile(
        concurrent
      )
    }

    throw new Error(
      'Não foi possível preparar a proteção da cópia online.'
    )
  }

  const created =
    await readProfile(
      accountId,
      env
    )

  if (!created) {
    throw new Error(
      'A proteção da cópia online não ficou disponível.'
    )
  }

  return assertSessionProfile(
    created
  )
}

async function readRecordMetadata(
  accountId: string,
  env:
    MaProfessorCloudBackupEnv
) {
  return env
    .MA_PROFESSOR_DB
    .prepare(
      `
        SELECT
          record_revision,
          updated_at,
          LENGTH(ciphertext) AS ciphertext_bytes
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

async function readRecord(
  accountId: string,
  env:
    MaProfessorCloudBackupEnv
) {
  return env
    .MA_PROFESSOR_DB
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
    typeof value !==
      'number' ||
    !Number.isInteger(
      value
    ) ||
    value < 0
  ) {
    throw new CloudBackupApiError(
      'A revisão da cópia não é válida.',
      400
    )
  }

  return value
}

function parseEncryptedPayload(
  value: unknown
): EncryptedPayload {
  if (
    !isObject(
      value
    ) ||
    value.encryptionVersion !==
      ENCRYPTION_VERSION ||
    value.encryptionAlgorithm !==
      ENCRYPTION_ALGORITHM ||
    typeof value.nonce !==
      'string' ||
    typeof value.ciphertext !==
      'string' ||
    !value.ciphertext ||
    typeof value.ciphertextHash !==
      'string'
  ) {
    throw new CloudBackupApiError(
      'A cópia cifrada enviada não é válida.',
      400
    )
  }

  if (
    base64ByteLength(
      value.nonce
    ) !==
      NONCE_BYTES ||
    base64ByteLength(
      value.ciphertextHash
    ) !==
      HASH_BYTES
  ) {
    throw new CloudBackupApiError(
      'A cópia cifrada enviada tem parâmetros inválidos.',
      400
    )
  }

  const ciphertextBytes =
    base64ByteLength(
      value.ciphertext
    )

  if (
    ciphertextBytes < 1 ||
    ciphertextBytes >
      MAX_CIPHERTEXT_BYTES
  ) {
    throw new CloudBackupApiError(
      'A cópia cifrada ultrapassa o limite permitido.',
      413
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

async function handleStatus(
  body: JsonBody,
  env:
    MaProfessorCloudBackupEnv
) {
  const authenticated =
    await verifyAccessSession(
      body,
      env
    )

  const profile =
    await ensureSessionProfile(
      authenticated.accountId,
      env
    )

  const metadata =
    await readRecordMetadata(
      authenticated.accountId,
      env
    )

  return json({
    success:
      true,

    serverRevision:
      profile.server_revision,

    cryptoVersion:
      profile.crypto_version,

    updatedAt:
      new Date(
        profile.updated_at
      ).toISOString(),

    backup: {
      found:
        metadata !==
          null,

      recordRevision:
        metadata
          ?.record_revision ??
        null,

      updatedAt:
        metadata
          ? new Date(
              metadata.updated_at
            ).toISOString()
          : null,

      ciphertextBytes:
        metadata
          ?.ciphertext_bytes ??
        null
    }
  })
}

async function handleKey(
  body: JsonBody,
  env:
    MaProfessorCloudBackupEnv
) {
  const authenticated =
    await verifyAccessSession(
      body,
      env
    )

  const profile =
    await ensureSessionProfile(
      authenticated.accountId,
      env
    )

  return json({
    success:
      true,

    cryptoVersion:
      profile.crypto_version,

    keyAlgorithm:
      ENCRYPTION_ALGORITHM,

    key:
      profile.recovery_wrapped_master_key
  })
}

async function handleGet(
  body: JsonBody,
  env:
    MaProfessorCloudBackupEnv
) {
  const recordId =
    normalizeId(
      body.recordId,
      80
    )

  if (
    recordId !==
      RECORD_ID
  ) {
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
    await ensureSessionProfile(
      authenticated.accountId,
      env
    )

  const record =
    await readRecord(
      authenticated.accountId,
      env
    )

  if (!record) {
    return json({
      success:
        true,

      found:
        false,

      recordId:
        RECORD_ID,

      serverRevision:
        profile.server_revision
    })
  }

  return json({
    success:
      true,

    found:
      true,

    recordId:
      RECORD_ID,

    serverRevision:
      profile.server_revision,

    recordRevision:
      record.record_revision,

    updatedAt:
      new Date(
        record.updated_at
      ).toISOString(),

    encrypted: {
      encryptionVersion:
        record.encryption_version,

      encryptionAlgorithm:
        record.encryption_algorithm,

      nonce:
        record.nonce,

      ciphertext:
        record.ciphertext,

      ciphertextHash:
        record.ciphertext_hash
    }
  })
}

async function handlePush(
  body: JsonBody,
  env:
    MaProfessorCloudBackupEnv
) {
  const recordId =
    normalizeId(
      body.recordId,
      80
    )

  if (
    recordId !==
      RECORD_ID
  ) {
    throw new CloudBackupApiError(
      'O identificador da cópia não é válido.',
      400
    )
  }

  const expectedServerRevision =
    parseExpectedRevision(
      body.expectedServerRevision
    )

  const encrypted =
    parseEncryptedPayload(
      body.encrypted
    )

  const authenticated =
    await verifyAccessSession(
      body,
      env
    )

  const profile =
    await ensureSessionProfile(
      authenticated.accountId,
      env
    )

  if (
    profile.server_revision !==
      expectedServerRevision
  ) {
    throw new CloudBackupApiError(
      'Existe uma cópia online mais recente. Atualize o estado antes de voltar a guardar.',
      409
    )
  }

  const existing =
    await readRecord(
      authenticated.accountId,
      env
    )

  const nextServerRevision =
    profile.server_revision +
    1

  const nextRecordRevision =
    (
      existing
        ?.record_revision ??
      0
    ) +
    1

  const timestamp =
    Date.now()

  const sourceDeviceIdHash =
    await hashDeviceId(
      authenticated.deviceId
    )

  const results =
    await env
      .MA_PROFESSOR_DB
      .batch([
        env
          .MA_PROFESSOR_DB
          .prepare(
            `
              INSERT INTO ma_professor_encrypted_records (
                account_id,
                record_id,
                server_revision,
                record_revision,
                source_device_id_hash,
                encryption_version,
                encryption_algorithm,
                nonce,
                ciphertext,
                ciphertext_hash,
                created_at,
                updated_at,
                deleted_at
              ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL
              )
              ON CONFLICT(account_id, record_id)
              DO UPDATE SET
                server_revision = excluded.server_revision,
                record_revision = excluded.record_revision,
                source_device_id_hash = excluded.source_device_id_hash,
                encryption_version = excluded.encryption_version,
                encryption_algorithm = excluded.encryption_algorithm,
                nonce = excluded.nonce,
                ciphertext = excluded.ciphertext,
                ciphertext_hash = excluded.ciphertext_hash,
                updated_at = excluded.updated_at,
                deleted_at = NULL
            `
          )
          .bind(
            authenticated.accountId,
            RECORD_ID,
            nextServerRevision,
            nextRecordRevision,
            sourceDeviceIdHash,
            encrypted.encryptionVersion,
            encrypted.encryptionAlgorithm,
            encrypted.nonce,
            encrypted.ciphertext,
            encrypted.ciphertextHash,
            existing
              ? existing.updated_at
              : timestamp,
            timestamp
          ),

        env
          .MA_PROFESSOR_DB
          .prepare(
            `
              UPDATE ma_professor_sync_profiles
              SET
                server_revision = ?,
                updated_at = ?
              WHERE account_id = ?
                AND server_revision = ?
                AND deleted_at IS NULL
            `
          )
          .bind(
            nextServerRevision,
            timestamp,
            authenticated.accountId,
            expectedServerRevision
          )
      ])

  if (
    results.length !==
      2 ||
    results.some(
      result =>
        result.success !==
          true
    )
  ) {
    throw new Error(
      'Não foi possível guardar a cópia cifrada.'
    )
  }

  const confirmedProfile =
    await readProfile(
      authenticated.accountId,
      env
    )

  if (
    !confirmedProfile ||
    confirmedProfile.server_revision !==
      nextServerRevision
  ) {
    throw new CloudBackupApiError(
      'A revisão da cópia mudou durante o envio. Atualize o estado antes de tentar novamente.',
      409
    )
  }

  return json({
    success:
      true,

    recordId:
      RECORD_ID,

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

function getErrorDetails(
  error: unknown
) {
  if (
    error instanceof
      CloudBackupApiError
  ) {
    return {
      status:
        error.status,

      message:
        error.message
    }
  }

  console.error(
    'MA-Professor cloud backup request failed',
    {
      message:
        error instanceof Error
          ? error.message
          : String(
              error
            )
    }
  )

  return {
    status:
      500,

    message:
      'Não foi possível contactar o serviço de cópias cifradas.'
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
  env:
    MaProfessorCloudBackupEnv
) {
  const origin =
    normalizeOrigin(
      request.headers.get(
        'Origin'
      ) || ''
    )

  const corsHeaders:
    Record<
      string,
      string
    > = {}

  if (
    origin &&
    isAllowedOrigin(
      request
    )
  ) {
    corsHeaders[
      'Access-Control-Allow-Origin'
    ] =
      origin

    corsHeaders.Vary =
      'Origin'
  }

  if (
    request.method ===
      'OPTIONS'
  ) {
    if (
      !isAllowedOrigin(
        request
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            'Pedido bloqueado por origem inválida.'
        },
        403
      )
    }

    return new Response(
      null,
      {
        status:
          204,

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
    request.method !==
      'POST'
  ) {
    return json(
      {
        success:
          false,

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

  if (
    !isAllowedOrigin(
      request
    )
  ) {
    return json(
      {
        success:
          false,

        message:
          'Pedido bloqueado por origem inválida.'
      },
      403,
      corsHeaders
    )
  }

  const url =
    new URL(
      request.url
    )

  const action =
    url.pathname.slice(
      MA_PROFESSOR_CLOUD_BACKUP_API_PREFIX
        .length
    ) || '/'

  try {
    const body =
      await readBody(
        request
      )

    switch (
      action
    ) {
      case '/status':
        return await handleStatus(
          body,
          env
        )

      case '/key':
        return await handleKey(
          body,
          env
        )

      case '/get':
        return await handleGet(
          body,
          env
        )

      case '/push':
        return await handlePush(
          body,
          env
        )

      default:
        return json(
          {
            success:
              false,

            message:
              'Endpoint não encontrado.'
          },
          404,
          corsHeaders
        )
    }
  } catch (
    error
  ) {
    const details =
      getErrorDetails(
        error
      )

    return json(
      {
        success:
          false,

        message:
          details.message
      },
      details.status,
      corsHeaders
    )
  }
}
