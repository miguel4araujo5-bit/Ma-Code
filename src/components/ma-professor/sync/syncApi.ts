const API_PREFIX =
  '/api/ma-professor/sync'

interface ApiErrorBody {
  success?: boolean
  message?: string
}

export interface MAProfessorSyncStatus {
  success: true
  databaseReady: true
  profileExists: boolean
  serverRevision: number
  cryptoVersion: number | null
  updatedAt: string | null
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
    typeof value.serverRevision !==
      'number' ||
    !Number.isFinite(
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

async function postJson(
  path: string,
  body: Record<string, unknown>
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
        body: JSON.stringify(body)
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
        'string'
        ? data.message
        : ''

    throw new Error(
      message ||
        'Não foi possível verificar o serviço de sincronização.'
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
      }
    )

  return parseSyncStatus(
    data
  )
}
