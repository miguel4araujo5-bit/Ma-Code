import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path =>
  readFile(
    new URL(`../../${path}`, import.meta.url),
    'utf8'
  )

const compact = value =>
  value.replace(/\s+/g, ' ')

const [
  workerSource,
  clientSource,
  preferenceSource,
  authWorkerSource,
  accessApiSource
] = await Promise.all([
  read('worker/maProfessorCloudBackup.ts'),
  read('src/components/ma-professor/sync/cloudBackupService.ts'),
  read('src/components/ma-professor/sync/cloudBackupPreference.ts'),
  read('worker/maProfessorAccessAuthBridge.ts'),
  read('src/components/ma-professor/access/accessApi.ts')
])

const worker = compact(workerSource)
const client = compact(clientSource)
const preference = compact(preferenceSource)
const authWorker = compact(authWorkerSource)
const accessApi = compact(accessApiSource)

test(
  'v2 compatibility remains explicit while the v3 protection is active',
  () => {
    assert.match(
      worker,
      /const CRYPTO_VERSION = 2/
    )
    assert.doesNotMatch(worker, /function createSessionKey|ensureSessionProfile/)
    assert.match(worker, /handleInitializeV3/)
    assert.match(worker, /assertSessionProfile\(profile\)/)
    assert.match(
      worker,
      /recovery_wrapped_master_key/
    )
    assert.match(
      worker,
      /key: profile\.recovery_wrapped_master_key/
    )

    assert.match(
      client,
      /postJson\( '\/key', sessionBody\(session\)/
    )
    assert.match(
      client,
      /const keyResult = await readKey\(session\)/
    )
    assert.match(
      client,
      /subtle\.importKey\( 'raw',/
    )
    assert.match(
      client,
      /keyResult\.key/
    )

    assert.match(
      preference,
      /A MA-CODE não recebe a sua password pessoal nem guarda no servidor o material necessário para ler a cópia/
    )
    assert.doesNotMatch(
      preference,
      /proteção v[23]/
    )
  }
)



test(
  'v3 client preparation fails closed and stays local before promotion',
  () => {
    assert.match(
      client,
      /readMAProfessorOpaqueExportKey\( session\.email \)/
    )
    assert.match(
      client,
      /if \(!exportKey\) \{[\s\S]*?MAProfessorCloudBackupAuthenticationRequiredError/
    )

    const start = client.indexOf(
      'export async function prepareMAProfessorCloudBackupV3Promotion'
    )
    const end = client.indexOf(
      'export async function ',
      start + 20
    )
    const preparation = client.slice(
      start,
      end === -1
        ? client.length
        : end
    )

    assert.ok(start >= 0)
    assert.match(
      preparation,
      /zlibSync\(/
    )
    assert.match(
      preparation,
      /createMAProfessorBackupV3KeyMaterial\( exportKey \)/
    )
    assert.match(
      preparation,
      /encryptMAProfessorBackupV3Data\([\s\S]*?RECORD_ID/
    )
    assert.match(
      preparation,
      /decryptMAProfessorBackupV3Data\([\s\S]*?RECORD_ID/
    )
    assert.match(
      preparation,
      /if \(!validation\.valid\)/
    )
    assert.doesNotMatch(
      preparation,
      /postJson\(/
    )
    assert.doesNotMatch(
      preparation,
      /\/promote-v3/
    )
  }
)

test(
  'v3 promotion remains additive until the client migration is explicitly enabled',
  () => {
    assert.match(
      worker,
      /const V3_CRYPTO_VERSION = 3/
    )
    assert.match(
      worker,
      /case '\/promote-v3': return await handlePromoteV3\(body, env\)/
    )
    assert.match(
      client,
      /export async function promotePreparedMAProfessorCloudBackupV3/
    )
    assert.match(
      client,
      /postJson\( '\/promote-v3'/
    )
    assert.doesNotMatch(
      preference,
      /promotePreparedMAProfessorCloudBackupV3|prepareMAProfessorCloudBackupV3Promotion/
    )
    assert.match(
      client,
      /postJson\( '\/key', sessionBody\(session\)/
    )
    assert.match(
      client,
      /postJson\( '\/push'/
    )
  }
)

test(
  'public account flows no longer submit the personal password while backup v2 remains isolated',
  () => {
    assert.doesNotMatch(
      accessApi,
      /accountPassword/
    )
    assert.doesNotMatch(
      accessApi,
      /export async function loginMAProfessorAccess/
    )
    assert.match(
      authWorker,
      /O login legado foi descontinuado\. Utilize o login protegido\./
    )
    assert.match(
      authWorker,
      /O fluxo antigo de password pessoal foi descontinuado/
    )
  }
)
