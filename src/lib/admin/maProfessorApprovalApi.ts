import type {
  MAProfessorAccessDecisionResult
} from './maProfessorAdminApi'

export type MAProfessorApprovalPlan =
  | 'free'
  | 'paid_30_days'
  | 'school_year'

interface ErrorBody {
  message?: string
}

async function readBody(
  response: Response
) {
  try {
    return await response.json() as unknown
  } catch {
    return null
  }
}

function getMessage(
  body: unknown,
  fallback: string
) {
  if (
    body &&
    typeof body === 'object' &&
    typeof (
      body as ErrorBody
    ).message === 'string'
  ) {
    return (
      body as ErrorBody
    ).message as string
  }

  return fallback
}

export async function approveMAProfessorAccessPlan(
  email: string,
  approvalPlan: MAProfessorApprovalPlan
) {
  let response: Response

  try {
    response = await fetch(
      '/api/admin/ma-professor/requests/approve-plan',
      {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          email,
          approvalPlan
        })
      }
    )
  } catch {
    throw new Error(
      'Não foi possível ligar ao backend administrativo do MA-Professor.'
    )
  }

  const body =
    await readBody(response)

  if (response.status === 401) {
    throw new Error(
      'A sessão administrativa expirou. Atualize a página e volte a entrar.'
    )
  }

  if (!response.ok) {
    throw new Error(
      getMessage(
        body,
        'Não foi possível aprovar o acesso selecionado.'
      )
    )
  }

  if (
    !body ||
    typeof body !== 'object' ||
    (
      body as Record<string, unknown>
    ).success !== true ||
    typeof (
      body as Record<string, unknown>
    ).message !== 'string'
  ) {
    throw new Error(
      'O backend administrativo devolveu uma resposta de aprovação inválida.'
    )
  }

  return body as
    MAProfessorAccessDecisionResult & {
      approvalPlan?:
        MAProfessorApprovalPlan
    }
}
