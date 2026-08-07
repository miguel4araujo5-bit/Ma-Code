import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

export const MA_PROFESSOR_RECOVERY_API_PREFIX =
  '/api/ma-professor/recovery'

const ACCESS_VERIFY_PATH =
  '/api/ma-professor/access/verify'

const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'

const MAX_BODY_BYTES =
  20_000

const CRYPTO_VERSION =
  1

const RECOVERY_KDF_ITERATIONS =
  600_000

const RECOVERY_SALT_BYTES =
  16

const RECOVERY_NONCE_BYTES =
  12

const RECOVERY_WRAPPED_KEY_BYTES =
  48

const RECOVERY_VERIFIER_BYTES =
  32

const DEVICE_HASH_BYTES =
  32

const DEVICE_WRAPPED_KEY_BYTES =
  384

const DEVICE_PUBLIC_MODULUS_BYTES =
  384

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

  first<
    T = Record<
      string,
      unknown
    >
  >(): Promise<T | null>

  run():
    Promise<D1ResultLike>
}

interface D1DatabaseLike {
  prepare(
    query: string
  ): D1PreparedStatementLike
}

export interface MaProfessorRecoveryEnv
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

interface AuthenticatedAccount {
  accountId:
    string

  deviceId:
    string

  deviceIdHash:
    string
}

interface SyncProfileRow {
  server_revision:
    number

  crypto_version:
    number

  recovery_kdf_algorithm:
    string

  recovery_kdf_salt:
    string

  recovery_kdf_parameters:
    string

  recovery_key_wrap_algorithm:
    string

  recovery_wrapped_master_key:
    string

  recovery_wrapped_master_key_nonce:
    string

  updated_at:
    number
}

interface SyncDeviceRow {
  device_id_hash:
    string
}

interface DeviceCryptoPayload {
  deviceIdHash:
    string

  devicePublicKey:
    string

  keyWrapAlgorithm:
    'RSA-OAEP-3072-SHA-256'

  wrappedMasterKey:
    string

  wrappedMasterKeyNonce:
    ''
}

interface StoredRecoveryParameters {
  iterations:
    number

  hash:
    string

  saltBytes:
    number

  recoveryVerifier?:
    string
}

class RecoveryApiError
  extends Error {
  readonly status:
    number

  constructor(
    message: string,
    status: number
  ) {
    super(message)

    this.name =
      'RecoveryApiError'

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

function readRequiredString(
  object: JsonObject,
  key: string,
  maxLength: number
) {
  const value =
    object[
      key
    ]

  if (
    typeof value !==
      'string' ||
    !value.trim() ||
    value.length >
      maxLength
  ) {
    throw new RecoveryApiError(
      'O pedido de recuperação não é válido.',
      400
    )
  }

  return value.trim()
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

function base64UrlByteLength(
  value: string
) {
  try {
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

    return atob(
      normalized +
        padding
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
    throw new RecoveryApiError(
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
    throw new RecoveryApiError(
      'O pedido de recuperação é demasiado grande.',
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
    throw new RecoveryApiError(
      'O pedido de recuperação é demasiado grande.',
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
    throw new RecoveryApiError(
      'O pedido não contém JSON válido.',
      400
    )
  }

  if (
    !isObject(
      parsed
    )
  ) {
    throw new RecoveryApiError(
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
          .toString(
            16
          )
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
  env:
    MaProfessorRecoveryEnv
): Promise<AuthenticatedAccount> {
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
    throw new RecoveryApiError(
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

    throw new RecoveryApiError(
      message,
      response.status ===
        403
        ? 403
        : 401
    )
  }

  if (
    !isUsableLicenseStatus(
      result.license
        .status
    )
  ) {
    throw new RecoveryApiError(
      'A licença não permite recuperar dados neste momento.',
      403
    )
  }

  return {
    accountId:
      await createAccountId(
        result.license.email
      ),

    deviceId,

    deviceIdHash:
      await hashDeviceId(
        deviceId
      )
  }
}

async function readProfile(
  accountId: string,
  env:
    MaProfessorRecoveryEnv
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

async function readAuthorizedDevice(
  accountId: string,
  deviceIdHash: string,
  env:
    MaProfessorRecoveryEnv
) {
  return env
    .MA_PROFESSOR_DB
    .prepare(
      `
        SELECT
          device_id_hash
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

function parseRecoveryParameters(
  value: string
): StoredRecoveryParameters {
  let parsed: unknown

  try {
    parsed =
      JSON.parse(
        value
      )
  } catch {
    parsed =
      null
  }

  if (
    !isObject(
      parsed
    ) ||
    parsed.iterations !==
      RECOVERY_KDF_ITERATIONS ||
    parsed.hash !==
      'SHA-256' ||
    parsed.saltBytes !==
      RECOVERY_SALT_BYTES
  ) {
    throw new RecoveryApiError(
      'A configuração de recuperação desta conta não é suportada.',
      409
    )
  }

  const recoveryVerifier =
    typeof parsed
      .recoveryVerifier ===
      'string'
      ? parsed
          .recoveryVerifier
          .trim()
      : undefined

  if (
    recoveryVerifier &&
    base64ByteLength(
      recoveryVerifier
    ) !==
      RECOVERY_VERIFIER_BYTES
  ) {
    throw new RecoveryApiError(
      'A configuração de recuperação desta conta está danificada.',
      409
    )
  }

  return {
    iterations:
      RECOVERY_KDF_ITERATIONS,

    hash:
      'SHA-256',

    saltBytes:
      RECOVERY_SALT_BYTES,

    recoveryVerifier
  }
}

function validateProfile(
  profile:
    SyncProfileRow
) {
  if (
    profile.crypto_version !==
      CRYPTO_VERSION ||
    profile.recovery_kdf_algorithm !==
      'PBKDF2-HMAC-SHA-256' ||
    profile.recovery_key_wrap_algorithm !==
      'AES-256-GCM' ||
    base64ByteLength(
      profile
        .recovery_kdf_salt
    ) !==
      RECOVERY_SALT_BYTES ||
    base64ByteLength(
      profile
        .recovery_wrapped_master_key
    ) !==
      RECOVERY_WRAPPED_KEY_BYTES ||
    base64ByteLength(
      profile
        .recovery_wrapped_master_key_nonce
    ) !==
      RECOVERY_NONCE_BYTES
  ) {
    throw new RecoveryApiError(
      'A configuração de recuperação desta conta não é suportada.',
      409
    )
  }

  return parseRecoveryParameters(
    profile
      .recovery_kdf_parameters
  )
}

function parseRecoveryVerifier(
  value: unknown
) {
  if (
    typeof value !==
      'string'
  ) {
    throw new RecoveryApiError(
      'A prova de recuperação não é válida.',
      400
    )
  }

  const normalized =
    value.trim()

  if (
    base64ByteLength(
      normalized
    ) !==
      RECOVERY_VERIFIER_BYTES
  ) {
    throw new RecoveryApiError(
      'A prova de recuperação não é válida.',
      400
    )
  }

  return normalized
}

function timingSafeStringEqual(
  left: string,
  right: string
) {
  if (
    left.length !==
      right.length
  ) {
    return false
  }

  let difference =
    0

  for (
    let index = 0;
    index <
      left.length;
    index += 1
  ) {
    difference |=
      left.charCodeAt(
        index
      ) ^
      right.charCodeAt(
        index
      )
  }

  return difference ===
    0
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
    throw new RecoveryApiError(
      'A configuração deste dispositivo não é válida.',
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
    throw new RecoveryApiError(
      'A configuração deste dispositivo não corresponde à sessão atual.',
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
    throw new RecoveryApiError(
      'A chave pública deste dispositivo não é válida.',
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
      imported
        .algorithm as
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
    throw new RecoveryApiError(
      'A chave pública deste dispositivo não é válida.',
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

function assertD1Success(
  result: D1ResultLike,
  message: string
) {
  if (
    result.success !==
      true ||
    (
      typeof result.meta
        ?.changes ===
        'number' &&
      result.meta.changes <
        1
    )
  ) {
    throw new Error(
      message
    )
  }
}

async function handlePrepare(
  body: JsonObject,
  env:
    MaProfessorRecoveryEnv
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
    throw new RecoveryApiError(
      'Esta conta ainda não possui uma cópia protegida.',
      404
    )
  }

  const parameters =
    validateProfile(
      profile
    )

  /*
   * O verifier nunca é devolvido a um dispositivo ainda não
   * autorizado. O browser terá de o calcular a partir da verdadeira
   * chave principal recuperada.
   */
  if (
    !parameters
      .recoveryVerifier
  ) {
    throw new RecoveryApiError(
      'A recuperação noutros dispositivos ainda precisa de ser preparada. Abra primeiro o MA-Professor num dispositivo já autorizado e tente novamente.',
      409
    )
  }

  const publicParameters =
    JSON.stringify({
      iterations:
        parameters.iterations,

      hash:
        parameters.hash,

      saltBytes:
        parameters.saltBytes
    })

  return json({
    success:
      true,

    profileExists:
      true,

    serverRevision:
      profile
        .server_revision,

    cryptoVersion:
      profile
        .crypto_version,

    updatedAt:
      new Date(
        profile.updated_at
      ).toISOString(),

    profile: {
      cryptoVersion:
        1,

      recoveryKdfAlgorithm:
        'PBKDF2-HMAC-SHA-256',

      recoveryKdfSalt:
        profile
          .recovery_kdf_salt,

      recoveryKdfParameters:
        publicParameters,

      recoveryKeyWrapAlgorithm:
        'AES-256-GCM',

      recoveryWrappedMasterKey:
        profile
          .recovery_wrapped_master_key,

      recoveryWrappedMasterKeyNonce:
        profile
          .recovery_wrapped_master_key_nonce
    }
  })
}

async function handleRegisterVerifier(
  body: JsonObject,
  env:
    MaProfessorRecoveryEnv
) {
  const authenticated =
    await verifyAccessSession(
      body,
      env
    )

  const device =
    await readAuthorizedDevice(
      authenticated.accountId,
      authenticated.deviceIdHash,
      env
    )

  if (!device) {
    throw new RecoveryApiError(
      'Este dispositivo ainda não está autorizado a preparar a recuperação da conta.',
      403
    )
  }

  const profile =
    await readProfile(
      authenticated.accountId,
      env
    )

  if (!profile) {
    throw new RecoveryApiError(
      'A proteção desta conta ainda não foi criada.',
      409
    )
  }

  const parameters =
    validateProfile(
      profile
    )

  const recoveryVerifier =
    parseRecoveryVerifier(
      body.recoveryVerifier
    )

  if (
    parameters
      .recoveryVerifier
  ) {
    if (
      !timingSafeStringEqual(
        parameters
          .recoveryVerifier,
        recoveryVerifier
      )
    ) {
      throw new RecoveryApiError(
        'A proteção de recuperação desta conta não corresponde à chave deste dispositivo.',
        409
      )
    }

    await env
      .MA_PROFESSOR_DB
      .prepare(
        `
          UPDATE ma_professor_sync_devices
          SET last_seen_at = ?
          WHERE account_id = ?
            AND device_id_hash = ?
            AND revoked_at IS NULL
        `
      )
      .bind(
        Date.now(),
        authenticated.accountId,
        authenticated.deviceIdHash
      )
      .run()

    return json({
      success:
        true,

      registered:
        false,

      updatedAt:
        new Date(
          profile.updated_at
        ).toISOString()
    })
  }

  const timestamp =
    Date.now()

  const updatedParameters =
    JSON.stringify({
      iterations:
        parameters.iterations,

      hash:
        parameters.hash,

      saltBytes:
        parameters.saltBytes,

      recoveryVerifier
    })

  const result =
    await env
      .MA_PROFESSOR_DB
      .prepare(
        `
          UPDATE ma_professor_sync_profiles
          SET
            recovery_kdf_parameters = ?,
            updated_at = ?
          WHERE account_id = ?
            AND deleted_at IS NULL
        `
      )
      .bind(
        updatedParameters,
        timestamp,
        authenticated.accountId
      )
      .run()

  assertD1Success(
    result,
    'Não foi possível preparar a recuperação da conta.'
  )

  await env
    .MA_PROFESSOR_DB
    .prepare(
      `
        UPDATE ma_professor_sync_devices
        SET last_seen_at = ?
        WHERE account_id = ?
          AND device_id_hash = ?
          AND revoked_at IS NULL
      `
    )
    .bind(
      timestamp,
      authenticated.accountId,
      authenticated.deviceIdHash
    )
    .run()

  return json({
    success:
      true,

    registered:
      true,

    updatedAt:
      new Date(
        timestamp
      ).toISOString()
  })
}

async function handleAuthorizeDevice(
  body: JsonObject,
  env:
    MaProfessorRecoveryEnv
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
    throw new RecoveryApiError(
      'A proteção desta conta ainda não foi criada.',
      409
    )
  }

  const parameters =
    validateProfile(
      profile
    )

  if (
    !parameters
      .recoveryVerifier
  ) {
    throw new RecoveryApiError(
      'A recuperação noutros dispositivos ainda não está preparada.',
      409
    )
  }

  const submittedVerifier =
    parseRecoveryVerifier(
      body.recoveryVerifier
    )

  if (
    !timingSafeStringEqual(
      parameters
        .recoveryVerifier,
      submittedVerifier
    )
  ) {
    throw new RecoveryApiError(
      'A chave de recuperação está incorreta ou não corresponde a esta conta.',
      403
    )
  }

  const device =
    await parseDeviceCrypto(
      body.device,
      authenticated.deviceIdHash
    )

  const timestamp =
    Date.now()

  const result =
    await env
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
          ON CONFLICT(account_id, device_id_hash)
          DO UPDATE SET
            device_public_key = excluded.device_public_key,
            key_wrap_algorithm = excluded.key_wrap_algorithm,
            wrapped_master_key = excluded.wrapped_master_key,
            wrapped_master_key_nonce = excluded.wrapped_master_key_nonce,
            last_seen_at = excluded.last_seen_at,
            revoked_at = NULL
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
      .run()

  assertD1Success(
    result,
    'Não foi possível autorizar este dispositivo.'
  )

  return json({
    success:
      true,

    authorized:
      true,

    serverRevision:
      profile
        .server_revision,

    cryptoVersion:
      profile
        .crypto_version,

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
      RecoveryApiError
  ) {
    return {
      status:
        error.status,

      message:
        error.message
    }
  }

  console.error(
    'MA-Professor recovery request failed',
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
      'Não foi possível concluir a recuperação neste momento.'
  }
}

export function isMAProfessorRecoveryApiPath(
  pathname: string
) {
  return (
    pathname ===
      MA_PROFESSOR_RECOVERY_API_PREFIX ||
    pathname.startsWith(
      `${MA_PROFESSOR_RECOVERY_API_PREFIX}/`
    )
  )
}

export async function handleMAProfessorRecoveryApiRequest(
  request: Request,
  env:
    MaProfessorRecoveryEnv
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
      MA_PROFESSOR_RECOVERY_API_PREFIX
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
      case '/prepare':
        return await handlePrepare(
          body,
          env
        )

      case '/register-verifier':
        return await handleRegisterVerifier(
          body,
          env
        )

      case '/authorize-device':
        return await handleAuthorizeDevice(
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
