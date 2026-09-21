import assert from 'node:assert/strict'
import {
  readFile
} from 'node:fs/promises'
import test from 'node:test'

const [
  apiSource,
  clientSource,
  accessSource
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
  'legacy enrollment is the only OPAQUE API transition that submits the current v2 password',
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
      /\bpassword\b/
    )
    assert.doesNotMatch(
      finish,
      /\bpassword\b/
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
