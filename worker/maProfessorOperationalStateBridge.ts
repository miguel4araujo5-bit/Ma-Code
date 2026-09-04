import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorAccessAccountAdminBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

const OPERATIONAL_STORAGE_KEY =
  'ma-professor-operational-state-v1'

const PUBLIC_OPERATIONAL_STATE_PATH =
  '/api/ma-professor/access/operational-state'

const INTERNAL_OPERATIONAL_STATUS_PATH =
  '/__internal/ma-professor/admin/accounts/operational-status'

const INTERNAL_RESET_ACCESS_PATH =
  '/__internal/ma-professor/admin/accounts/reset-access'

const INTERNAL_DELETE_ACCOUNTS_PATH =
  '/__internal/ma-professor/admin/accounts/delete'

const MAX_BATCH_EMAILS =
  100

type JsonObject =
  Record<string, unknown>

interface AccessStateSnapshot {
  sessions?: Record<
    string,
    JsonObject
  >
}

interface StoredOperationalAccountState {
  email: string
  operationalReady: boolean
  operationalReadyAt: number | null
  fullSetupCompleted: boolean
  fullSetupCompletedAt: number | null
  updatedAt: number
}

interface OperationalStateSnapshot {
  schemaVersion: 1
  accounts: Record<
    string,
    StoredOperationalAccountState
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
}

interface DurableObjectStateLike {
  storage:
    DurableObjectStorageLike
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

function createOperationalState():
  OperationalStateSnapshot {
  return {
    schemaVersion:
      1,
    accounts:
      {},
    updatedAt:
      Date.now()
  }
}

function normalizeOperationalState(
  value:
    | OperationalStateSnapshot
    | undefined
) {
  if (
    !value ||
    value.schemaVersion !==
      1 ||
    !value.accounts ||
    typeof value.accounts !==
      'object'
  ) {
    return createOperationalState()
  }

  return value
}

async function readJson(
  request: Request
): Promise<JsonObject> {
  const parsed =
    await request.json() as
      unknown

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

function getSessionEmail(
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

function normalizeEmailList(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  return Array.from(
    new Set(
      value
        .map(
          normalizeEmail
        )
        .filter(
          isValidEmail
        )
    )
  ).slice(
    0,
    MAX_BATCH_EMAILS
  )
}

export class MaProfessorAccessDurableObject {
  private readonly state:
    DurableObjectStateLike

  private readonly existing:
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

    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        state as never,
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

  private async authenticateSession(
    token: string,
    deviceId: string
  ) {
    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        ACCESS_STORAGE_KEY
      )

    if (
      !accessState?.sessions
    ) {
      return null
    }

    const tokenHash =
      await hashSessionToken(
        token
      )

    const session =
      accessState.sessions[
        tokenHash
      ]

    if (
      !session ||
      typeof session !==
        'object' ||
      Array.isArray(
        session
      )
    ) {
      return null
    }

    const email =
      getSessionEmail(
        session
      )

    const storedDeviceId =
      normalizeId(
        session.deviceId,
        180
      )

    if (
      !email ||
      storedDeviceId !==
        deviceId ||
      session.revokedAt !==
        null
    ) {
      return null
    }

    return {
      email,
      session
    }
  }

  private async handleOperationalReport(
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
            'O estado operacional enviado não é válido.'
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

    if (
      typeof body.operationalReady !==
        'boolean' ||
      typeof body.fullSetupCompleted !==
        'boolean'
    ) {
      return json(
        {
          success:
            false,
          message:
            'O estado operacional enviado não é válido.'
        },
        400
      )
    }

    const authenticated =
      await this.authenticateSession(
        token,
        deviceId
      )

    if (!authenticated) {
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

    const now =
      Date.now()

    const state =
      normalizeOperationalState(
        await this.state.storage.get<OperationalStateSnapshot>(
          OPERATIONAL_STORAGE_KEY
        )
      )

    const previous =
      state.accounts[
        authenticated.email
      ]

    state.accounts[
      authenticated.email
    ] = {
      email:
        authenticated.email,
      operationalReady:
        body.operationalReady,
      operationalReadyAt:
        previous?.operationalReadyAt ??
        (
          body.operationalReady
            ? now
            : null
        ),
      fullSetupCompleted:
        body.fullSetupCompleted,
      fullSetupCompletedAt:
        previous?.fullSetupCompletedAt ??
        (
          body.fullSetupCompleted
            ? now
            : null
        ),
      updatedAt:
        now
    }

    state.updatedAt =
      now

    await this.state.storage.put(
      OPERATIONAL_STORAGE_KEY,
      state
    )

    return json({
      success:
        true
    })
  }

  private async handleOperationalAdminStatus(
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
            'O pedido administrativo é inválido.'
        },
        400
      )
    }

    const emails =
      normalizeEmailList(
        body.emails
      )

    if (
      emails.length ===
        0
    ) {
      return json(
        {
          success:
            false,
          message:
            'Selecione pelo menos um utilizador.'
        },
        400
      )
    }

    const [
      accessState,
      operationalState
    ] =
      await Promise.all([
        this.state.storage.get<AccessStateSnapshot>(
          ACCESS_STORAGE_KEY
        ),
        this.state.storage.get<OperationalStateSnapshot>(
          OPERATIONAL_STORAGE_KEY
        )
      ])

    const normalizedOperational =
      normalizeOperationalState(
        operationalState
      )

    const sessions =
      Object.values(
        accessState?.sessions ||
        {}
      )

    const statuses =
      emails.map(
        email => {
          const accountSessions =
            sessions
              .filter(
                session =>
                  getSessionEmail(
                    session
                  ) === email &&
                  session.revokedAt ===
                    null
              )
              .sort(
                (
                  left,
                  right
                ) =>
                  (
                    readTimestamp(
                      right.lastSeenAt
                    ) ??
                    readTimestamp(
                      right.createdAt
                    ) ??
                    0
                  ) -
                  (
                    readTimestamp(
                      left.lastSeenAt
                    ) ??
                    readTimestamp(
                      left.createdAt
                    ) ??
                    0
                  )
              )

          const latestSession =
            accountSessions[0] ||
            null

          const operational =
            normalizedOperational
              .accounts[
                email
              ] ||
            null

          return {
            email,
            hasActiveSession:
              accountSessions.length >
              0,
            activeSessionCount:
              accountSessions.length,
            sessionCreatedAt:
              toIsoTimestamp(
                latestSession?.createdAt
              ),
            lastSeenAt:
              toIsoTimestamp(
                latestSession?.lastSeenAt ??
                  latestSession?.createdAt
              ),
            operationalStateReported:
              Boolean(
                operational
              ),
            operationalReady:
              operational?.operationalReady ??
              null,
            operationalReadyAt:
              toIsoTimestamp(
                operational?.operationalReadyAt
              ),
            fullSetupCompleted:
              operational?.fullSetupCompleted ??
              null,
            fullSetupCompletedAt:
              toIsoTimestamp(
                operational?.fullSetupCompletedAt
              ),
            operationalStateUpdatedAt:
              toIsoTimestamp(
                operational?.updatedAt
              )
          }
        }
      )

    return json({
      success:
        true,
      statuses,
      generatedAt:
        new Date()
          .toISOString()
    })
  }

  private async clearOperationalStateAfterAccountMutation(
    request: Request,
    response: Response
  ) {
    if (!response.ok) {
      return
    }

    try {
      const body =
        await readJson(
          request.clone()
        )

      const url =
        new URL(
          request.url
        )

      const emails =
        url.pathname ===
          INTERNAL_DELETE_ACCOUNTS_PATH
          ? normalizeEmailList(
              body.emails
            )
          : [
              normalizeEmail(
                body.email
              )
            ].filter(
              isValidEmail
            )

      if (
        emails.length ===
          0
      ) {
        return
      }

      const state =
        normalizeOperationalState(
          await this.state.storage.get<OperationalStateSnapshot>(
            OPERATIONAL_STORAGE_KEY
          )
        )

      let changed =
        false

      for (const email of emails) {
        if (
          state.accounts[
            email
          ]
        ) {
          delete state.accounts[
            email
          ]
          changed =
            true
        }
      }

      if (changed) {
        state.updatedAt =
          Date.now()

        await this.state.storage.put(
          OPERATIONAL_STORAGE_KEY,
          state
        )
      }
    } catch (
      error
    ) {
      console.error(
        'MA-Professor operational-state cleanup failed',
        error
      )
    }
  }

  private async handleRequest(
    request: Request
  ) {
    const url =
      new URL(
        request.url
      )

    if (
      url.pathname ===
        PUBLIC_OPERATIONAL_STATE_PATH
    ) {
      return this.handleOperationalReport(
        request
      )
    }

    if (
      url.pathname ===
        INTERNAL_OPERATIONAL_STATUS_PATH
    ) {
      return this.handleOperationalAdminStatus(
        request
      )
    }

    if (
      url.pathname ===
        INTERNAL_RESET_ACCESS_PATH ||
      url.pathname ===
        INTERNAL_DELETE_ACCOUNTS_PATH
    ) {
      const copy =
        request.clone()

      const response =
        await this.existing.fetch(
          request
        )

      await this.clearOperationalStateAfterAccountMutation(
        copy,
        response
      )

      return response
    }

    return this.existing.fetch(
      request
    )
  }
}
