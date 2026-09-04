const MA_PROFESSOR_ACCOUNT_ADMIN_API_PREFIX =
  '/api/admin/ma-professor/accounts'

interface AdminApiErrorBody {
  success?: boolean
  message?: string
}

export interface MAProfessorAccountAdminResult {
  success: true
  message: string
  emails: string[]
  cloudDataDeleted?: boolean
}

export interface MAProfessorAccountOperationalStatus {
  email: string
  hasActiveSession: boolean
  activeSessionCount: number
  sessionCreatedAt: string | null
  lastSeenAt: string | null
  operationalStateReported: boolean
  operationalReady: boolean | null
  operationalReadyAt: string | null
  fullSetupCompleted: boolean | null
  fullSetupCompletedAt: string | null
  operationalStateUpdatedAt: string | null
}

interface MAProfessorOperationalStatusResult {
  success: true
  statuses:
    MAProfessorAccountOperationalStatus[]
  generatedAt: string
}

async function readResponseBody(
  response: Response
) {
  try {
    return await response.json() as unknown
  } catch {
    return null
  }
}

function getApiMessage(
  body: unknown,
  fallback: string
) {
  if (
    body &&
    typeof body ===
      'object'
  ) {
    const data =
      body as AdminApiErrorBody

    if (
      typeof data.message ===
        'string'
    ) {
      return data.message
    }
  }

  return fallback
}

async function postAccountJson(
  path: string,
  payload:
    Record<string, unknown>,
  fallbackMessage: string
) {
  let response:
    Response

  try {
    response =
      await fetch(
        `${MA_PROFESSOR_ACCOUNT_ADMIN_API_PREFIX}${path}`,
        {
          method:
            'POST',
          credentials:
            'include',
          cache:
            'no-store',
          headers: {
            Accept:
              'application/json',
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify(
              payload
            )
        }
      )
  } catch {
    throw new Error(
      'Não foi possível ligar ao backend administrativo do MA-Professor.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (
    response.status ===
      401
  ) {
    throw new Error(
      'A sessão administrativa expirou. Atualize a página e volte a entrar.'
    )
  }

  if (
    !response.ok
  ) {
    throw new Error(
      getApiMessage(
        body,
        fallbackMessage
      )
    )
  }

  return body
}

async function postAccountAction(
  path: string,
  payload:
    Record<string, unknown>,
  fallbackMessage: string
) {
  const body =
    await postAccountJson(
      path,
      payload,
      fallbackMessage
    )

  const data =
    body as
      MAProfessorAccountAdminResult |
      null

  if (
    !data ||
    data.success !==
      true ||
    typeof data.message !==
      'string' ||
    !Array.isArray(
      data.emails
    ) ||
    data.emails.some(
      email =>
        typeof email !==
          'string'
    )
  ) {
    throw new Error(
      'O backend administrativo devolveu uma resposta de utilizadores inválida.'
    )
  }

  return data
}

function isNullableString(
  value: unknown
) {
  return value === null ||
    typeof value ===
      'string'
}

function assertOperationalStatus(
  value: unknown
): asserts value is MAProfessorAccountOperationalStatus {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    throw new Error(
      'O backend administrativo devolveu um estado operacional inválido.'
    )
  }

  const data =
    value as
      Record<string, unknown>

  if (
    typeof data.email !==
      'string' ||
    typeof data.hasActiveSession !==
      'boolean' ||
    typeof data.activeSessionCount !==
      'number' ||
    !isNullableString(
      data.sessionCreatedAt
    ) ||
    !isNullableString(
      data.lastSeenAt
    ) ||
    typeof data.operationalStateReported !==
      'boolean' ||
    !(
      data.operationalReady ===
        null ||
      typeof data.operationalReady ===
        'boolean'
    ) ||
    !isNullableString(
      data.operationalReadyAt
    ) ||
    !(
      data.fullSetupCompleted ===
        null ||
      typeof data.fullSetupCompleted ===
        'boolean'
    ) ||
    !isNullableString(
      data.fullSetupCompletedAt
    ) ||
    !isNullableString(
      data.operationalStateUpdatedAt
    )
  ) {
    throw new Error(
      'O backend administrativo devolveu um estado operacional inválido.'
    )
  }
}

export async function getMAProfessorAccountsOperationalStatus(
  emails: string[]
) {
  if (
    emails.length ===
      0
  ) {
    return []
  }

  const body =
    await postAccountJson(
      '/operational-status',
      {
        emails
      },
      'Não foi possível consultar o estado operacional das contas.'
    )

  const data =
    body as
      MAProfessorOperationalStatusResult |
      null

  if (
    !data ||
    data.success !==
      true ||
    !Array.isArray(
      data.statuses
    ) ||
    typeof data.generatedAt !==
      'string'
  ) {
    throw new Error(
      'O backend administrativo devolveu estados operacionais inválidos.'
    )
  }

  for (
    const status of
    data.statuses
  ) {
    assertOperationalStatus(
      status
    )
  }

  return data.statuses
}

export async function resetMAProfessorAccountAccess(
  email: string
) {
  return postAccountAction(
    '/reset-access',
    {
      email
    },
    'Não foi possível repor o acesso deste utilizador.'
  )
}

export async function deleteMAProfessorAccounts(
  emails: string[],
  confirmation: string
) {
  return postAccountAction(
    '/delete',
    {
      emails,
      confirmation
    },
    'Não foi possível apagar os utilizadores selecionados.'
  )
}
