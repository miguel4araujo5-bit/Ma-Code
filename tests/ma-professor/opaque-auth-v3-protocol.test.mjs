import assert from 'node:assert/strict'
import {
  readFile
} from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

function transpile(
  source,
  filename
) {
  const output =
    ts.transpileModule(
      source,
      {
        fileName:
          filename,
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

  return output.outputText
}

const [
  stateSource,
  protocolSource
] =
  await Promise.all([
    readFile(
      new URL(
        '../../worker/maProfessorOpaqueAuthState.ts',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../../worker/maProfessorOpaqueAuthProtocol.ts',
        import.meta.url
      ),
      'utf8'
    )
  ])

const stateJs =
  transpile(
    stateSource,
    'maProfessorOpaqueAuthState.ts'
  )

const stateUrl =
  `data:text/javascript;base64,${
    Buffer.from(
      stateJs
    ).toString('base64')
  }`

const protocolJs =
  transpile(
    protocolSource
      .replace(
        "'./maProfessorOpaqueAuthState'",
        `'${stateUrl}'`
      ),
    'maProfessorOpaqueAuthProtocol.ts'
  )

const protocolUrl =
  `data:text/javascript;base64,${
    Buffer.from(
      protocolJs
    ).toString('base64')
  }`

const opaque =
  await import(
    protocolUrl
  )

function fakeRuntime() {
  let sequence = 0

  return {
    createServerSetup() {
      return 'server-setup'
    },

    createServerRegistrationResponse({
      userIdentifier,
      registrationRequest
    }) {
      return {
        registrationResponse:
          `reg-response:${userIdentifier}:${registrationRequest}`
      }
    },

    startServerLogin({
      registrationRecord,
      startLoginRequest,
      userIdentifier
    }) {
      sequence += 1

      return {
        serverLoginState:
          JSON.stringify({
            registrationRecord,
            startLoginRequest,
            userIdentifier,
            sequence
          }),
        loginResponse:
          `login-response:${sequence}`
      }
    },

    finishServerLogin({
      serverLoginState,
      finishLoginRequest
    }) {
      const state =
        JSON.parse(
          serverLoginState
        )

      if (
        !state.registrationRecord ||
        finishLoginRequest !==
          `proof:${state.registrationRecord}`
      ) {
        throw new Error(
          'invalid opaque proof'
        )
      }

      return {
        sessionKey:
          'server-session-key-must-not-escape'
      }
    }
  }
}

test(
  'enrollment stores only an OPAQUE registration record and marks v2 migration explicitly',
  () => {
    const runtime =
      fakeRuntime()

    const state =
      opaque
        .createFreshOpaqueAuthState(
          100
        )

    const started =
      opaque
        .startOpaqueEnrollment(
          state,
          runtime,
          {
            email:
              'Teacher@Example.COM ',
            deviceId:
              'device-enroll',
            registrationRequest:
              'opaque-registration-request'
          },
          150
        )

    assert.match(
      started.registrationResponse,
      /teacher@example\.com/
    )
    assert.ok(
      started.enrollmentId
    )

    const stored =
      opaque
        .finishOpaqueEnrollment(
          state,
          {
            email:
              'Teacher@Example.COM',
            deviceId:
              'device-enroll',
            enrollmentId:
              started.enrollmentId,
            registrationRecord:
              'opaque-record-123',
            migratedFromV2:
              true
          },
          200
        )

    assert.equal(
      stored.email,
      'teacher@example.com'
    )
    assert.equal(
      stored.registrationRecord,
      'opaque-record-123'
    )
    assert.equal(
      stored.migratedFromV2At,
      200
    )
  }
)

test(
  'OPAQUE enrollment is single-use, expires and is bound to email and device',
  () => {
    const runtime =
      fakeRuntime()

    const state =
      opaque
        .createFreshOpaqueAuthState(
          100
        )

    const wrongDevice =
      opaque
        .startOpaqueEnrollment(
          state,
          runtime,
          {
            email:
              'teacher@example.com',
            deviceId:
              'device-a',
            registrationRequest:
              'request-a'
          },
          120
        )

    assert.throws(
      () =>
        opaque
          .finishOpaqueEnrollment(
            state,
            {
              email:
                'teacher@example.com',
              deviceId:
                'device-b',
              enrollmentId:
                wrongDevice.enrollmentId,
              registrationRecord:
                'record-a'
            },
            130
          ),
      /OPAQUE_ENROLLMENT_INVALID/
    )

    assert.throws(
      () =>
        opaque
          .finishOpaqueEnrollment(
            state,
            {
              email:
                'teacher@example.com',
              deviceId:
                'device-a',
              enrollmentId:
                wrongDevice.enrollmentId,
              registrationRecord:
                'record-a'
            },
            131
          ),
      /OPAQUE_ENROLLMENT_INVALID/,
      'Um enrollment inválido deve ser consumido e não pode ser reutilizado.'
    )

    const expired =
      opaque
        .startOpaqueEnrollment(
          state,
          runtime,
          {
            email:
              'teacher@example.com',
            deviceId:
              'device-a',
            registrationRequest:
              'request-expired'
          },
          200
        )

    assert.throws(
      () =>
        opaque
          .finishOpaqueEnrollment(
            state,
            {
              email:
                'teacher@example.com',
              deviceId:
                'device-a',
              enrollmentId:
                expired.enrollmentId,
              registrationRecord:
                'record-expired'
            },
            200 +
              2 * 60 * 1000
          ),
      /OPAQUE_ENROLLMENT_INVALID/
    )
  }
)

test(
  'known and unknown accounts both receive an OPAQUE login start response',
  () => {
    const runtime =
      fakeRuntime()

    const state =
      opaque
        .createFreshOpaqueAuthState(
          100
        )

    const enrollment =
      opaque
        .startOpaqueEnrollment(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-seed',
            registrationRequest:
              'seed-registration'
          },
          105
        )

    opaque
      .finishOpaqueEnrollment(
        state,
        {
          email:
            'known@example.com',
          deviceId:
            'device-seed',
          enrollmentId:
            enrollment.enrollmentId,
          registrationRecord:
            'known-record'
        },
        110
      )

    const known =
      opaque
        .startOpaqueLogin(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-known',
            startLoginRequest:
              'start-known'
          },
          120
        )

    const unknown =
      opaque
        .startOpaqueLogin(
          state,
          runtime,
          {
            email:
              'missing@example.com',
            deviceId:
              'device-missing',
            startLoginRequest:
              'start-missing'
          },
          121
        )

    assert.ok(
      known.loginId
    )
    assert.ok(
      unknown.loginId
    )
    assert.ok(
      known.loginResponse
    )
    assert.ok(
      unknown.loginResponse
    )
  }
)

test(
  'a valid proof resolves only to account identity and device, never to the OPAQUE session key',
  () => {
    const runtime =
      fakeRuntime()

    const state =
      opaque
        .createFreshOpaqueAuthState(
          100
        )

    const enrollment =
      opaque
        .startOpaqueEnrollment(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-seed',
            registrationRequest:
              'seed-registration'
          },
          105
        )

    opaque
      .finishOpaqueEnrollment(
        state,
        {
          email:
            'known@example.com',
          deviceId:
            'device-seed',
          enrollmentId:
            enrollment.enrollmentId,
          registrationRecord:
            'known-record'
        },
        110
      )

    const started =
      opaque
        .startOpaqueLogin(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-123',
            startLoginRequest:
              'start'
          },
          120
        )

    const finished =
      opaque
        .finishOpaqueLogin(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-123',
            loginId:
              started.loginId,
            finishLoginRequest:
              'proof:known-record'
          },
          130
        )

    assert.deepEqual(
      finished,
      {
        email:
          'known@example.com',
        deviceId:
          'device-123'
      }
    )

    assert.doesNotMatch(
      JSON.stringify(
        finished
      ),
      /session-key/
    )
  }
)

test(
  'unknown account, wrong proof, expired proof and replay all fail without identity disclosure',
  () => {
    const runtime =
      fakeRuntime()

    const state =
      opaque
        .createFreshOpaqueAuthState(
          100
        )

    const enrollment =
      opaque
        .startOpaqueEnrollment(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-seed',
            registrationRequest:
              'seed-registration'
          },
          105
        )

    opaque
      .finishOpaqueEnrollment(
        state,
        {
          email:
            'known@example.com',
          deviceId:
            'device-seed',
          enrollmentId:
            enrollment.enrollmentId,
          registrationRecord:
            'known-record'
        },
        110
      )

    const unknown =
      opaque
        .startOpaqueLogin(
          state,
          runtime,
          {
            email:
              'missing@example.com',
            deviceId:
              'device-missing',
            startLoginRequest:
              'start-unknown'
          },
          120
        )

    assert.equal(
      opaque.finishOpaqueLogin(
        state,
        runtime,
        {
          email:
            'missing@example.com',
          deviceId:
            'device-missing',
          loginId:
            unknown.loginId,
          finishLoginRequest:
            'anything'
        },
        130
      ),
      null
    )

    const wrong =
      opaque
        .startOpaqueLogin(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-known',
            startLoginRequest:
              'start-wrong'
          },
          140
        )

    assert.equal(
      opaque.finishOpaqueLogin(
        state,
        runtime,
        {
          email:
            'known@example.com',
          deviceId:
            'device-known',
          loginId:
            wrong.loginId,
          finishLoginRequest:
            'wrong-proof'
        },
        150
      ),
      null
    )

    assert.equal(
      opaque.finishOpaqueLogin(
        state,
        runtime,
        {
          email:
            'known@example.com',
          deviceId:
            'device-known',
          loginId:
            wrong.loginId,
          finishLoginRequest:
            'proof:known-record'
        },
        151
      ),
      null,
      'Uma tentativa falhada deve consumir o challenge e impedir replay.'
    )

    const expired =
      opaque
        .startOpaqueLogin(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-known',
            startLoginRequest:
              'start-expired'
          },
          200
        )

    assert.equal(
      opaque.finishOpaqueLogin(
        state,
        runtime,
        {
          email:
            'known@example.com',
          deviceId:
            'device-known',
          loginId:
            expired.loginId,
          finishLoginRequest:
            'proof:known-record'
        },
        200 +
          2 * 60 * 1000
      ),
      null
    )
  }
)

test(
  'OPAQUE finish binds the proof to the device used at login start and consumes a mismatched challenge',
  () => {
    const runtime =
      fakeRuntime()

    const state =
      opaque
        .createFreshOpaqueAuthState(
          100
        )

    const enrollment =
      opaque
        .startOpaqueEnrollment(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-seed',
            registrationRequest:
              'seed-registration'
          },
          105
        )

    opaque
      .finishOpaqueEnrollment(
        state,
        {
          email:
            'known@example.com',
          deviceId:
            'device-seed',
          enrollmentId:
            enrollment.enrollmentId,
          registrationRecord:
            'known-record'
        },
        110
      )

    const started =
      opaque
        .startOpaqueLogin(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-known',
            startLoginRequest:
              'start-device-binding'
          },
          120
        )

    assert.equal(
      opaque.finishOpaqueLogin(
        state,
        runtime,
        {
          email:
            'known@example.com',
          deviceId:
            'device-other',
          loginId:
            started.loginId,
          finishLoginRequest:
            'proof:known-record'
        },
        130
      ),
      null
    )

    assert.equal(
      opaque.finishOpaqueLogin(
        state,
        runtime,
        {
          email:
            'known@example.com',
          deviceId:
            'device-known',
          loginId:
            started.loginId,
          finishLoginRequest:
            'proof:known-record'
        },
        131
      ),
      null,
      'Um challenge com dispositivo divergente deve ficar consumido e não pode ser reutilizado.'
    )
  }
)

test(
  'OPAQUE finish binds the proof to the email used at login start and consumes a mismatched challenge',
  () => {
    const runtime =
      fakeRuntime()

    const state =
      opaque
        .createFreshOpaqueAuthState(
          100
        )

    const enrollment =
      opaque
        .startOpaqueEnrollment(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-seed',
            registrationRequest:
              'seed-registration'
          },
          105
        )

    opaque
      .finishOpaqueEnrollment(
        state,
        {
          email:
            'known@example.com',
          deviceId:
            'device-seed',
          enrollmentId:
            enrollment.enrollmentId,
          registrationRecord:
            'known-record'
        },
        110
      )

    const started =
      opaque
        .startOpaqueLogin(
          state,
          runtime,
          {
            email:
              'known@example.com',
            deviceId:
              'device-known',
            startLoginRequest:
              'start-email-binding'
          },
          120
        )

    assert.equal(
      opaque.finishOpaqueLogin(
        state,
        runtime,
        {
          email:
            'other@example.com',
          deviceId:
            'device-known',
          loginId:
            started.loginId,
          finishLoginRequest:
            'proof:known-record'
        },
        130
      ),
      null
    )

    assert.equal(
      opaque.finishOpaqueLogin(
        state,
        runtime,
        {
          email:
            'known@example.com',
          deviceId:
            'device-known',
          loginId:
            started.loginId,
          finishLoginRequest:
            'proof:known-record'
        },
        131
      ),
      null,
      'Um challenge com email divergente deve ficar consumido e não pode ser reutilizado.'
    )
  }
)

test(
  'OPAQUE server protocol source contains no password or export-key input',
  () => {
    assert.doesNotMatch(
      protocolSource,
      /\bpassword\b/i
    )
    assert.doesNotMatch(
      protocolSource,
      /exportKey/i
    )
  }
)
