import assert from 'node:assert/strict'
import {
  readFile
} from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source =
  await readFile(
    new URL(
      '../../worker/maProfessorOpaqueAuthState.ts',
      import.meta.url
    ),
    'utf8'
  )

const output =
  ts.transpileModule(
    source,
    {
      fileName:
        'maProfessorOpaqueAuthState.ts',
      compilerOptions: {
        module:
          ts.ModuleKind.ESNext,
        target:
          ts.ScriptTarget.ES2022
      },
      reportDiagnostics:
        true
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

const moduleUrl =
  `data:text/javascript;base64,${
    Buffer.from(
      output.outputText
    ).toString('base64')
  }`

const opaqueState =
  await import(moduleUrl)

test(
  'OPAQUE v3 uses a separate durable-object storage key and starts empty',
  () => {
    assert.equal(
      opaqueState
        .MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY,
      'ma-professor-opaque-auth-v1'
    )

    const state =
      opaqueState
        .createMAProfessorOpaqueAuthState(
          123
        )

    assert.deepEqual(
      state,
      {
        schemaVersion: 1,
        protocol:
          'OPAQUE-RFC9807',
        serverSetup:
          null,
        registrations:
          {},
        pendingEnrollments:
          {},
        pendingLogins:
          {},
        createdAt:
          123,
        updatedAt:
          123
      }
    )
  }
)

test(
  'invalid or unknown OPAQUE state fails closed to a fresh v3 state without touching v2 credentials',
  () => {
    const state =
      opaqueState
        .normalizeMAProfessorOpaqueAuthState(
          {
            schemaVersion: 99,
            protocol:
              'UNKNOWN',
            serverSetup:
              'must-not-survive',
            registrations: {
              'legacy@example.com': {
                registrationRecord:
                  'must-not-survive'
              }
            },
            pendingLogins: {},
            createdAt: 1,
            updatedAt: 1
          },
          456
        )

    assert.equal(
      state.serverSetup,
      null
    )
    assert.deepEqual(
      state.registrations,
      {}
    )
    assert.equal(
      state.createdAt,
      456
    )
  }
)

test(
  'production auth bridge removes legacy personal-password storage and uses only OPAQUE plus MP activation state',
  async () => {
    const authBridge =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessAuthBridge.ts',
          import.meta.url
        ),
        'utf8'
      )

    assert.doesNotMatch(
      authBridge,
      /ma-professor-account-auth-v1/
    )
    assert.doesNotMatch(
      source,
      /ma-professor-account-auth-v1/
    )
    assert.match(
      authBridge,
      /MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY/
    )
    assert.match(
      authBridge,
      /activationPassword/
    )
  }
)

test(
  'session issuance is centralized before OPAQUE is allowed to reuse it',
  async () => {
    const authBridge =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessAuthBridge.ts',
          import.meta.url
        ),
        'utf8'
      )

    assert.match(
      authBridge,
      /private async issueAccountSession\(/
    )
    assert.match(
      authBridge,
      /return this\.issueAccountSession\(\s*authenticated\.email,\s*authenticated\.deviceId\s*\)/
    )

    const tokenCreationCount =
      (
        authBridge.match(
          /const token =\s*createToken\(\)/g
        ) || []
      ).length

    assert.equal(
      tokenCreationCount,
      1,
      'A emissão de tokens de login deve continuar centralizada numa única política.'
    )
  }
)
