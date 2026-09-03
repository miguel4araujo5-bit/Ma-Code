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

const INTERNAL_RESET_ACCESS_PATH =
  '/__internal/ma-professor/admin/accounts/reset-access'

const INTERNAL_DELETE_ACCOUNTS_PATH =
  '/__internal/ma-professor/admin/accounts/delete'

const MAX_BATCH_EMAILS =
  100

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
  status = 200
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

        'X-Robots-Tag':
          'noindex, nofollow'
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
      'O pedido administrativo contém JSON inválido.'
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
      'O pedido administrativo é inválido.'
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

    const updates:
      Record<
        string,
        unknown
      > = {}

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

    if (
      Object.keys(
        updates
      ).length >
      0
    ) {
      await this.state.storage.put(
        updates
      )
    }

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
