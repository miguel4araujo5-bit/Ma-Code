import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/access/accessTypes.ts',
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
  isLicenseUsable
} = await import(moduleUrl)

function license(
  status,
  validUntil
) {
  return {
    email: 'professor@example.com',
    plan: 'paid_30_days',
    status,
    validFrom:
      new Date(
        Date.now() - 60_000
      ).toISOString(),
    validUntil,
    daysRemaining: 1,
    renewalRequestedAt: null,
    revokedAt: null
  }
}

test(
  'active cached license remains usable only while validUntil is in the future',
  () => {
    assert.equal(
      isLicenseUsable(
        license(
          'active',
          new Date(
            Date.now() + 60_000
          ).toISOString()
        )
      ),
      true
    )

    assert.equal(
      isLicenseUsable(
        license(
          'active',
          new Date(
            Date.now() - 60_000
          ).toISOString()
        )
      ),
      false
    )
  }
)

test(
  'expiring and renewal-pending licenses also stop locally at validUntil',
  () => {
    for (const status of [
      'expiring',
      'renewal_pending'
    ]) {
      assert.equal(
        isLicenseUsable(
          license(
            status,
            new Date(
              Date.now() - 60_000
            ).toISOString()
          )
        ),
        false
      )
    }
  }
)

test(
  'revoked, expired and missing-expiry licenses never unlock offline access',
  () => {
    assert.equal(
      isLicenseUsable(
        license(
          'revoked',
          new Date(
            Date.now() + 60_000
          ).toISOString()
        )
      ),
      false
    )

    assert.equal(
      isLicenseUsable(
        license(
          'expired',
          new Date(
            Date.now() + 60_000
          ).toISOString()
        )
      ),
      false
    )

    assert.equal(
      isLicenseUsable(
        license(
          'active',
          null
        )
      ),
      false
    )
  }
)
