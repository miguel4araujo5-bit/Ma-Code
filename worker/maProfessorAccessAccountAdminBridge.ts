import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorAccountSessionBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

const STORAGE_KEY =
  'ma-professor-access-state-v1'

const COMMERCE_STORAGE_KEY =
  'ma-professor-admin-commerce-v1'

const ACCOUNT_AUTH_STORAGE_KEY =
  'ma-professor-account-auth-v1'

const LOGIN_THROTTLE_STORAGE_KEY =
  'ma-professor-login-throttle-v1'

const PUBLIC_STATUS_PATH =
  '/api/ma-professor/access/status'

const PUBLIC_LOGIN_PATH =
  '/api/ma-professor/access/login'

const INTERNAL_RESET_ACCESS_PATH =
  '/__internal/ma-professor/admin/accounts/reset-access'

const INTERNAL_DELETE_ACCOUNTS_PATH =
  '/__internal/ma-professor/admin/accounts/delete'

const MAX_BATCH_EMAILS =
  100

const MAX_FAILED_LOGIN_ATTEMPTS =
  5

const LOGIN_BLOCK_MINUTES =
  15

const LOGIN_THROTTLE_RETENTION_MS =
  24 * 60 * 60 * 1000

const MAX_LOGIN_THROTTLE_ENTRIES =
  2_000

type JsonObject =
  Record<string, unknown>

interface AccessStateSnapshot {
  licenses?: Record<
    string,
    JsonObject
  >

  sessions?: Record<
    string,
    JsonObject
  >

  renewals?: JsonObject[]

  accessRequests?: Record<
    string,
    JsonObject
  >

  credentials?: Record<
    string,
    JsonObject
  >

  updatedAt?: number
}

interface CommerceStateSnapshot {
  authorizations?:
    JsonObject[]

  updatedAt?: number
}

interface AccountAuthStateSnapshot {
  credentials?: Record<
    string,
    JsonObject
  >

  updatedAt?: number
}

interface LoginThrottleEntry {
  failedAttempts: number
  blockedUntil: number | null
  updatedAt: number
}

interface LoginThrottleState {
  schemaVersion: 1
  entries: Record<
    string,
    LoginThrottleEntry
  >
  updatedAt: number
}

interface DurableObjectStorageLike {
  get<T>(
    key: string
  ): Promise<T | undefined>

  put<T>(
    key: string,
    value: T
  ): Promise<void>

  put(
    entries:
      Record<string, unknown>
  ): Promise<void>
}

interface DurableObjectStateLike {
  storage:
    DurableObjectStorageLike

  blockConcurrencyWhile<T>(
    callback:
      () => Promise<T>
  ): Promise<T>
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

        'Cache-Control':
          'no-store',

        Pragma:
          'no-cache',

        'X-Content-Type-Options':
          'nosniff',

        'X-Frame-Options':
          'DENY',

        'Referrer-Policy':
          'no-referrer',

        'X-Robots-Tag':
          'noindex, nofollow',

        ...extraHeaders
      }
    }
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
        .slice(
          0,
          180
        )
    : ''
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

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  )
}

async function readJson(
  request: Request
): Promise<JsonObject> {
  let parsed:
    unknown

  try {
    parsed =
      await request.json()
  } catch {
    throw new Error(
      'O pedido contém JSON inválido.'
    )
  }

  if (
    !parsed ||
    typeof parsed !==
      'object' ||
    Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      'O pedido é inválido.'
    )
  }

  return parsed as
    JsonObject
}

function normalizeEmailList(
  value: unknown
) {
  const candidates =
    Array.isArray(
      value
    )
      ? value
      : [value]

  const emails =
    Array.from(
      new Set(
        candidates
          .map(
            normalizeEmail
          )
          .filter(
            isValidEmail
          )
      )
    )

  if (
    emails.length ===
    0
  ) {
    throw new Error(
      'Indique pelo menos um email válido.'
    )
  }

  if (
    emails.length >
    MAX_BATCH_EMAILS
  ) {
    throw new Error(
      `Só é possível processar até ${MAX_BATCH_EMAILS} utilizadores de cada vez.`
    )
  }

  return emails
}

function getObjectEmail(
  value: unknown
) {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value
    )
  ) {
    return ''
  }

  return normalizeEmail(
    (
      value as
        JsonObject
    ).email
  )
}

function removeRecordEntries(
  record:
    | Record<
        string,
        JsonObject
      >
    | undefined,
  targetEmails:
    Set<string>
) {
  if (!record) {
    return
  }

  for (
    const [
      key,
      value
    ] of Object.entries(
      record
    )
  ) {
    if (
      targetEmails.has(
        normalizeEmail(
          key
        )
      ) ||
      targetEmails.has(
        getObjectEmail(
          value
        )
      )
    ) {
      delete record[
        key
      ]
    }
  }
}

function removeAccessIdentity(
  state:
    | AccessStateSnapshot
    | undefined,
  targetEmails:
    Set<string>
) {
  if (!state) {
    return
  }

  removeRecordEntries(
    state.licenses,
    targetEmails
  )

  removeRecordEntries(
    state.sessions,
    targetEmails
  )

  removeRecordEntries(
    state.accessRequests,
    targetEmails
  )

  removeRecordEntries(
    state.credentials,
    targetEmails
  )

  if (
    Array.isArray(
      state.renewals
    )
  ) {
    state.renewals =
      state.renewals.filter(
        renewal =>
          !targetEmails.has(
            getObjectEmail(
              renewal
            )
          )
      )
  }

  state.updatedAt =
    Date.now()
}

function removeCommerceIdentity(
  state:
    | CommerceStateSnapshot
    | undefined,
  targetEmails:
    Set<string>
) {
  if (!state) {
    return
  }

  if (
    Array.isArray(
      state.authorizations
    )
  ) {
    state.authorizations =
      state.authorizations.filter(
        authorization =>
          !targetEmails.has(
            getObjectEmail(
              authorization
            )
          )
      )
  }

  state.updatedAt =
    Date.now()
}

function removeAccountAuthentication(
  state:
    | AccountAuthStateSnapshot
    | undefined,
  targetEmails:
    Set<string>
) {
  if (!state) {
    return
  }

  removeRecordEntries(
    state.credentials,
    targetEmails
  )

  state.updatedAt =
    Date.now()
}

function createLoginThrottleState():
  LoginThrottleState {
  return {
    schemaVersion:
      1,
    entries:
      {},
    updatedAt:
      Date.now()
  }
}

function normalizeLoginThrottleState(
  stored:
    | LoginThrottleState
    | undefined
) {
  if (
    !stored ||
    stored.schemaVersion !==
      1 ||
    !stored.entries ||
    typeof stored.entries !==
      'object'
  ) {
    return createLoginThrottleState()
  }

  return stored
}

function pruneLoginThrottleState(
  state:
    LoginThrottleState,
  now: number
) {
  for (
    const [
      key,
      entry
    ] of Object.entries(
      state.entries
    )
  ) {
    const blockExpired =
      entry.blockedUntil ===
        null ||
      entry.blockedUntil <=
        now

    if (
      blockExpired &&
      now -
        entry.updatedAt >
        LOGIN_THROTTLE_RETENTION_MS
    ) {
      delete state.entries[
        key
      ]
    }
  }

  const entries =
    Object.entries(
      state.entries
    )

  if (
    entries.length <=
    MAX_LOGIN_THROTTLE_ENTRIES
  ) {
    return
  }

  entries
    .sort(
      (
        left,
        right
      ) =>
        left[1].updatedAt -
        right[1].updatedAt
    )
    .slice(
      0,
      entries.length -
        MAX_LOGIN_THROTTLE_ENTRIES
    )
    .forEach(
      ([key]) => {
        delete state.entries[
          key
        ]
      }
    )
}

function bytesToBase64Url(
  bytes: Uint8Array
) {
  let binary = ''

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(
        byte
      )
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function hashValue(
  value: string
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(
          value
        )
    )

  return bytesToBase64Url(
    new Uint8Array(
      digest
    )
  )
}

async function hashSessionToken(
  token: string
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(
          token
        )
    )

  const bytes =
    new Uint8Array(
      digest
    )

  let binary = ''

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(
        byte
      )
  }

  return btoa(binary)
}

function getClientAddress(
  request: Request
) {
  const cloudflareAddress =
    normalizeId(
      request.headers.get(
        'CF-Connecting-IP'
      ),
      128
    )

  if (cloudflareAddress) {
    return cloudflareAddress
  }

  const forwarded =
    normalizeId(
      request.headers.get(
        'X-Forwarded-For'
      ),
      256
    )

  return forwarded
    .split(',')[0]
    ?.trim()
    .slice(0, 128) ||
    'unknown'
}

async function getLoginThrottleKey(
  request: Request,
  email: string
) {
  const addressHash =
    await hashValue(
      `ma-professor-login-ip-v1:${getClientAddress(
        request
      )}`
    )

  return `${email}|${addressHash}`
}

function removeLoginThrottleForEmails(
  state:
    LoginThrottleState,
  targetEmails:
    Set<string>
) {
  for (
    const key of Object.keys(
      state.entries
    )
  ) {
    const separatorIndex =
      key.indexOf('|')

    const email =
      separatorIndex >=
        0
        ? key.slice(
            0,
            separatorIndex
          )
        : ''

    if (
      targetEmails.has(
        email
      )
    ) {
      delete state.entries[
        key
      ]
    }
  }

  state.updatedAt =
    Date.now()
}

function readTimestamp(
  value: unknown
) {
  return typeof value ===
      'number' &&
    Number.isFinite(
      value
    )
    ? value
    : null
}

function toIsoTimestamp(
  value: unknown
) {
  const timestamp =
    readTimestamp(
      value
    )

  return timestamp ===
    null
    ? null
    : new Date(
        timestamp
      ).toISOString()
}

function normalizeRequestStatus(
  value: unknown
) {
  return value ===
      'pending' ||
    value ===
      'approved' ||
    value ===
      'rejected'
    ? value
    : null
}

function getStatusMessage(
  status:
    | 'pending'
    | 'approved'
    | 'rejected',
  canActivate: boolean,
  activatedAt:
    number | null
) {
  if (
    status ===
      'pending'
  ) {
    return 'O seu pedido continua em análise pela MA-CODE.'
  }

  if (
    status ===
      'rejected'
  ) {
    return 'Este pedido não foi aprovado. Contacte a MA-CODE se pretender esclarecer ou voltar a solicitar acesso.'
  }

  if (canActivate) {
    return 'O seu pedido foi aprovado. Utilize a senha de ativação recebida para iniciar o período de acesso.'
  }

  if (
    activatedAt !==
    null
  ) {
    return 'O pedido está aprovado e o período anterior já foi ativado. Se precisar de um novo período de acesso, escolha uma das opções disponíveis.'
  }

  return 'O pedido foi aprovado, mas a senha de ativação ainda não está disponível.'
}

export class MaProfessorAccessDurableObject {
  private readonly state:
    DurableObjectStateLike

  private readonly env:
    MaProfessorAccessEnv

  private existing:
    ExistingMaProfessorAccessDurableObject

  private operation:
    Promise<void> =
      Promise.resolve()

  constructor(
    state:
      DurableObjectStateLike,
    env:
      MaProfessorAccessEnv
  ) {
    this.state =
      state

    this.env =
      env

    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        state,
        env
      )
  }

  fetch(
    request: Request
  ): Promise<Response> {
    const response =
      this.operation.then(
        () =>
          this.handleRequest(
            request
          )
      )

    this.operation =
      response.then(
        () => undefined,
        () => undefined
      )

    return response
  }

  private refreshExisting() {
    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        this.state,
        this.env
      )
  }

  private async handleAccessStatus(
    request: Request
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

    let body:
      JsonObject

    try {
      body =
        await readJson(
          request
        )
    } catch {
      return json(
        {
          success:
            false,
          message:
            'O pedido de consulta de acesso é inválido.'
        },
        400
      )
    }

    const token =
      normalizeId(
        body.token,
        256
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
      return json(
        {
          success:
            false,
          message:
            'A sessão da conta não é válida.'
        },
        401
      )
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        STORAGE_KEY
      )

    if (
      !accessState?.sessions
    ) {
      return json(
        {
          success:
            false,
          message:
            'A sessão da conta já não é válida.'
        },
        401
      )
    }

    const tokenHash =
      await hashSessionToken(
        token
      )

    const session =
      accessState.sessions[
        tokenHash
      ]

    const sessionEmail =
      getObjectEmail(
        session
      )

    const storedDeviceId =
      session &&
      typeof session.deviceId ===
        'string'
        ? normalizeId(
            session.deviceId,
            180
          )
        : ''

    if (
      !session ||
      !sessionEmail ||
      storedDeviceId !==
        deviceId ||
      session.revokedAt !==
        null
    ) {
      return json(
        {
          success:
            false,
          message:
            'A sessão da conta já não é válida.'
        },
        401
      )
    }

    const accessRequest =
      accessState.accessRequests?.[
        sessionEmail
      ]

    if (!accessRequest) {
      return json(
        {
          success:
            false,
          message:
            'Não existe um pedido de acesso associado a esta conta.'
        },
        404
      )
    }

    const status =
      normalizeRequestStatus(
        accessRequest.status
      )

    if (!status) {
      return json(
        {
          success:
            false,
          message:
            'O estado do pedido de acesso não é válido.'
        },
        500
      )
    }

    const activatedAt =
      readTimestamp(
        accessRequest.activatedAt
      )

    const canActivate =
      Boolean(
        accessState.credentials?.[
          sessionEmail
        ]
      )

    return json({
      success:
        true,
      request: {
        email:
          sessionEmail,
        status,
        requestedAt:
          toIsoTimestamp(
            accessRequest.requestedAt
          ),
        approvedAt:
          toIsoTimestamp(
            accessRequest.approvedAt
          ),
        rejectedAt:
          toIsoTimestamp(
            accessRequest.rejectedAt
          ),
        activatedAt:
          toIsoTimestamp(
            accessRequest.activatedAt
          )
      },
      canActivate,
      message:
        getStatusMessage(
          status,
          canActivate,
          activatedAt
        )
    })
  }

  private async handleLogin(
    request: Request
  ) {
    if (
      request.method !==
      'POST'
    ) {
      return this.existing.fetch(
        request
      )
    }

    let body:
      JsonObject

    try {
      body =
        await readJson(
          request.clone()
        )
    } catch {
      return this.existing.fetch(
        request
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    if (
      !isValidEmail(
        email
      )
    ) {
      return this.existing.fetch(
        request
      )
    }

    const throttleKey =
      await getLoginThrottleKey(
        request,
        email
      )

    const now =
      Date.now()

    const throttleState =
      normalizeLoginThrottleState(
        await this.state.storage.get<LoginThrottleState>(
          LOGIN_THROTTLE_STORAGE_KEY
        )
      )

    pruneLoginThrottleState(
      throttleState,
      now
    )

    const previousEntry =
      throttleState.entries[
        throttleKey
      ]

    if (
      previousEntry?.blockedUntil !==
        null &&
      typeof previousEntry?.blockedUntil ===
        'number' &&
      previousEntry.blockedUntil >
        now
    ) {
      const retryAfterSeconds =
        Math.max(
          1,
          Math.ceil(
            (
              previousEntry.blockedUntil -
              now
            ) /
              1000
          )
        )

      return json(
        {
          success:
            false,
          message:
            'Foram feitas várias tentativas de entrada inválidas. Aguarde alguns minutos antes de tentar novamente.'
        },
        429,
        {
          'Retry-After':
            String(
              retryAfterSeconds
            )
        }
      )
    }

    if (
      previousEntry?.blockedUntil !==
        null &&
      typeof previousEntry?.blockedUntil ===
        'number' &&
      previousEntry.blockedUntil <=
        now
    ) {
      delete throttleState.entries[
        throttleKey
      ]
    }

    const response =
      await this.existing.fetch(
        request
      )

    if (
      response.status ===
      401
    ) {
      const currentEntry =
        throttleState.entries[
          throttleKey
        ]

      const failedAttempts =
        (
          currentEntry
            ?.failedAttempts ??
          0
        ) +
        1

      const blocked =
        failedAttempts >=
        MAX_FAILED_LOGIN_ATTEMPTS

      throttleState.entries[
        throttleKey
      ] = {
        failedAttempts:
          blocked
            ? 0
            : failedAttempts,
        blockedUntil:
          blocked
            ? now +
              LOGIN_BLOCK_MINUTES *
                60 *
                1000
            : null,
        updatedAt:
          now
      }

      throttleState.updatedAt =
        now

      await this.state.storage.put(
        LOGIN_THROTTLE_STORAGE_KEY,
        throttleState
      )

      if (blocked) {
        return json(
          {
            success:
              false,
            message:
              'Foram feitas várias tentativas de entrada inválidas. Aguarde alguns minutos antes de tentar novamente.'
          },
          429,
          {
            'Retry-After':
              String(
                LOGIN_BLOCK_MINUTES *
                  60
              )
          }
        )
      }

      return response
    }

    if (
      response.ok &&
      throttleState.entries[
        throttleKey
      ]
    ) {
      delete throttleState.entries[
        throttleKey
      ]

      throttleState.updatedAt =
        now

      await this.state.storage.put(
        LOGIN_THROTTLE_STORAGE_KEY,
        throttleState
      )
    }

    return response
  }

  private async handleAccountReset(
    request: Request,
    multiple: boolean
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
        405
      )
    }

    let body:
      JsonObject

    try {
      body =
        await readJson(
          request
        )
    } catch (
      error
    ) {
      return json(
        {
          success:
            false,

          message:
            error instanceof
              Error
              ? error.message
              : 'Pedido administrativo inválido.'
        },
        400
      )
    }

    let emails:
      string[]

    try {
      emails =
        normalizeEmailList(
          multiple
            ? body.emails
            : body.email
        )
    } catch (
      error
    ) {
      return json(
        {
          success:
            false,

          message:
            error instanceof
              Error
              ? error.message
              : 'A lista de utilizadores é inválida.'
        },
        400
      )
    }

    const targetEmails =
      new Set(
        emails
      )

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        STORAGE_KEY
      )

    const commerceState =
      await this.state.storage.get<CommerceStateSnapshot>(
        COMMERCE_STORAGE_KEY
      )

    const accountAuthState =
      await this.state.storage.get<AccountAuthStateSnapshot>(
        ACCOUNT_AUTH_STORAGE_KEY
      )

    const loginThrottleState =
      normalizeLoginThrottleState(
        await this.state.storage.get<LoginThrottleState>(
          LOGIN_THROTTLE_STORAGE_KEY
        )
      )

    removeAccessIdentity(
      accessState,
      targetEmails
    )

    removeCommerceIdentity(
      commerceState,
      targetEmails
    )

    removeAccountAuthentication(
      accountAuthState,
      targetEmails
    )

    removeLoginThrottleForEmails(
      loginThrottleState,
      targetEmails
    )

    const updates:
      Record<
        string,
        unknown
      > = {
        [LOGIN_THROTTLE_STORAGE_KEY]:
          loginThrottleState
      }

    if (
      accessState
    ) {
      updates[
        STORAGE_KEY
      ] =
        accessState
    }

    if (
      commerceState
    ) {
      updates[
        COMMERCE_STORAGE_KEY
      ] =
        commerceState
    }

    if (
      accountAuthState
    ) {
      updates[
        ACCOUNT_AUTH_STORAGE_KEY
      ] =
        accountAuthState
    }

    await this.state.storage.put(
      updates
    )

    /*
     * As bridges existentes mantêm partes do estado em memória.
     * Recriá-las impede que um pedido seguinte volte a persistir
     * uma versão anterior do estado removido.
     */
    this.refreshExisting()

    return json({
      success:
        true,

      emails,

      message:
        multiple
          ? `${emails.length} utilizador(es) removido(s) do estado de acesso do MA-Professor.`
          : 'O acesso desta conta foi reposto. Pedido, licença, sessões, senhas e password pessoal foram removidos.'
    })
  }

  private handleRequest(
    request: Request
  ): Promise<Response> {
    const url =
      new URL(
        request.url
      )

    if (
      url.pathname ===
      PUBLIC_STATUS_PATH
    ) {
      return this.handleAccessStatus(
        request
      )
    }

    if (
      url.pathname ===
      PUBLIC_LOGIN_PATH
    ) {
      return this.handleLogin(
        request
      )
    }

    if (
      url.pathname ===
      INTERNAL_RESET_ACCESS_PATH
    ) {
      return this.handleAccountReset(
        request,
        false
      )
    }

    if (
      url.pathname ===
      INTERNAL_DELETE_ACCOUNTS_PATH
    ) {
      return this.handleAccountReset(
        request,
        true
      )
    }

    return this.existing.fetch(
      request
    )
  }
}
