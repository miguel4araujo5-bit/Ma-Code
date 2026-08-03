import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

export const MA_PROFESSOR_SYNC_API_PREFIX =
  '/api/ma-professor/sync'

const ACCESS_VERIFY_PATH =
  '/api/ma-professor/access/verify'

const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'

const MAX_BODY_BYTES = 12_000
const CRYPTO_VERSION = 1
const RECOVERY_KDF_ITERATIONS = 600_000
const RECOVERY_SALT_BYTES = 16
const RECOVERY_NONCE_BYTES = 12
const RECOVERY_WRAPPED_KEY_BYTES = 48
const DEVICE_HASH_BYTES = 32
const DEVICE_WRAPPED_KEY_BYTES = 384
const DEVICE_PUBLIC_MODULUS_BYTES = 384

type JsonBody = Record<string, unknown>
type JsonObject = Record<string, unknown>

interface D1ResultLike {
  success: boolean
}

interface D1PreparedStatementLike {
  bind(
    ...values: unknown[]
  ): D1PreparedStatementLike

  first<T = Record<string, unknown>>(): Promise<T | null>
}

interface D1DatabaseLike {
  prepare(
    query: string
  ): D1PreparedStatementLike

  batch(
    statements: D1PreparedStatementLike[]
  ): Promise<D1ResultLike[]>
}

export interface MaProfessorSyncEnv
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

interface SyncProfileRow {
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

interface SyncDeviceRow {
  device_id_hash: string
  device_public_key: string
  key_wrap_algorithm: string
  wrapped_master_key: string
  wrapped_master_key_nonce: string
}

interface CryptoProfilePayload {
  cryptoVersion: 1

  recoveryKdfAlgorithm:
    'PBKDF2-HMAC-SHA-256'

  recoveryKdfSalt: string
  recoveryKdfParameters: string

  recoveryKeyWrapAlgorithm:
    'AES-256-GCM'

  recoveryWrappedMasterKey: string
  recoveryWrappedMasterKeyNonce: string
}

interface DeviceCryptoPayload {
  deviceIdHash: string
  devicePublicKey: string

  keyWrapAlgorithm:
    'RSA-OAEP-3072-SHA-256'

  wrappedMasterKey: string
  wrappedMasterKeyNonce: ''
}

class SyncApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number
  ) {
    super(message)

    this.name =
      'SyncApiError'

    this.status =
      status
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

function readRequiredString(
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
    throw new SyncApiError(
      'A configuração de proteção enviada não é válida.',
      400
    )
  }

  return value.trim()
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
    throw new SyncApiError(
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
    throw new SyncApiError(
      'O pedido é demasiado grande.',
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
    throw new SyncApiError(
      'O pedido é demasiado grande.',
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
    throw new SyncApiError(
      'O pedido enviado não contém JSON válido.',
      400
    )
  }

  if (
    !isObject(
      parsed
    )
  ) {
    throw new SyncApiError(
      'O pedido enviado não é válido.',
      400
    )
  }

  return parsed
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

function base64UrlByteLength(
  value: string
) {
  const normalized =
    value
      .replace(
        /-/g,
        '+'
      )
      .replace(
        /_/g,
        '/'
      )

  const padding =
    normalized.length %
      4 ===
    0
      ? ''
      : '='.repeat(
          4 -
            (
              normalized.length %
              4
            )
        )

  return base64ByteLength(
    normalized +
      padding
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
          .toString(16)
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

async function verifyAccessSession(
  body: JsonBody,
  env: MaProfessorSyncEnv
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
    throw new SyncApiError(
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

    throw new SyncApiError(
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
    throw new SyncApiError(
      'A licença não permite sincronizar dados neste momento.',
      403
    )
  }

  const accountId =
    await createAccountId(
      result.license.email
    )

  return {
    accountId,
    deviceId
  }
}

function parseCryptoProfile(
  value: unknown
): CryptoProfilePayload {
  if (
    !isObject(
      value
    )
  ) {
    throw new SyncApiError(
      'A configuração de proteção enviada não é válida.',
      400
    )
  }

  if (
    value.cryptoVersion !==
      CRYPTO_VERSION
  ) {
    throw new SyncApiError(
      'Esta versão da proteção de dados não é suportada.',
      400
    )
  }

  const recoveryKdfAlgorithm =
    readRequiredString(
      value,
      'recoveryKdfAlgorithm',
      64
    )

  const recoveryKdfSalt =
    readRequiredString(
      value,
      'recoveryKdfSalt',
      128
    )

  const recoveryKdfParameters =
    readRequiredString(
      value,
      'recoveryKdfParameters',
      512
    )

  const recoveryKeyWrapAlgorithm =
    readRequiredString(
      value,
      'recoveryKeyWrapAlgorithm',
      64
    )

  const recoveryWrappedMasterKey =
    readRequiredString(
      value,
      'recoveryWrappedMasterKey',
      256
    )

  const recoveryWrappedMasterKeyNonce =
    readRequiredString(
      value,
      'recoveryWrappedMasterKeyNonce',
      128
    )

  if (
    recoveryKdfAlgorithm !==
      'PBKDF2-HMAC-SHA-256' ||
    recoveryKeyWrapAlgorithm !==
      'AES-256-GCM' ||
    base64ByteLength(
      recoveryKdfSalt
    ) !==
      RECOVERY_SALT_BYTES ||
    base64ByteLength(
      recoveryWrappedMasterKey
    ) !==
      RECOVERY_WRAPPED_KEY_BYTES ||
    base64ByteLength(
      recoveryWrappedMasterKeyNonce
    ) !==
      RECOVERY_NONCE_BYTES
  ) {
    throw new SyncApiError(
      'A configuração de proteção enviada não é suportada.',
      400
    )
  }

  let parameters: unknown

  try {
    parameters =
      JSON.parse(
        recoveryKdfParameters
      )
  } catch {
    parameters =
      null
  }

  if (
    !isObject(
      parameters
    ) ||
    parameters.iterations !==
      RECOVERY_KDF_ITERATIONS ||
    parameters.hash !==
      'SHA-256' ||
    parameters.saltBytes !==
      RECOVERY_SALT_BYTES
  ) {
    throw new SyncApiError(
      'Os parâmetros da chave de recuperação não são suportados.',
      400
    )
  }

  return {
    cryptoVersion:
      1,

    recoveryKdfAlgorithm:
      'PBKDF2-HMAC-SHA-256',

    recoveryKdfSalt,

    recoveryKdfParameters,

    recoveryKeyWrapAlgorithm:
      'AES-256-GCM',

    recoveryWrappedMasterKey,

    recoveryWrappedMasterKeyNonce
  }
}

async function parseDeviceCrypto(
  value: unknown,
  expectedDeviceIdHash:
    string
): Promise<DeviceCryptoPayload> {
  if (
    !isObject(
      value
    )
  ) {
    throw new SyncApiError(
      'A configuração do dispositivo não é válida.',
      400
    )
  }

  const deviceIdHash =
    readRequiredString(
      value,
      'deviceIdHash',
      128
    )

  const devicePublicKey =
    readRequiredString(
      value,
      'devicePublicKey',
      2_500
    )

  const keyWrapAlgorithm =
    readRequiredString(
      value,
      'keyWrapAlgorithm',
      64
    )

  const wrappedMasterKey =
    readRequiredString(
      value,
      'wrappedMasterKey',
      1_000
    )

  if (
    value.wrappedMasterKeyNonce !==
      '' ||
    deviceIdHash !==
      expectedDeviceIdHash ||
    base64ByteLength(
      deviceIdHash
    ) !==
      DEVICE_HASH_BYTES ||
    keyWrapAlgorithm !==
      'RSA-OAEP-3072-SHA-256' ||
    base64ByteLength(
      wrappedMasterKey
    ) !==
      DEVICE_WRAPPED_KEY_BYTES
  ) {
    throw new SyncApiError(
      'A configuração do dispositivo não corresponde à sessão atual.',
      400
    )
  }

  let jwk: unknown

  try {
    jwk =
      JSON.parse(
        devicePublicKey
      )
  } catch {
    jwk =
      null
  }

  if (
    !isObject(
      jwk
    ) ||
    jwk.kty !==
      'RSA' ||
    jwk.alg !==
      'RSA-OAEP-256' ||
    jwk.ext !==
      true ||
    jwk.e !==
      'AQAB' ||
    typeof jwk.n !==
      'string' ||
    base64UrlByteLength(
      jwk.n
    ) !==
      DEVICE_PUBLIC_MODULUS_BYTES ||
    !Array.isArray(
      jwk.key_ops
    ) ||
    !jwk.key_ops.includes(
      'encrypt'
    ) ||
    !jwk.key_ops.includes(
      'wrapKey'
    )
  ) {
    throw new SyncApiError(
      'A chave pública do dispositivo não é válida.',
      400
    )
  }

  try {
    const imported =
      await globalThis
        .crypto
        .subtle
        .importKey(
          'jwk',

          jwk as JsonWebKey,

          {
            name:
              'RSA-OAEP',

            hash:
              'SHA-256'
          },

          false,

          [
            'encrypt',
            'wrapKey'
          ]
        )

    const algorithm =
      imported.algorithm as
        RsaHashedKeyAlgorithm

    if (
      imported.type !==
        'public' ||
      algorithm.name !==
        'RSA-OAEP' ||
      algorithm.modulusLength !==
        3072 ||
      algorithm.hash.name !==
        'SHA-256'
    ) {
      throw new Error(
        'invalid key'
      )
    }
  } catch {
    throw new SyncApiError(
      'A chave pública do dispositivo não é válida.',
      400
    )
  }

  return {
    deviceIdHash,
    devicePublicKey,

    keyWrapAlgorithm:
      'RSA-OAEP-3072-SHA-256',

    wrappedMasterKey,

    wrappedMasterKeyNonce:
      ''
  }
}

async function readSyncProfile(
  accountId: string,
  env: MaProfessorSyncEnv
) {
  return env
    .MA_PROFESSOR_DB
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
    .bind(
      accountId
    )
    .first<SyncProfileRow>()
}

async function readSyncDevice(
  accountId: string,
  deviceIdHash: string,
  env: MaProfessorSyncEnv
) {
  return env
    .MA_PROFESSOR_DB
    .prepare(
      `
        SELECT
          device_id_hash,
          device_public_key,
          key_wrap_algorithm,
          wrapped_master_key,
          wrapped_master_key_nonce
        FROM ma_professor_sync_devices
        WHERE account_id = ?
          AND device_id_hash = ?
          AND revoked_at IS NULL
        LIMIT 1
      `
    )
    .bind(
      accountId,
      deviceIdHash
    )
    .first<SyncDeviceRow>()
}

function profileMatches(
  row: SyncProfileRow,
  payload:
    CryptoProfilePayload
) {
  return (
    row.crypto_version ===
      payload.cryptoVersion &&
    row.recovery_kdf_algorithm ===
      payload.recoveryKdfAlgorithm &&
    row.recovery_kdf_salt ===
      payload.recoveryKdfSalt &&
    row.recovery_kdf_parameters ===
      payload.recoveryKdfParameters &&
    row.recovery_key_wrap_algorithm ===
      payload.recoveryKeyWrapAlgorithm &&
    row.recovery_wrapped_master_key ===
      payload.recoveryWrappedMasterKey &&
    row.recovery_wrapped_master_key_nonce ===
      payload.recoveryWrappedMasterKeyNonce
  )
}

function deviceMatches(
  row: SyncDeviceRow,
  payload:
    DeviceCryptoPayload
) {
  return (
    row.device_id_hash ===
      payload.deviceIdHash &&
    row.device_public_key ===
      payload.devicePublicKey &&
    row.key_wrap_algorithm ===
      payload.keyWrapAlgorithm &&
    row.wrapped_master_key ===
      payload.wrappedMasterKey &&
    row.wrapped_master_key_nonce ===
      payload.wrappedMasterKeyNonce
  )
}

async function verifyExistingSetup(
  accountId: string,
  profile:
    CryptoProfilePayload,
  device:
    DeviceCryptoPayload,
  env:
    MaProfessorSyncEnv
) {
  const storedProfile =
    await readSyncProfile(
      accountId,
      env
    )

  if (!storedProfile) {
    return null
  }

  const storedDevice =
    await readSyncDevice(
      accountId,
      device.deviceIdHash,
      env
    )

  if (
    !profileMatches(
      storedProfile,
      profile
    ) ||
    !storedDevice ||
    !deviceMatches(
      storedDevice,
      device
    )
  ) {
    throw new SyncApiError(
      'A proteção desta conta já foi iniciada. Utilize a chave de recuperação para autorizar este dispositivo.',
      409
    )
  }

  return storedProfile
}

async function handleStatus(
  body: JsonBody,
  env: MaProfessorSyncEnv
) {
  const authenticated =
    await verifyAccessSession(
      body,
      env
    )

  const profile =
    await readSyncProfile(
      authenticated.accountId,
      env
    )

  return json({
    success:
      true,

    databaseReady:
      true,

    profileExists:
      profile !== null,

    serverRevision:
      profile
        ?.server_revision ??
      0,

    cryptoVersion:
      profile
        ?.crypto_version ??
      null,

    updatedAt:
      profile
        ? new Date(
            profile.updated_at
          ).toISOString()
        : null
  })
}

async function handleInitialize(
  body: JsonBody,
  env: MaProfessorSyncEnv
) {
  const authenticated =
    await verifyAccessSession(
      body,
      env
    )

  const expectedDeviceIdHash =
    await hashDeviceId(
      authenticated.deviceId
    )

  const profile =
    parseCryptoProfile(
      body.profile
    )

  const device =
    await parseDeviceCrypto(
      body.device,
      expectedDeviceIdHash
    )

  const existing =
    await verifyExistingSetup(
      authenticated.accountId,
      profile,
      device,
      env
    )

  if (existing) {
    return json({
      success:
        true,

      created:
        false,

      profileExists:
        true,

      serverRevision:
        existing
          .server_revision,

      cryptoVersion:
        existing
          .crypto_version,

      updatedAt:
        new Date(
          existing.updated_at
        ).toISOString()
    })
  }

  const timestamp =
    Date.now()

  try {
    const results =
      await env
        .MA_PROFESSOR_DB
        .batch([
          env
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
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  NULL
                )
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

          env
            .MA_PROFESSOR_DB
            .prepare(
              `
                INSERT INTO ma_professor_sync_devices (
                  account_id,
                  device_id_hash,
                  device_public_key,
                  key_wrap_algorithm,
                  wrapped_master_key,
                  wrapped_master_key_nonce,
                  created_at,
                  last_seen_at,
                  revoked_at
                ) VALUES (
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  NULL
                )
              `
            )
            .bind(
              authenticated.accountId,
              device.deviceIdHash,
              device.devicePublicKey,
              device.keyWrapAlgorithm,
              device.wrappedMasterKey,
              device.wrappedMasterKeyNonce,
              timestamp,
              timestamp
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
        'D1 batch failed'
      )
    }
  } catch {
    const retried =
      await verifyExistingSetup(
        authenticated.accountId,
        profile,
        device,
        env
      )

    if (retried) {
      return json({
        success:
          true,

        created:
          false,

        profileExists:
          true,

        serverRevision:
          retried
            .server_revision,

        cryptoVersion:
          retried
            .crypto_version,

        updatedAt:
          new Date(
            retried.updated_at
          ).toISOString()
      })
    }

    throw new Error(
      'Não foi possível criar o perfil cifrado.'
    )
  }

  return json(
    {
      success:
        true,

      created:
        true,

      profileExists:
        true,

      serverRevision:
        0,

      cryptoVersion:
        profile.cryptoVersion,

      updatedAt:
        new Date(
          timestamp
        ).toISOString()
    },

    201
  )
}

function getErrorDetails(
  error: unknown
) {
  if (
    error instanceof
      SyncApiError
  ) {
    return {
      status:
        error.status,

      message:
        error.message
    }
  }

  console.error(
    'MA-Professor sync request failed',

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
      'Não foi possível contactar o serviço de sincronização.'
  }
}

export function isMAProfessorSyncApiPath(
  pathname: string
) {
  return (
    pathname ===
      MA_PROFESSOR_SYNC_API_PREFIX ||
    pathname.startsWith(
      `${MA_PROFESSOR_SYNC_API_PREFIX}/`
    )
  )
}

export async function handleMAProfessorSyncApiRequest(
  request: Request,
  env: MaProfessorSyncEnv
) {
  const origin =
    normalizeOrigin(
      request.headers.get(
        'Origin'
      ) || ''
    )

  const corsHeaders:
    Record<string, string> =
      {}

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
      MA_PROFESSOR_SYNC_API_PREFIX
        .length
    ) || '/'

  try {
    const body =
      await readBody(
        request
      )

    switch (action) {
      case '/status':
        return await handleStatus(
          body,
          env
        )

      case '/initialize':
        return await handleInitialize(
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
