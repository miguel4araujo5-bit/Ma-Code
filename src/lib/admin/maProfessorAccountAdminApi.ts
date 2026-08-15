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

async function postAccountAction(
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
