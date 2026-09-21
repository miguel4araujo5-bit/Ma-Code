import assert from 'node:assert/strict'
import {
  readFile,
  readdir
} from 'node:fs/promises'
import test from 'node:test'

const ROOT =
  new URL(
    '../../',
    import.meta.url
  )

async function read(
  relativePath
) {
  return readFile(
    new URL(
      relativePath,
      ROOT
    ),
    'utf8'
  )
}

const [
  cryptoSource,
  opaqueClientSource,
  opaqueAccessSource,
  opaqueProtocolSource
] =
  await Promise.all([
    read(
      'src/components/ma-professor/sync/cloudBackupV3Crypto.ts'
    ),
    read(
      'src/components/ma-professor/access/opaqueClient.ts'
    ),
    read(
      'src/components/ma-professor/access/opaqueAccess.ts'
    ),
    read(
      'worker/maProfessorOpaqueAuthProtocol.ts'
    )
  ])

test(
  'backup v3 reserves three explicit and distinct cryptographic domains',
  () => {
    const domains = [
      'MA-CODE/MA-Professor/cloud-backup/v3/wrapping-key',
      'MA-CODE/MA-Professor/cloud-backup/v3/master-key-wrap',
      'MA-CODE/MA-Professor/cloud-backup/v3/data'
    ]

    for (
      const domain of
      domains
    ) {
      assert.match(
        cryptoSource,
        new RegExp(
          domain
            .replaceAll('/', '\\/')
            .replaceAll('-', '\\-')
        )
      )
    }

    assert.equal(
      new Set(
        domains
      ).size,
      domains.length
    )

    assert.match(
      cryptoSource,
      /info:\s*\n?\s*toArrayBuffer\([\s\S]*?MA_PROFESSOR_BACKUP_V3_KDF_CONTEXT/
    )

    assert.match(
      cryptoSource,
      /additionalData:\s*\n?\s*textEncoder\.encode\([\s\S]*?MA_PROFESSOR_BACKUP_V3_WRAP_AAD/
    )
  }
)

test(
  'OPAQUE session key is never exposed by the MA-Professor client adapter',
  () => {
    assert.doesNotMatch(
      opaqueClientSource,
      /\bsessionKey\b/
    )

    assert.match(
      opaqueClientSource,
      /return \{\s*finishLoginRequest:[\s\S]*?exportKey:/
    )
  }
)

test(
  'OPAQUE server verifies and discards its session key before creating the app session',
  () => {
    const start =
      opaqueProtocolSource
        .indexOf(
          'export function finishOpaqueLogin'
        )

    const end =
      opaqueProtocolSource
        .indexOf(
          'export function createFreshOpaqueAuthState',
          start
        )

    assert.ok(
      start >= 0 &&
      end > start
    )

    const finishSource =
      opaqueProtocolSource
        .slice(
          start,
          end
        )

    assert.match(
      finishSource,
      /runtime\s*\.finishServerLogin\(/
    )

    assert.doesNotMatch(
      finishSource,
      /\bsessionKey\b/
    )

    assert.match(
      finishSource,
      /return \{\s*email:[\s\S]*?deviceId:/
    )
  }
)

test(
  'OPAQUE export key never appears in production Worker TypeScript',
  async () => {
    const workerDirectory =
      new URL(
        'worker/',
        ROOT
      )

    const workerFiles =
      (
        await readdir(
          workerDirectory
        )
      )
        .filter(
          name =>
            name.endsWith(
              '.ts'
            )
        )

    for (
      const file of
      workerFiles
    ) {
      const source =
        await read(
          `worker/${file}`
        )

      assert.doesNotMatch(
        source,
        /\bexportKey\b/,
        `${file} não pode receber nem persistir a OPAQUE exportKey.`
      )
    }
  }
)

test(
  'application receives the OPAQUE export key only after server login or enrollment finishes',
  () => {
    const loginClientFinish =
      opaqueAccessSource
        .indexOf(
          'const clientFinish =',
          opaqueAccessSource
            .indexOf(
              'export async function loginMAProfessorOpaque'
            )
        )

    const loginServerFinish =
      opaqueAccessSource
        .indexOf(
          'await finishMAProfessorOpaqueLogin(',
          loginClientFinish
        )

    const loginReturn =
      opaqueAccessSource
        .indexOf(
          'return {',
          loginServerFinish
        )

    assert.ok(
      loginClientFinish >= 0 &&
      loginServerFinish >
        loginClientFinish &&
      loginReturn >
        loginServerFinish
    )

    const enrollmentStart =
      opaqueAccessSource
        .indexOf(
          'export async function enrollMAProfessorOpaqueForActivation'
        )

    const enrollmentServerFinish =
      opaqueAccessSource
        .indexOf(
          'await finishMAProfessorOpaqueEnrollment(',
          enrollmentStart
        )

    const enrollmentReturn =
      opaqueAccessSource
        .indexOf(
          'return {',
          enrollmentServerFinish
        )

    assert.ok(
      enrollmentStart >= 0 &&
      enrollmentServerFinish >
        enrollmentStart &&
      enrollmentReturn >
        enrollmentServerFinish
    )
  }
)

test(
  'backup v3 key derivation never consumes an OPAQUE session key or MP activation secret',
  () => {
    assert.doesNotMatch(
      cryptoSource,
      /\bsessionKey\b/
    )

    assert.doesNotMatch(
      cryptoSource,
      /activationPassword|MP-/
    )

    assert.match(
      cryptoSource,
      /deriveWrappingKey\(\s*exportKey:\s*string/
    )
  }
)
