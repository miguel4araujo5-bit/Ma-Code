import assert from 'node:assert/strict'
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import * as ts from 'typescript'

const ACCESS_KEY =
  'ma-professor-access-state-v1'

const DAY_MS =
  24 * 60 * 60 * 1000

function clone(value) {
  return value === undefined
    ? undefined
    : structuredClone(value)
}

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(
      Object.entries(initial).map(
        ([key, value]) => [
          key,
          clone(value)
        ]
      )
    )
    this.putCalls = []
  }

  async get(key) {
    return clone(
      this.values.get(key)
    )
  }

  async put(keyOrEntries, value) {
    if (
      typeof keyOrEntries ===
        'string'
    ) {
      this.putCalls.push({
        key: keyOrEntries,
        value: clone(value)
      })
      this.values.set(
        keyOrEntries,
        clone(value)
      )
      return
    }

    for (
      const [key, entry] of
      Object.entries(
        keyOrEntries
      )
    ) {
      this.putCalls.push({
        key,
        value: clone(entry)
      })
      this.values.set(
        key,
        clone(entry)
      )
    }
  }

  snapshot(key) {
    return clone(
      this.values.get(key)
    )
  }

  putsFor(key) {
    return this.putCalls.filter(
      call =>
        call.key === key
    )
  }
}

function transpile(source, filename) {
  const output =
    ts.transpileModule(
      source,
      {
        fileName: filename,
        compilerOptions: {
          module:
            ts.ModuleKind.ESNext,
          target:
            ts.ScriptTarget.ES2022
        },
        reportDiagnostics: true
      }
    )

  const errors =
    (output.diagnostics || [])
      .filter(
        diagnostic =>
          diagnostic.category ===
            ts.DiagnosticCategory.Error
      )

  assert.equal(
    errors.length,
    0,
    errors.map(
      diagnostic =>
        ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        )
    ).join('\n')
  )

  return output.outputText
    .replaceAll(
      "'./maProfessorLoginAttemptGuardBridge'",
      "'./maProfessorLoginAttemptGuardBridge.mjs'"
    )
    .replaceAll(
      '"./maProfessorLoginAttemptGuardBridge"',
      '"./maProfessorLoginAttemptGuardBridge.mjs"'
    )
    .replaceAll(
      "'./maProfessorAccessSessionSplitBridge'",
      "'./maProfessorAccessSessionSplitBridge.mjs'"
    )
    .replaceAll(
      '"./maProfessorAccessSessionSplitBridge"',
      '"./maProfessorAccessSessionSplitBridge.mjs"'
    )
    .replaceAll(
      "'./maProfessorAccessRequestSplitBridge'",
      "'./maProfessorAccessRequestSplitBridge.mjs'"
    )
    .replaceAll(
      '"./maProfessorAccessRequestSplitBridge"',
      '"./maProfessorAccessRequestSplitBridge.mjs"'
    )
    .replaceAll(
      "'./maProfessorAccessRenewalSplitBridge'",
      "'./maProfessorAccessRenewalSplitBridge.mjs'"
    )
    .replaceAll(
      '"./maProfessorAccessRenewalSplitBridge"',
      '"./maProfessorAccessRenewalSplitBridge.mjs"'
    )
}

async function stageRetentionBridge() {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'ma-professor-request-retention-'
      )
    )

  const source =
    await readFile(
      new URL(
        '../../worker/maProfessorAccessRetentionBridge.ts',
        import.meta.url
      ),
      'utf8'
    )

  await writeFile(
    join(
      directory,
      'maProfessorAccessRetentionBridge.mjs'
    ),
    transpile(
      source,
      'maProfessorAccessRetentionBridge.ts'
    ),
    'utf8'
  )

  await writeFile(
    join(
      directory,
      'maProfessorAccessSessionSplitBridge.mjs'
    ),
    `
      export function createMAProfessorAccessSessionSplitState(state) {
        return state
      }
    `,
    'utf8'
  )

  await writeFile(
    join(
      directory,
      'maProfessorAccessRequestSplitBridge.mjs'
    ),
    `
      export function createMAProfessorAccessRequestSplitState(state) {
        return state
      }
    `,
    'utf8'
  )

  await writeFile(
    join(
      directory,
      'maProfessorAccessRenewalSplitBridge.mjs'
    ),
    `
      export function createMAProfessorAccessRenewalSplitState(state) {
        return state
      }
    `,
    'utf8'
  )

  await writeFile(
    join(
      directory,
      'maProfessorLoginAttemptGuardBridge.mjs'
    ),
    `
      export const statesSeen = []

      export class MaProfessorAccessDurableObject {
        constructor(state) {
          this.state = state
        }

        async fetch() {
          const snapshot =
            await this.state.storage.get(
              '${ACCESS_KEY}'
            )

          statesSeen.push(
            structuredClone(snapshot)
          )

          return new Response(
            JSON.stringify({
              success: true
            }),
            {
              status: 200,
              headers: {
                'Content-Type':
                  'application/json'
              }
            }
          )
        }
      }
    `,
    'utf8'
  )

  const runtime =
    await import(
      pathToFileURL(
        join(
          directory,
          'maProfessorAccessRetentionBridge.mjs'
        )
      ).href
    )

  const lower =
    await import(
      pathToFileURL(
        join(
          directory,
          'maProfessorLoginAttemptGuardBridge.mjs'
        )
      ).href
    )

  return {
    runtime,
    lower,
    dispose: () =>
      rm(
        directory,
        {
          recursive: true,
          force: true
        }
      )
  }
}

function accessRequest(
  email,
  status,
  timestamp,
  overrides = {}
) {
  return {
    id:
      `request-${email}`,
    email,
    status,
    requestedAt:
      timestamp,
    approvedAt:
      status === 'approved'
        ? timestamp
        : null,
    rejectedAt:
      status === 'rejected'
        ? timestamp
        : null,
    activatedAt:
      null,
    failedActivationAttempts:
      0,
    blockedUntil:
      null,
    updatedAt:
      timestamp,
    ...overrides
  }
}

function accessState(
  accessRequests,
  overrides = {}
) {
  return {
    schemaVersion: 2,
    licenses: {},
    sessions: {},
    renewals: [],
    accessRequests,
    credentials: {},
    createdAt:
      Date.now(),
    updatedAt:
      Date.now(),
    ...overrides
  }
}

async function triggerRead(
  runtime,
  storage
) {
  const access =
    new runtime.MaProfessorAccessDurableObject(
      {
        storage
      },
      {}
    )

  return access.fetch(
    new Request(
      'https://ma-code.pt/api/ma-professor/access/not-found',
      {
        method: 'POST',
        body: '{}'
      }
    )
  )
}

test(
  'stale rejected requests without access identity are pruned during the existing access-state read',
  async t => {
    const staged =
      await stageRetentionBridge()
    t.after(staged.dispose)

    const now =
      Date.now()
    const stale =
      now - 181 * DAY_MS
    const recent =
      now - 30 * DAY_MS

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          accessState({
            'old-rejected@example.com':
              accessRequest(
                'old-rejected@example.com',
                'rejected',
                stale
              ),
            'recent-rejected@example.com':
              accessRequest(
                'recent-rejected@example.com',
                'rejected',
                recent
              ),
            'old-pending@example.com':
              accessRequest(
                'old-pending@example.com',
                'pending',
                stale
              ),
            'old-approved@example.com':
              accessRequest(
                'old-approved@example.com',
                'approved',
                stale
              )
          })
      })

    const response =
      await triggerRead(
        staged.runtime,
        storage
      )

    assert.equal(response.status, 200)

    const persisted =
      storage.snapshot(ACCESS_KEY)

    assert.equal(
      persisted.accessRequests[
        'old-rejected@example.com'
      ],
      undefined
    )
    assert.ok(
      persisted.accessRequests[
        'recent-rejected@example.com'
      ]
    )
    assert.ok(
      persisted.accessRequests[
        'old-pending@example.com'
      ]
    )
    assert.ok(
      persisted.accessRequests[
        'old-approved@example.com'
      ]
    )

    assert.equal(
      storage.putsFor(ACCESS_KEY).length,
      1,
      'A limpeza deve persistir apenas quando encontrou um rejeitado elegível.'
    )

    assert.equal(
      staged.lower.statesSeen.length,
      1
    )
    assert.equal(
      staged.lower.statesSeen[0]
        .accessRequests[
          'old-rejected@example.com'
        ],
      undefined,
      'A cadeia existente deve receber já o estado limpo, evitando ressurreição por uma cópia em memória antiga.'
    )
  }
)

test(
  'licenses credentials and meaningful approved or activated history protect rejected records from retention cleanup',
  async t => {
    const staged =
      await stageRetentionBridge()
    t.after(staged.dispose)

    const stale =
      Date.now() - 181 * DAY_MS

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          accessState(
            {
              'licensed@example.com':
                accessRequest(
                  'licensed@example.com',
                  'rejected',
                  stale
                ),
              'credential@example.com':
                accessRequest(
                  'credential@example.com',
                  'rejected',
                  stale
                ),
              'approved-history@example.com':
                accessRequest(
                  'approved-history@example.com',
                  'rejected',
                  stale,
                  {
                    approvedAt: stale
                  }
                ),
              'activated-history@example.com':
                accessRequest(
                  'activated-history@example.com',
                  'rejected',
                  stale,
                  {
                    activatedAt: stale
                  }
                )
            },
            {
              licenses: {
                'licensed@example.com': {
                  email:
                    'licensed@example.com'
                }
              },
              credentials: {
                'credential@example.com': {
                  email:
                    'credential@example.com'
                }
              }
            }
          )
      })

    await triggerRead(
      staged.runtime,
      storage
    )

    const persisted =
      storage.snapshot(ACCESS_KEY)

    assert.equal(
      Object.keys(
        persisted.accessRequests
      ).length,
      4
    )

    assert.equal(
      storage.putsFor(ACCESS_KEY).length,
      0,
      'Nenhuma escrita adicional deve ocorrer quando todos os registos antigos continuam protegidos.'
    )
  }
)

test(
  'retention bridge is the production MA-Professor Durable Object entrypoint without adding bindings or migrations',
  async () => {
    const entry =
      await readFile(
        new URL(
          '../../worker/entry.ts',
          import.meta.url
        ),
        'utf8'
      )

    const wrangler =
      await readFile(
        new URL(
          '../../wrangler.jsonc',
          import.meta.url
        ),
        'utf8'
      )

    assert.match(
      entry,
      /from '\.\/maProfessorAccessRetentionBridge'/
    )
    assert.doesNotMatch(
      entry,
      /from '\.\/maProfessorLoginAttemptGuardBridge'/
    )

    assert.match(
      wrangler,
      /MA_PROFESSOR_ACCESS/
    )
    assert.doesNotMatch(
      wrangler,
      /login-guard/i
    )
  }
)
