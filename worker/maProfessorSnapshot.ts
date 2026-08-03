import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

export const MA_PROFESSOR_SNAPSHOT_API_PREFIX =
  '/api/ma-professor/snapshot'

const ACCESS_VERIFY_PATH =
  '/api/ma-professor/access/verify'

const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'

const MAX_BODY_BYTES = 1_500_000
const MAX_RECORD_ID_LENGTH = 128
const MAX_CIPHERTEXT_CHARACTERS = 1_250_000
const NONCE_BYTES = 12
const HASH_BYTES = 32
const ENCRYPTION_VERSION = 1

const ENCRYPTION_ALGORITHM =
  'AES-256-GCM'

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

  first<
    T = Record<string, unknown>
  >(): Promise<T | null>
}

interface D1DatabaseLike {
  prepare(
    query: string
  ): D1PreparedStatementLike

  batch(
    statements:
      D1PreparedStatementLike[]
  ): Promise<D1ResultLike[]>
}

export interface MaProfessorSnapshotEnv
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
  license: AccessLicense
}

interface AccessVerifyError {
  success: false
  message?: string
}

type AccessVerifyResult =
  | AccessVerifySuccess
  | AccessVerifyError

interface AuthorizedProfileRow {
  server_revision: number
  crypto_version: number
  device_id_hash: string
}

interface ExistingRecordRow {
  record_revision: number
  created_at: number
}

interface StoredRecordRow {
  server_revision: number
  record_revision: number

  encryption_version: number
  encryption_algorithm: string

  nonce: string
  ciphertext: string
  ciphertext_hash: string

  created_at: number
  updated_at: number
}

interface ParsedEncryptedRecord {
  recordId: string

  encryptionVersion: 1

  encryptionAlgorithm:
    typeof ENCRYPTION_ALGORITHM

  nonce: string
  ciphertext: string
  ciphertextHash: string
}

class SnapshotApiError
  extends Error {
  readonly status: number
  readonly details: JsonObject

  constructor(
    message: string,
    status: number,
    details: JsonObject = {}
  ) {
    super(message)

    this.name =
      'SnapshotApiError'

    this.status =
      status

    this.details =
      details
  }
}

const securityHeaders:
  Record<string, string> = {
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
    Record<string, string> = {}
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

function isObject(
  value: unknown
): value is JsonObject {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
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

  for (
    const byte of bytes
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

async function readBody(
  request: Request
): Promise<JsonObject> {
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
    throw new SnapshotApiError(
      'Formato de pedido inválido.',
      400
    )
  }

  const declaredLength =
    Number(
      request.headers.get(
        'content-length'
      ) || 0
    )

  if (
    Number.isFinite(
      declaredLength
    ) &&
    declaredLength >
      MAX_BODY_BYTES
  ) {
    throw new SnapshotApiError(
      'O registo cifrado ultrapassa o limite permitido.',
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
    throw new SnapshotApiError(
      'O registo cifrado ultrapassa o limite permitido.',
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
    throw new SnapshotApiError(
      'O pedido enviado não contém JSON válido.',
      400
    )
  }

  if (
    !isObject(
      parsed
    )
  ) {
    throw new SnapshotApiError(
      'O pedido enviado não é válido.',
      400
    )
  }

  return parsed
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

        toArrayBuffer(
          new TextEncoder()
            .encode(
              `ma-professor-account-v1:${normalizedEmail}`
            )
        )
      )

  const hex =
    Array.from(
      new Uint8Array(
        digest
      ),

      byte =>
        byte
          .toString(16)
          .padStart(
            2,
            '0'
          )
    ).join('')

  return `account-${hex}`
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

        toArrayBuffer(
          new TextEncoder()
            .encode(
              `ma-professor-device-v1:${deviceId}`
            )
        )
      )

  return bytesToBase64(
    new Uint8Array(
      digest
    )
  )
}

async function verifyAccessSession(
  body: JsonObject,
  env: MaProfessorSnapshotEnv
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
    throw new SnapshotApiError(
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

    throw new SnapshotApiError(
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
    throw new SnapshotApiError(
      'A licença não permite sincronizar dados neste momento.',
      403
    )
  }

  return {
    accountId:
      await createAccountId(
        result.license.email
      ),

    deviceIdHash:
      await hashDeviceId(
        deviceId
      )
  }
}

async function authorizeProfile(
  body: JsonObject,
  env: MaProfessorSnapshotEnv
) {
  const authenticated =
    await verifyAccessSession(
      body,
      env
    )

  const profile =
    await env
      .MA_PROFESSOR_DB
      .prepare(
        `
          SELECT
            profile.server_revision,
            profile.crypto_version,
            device.device_id_hash
          FROM ma_professor_sync_profiles AS profile
          INNER JOIN ma_professor_sync_devices AS device
            ON device.account_id = profile.account_id
          WHERE profile.account_id = ?
            AND profile.deleted_at IS NULL
            AND device.device_id_hash = ?
            AND device.revoked_at IS NULL
          LIMIT 1
        `
      )
      .bind(
        authenticated.accountId,
        authenticated.deviceIdHash
      )
      .first<AuthorizedProfileRow>()

  if (!profile) {
    throw new SnapshotApiError(
      'A proteção cifrada desta conta ainda não está disponível neste dispositivo.',
      409
    )
  }

  if (
    profile.crypto_version !==
      1 ||
    profile.device_id_hash !==
      authenticated.deviceIdHash
  ) {
    throw new SnapshotApiError(
      'Esta versão da proteção de dados não é suportada.',
      409
    )
  }

  return {
    ...authenticated,

    serverRevision:
      profile.server_revision
  }
}

function parseRecordId(
  value: unknown
) {
  const recordId =
    typeof value ===
      'string'
      ? value.trim()
      : ''

  if (
    !recordId ||
    recordId.length >
      MAX_RECORD_ID_LENGTH ||
    !/^[a-z0-9][a-z0-9._:-]*$/i.test(
      recordId
    )
  ) {
    throw new SnapshotApiError(
      'O identificador do registo cifrado não é válido.',
      400
    )
  }

  return recordId
}

function requireString(
  object: JsonObject,
  key: string,
  maxLength: number
) {
  const value =
    object[key]

  if (
    typeof value !==
      'string' ||
    !value.trim() ||
    value.length >
      maxLength
  ) {
    throw new SnapshotApiError(
      'O registo cifrado enviado não é válido.',
      400
    )
  }

  return value.trim()
}

function parseEncryptedRecord(
  body: JsonObject
): ParsedEncryptedRecord {
  const recordId =
    parseRecordId(
      body.recordId
    )

  if (
    !isObject(
      body.encrypted
    )
  ) {
    throw new SnapshotApiError(
      'O registo cifrado enviado não é válido.',
      400
    )
  }

  const encrypted =
    body.encrypted

  if (
    encrypted.encryptionVersion !==
      ENCRYPTION_VERSION ||
    encrypted.encryptionAlgorithm !==
      ENCRYPTION_ALGORITHM
  ) {
    throw new SnapshotApiError(
      'Esta versão do registo cifrado não é suportada.',
      400
    )
  }

  const nonce =
    requireString(
      encrypted,
      'nonce',
      128
    )

  const ciphertext =
    requireString(
      encrypted,
      'ciphertext',
      MAX_CIPHERTEXT_CHARACTERS
    )

  const ciphertextHash =
    requireString(
      encrypted,
      'ciphertextHash',
      128
    )

  if (
    base64ByteLength(
      nonce
    ) !==
      NONCE_BYTES ||
    base64ByteLength(
      ciphertext
    ) <
      17 ||
    base64ByteLength(
      ciphertextHash
    ) !==
      HASH_BYTES
  ) {
    throw new SnapshotApiError(
      'O registo cifrado está incompleto ou tem um tamanho inválido.',
      400
    )
  }

  return {
    recordId,

    encryptionVersion:
      1,

    encryptionAlgorithm:
      ENCRYPTION_ALGORITHM,

    nonce,
    ciphertext,
    ciphertextHash
  }
}

function readExpectedRevision(
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
    throw new SnapshotApiError(
      'A revisão esperada da sincronização não é válida.',
      400
    )
  }

  return value
}

async function readExistingRecord(
  accountId: string,
  recordId: string,
  env: MaProfessorSnapshotEnv
) {
  return env
    .MA_PROFESSOR_DB
    .prepare(
      `
        SELECT
          record_revision,
          created_at
        FROM ma_professor_encrypted_records
        WHERE account_id = ?
          AND record_id = ?
        LIMIT 1
      `
    )
    .bind(
      accountId,
      recordId
    )
    .first<ExistingRecordRow>()
}

async function handlePush(
  body: JsonObject,
  env: MaProfessorSnapshotEnv
) {
  const authorized =
    await authorizeProfile(
      body,
      env
    )

  const expectedServerRevision =
    readExpectedRevision(
      body.expectedServerRevision
    )

  if (
    expectedServerRevision !==
      authorized.serverRevision
  ) {
    throw new SnapshotApiError(
      'Existe uma versão mais recente da cópia cifrada.',
      409,
      {
        currentServerRevision:
          authorized.serverRevision
      }
    )
  }

  const record =
    parseEncryptedRecord(
      body
    )

  const existing =
    await readExistingRecord(
      authorized.accountId,
      record.recordId,
      env
    )

  const nextServerRevision =
    expectedServerRevision +
    1

  const nextRecordRevision =
    (
      existing
        ?.record_revision ??
      0
    ) + 1

  const timestamp =
    Date.now()

  const createdAt =
    existing
      ?.created_at ??
    timestamp

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
              )
              SELECT
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                NULL
              FROM ma_professor_sync_profiles
              WHERE account_id = ?
                AND server_revision = ?
                AND deleted_at IS NULL
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
            authorized.accountId,
            record.recordId,
            nextServerRevision,
            nextRecordRevision,
            authorized.deviceIdHash,
            record.encryptionVersion,
            record.encryptionAlgorithm,
            record.nonce,
            record.ciphertext,
            record.ciphertextHash,
            createdAt,
            timestamp,
            authorized.accountId,
            expectedServerRevision
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
            authorized.accountId,
            expectedServerRevision
          )
      ])

  const recordChanged =
    results[0]
      ?.success === true &&
    results[0]
      ?.meta
      ?.changes === 1

  const profileChanged =
    results[1]
      ?.success === true &&
    results[1]
      ?.meta
      ?.changes === 1

  if (
    !recordChanged ||
    !profileChanged
  ) {
    const latest =
      await env
        .MA_PROFESSOR_DB
        .prepare(
          `
            SELECT server_revision
            FROM ma_professor_sync_profiles
            WHERE account_id = ?
              AND deleted_at IS NULL
            LIMIT 1
          `
        )
        .bind(
          authorized.accountId
        )
        .first<{
          server_revision: number
        }>()

    throw new SnapshotApiError(
      'Existe uma versão mais recente da cópia cifrada.',
      409,
      {
        currentServerRevision:
          latest
            ?.server_revision ??
          authorized.serverRevision
      }
    )
  }

  return json({
    success:
      true,

    recordId:
      record.recordId,

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

async function handleGet(
  body: JsonObject,
  env: MaProfessorSnapshotEnv
) {
  const authorized =
    await authorizeProfile(
      body,
      env
    )

  const recordId =
    parseRecordId(
      body.recordId
    )

  const record =
    await env
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
            created_at,
            updated_at
          FROM ma_professor_encrypted_records
          WHERE account_id = ?
            AND record_id = ?
            AND deleted_at IS NULL
          LIMIT 1
        `
      )
      .bind(
        authorized.accountId,
        recordId
      )
      .first<StoredRecordRow>()

  if (!record) {
    return json({
      success:
        true,

      found:
        false,

      recordId,

      serverRevision:
        authorized.serverRevision
    })
  }

  return json({
    success:
      true,

    found:
      true,

    recordId,

    serverRevision:
      authorized.serverRevision,

    recordRevision:
      record.record_revision,

    recordServerRevision:
      record.server_revision,

    createdAt:
      new Date(
        record.created_at
      ).toISOString(),

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

function errorDetails(
  error: unknown
) {
  if (
    error instanceof
      SnapshotApiError
  ) {
    return {
      status:
        error.status,

      message:
        error.message,

      details:
        error.details
    }
  }

  console.error(
    'MA-Professor snapshot request failed',
    {
      message:
        error instanceof
          Error
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
      'Não foi possível guardar a cópia cifrada.',

    details: {}
  }
}

export function isMAProfessorSnapshotApiPath(
  pathname: string
) {
  return (
    pathname ===
      MA_PROFESSOR_SNAPSHOT_API_PREFIX ||
    pathname.startsWith(
      `${MA_PROFESSOR_SNAPSHOT_API_PREFIX}/`
    )
  )
}

export async function handleMAProfessorSnapshotApiRequest(
  request: Request,
  env: MaProfessorSnapshotEnv
) {
  const origin =
    normalizeOrigin(
      request.headers.get(
        'Origin'
      ) || ''
    )

  const corsHeaders:
    Record<string, string> = {}

  if (
    origin &&
    isAllowedOrigin(
      request
    )
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
      MA_PROFESSOR_SNAPSHOT_API_PREFIX
        .length
    ) || '/'

  try {
    const body =
      await readBody(
        request
      )

    switch (action) {
      case '/push':
        return await handlePush(
          body,
          env
        )

      case '/get':
        return await handleGet(
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
  } catch (error) {
    const details =
      errorDetails(
        error
      )

    return json(
      {
        success:
          false,

        message:
          details.message,

        ...details.details
      },
      details.status,
      corsHeaders
    )
  }
}
