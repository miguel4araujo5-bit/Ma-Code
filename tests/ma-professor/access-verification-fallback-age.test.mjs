import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/access/accessVerificationPolicy.ts',
    import.meta.url
  ),
  'utf8'
)

const output = ts.transpileModule(
  source,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
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

const moduleUrl =
  `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`

const policy = await import(moduleUrl)

const HOUR = 60 * 60 * 1000
const now = Date.parse('2026-09-13T08:00:00.000Z')

function storedAt(checkedAt) {
  return {
    token: 'token-a',
    deviceId: 'device-a',
    checkedAt
  }
}

test(
  'offline fallback accepts only a recent successful verification',
  () => {
    assert.equal(
      policy.canUseStoredSessionForVerificationFallback(
        new TypeError('offline'),
        storedAt(
          new Date(now - 23 * HOUR).toISOString()
        ),
        'token-a',
        'device-a',
        now
      ),
      true
    )

    assert.equal(
      policy.canUseStoredSessionForVerificationFallback(
        { status: 503 },
        storedAt(
          new Date(now - 24 * HOUR).toISOString()
        ),
        'token-a',
        'device-a',
        now
      ),
      true
    )
  }
)

test(
  'offline fallback rejects stale, missing, invalid or future verification timestamps',
  () => {
    for (const checkedAt of [
      new Date(now - 24 * HOUR - 1).toISOString(),
      undefined,
      '',
      'invalid-date',
      new Date(now + 1).toISOString()
    ]) {
      assert.equal(
        policy.canUseStoredSessionForVerificationFallback(
          new TypeError('offline'),
          storedAt(checkedAt),
          'token-a',
          'device-a',
          now
        ),
        false
      )
    }
  }
)

test(
  '401 and identity mismatches remain blocked regardless of freshness',
  () => {
    const fresh = storedAt(
      new Date(now - HOUR).toISOString()
    )

    assert.equal(
      policy.canUseStoredSessionForVerificationFallback(
        { status: 401 },
        fresh,
        'token-a',
        'device-a',
        now
      ),
      false
    )

    assert.equal(
      policy.canUseStoredSessionForVerificationFallback(
        new TypeError('offline'),
        fresh,
        'token-b',
        'device-a',
        now
      ),
      false
    )

    assert.equal(
      policy.canUseStoredSessionForVerificationFallback(
        new TypeError('offline'),
        fresh,
        'token-a',
        'device-b',
        now
      ),
      false
    )
  }
)
