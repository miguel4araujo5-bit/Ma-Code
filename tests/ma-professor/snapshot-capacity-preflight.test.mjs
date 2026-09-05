import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
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

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const capacitySource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/snapshotCapacityPolicy.ts',
    import.meta.url
  ),
  'utf8'
)

const capacityUrl =
  transpile(capacitySource)

const capacityModule = await import(
  capacityUrl
)

function createEncrypted(
  ciphertextCharacters
) {
  return {
    encryptionVersion: 1,
    encryptionAlgorithm: 'AES-256-GCM',
    nonce: 'A'.repeat(16),
    ciphertext:
      'A'.repeat(
        ciphertextCharacters
      ),
    ciphertextHash:
      'B'.repeat(44)
  }
}

function inspectWithCiphertext(
  ciphertextCharacters
) {
  return capacityModule
    .inspectMAProfessorSnapshotPushCapacity({
      token:
        't'.repeat(43),
      deviceId:
        '12345678-1234-4abc-8def-123456789abc',
      recordId:
        'database-v1',
      expectedServerRevision: 12,
      encrypted:
        createEncrypted(
          ciphertextCharacters
        )
    })
}

test(
  'capacity policy distinguishes normal, warning, critical and blocked uploads',
  () => {
    assert.equal(
      inspectWithCiphertext(
        400_000
      ).level,
      'normal'
    )

    assert.equal(
      inspectWithCiphertext(
        1_120_000
      ).level,
      'warning'
    )

    assert.equal(
      inspectWithCiphertext(
        1_340_000
      ).level,
      'critical'
    )

    assert.equal(
      inspectWithCiphertext(
        1_480_001
      ).level,
      'blocked'
    )
  }
)

test(
  'capacity error explains that an oversized snapshot was not sent and local data remain available',
  () => {
    const capacity =
      inspectWithCiphertext(
        1_480_001
      )

    assert.throws(
      () =>
        capacityModule
          .assertMAProfessorSnapshotPushCapacity(
            capacity
          ),
      error => {
        assert.ok(
          error instanceof
            capacityModule.MAProfessorSnapshotCapacityError
        )
        assert.match(
          error.message,
          /não foi enviada/i
        )
        assert.match(
          error.message,
          /continuam guardados neste dispositivo/i
        )
        return true
      }
    )
  }
)

const snapshotApiSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/snapshotApi.ts',
    import.meta.url
  ),
  'utf8'
)

const snapshotApiRuntime =
  snapshotApiSource.replaceAll(
    "'./snapshotCapacityPolicy'",
    `'${capacityUrl}'`
  )

const snapshotApiModule = await import(
  transpile(snapshotApiRuntime)
)

test(
  'oversized encrypted snapshot is blocked before fetch is called',
  async () => {
    const originalFetch =
      globalThis.fetch

    let fetchCalls = 0

    globalThis.fetch =
      async () => {
        fetchCalls += 1
        throw new Error(
          'fetch should not be reached'
        )
      }

    try {
      await assert.rejects(
        () =>
          snapshotApiModule
            .pushMAProfessorEncryptedSnapshot(
              't'.repeat(43),
              '12345678-1234-4abc-8def-123456789abc',
              'database-v1',
              12,
              createEncrypted(
                1_480_001
              )
            ),
        error => {
          assert.equal(
            error.name,
            'MAProfessorSnapshotCapacityError'
          )
          return true
        }
      )

      assert.equal(
        fetchCalls,
        0
      )
    } finally {
      globalThis.fetch =
        originalFetch
    }
  }
)

test(
  'allowed upload keeps the existing request contract and returns its capacity classification',
  async () => {
    const originalFetch =
      globalThis.fetch

    let requestBody =
      null

    globalThis.fetch =
      async (
        _url,
        init
      ) => {
        requestBody =
          JSON.parse(
            init.body
          )

        return new Response(
          JSON.stringify({
            success: true,
            recordId:
              'database-v1',
            serverRevision: 13,
            recordRevision: 7,
            updatedAt:
              '2026-09-05T11:00:00.000Z'
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

    try {
      const encrypted =
        createEncrypted(
          400_000
        )

      const result =
        await snapshotApiModule
          .pushMAProfessorEncryptedSnapshot(
            't'.repeat(43),
            '12345678-1234-4abc-8def-123456789abc',
            'database-v1',
            12,
            encrypted
          )

      assert.deepEqual(
        requestBody,
        {
          token:
            't'.repeat(43),
          deviceId:
            '12345678-1234-4abc-8def-123456789abc',
          recordId:
            'database-v1',
          expectedServerRevision: 12,
          encrypted
        }
      )

      assert.equal(
        result.serverRevision,
        13
      )
      assert.equal(
        result.capacity.level,
        'normal'
      )
    } finally {
      globalThis.fetch =
        originalFetch
    }
  }
)

const noticeSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/SnapshotCapacityNotice.tsx',
    import.meta.url
  ),
  'utf8'
)

const pageSource = await readFile(
  new URL(
    '../../src/pages/MAProfessorPage.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'capacity warning is mounted globally and distinguishes approaching, critical and blocked states',
  () => {
    assert.match(
      noticeSource,
      /a aproximar-se do limite técnico/i
    )
    assert.match(
      noticeSource,
      /muito próxima do limite técnico/i
    )
    assert.match(
      noticeSource,
      /não foi enviada/i
    )
    assert.match(
      pageSource,
      /<SnapshotCapacityNotice\s*\/>/
    )
  }
)
