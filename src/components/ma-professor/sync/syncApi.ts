import type {
  MAProfessorCryptoProfilePayload,
  MAProfessorDeviceCryptoPayload
} from './cryptoService'

const API_PREFIX =
  '/api/ma-professor/sync'

export interface MAProfessorSyncStatus {
  success: true
  databaseReady: true
  profileExists: boolean
  serverRevision: number
  cryptoVersion: number | null
  updatedAt: string | null
}

export interface MAProfessorSyncInitializeResult {
  success: true
  created: boolean
  profileExists: true
  serverRevision: number
  cryptoVersion: number
  updatedAt: string
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

function isNullableNumber(
  value: unknown
): value is number | null {
  return (
    value === null ||
    (
      typeof value === 'number' &&
      Number.isFinite(value)
    )
  )
}

function isNullableString(
  value: unknown
): value is string | null {
  return (
    value === null ||
    typeof value === 'string'
  )
}

function parseSyncStatus(
  value: unknown
): MAProfessorSyncStatus {
  if (
    !isObject(value) ||
    value.success !== true ||
    value.databaseReady !== true ||
    typeof value.profileExists !==
      'boolean' ||
    !isNonNegativeInteger(
      value.serverRevision
    ) ||
    !isNullableNumber(
      value.cryptoVersion
    ) ||
    !isNullableString(
      value.updatedAt
    )
  ) {
    throw new Error(
      'O serviço de sincronização devolveu uma resposta inválida.'
    )
  }

  return {
    success: true,
    databaseReady: true,
    profileExists:
      value.profileExists,
    serverRevision:
      value.serverRevision,
    cryptoVersion:
      value.cryptoVersion,
    updatedAt:
      value.updatedAt
  }
}

function parseInitializeResult(
  value: unknown
): MAProfessorSyncInitializeResult {
  if (
    !isObject(value) ||
    value.success !== true ||
    typeof value.created !==
      'boolean' ||
    value.profileExists !== true ||
    !isNonNegativeInteger(
      value.serverRevision
    ) ||
    !isPositiveInteger(
      value.cryptoVersion
    ) ||
    typeof value.updatedAt !==
      'string' ||
    !value.updatedAt
  ) {
    throw new Error(
      'O serviço de sincronização devolveu uma resposta inválida ao criar a proteção da conta.'
    )
  }

  const updatedAtDate =
    new Date(
      value.updatedAt
    )

  if (
    Number.isNaN(
      updatedAtDate.getTime()
    )
  ) {
    throw new Error(
      'O serviço de sincronização devolveu uma data inválida.'
    )
  }

  return {
    success: true,
    created:
      value.created,
    profileExists: true,
    serverRevision:
      value.serverRevision,
    cryptoVersion:
      value.cryptoVersion,
    updatedAt:
      value.updatedAt
  }
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
  fallbackMessage: string
) {
  let response: Response

  try {
    response = await fetch(
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

        body: JSON.stringify(
          body
        )
      }
    )
  } catch {
    throw new Error(
      'Não foi possível ligar ao serviço de sincronização. Os seus dados continuam guardados neste dispositivo.'
    )
  }

  let data: unknown

  try {
    data =
      await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message =
      isObject(data) &&
      typeof data.message ===
        'string' &&
      data.message.trim()
        ? data.message.trim()
        : fallbackMessage

    throw new Error(
      message
    )
  }

  return data
}

export async function getMAProfessorSyncStatus(
  token: string,
  deviceId: string
) {
  const data =
    await postJson(
      '/status',

      {
        token,
        deviceId
      },

      'Não foi possível verificar o serviço de sincronização.'
    )

  return parseSyncStatus(
    data
  )
}

export async function initializeMAProfessorSync(
  token: string,
  deviceId: string,
  profile:
    MAProfessorCryptoProfilePayload,
  device:
    MAProfessorDeviceCryptoPayload
) {
  const data =
    await postJson(
      '/initialize',

      {
        token,
        deviceId,
        profile,
        device
      },

      'Não foi possível criar a proteção cifrada da conta.'
    )

  return parseInitializeResult(
    data
  )
}
