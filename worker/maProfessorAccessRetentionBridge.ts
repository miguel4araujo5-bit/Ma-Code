import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorLoginAttemptGuardBridge'

import {
  createMAProfessorAccessSessionSplitState
} from './maProfessorAccessSessionSplitBridge'

import {
  createMAProfessorAccessRequestSplitState
} from './maProfessorAccessRequestSplitBridge'

import {
  createMAProfessorAccessRenewalSplitState
} from './maProfessorAccessRenewalSplitBridge'

import {
  createMAProfessorAccessCredentialSplitState
} from './maProfessorAccessCredentialSplitBridge'

import {
  createMAProfessorAccessLicenseSplitState
} from './maProfessorAccessLicenseSplitBridge'

import {
  createMAProfessorSessionLifecycleState
} from './maProfessorSessionLifecycleState'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

const REJECTED_REQUEST_RETENTION_MS =
  180 * 24 * 60 * 60 * 1000

type JsonObject =
  Record<string, unknown>

interface DurableObjectStorageLike {
  get<T>(
    key: string
  ): Promise<T | undefined>

  put(
    keyOrEntries:
      | string
      | Record<string, unknown>,
    value?: unknown
  ): Promise<void>
}

interface DurableObjectStateLike {
  storage:
    DurableObjectStorageLike
}

function isRecord(
  value: unknown
): value is JsonObject {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(value)
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

function readTimestamp(
  value: unknown
) {
  return typeof value ===
      'number' &&
    Number.isFinite(value)
    ? value
    : null
}

function collectProtectedEmails(
  value: unknown,
  target: Set<string>
) {
  if (!isRecord(value)) {
    return
  }

  for (
    const [
      key,
      candidate
    ] of Object.entries(value)
  ) {
    const keyEmail =
      normalizeEmail(key)

    if (keyEmail) {
      target.add(keyEmail)
    }

    if (isRecord(candidate)) {
      const candidateEmail =
        normalizeEmail(
          candidate.email
        )

      if (candidateEmail) {
        target.add(
          candidateEmail
        )
      }
    }
  }
}

function pruneStaleRejectedRequests(
  stored: unknown,
  now: number
) {
  if (!isRecord(stored)) {
    return false
  }

  const accessRequests =
    stored.accessRequests

  if (!isRecord(accessRequests)) {
    return false
  }

  const protectedEmails =
    new Set<string>()

  collectProtectedEmails(
    stored.licenses,
    protectedEmails
  )

  collectProtectedEmails(
    stored.credentials,
    protectedEmails
  )

  const cutoff =
    now -
    REJECTED_REQUEST_RETENTION_MS

  let changed = false

  for (
    const [
      key,
      candidate
    ] of Object.entries(
      accessRequests
    )
  ) {
    if (
      !isRecord(candidate) ||
      candidate.status !==
        'rejected'
    ) {
      continue
    }

    const email =
      normalizeEmail(
        candidate.email ??
        key
      )

    if (
      !email ||
      protectedEmails.has(
        email
      )
    ) {
      continue
    }

    if (
      readTimestamp(
        candidate.approvedAt
      ) !== null ||
      readTimestamp(
        candidate.activatedAt
      ) !== null
    ) {
      continue
    }

    const timestamps = [
      readTimestamp(
        candidate.requestedAt
      ),
      readTimestamp(
        candidate.rejectedAt
      ),
      readTimestamp(
        candidate.updatedAt
      )
    ].filter(
      (
        timestamp
      ): timestamp is number =>
        timestamp !== null
    )

    if (
      timestamps.length ===
        0 ||
      Math.max(
        ...timestamps
      ) >= cutoff
    ) {
      continue
    }

    delete accessRequests[
      key
    ]

    changed = true
  }

  return changed
}

function createRetentionGuardedState(
  state: DurableObjectStateLike
) {
  const storage =
    state.storage

  let accessStateInspected =
    false

  const guardedStorage:
    DurableObjectStorageLike = {
      async get<T>(
        key: string
      ) {
        const value =
          await storage.get<T>(key)

        if (
          key === ACCESS_STORAGE_KEY &&
          !accessStateInspected
        ) {
          accessStateInspected = true

          if (
            pruneStaleRejectedRequests(
              value,
              Date.now()
            )
          ) {
            await storage.put(
              ACCESS_STORAGE_KEY,
              value
            )
          }
        }

        return value
      },

      async put(
        keyOrEntries:
          | string
          | Record<string, unknown>,
        value?: unknown
      ) {
        if (
          typeof keyOrEntries ===
            'string'
        ) {
          await storage.put(
            keyOrEntries,
            value
          )
          return
        }

        await storage.put(
          keyOrEntries
        )
      }
    }

  return new Proxy(
    state as object,
    {
      get(
        target,
        property,
        receiver
      ) {
        if (property === 'storage') {
          return guardedStorage
        }

        const value =
          Reflect.get(
            target,
            property,
            receiver
          )

        return typeof value ===
          'function'
          ? value.bind(target)
          : value
      }
    }
  ) as DurableObjectStateLike
}

export class MaProfessorAccessDurableObject {
  private readonly existing:
    ExistingMaProfessorAccessDurableObject

  constructor(
    state: DurableObjectStateLike,
    env: MaProfessorAccessEnv
  ) {
    const sessionSplitState =
      createMAProfessorAccessSessionSplitState(
        state
      )

    const requestSplitState =
      createMAProfessorAccessRequestSplitState(
        sessionSplitState
      )

    const renewalSplitState =
      createMAProfessorAccessRenewalSplitState(
        requestSplitState
      )

    const credentialSplitState =
      createMAProfessorAccessCredentialSplitState(
        renewalSplitState
      )

    const licenseSplitState =
      createMAProfessorAccessLicenseSplitState(
        credentialSplitState
      )

    const sessionLifecycleState =
      createMAProfessorSessionLifecycleState(
        licenseSplitState
      )

    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        createRetentionGuardedState(
          sessionLifecycleState
        ) as never,
        env
      )
  }

  fetch(
    request: Request
  ) {
    return this.existing.fetch(
      request
    )
  }
}
