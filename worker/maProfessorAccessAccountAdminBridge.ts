import {
  handleMaCodeAdminApiRequest,
  type MaCodeAdminEnv
} from './maCodeAdmin'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

export const MA_PROFESSOR_ACCOUNT_ADMIN_API_PREFIX =
  '/api/admin/ma-professor/accounts'

const RESET_ACCESS_PATH =
  `${MA_PROFESSOR_ACCOUNT_ADMIN_API_PREFIX}/reset-access`

const DELETE_ACCOUNTS_PATH =
  `${MA_PROFESSOR_ACCOUNT_ADMIN_API_PREFIX}/delete`

const INTERNAL_RESET_ACCESS_PATH =
  '/__internal/ma-professor/admin/accounts/reset-access'

const INTERNAL_DELETE_ACCOUNTS_PATH =
  '/__internal/ma-professor/admin/accounts/delete'

const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'

const DELETE_CONFIRMATION =
  'APAGAR'

const MAX_BATCH_EMAILS = 100
const MAX_BODY_BYTES = 20_000

type JsonObject =
  Record<string, unknown>

interface D1ResultLike {
  success: boolean
}

interface D1PreparedStatementLike {
  bind(
    ...values: unknown[]
  ): D1PreparedStatementLike
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

export interface MaProfessorAccountAdminEnv
  extends MaCodeAdminEnv,
    MaProfessorAccessEnv {
  MA_PROFESSOR_DB:
    D1DatabaseLike
}

const securityHeaders:
  Record<string, string> = {
    'Cache-Control':
      'no-store',
    Pragma:
      'no-cache',
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
    JSON.stringify(body),
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

function isLocalOrigin(
  origin: string
) {
  try {
    return [
      'localhost',
      '127.0.0.1',
      '0.0.0.0'
    ].includes(
      new URL(
        origin
      ).hostname
    )
  } catch {
    return false
  }
}

function isAllowedBrowserRequest(
  request: Request
) {
  const requestOrigin =
    new URL(
      request.url
    ).origin

  const candidate =
    normalizeOrigin(
      request.headers.get(
        'Origin'
      ) || ''
    ) ||
    normalizeOrigin(
      request.headers.get(
        'Referer'
      ) || ''
    )

  if (!candidate) {
    return false
  }

  return (
    candidate ===
      requestOrigin ||
    candidate ===
      'https://ma-code.pt' ||
    candidate ===
      'https://www.ma-code.pt' ||
    isLocalOrigin(
      candidate
    )
  )
}

function normalizeEmail(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .toLowerCase()
        .slice(0, 180)
    : ''
}

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  )
}

async function readJsonBody(
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
    throw new Error(
      'Formato de pedido inválido.'
    )
  }

  const text =
    await request.text()

  if (
    new TextEncoder()
      .encode(text)
      .byteLength >
      MAX_BODY_BYTES
  ) {
    throw new Error(
      'O pedido é demasiado grande.'
    )
  }

  let parsed: unknown

  try {
    parsed =
      JSON.parse(
        text
      ) as unknown
  } catch {
    throw new Error(
      'O pedido enviado não contém JSON válido.'
    )
  }

  if (
    !parsed ||
    typeof parsed !==
      'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      'O pedido enviado não é válido.'
    )
  }

  return parsed as JsonObject
}

function normalizeEmailList(
  value: unknown
) {
  if (
    !Array.isArray(value)
  ) {
    throw new Error(
      'A lista de utilizadores é inválida.'
    )
  }

  const emails =
    Array.from(
      new Set(
        value
          .map(normalizeEmail)
          .filter(isValidEmail)
      )
    )

  if (
    emails.length === 0
  ) {
    throw new Error(
      'Selecione pelo menos um utilizador.'
    )
  }

  if (
    emails.length >
      MAX_BATCH_EMAILS
  ) {
    throw new Error(
      `Só é possível apagar até ${MAX_BATCH_EMAILS} utilizadores de cada vez.`
    )
  }

  return emails
}

async function validateAdminSession(
  request: Request,
  env:
    MaProfessorAccountAdminEnv
) {
  const sessionUrl =
    new URL(
      request.url
    )

  sessionUrl.pathname =
    '/api/admin/session'
  sessionUrl.search = ''
  sessionUrl.hash = ''

  const response =
    await handleMaCodeAdminApiRequest(
      new Request(
        sessionUrl.toString(),
        {
          method:
            'GET',
          headers:
            request.headers
        }
      ),
      env
    )

  return response?.ok ===
    true
}

function getAccessStub(
  env:
    MaProfessorAccountAdminEnv
) {
  const id =
    env.MA_PROFESSOR_ACCESS.idFromName(
      ACCESS_DURABLE_OBJECT_NAME
    )

  return env.MA_PROFESSOR_ACCESS.get(
    id
  )
}

async function callInternalAccessMutation(
  request: Request,
  env:
    MaProfessorAccountAdminEnv,
  pathname: string,
  body: JsonObject
) {
  return getAccessStub(
    env
  ).fetch(
    new Request(
      new URL(
        pathname,
        request.url
      ).toString(),
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
          JSON.stringify(
            body
          )
      }
    )
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
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(
          [
            'ma-professor-account-v1',
            normalizedEmail
          ].join(':')
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

async function deleteCloudAccountData(
  env:
    MaProfessorAccountAdminEnv,
  emails: string[]
) {
  const accountIds =
    await Promise.all(
      emails.map(
        createAccountId
      )
    )

  const placeholders =
    accountIds
      .map(() => '?')
      .join(', ')

  const results =
    await env.MA_PROFESSOR_DB.batch([
      env.MA_PROFESSOR_DB
        .prepare(
          `DELETE FROM ma_professor_encrypted_records WHERE account_id IN (${placeholders})`
        )
        .bind(
          ...accountIds
        ),
      env.MA_PROFESSOR_DB
        .prepare(
          `DELETE FROM ma_professor_sync_devices WHERE account_id IN (${placeholders})`
        )
        .bind(
          ...accountIds
        ),
      env.MA_PROFESSOR_DB
        .prepare(
          `DELETE FROM ma_professor_sync_profiles WHERE account_id IN (${placeholders})`
        )
        .bind(
          ...accountIds
        )
    ])

  if (
    results.length !== 3 ||
    results.some(
      result =>
        result.success !==
        true
    )
  ) {
    throw new Error(
      'Não foi possível eliminar todos os dados cloud selecionados.'
    )
  }
}

async function handleResetAccess(
  request: Request,
  env:
    MaProfessorAccountAdminEnv,
  body: JsonObject
) {
  const email =
    normalizeEmail(
      body.email
    )

  if (
    !isValidEmail(
      email
    )
  ) {
    return json(
      {
        success:
          false,
        message:
          'Indique um email válido.'
      },
      400
    )
  }

  return callInternalAccessMutation(
    request,
    env,
    INTERNAL_RESET_ACCESS_PATH,
    {
      email
    }
  )
}

async function handleDeleteAccounts(
  request: Request,
  env:
    MaProfessorAccountAdminEnv,
  body: JsonObject
) {
  if (
    body.confirmation !==
      DELETE_CONFIRMATION
  ) {
    return json(
      {
        success:
          false,
        message:
          'Para confirmar a eliminação escreva exatamente APAGAR.'
      },
      400
    )
  }

  let emails:
    string[]

  try {
    emails =
      normalizeEmailList(
        body.emails
      )
  } catch (
    error
  ) {
    return json(
      {
        success:
          false,
        message:
          error instanceof Error
            ? error.message
            : 'A seleção de utilizadores é inválida.'
      },
      400
    )
  }

  try {
    await deleteCloudAccountData(
      env,
      emails
    )
  } catch {
    return json(
      {
        success:
          false,
        message:
          'Não foi possível eliminar os dados cloud selecionados. O estado de acesso não foi apagado.'
      },
      500
    )
  }

  const accessResponse =
    await callInternalAccessMutation(
      request,
      env,
      INTERNAL_DELETE_ACCOUNTS_PATH,
      {
        emails
      }
    )

  if (
    !accessResponse.ok
  ) {
    return json(
      {
        success:
          false,
        message:
          'Os dados cloud foram removidos, mas não foi possível concluir a remoção do estado de acesso. Repita a eliminação para concluir.'
      },
      500
    )
  }

  return json({
    success:
      true,
    emails,
    cloudDataDeleted:
      true,
    message:
      emails.length === 1
        ? 'O utilizador foi apagado do MA-Professor. A identidade de acesso e os dados cloud foram removidos.'
        : `${emails.length} utilizadores foram apagados do MA-Professor. As identidades de acesso e os dados cloud foram removidos.`
  })
}

export function isMAProfessorAccountAdminApiPath(
  pathname: string
) {
  return pathname ===
      RESET_ACCESS_PATH ||
    pathname ===
      DELETE_ACCOUNTS_PATH
}

export async function handleMAProfessorAccountAdminApiRequest(
  request: Request,
  env:
    MaProfessorAccountAdminEnv
) {
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
        Allow:
          'POST'
      }
    )
  }

  if (
    !isAllowedBrowserRequest(
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

  const authenticated =
    await validateAdminSession(
      request,
      env
    )

  if (
    !authenticated
  ) {
    return json(
      {
        success:
          false,
        message:
          'Sessão administrativa inválida ou expirada.'
      },
      401
    )
  }

  let body:
    JsonObject

  try {
    body =
      await readJsonBody(
        request
      )
  } catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : 'Pedido administrativo inválido.'

    return json(
      {
        success:
          false,
        message
      },
      message ===
        'O pedido é demasiado grande.'
        ? 413
        : 400
    )
  }

  const url =
    new URL(
      request.url
    )

  if (
    url.pathname ===
      RESET_ACCESS_PATH
  ) {
    return handleResetAccess(
      request,
      env,
      body
    )
  }

  if (
    url.pathname ===
      DELETE_ACCOUNTS_PATH
  ) {
    return handleDeleteAccounts(
      request,
      env,
      body
    )
  }

  return json(
    {
      success:
        false,
      message:
        'Endpoint administrativo de utilizadores não encontrado.'
    },
    404
  )
}
