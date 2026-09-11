import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorExplicitApprovalBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

const INTERNAL_CREDENTIAL_GENERATE_PATH =
  '/__internal/ma-professor/admin/credentials/generate'

type JsonObject =
  Record<string, unknown>

interface StoredAccessCredentialSnapshot {
  email: string
  passwordSalt: string
  passwordHash: string
  passwordIterations: number
  createdAt: number
  updatedAt: number
}

interface AccessStateSnapshot {
  credentials?: Record<
    string,
    StoredAccessCredentialSnapshot
  >
}

interface DurableObjectStorageLike {
  get<T>(
    key: string
  ): Promise<T | undefined>
}

interface DurableObjectStateLike {
  storage:
    DurableObjectStorageLike
}

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
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
        .slice(0, 180)
    : ''
}

async function readEmail(
  request: Request
) {
  try {
    const parsed =
      await request
        .clone()
        .json() as unknown

    if (
      !parsed ||
      typeof parsed !==
        'object' ||
      Array.isArray(parsed)
    ) {
      return ''
    }

    return normalizeEmail(
      (
        parsed as JsonObject
      ).email
    )
  } catch {
    return ''
  }
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
    state: DurableObjectStateLike,
    env: MaProfessorAccessEnv
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

  private async handleRequest(
    request: Request
  ) {
    const pathname =
      new URL(
        request.url
      ).pathname

    if (
      pathname !==
        INTERNAL_CREDENTIAL_GENERATE_PATH ||
      request.method !==
        'POST'
    ) {
      return this.existing.fetch(
        request
      )
    }

    const email =
      await readEmail(
        request
      )

    if (!email) {
      return this.existing.fetch(
        request
      )
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        ACCESS_STORAGE_KEY
      )

    if (
      accessState
        ?.credentials?.[
          email
        ]
    ) {
      return json(
        {
          success: false,
          message:
            'Já existe uma senha de ativação emitida para esta conta. Por segurança, a senha existente foi preservada e não foi substituída. Utilize o email de ativação já enviado.'
        },
        409
      )
    }

    return this.existing.fetch(
      request
    )
  }
}
