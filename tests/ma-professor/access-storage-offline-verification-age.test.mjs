import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/access/accessStorage.ts',
    import.meta.url
  ),
  'utf8'
)

const output = ts.transpileModule(
  source,
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    reportDiagnostics: true
  }
)

const errors =
  (output.diagnostics || []).filter(
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

function loadStorageModule() {
  let verificationState = 'verified'
  const exports = {}
  const module = { exports }

  Function(
    'require',
    'exports',
    'module',
    output.outputText
  )(
    request => {
      if (
        request ===
        './accessVerificationPolicy'
      ) {
        return {
          readMAProfessorAccessVerificationState: () =>
            verificationState
        }
      }

      throw new Error(
        `Unexpected dependency: ${request}`
      )
    },
    exports,
    module
  )

  return {
    storage: module.exports,
    setVerificationState: state => {
      verificationState = state
    }
  }
}

function session(
  checkedAt,
  token = 'token-a',
  deviceId = 'device-a'
) {
  return {
    token,
    deviceId,
    email: 'professor@example.test',
    license: null,
    checkedAt
  }
}

test(
  'local-cache persistence does not renew the last remote verification time',
  () => {
    const {
      storage,
      setVerificationState
    } = loadStorageModule()

    const remoteCheckedAt =
      '2026-09-13T07:00:00.000Z'
    const offlineCheckedAt =
      '2026-09-13T08:00:00.000Z'

    storage.saveMAProfessorStoredAccess(
      session(remoteCheckedAt)
    )

    setVerificationState(
      'local-cache'
    )

    storage.saveMAProfessorAccessSession(
      session(offlineCheckedAt)
    )

    assert.equal(
      storage.readMAProfessorStoredAccess()
        .checkedAt,
      remoteCheckedAt
    )
  }
)

test(
  'verified persistence advances the verification time normally',
  () => {
    const {
      storage,
      setVerificationState
    } = loadStorageModule()

    storage.saveMAProfessorStoredAccess(
      session(
        '2026-09-13T07:00:00.000Z'
      )
    )

    setVerificationState(
      'verified'
    )

    const verifiedCheckedAt =
      '2026-09-13T08:00:00.000Z'

    storage.saveMAProfessorAccessSession(
      session(verifiedCheckedAt)
    )

    assert.equal(
      storage.readMAProfessorStoredAccess()
        .checkedAt,
      verifiedCheckedAt
    )
  }
)

test(
  'local-cache never preserves a timestamp across a different session identity',
  () => {
    const {
      storage,
      setVerificationState
    } = loadStorageModule()

    storage.saveMAProfessorStoredAccess(
      session(
        '2026-09-13T07:00:00.000Z'
      )
    )

    setVerificationState(
      'local-cache'
    )

    const nextCheckedAt =
      '2026-09-13T08:00:00.000Z'

    storage.saveMAProfessorAccessSession(
      session(
        nextCheckedAt,
        'token-b',
        'device-a'
      )
    )

    assert.equal(
      storage.readMAProfessorStoredAccess()
        .checkedAt,
      nextCheckedAt
    )
  }
)
