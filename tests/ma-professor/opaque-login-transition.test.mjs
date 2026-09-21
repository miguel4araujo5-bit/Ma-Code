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
  'login UI uses OPAQUE only and contains no legacy password fallback',
  () => {
    assert.match(
      authGate,
      /loginMAProfessorOpaqueOnly/
    )

    assert.doesNotMatch(
      authGate,
      /loginMAProfessorAccess|loginMAProfessorPreferOpaque/
    )

    assert.match(
      authGate,
      /await loginMAProfessorOpaqueOnly\(\s*normalizedEmail,\s*personalPassword,\s*deviceId\s*\)/
    )
  }
)

test(
  'OPAQUE-only login fails closed instead of falling back to v2',
  () => {
    assert.match(
      opaqueAccess,
      /export async function loginMAProfessorOpaqueOnly/
    )

    assert.match(
      opaqueAccess,
      /if \(!opaque\)[\s\S]*?throw new Error/
    )

    assert.doesNotMatch(
      opaqueAccess,
      /loginMAProfessorAccess|authMode:\s*'legacy'|migratedToOpaque/
    )
  }
)

test(
  'first password registration happens during MP activation and never through a legacy session',
  () => {
    assert.match(
      opaqueAccess,
      /export async function enrollMAProfessorOpaqueForActivation/
    )

    assert.match(
      opaqueAccess,
      /startMAProfessorOpaqueEnrollment\(\s*email,\s*activationPassword,\s*deviceId,/
    )

    assert.doesNotMatch(
      opaqueAccess,
      /enrollMAProfessorOpaqueFromLegacySession/
    )
  }
)
