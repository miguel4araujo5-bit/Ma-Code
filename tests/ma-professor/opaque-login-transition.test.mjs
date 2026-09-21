import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const opaqueAccess =
  await readFile(
    new URL(
      '../../src/components/ma-professor/access/opaqueAccess.ts',
      import.meta.url
    ),
    'utf8'
  )

const authGate =
  await readFile(
    new URL(
      '../../src/components/ma-professor/access/MAProfessorAuthGate.tsx',
      import.meta.url
    ),
    'utf8'
  )

test(
  'login UI uses the OPAQUE-first transition helper instead of calling legacy login directly',
  () => {
    assert.match(
      authGate,
      /loginMAProfessorPreferOpaque/
    )

    assert.doesNotMatch(
      authGate,
      /loginMAProfessorAccess/
    )

    assert.match(
      authGate,
      /await loginMAProfessorPreferOpaque\(\s*normalizedEmail,\s*personalPassword,\s*deviceId\s*\)/
    )
  }
)

test(
  'transition helper falls back to v2 only after an OPAQUE proof returns null',
  () => {
    const opaqueCall =
      opaqueAccess.indexOf(
        'await loginMAProfessorOpaque('
      )

    const opaqueSuccess =
      opaqueAccess.indexOf(
        'if (opaque)',
        opaqueCall
      )

    const legacyCall =
      opaqueAccess.indexOf(
        'await loginMAProfessorAccess(',
        opaqueSuccess
      )

    assert.ok(
      opaqueCall >= 0 &&
      opaqueSuccess > opaqueCall &&
      legacyCall > opaqueSuccess
    )

    const beforeLegacy =
      opaqueAccess.slice(
        opaqueCall,
        legacyCall
      )

    assert.doesNotMatch(
      beforeLegacy,
      /catch\s*\(/
    )
    assert.doesNotMatch(
      beforeLegacy,
      /catch\s*\{/
    )
  }
)

test(
  'a valid legacy session survives an OPAQUE enrollment failure during migration',
  () => {
    assert.match(
      opaqueAccess,
      /const response =\s*await loginMAProfessorAccess\(/
    )

    assert.match(
      opaqueAccess,
      /try\s*\{[\s\S]*await enrollMAProfessorOpaqueFromLegacySession\([\s\S]*\}\s*catch\s*\{[\s\S]*migração OPAQUE não deve bloquear uma sessão v2 válida/
    )

    assert.match(
      opaqueAccess,
      /return \{\s*response,\s*exportKey,\s*authMode:\s*'legacy',\s*migratedToOpaque/
    )
  }
)
