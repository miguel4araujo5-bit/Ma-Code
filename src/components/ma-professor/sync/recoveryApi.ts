import type {
  MAProfessorCryptoProfilePayload,
  MAProfessorDeviceCryptoPayload
} from './cryptoService'

const API_PREFIX =
  '/api/ma-professor/recovery'

export interface MAProfessorRecoveryPrepareResult {
  success: true
  profileExists: true

  serverRevision:
    number

  cryptoVersion:
    number

  updatedAt:
    string

  profile:
    MAProfessorCryptoProfilePayload
}

export interface MAProfessorRecoveryVerifierResult {
  success: true

  registered:
    boolean

  updatedAt:
    string
}

export interface MAProfessorRecoveryAuthorizeResult {
  success: true

  authorized: true

  serverRevision:
    number

  cryptoVersion:
    number

  updatedAt:
    string
}

export class MAProfessorRecoveryRequestError
  extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number
  ) {
    super(message)

    this.name =
      'MAProfessorRecoveryRequestError'

    this.status =
      status
  }
}

function isObject(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}

function isNonNegativeInteger(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isInteger(
      value
    ) &&
    value >= 0
  )
}

function isPositiveInteger(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isInteger(
      value
    ) &&
    value >= 1
  )
}

function requireDateString(
  value: unknown
) {
  if (
    typeof value !==
      'string' ||
    !value.trim() ||
    Number.isNaN(
      new Date(
        value
      ).getTime()
    )
  ) {
    throw new Error(
      'O serviço devolveu uma data inválida.'
    )
  }

  return value
}

function requireString(
  value: unknown,
  message: string
) {
  if (
    typeof value !==
      'string' ||
    !value.trim()
  ) {
    throw new Error(
      message
    )
  }

  return value
}

function parseProfile(
  value: unknown
): MAProfessorCryptoProfilePayload {
  if (
    !isObject(
      value
    ) ||
    value.cryptoVersion !==
      1 ||
    value.recoveryKdfAlgorithm !==
      'PBKDF2-HMAC-SHA-256' ||
    value.recoveryKeyWrapAlgorithm !==
      'AES-256-GCM'
  ) {
    throw new Error(
      'A configuração de recuperação devolvida pelo serviço não é válida.'
    )
  }

  return {
    cryptoVersion:
      1,

    recoveryKdfAlgorithm:
      'PBKDF2-HMAC-SHA-256',

    recoveryKdfSalt:
      requireString(
        value.recoveryKdfSalt,
        'O salt da chave de recuperação não é válido.'
      ),

    recoveryKdfParameters:
      requireString(
        value.recoveryKdfParameters,
        'Os parâmetros da chave de recuperação não são válidos.'
      ),

    recoveryKeyWrapAlgorithm:
      'AES-256-GCM',

    recoveryWrappedMasterKey:
      requireString(
        value.recoveryWrappedMasterKey,
        'A chave protegida da conta não é válida.'
      ),

    recoveryWrappedMasterKeyNonce:
      requireString(
        value.recoveryWrappedMasterKeyNonce,
        'O identificador criptográfico da recuperação não é válido.'
      )
  }
}

function parsePrepareResult(
  value: unknown
): MAProfessorRecoveryPrepareResult {
  if (
    !isObject(
      value
    ) ||
    value.success !==
      true ||
    value.profileExists !==
      true ||
    !isNonNegativeInteger(
      value.serverRevision
    ) ||
    !isPositiveInteger(
      value.cryptoVersion
    )
  ) {
    throw new Error(
      'O serviço devolveu uma resposta de recuperação inválida.'
    )
  }

  return {
    success:
      true,

    profileExists:
      true,

    serverRevision:
      value.serverRevision,

    cryptoVersion:
      value.cryptoVersion,

    updatedAt:
      requireDateString(
        value.updatedAt
      ),

    profile:
      parseProfile(
        value.profile
      )
  }
}

function parseVerifierResult(
  value: unknown
): MAProfessorRecoveryVerifierResult {
  if (
    !isObject(
      value
    ) ||
    value.success !==
      true ||
    typeof value.registered !==
      'boolean'
  ) {
    throw new Error(
      'O serviço não confirmou a preparação da recuperação.'
    )
  }

  return {
    success:
      true,

    registered:
      value.registered,

    updatedAt:
      requireDateString(
        value.updatedAt
      )
  }
}

function parseAuthorizeResult(
  value: unknown
): MAProfessorRecoveryAuthorizeResult {
  if (
    !isObject(
      value
    ) ||
    value.success !==
      true ||
    value.authorized !==
      true ||
    !isNonNegativeInteger(
      value.serverRevision
    ) ||
    !isPositiveInteger(
      value.cryptoVersion
    )
  ) {
    throw new Error(
      'O serviço não confirmou a autorização deste dispositivo.'
    )
  }

  return {
    success:
      true,

    authorized:
      true,

    serverRevision:
      value.serverRevision,

    cryptoVersion:
      value.cryptoVersion,

    updatedAt:
      requireDateString(
        value.updatedAt
      )
  }
}

async function postJson(
  path: string,
  body: Record<
    string,
    unknown
  >,
  fallbackMessage: string
) {
  let response: Response

  try {
    response =
      await fetch(
        `${API_PREFIX}${path}`,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',

            Accept:
              'application/json'
          },

          cache:
            'no-store',

          body:
            JSON.stringify(
              body
            )
        }
      )
  } catch {
    throw new MAProfessorRecoveryRequestError(
      'Não foi possível contactar o serviço de recuperação. Os dados deste dispositivo não foram alterados.',
      0
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
      isObject(
        data
      ) &&
      typeof data.message ===
        'string' &&
      data.message.trim()
        ? data.message.trim()
        : fallbackMessage

    throw new MAProfessorRecoveryRequestError(
      message,
      response.status
    )
  }

  return data
}

function validateSessionValue(
  value: string,
  message: string
) {
  const normalized =
    value.trim()

  if (!normalized) {
    throw new Error(
      message
    )
  }

  return normalized
}

export async function getMAProfessorRecoveryProfile(
  token: string,
  deviceId: string
) {
  const data =
    await postJson(
      '/prepare',
      {
        token:
          validateSessionValue(
            token,
            'A sessão não está disponível.'
          ),

        deviceId:
          validateSessionValue(
            deviceId,
            'O identificador deste dispositivo não está disponível.'
          )
      },
      'Não foi possível preparar a recuperação desta conta.'
    )

  return parsePrepareResult(
    data
  )
}

export async function registerMAProfessorRecoveryVerifier(
  token: string,
  deviceId: string,
  recoveryVerifier: string
) {
  const verifier =
    recoveryVerifier.trim()

  if (!verifier) {
    throw new Error(
      'A prova de recuperação não é válida.'
    )
  }

  const data =
    await postJson(
      '/register-verifier',
      {
        token:
          validateSessionValue(
            token,
            'A sessão não está disponível.'
          ),

        deviceId:
          validateSessionValue(
            deviceId,
            'O identificador deste dispositivo não está disponível.'
          ),

        recoveryVerifier:
          verifier
      },
      'Não foi possível preparar a recuperação noutros dispositivos.'
    )

  return parseVerifierResult(
    data
  )
}

export async function authorizeMAProfessorRecoveredDevice(
  token: string,
  deviceId: string,
  recoveryVerifier: string,
  device:
    MAProfessorDeviceCryptoPayload
) {
  const verifier =
    recoveryVerifier.trim()

  if (!verifier) {
    throw new Error(
      'A prova de recuperação não é válida.'
    )
  }

  const data =
    await postJson(
      '/authorize-device',
      {
        token:
          validateSessionValue(
            token,
            'A sessão não está disponível.'
          ),

        deviceId:
          validateSessionValue(
            deviceId,
            'O identificador deste dispositivo não está disponível.'
          ),

        recoveryVerifier:
          verifier,

        device
      },
      'Não foi possível autorizar este dispositivo.'
    )

  return parseAuthorizeResult(
    data
  )
}
