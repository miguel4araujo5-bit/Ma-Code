import assert from 'node:assert/strict'
import {
  readFile
} from 'node:fs/promises'
import test from 'node:test'

const [
  apiSource,
  clientSource,
  accessSource,
  storageSource,
  authGateSource
] =
  await Promise.all([
    readFile(
      new URL(
        '../../src/components/ma-professor/access/accessApi.ts',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../../src/components/ma-professor/access/opaqueClient.ts',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../../src/components/ma-professor/access/opaqueAccess.ts',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../../src/components/ma-professor/access/accessStorage.ts',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../../src/components/ma-professor/access/MAProfessorAuthGate.tsx',
        import.meta.url
      ),
      'utf8'
    )
  ])

test(
  'OPAQUE login API never includes the personal password in server payloads',
  () => {
    const start =
      apiSource.match(
        /export async function startMAProfessorOpaqueLogin[\s\S]*?\n}\n/
      )?.[0] ?? ''

    const finish =
      apiSource.match(
        /export async function finishMAProfessorOpaqueLogin[\s\S]*?\n}\n/
      )?.[0] ?? ''

    assert.match(
      start,
      /startLoginRequest/
    )
    assert.match(
      finish,
      /finishLoginRequest/
    )

    assert.doesNotMatch(
      start,
      /\bpassword\b/
    )
    assert.doesNotMatch(
      finish,
      /\bpassword\b/
    )
  }
)

test(
  'OPAQUE enrollment is authorized by the activation secret without sending the personal password',
  () => {
    const start =
      apiSource.match(
        /export async function startMAProfessorOpaqueEnrollment[\s\S]*?\n}\n/
      )?.[0] ?? ''

    const finish =
      apiSource.match(
        /export async function finishMAProfessorOpaqueEnrollment[\s\S]*?\n}\n/
      )?.[0] ?? ''

    assert.match(
      start,
      /activationPassword/
    )
    assert.doesNotMatch(
      start,
      /\bpassword\b/
    )
    assert.doesNotMatch(
      finish,
      /\bpassword\b/
    )
    assert.doesNotMatch(
      start,
      /\btoken\b/
    )
    assert.doesNotMatch(
      finish,
      /\btoken\b/
    )
  }
)

test(
  'OPAQUE browser adapter keeps export keys in return values only and never persists password material',
  () => {
    for (
      const source of [
        clientSource,
        accessSource
      ]
    ) {
      assert.doesNotMatch(
        source,
        /localStorage|sessionStorage|indexedDB/i
      )

      assert.doesNotMatch(
        source,
        /setItem\s*\(/
      )
    }

    assert.match(
      clientSource,
      /keyStretching:\s*KEY_STRETCHING/
    )
    assert.match(
      clientSource,
      /'rfc-recommended' as const/
    )
    assert.match(
      accessSource,
      /exportKey:\s*clientFinish\.exportKey/
    )
  }
)

test(
  'OPAQUE export key is kept only in memory, scoped by email and cleared with the access session',
  () => {
    assert.match(
      storageSource,
      /let memoryOpaqueExportKey:/
    )
    assert.match(
      storageSource,
      /export function saveMAProfessorOpaqueExportKey\(/
    )
    assert.match(
      storageSource,
      /export function readMAProfessorOpaqueExportKey\(/
    )
    assert.match(
      storageSource,
      /export function clearMAProfessorOpaqueExportKey\(/
    )

    const saveFunction =
      storageSource.match(
        /export function saveMAProfessorOpaqueExportKey[\s\S]*?\n}\n/
      )?.[0] ?? ''

    assert.doesNotMatch(
      saveFunction,
      /writeStoredValue|localStorage|sessionStorage|setItem/
    )

    assert.match(
      storageSource,
      /export function clearMAProfessorStoredAccess\(\)[\s\S]*?clearMAProfessorOpaqueExportKey\(\)/
    )

    assert.match(
      authGateSource,
      /saveMAProfessorOpaqueExportKey\(\s*normalizedEmail,\s*exportKey\s*\)/
    )
  }
)

test(
  'client OPAQUE runtime is loaded lazily from the frozen audited Wasm asset',
  () => {
    assert.match(
      clientSource,
      /opaque_bg\.wasm\?url/
    )
    assert.match(
      clientSource,
      /let opaqueReady:[\s\S]*?null/
    )
    assert.match(
      clientSource,
      /if \(!opaqueReady\)/
    )
  }
)
