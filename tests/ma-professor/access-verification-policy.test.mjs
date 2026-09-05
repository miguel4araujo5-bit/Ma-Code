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

const {
  canUseStoredSessionForVerificationFallback,
  shouldInvalidateStoredSessionAfterVerificationError
} = await import(moduleUrl)

const stored = {
  token: 'token-a',
  deviceId: 'device-a'
}

test(
  '401 and 403 definitively invalidate the stored account session',
  () => {
    assert.equal(
      shouldInvalidateStoredSessionAfterVerificationError({
        status: 401
      }),
      true
    )

    assert.equal(
      shouldInvalidateStoredSessionAfterVerificationError({
        status: 403
      }),
      true
    )

    assert.equal(
      canUseStoredSessionForVerificationFallback(
        { status: 401 },
        stored,
        'token-a',
        'device-a'
      ),
      false
    )
  }
)

test(
  'network and server failures may reuse only the exact stored session',
  () => {
    assert.equal(
      canUseStoredSessionForVerificationFallback(
        new TypeError('Failed to fetch'),
        stored,
        'token-a',
        'device-a'
      ),
      true
    )

    assert.equal(
      canUseStoredSessionForVerificationFallback(
        { status: 503 },
        stored,
        'token-a',
        'device-a'
      ),
      true
    )
  }
)

test(
  'verification fallback never crosses token or device boundaries',
  () => {
    assert.equal(
      canUseStoredSessionForVerificationFallback(
        new TypeError('offline'),
        stored,
        'token-b',
        'device-a'
      ),
      false
    )

    assert.equal(
      canUseStoredSessionForVerificationFallback(
        new TypeError('offline'),
        stored,
        'token-a',
        'device-b'
      ),
      false
    )
  }
)
