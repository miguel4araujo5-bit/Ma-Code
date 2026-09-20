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
  'v2 baseline remains explicit until the password-protected v3 migration is implemented',
  () => {
    assert.match(
      worker,
      /const CRYPTO_VERSION = 2/
    )
    assert.match(
      worker,
      /function createSessionKey\(\)/
    )
    assert.match(
      worker,
      /const sessionKey = createSessionKey\(\)/
    )
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
      /a chave é gerida pelos servidores da MA-CODE, que têm capacidade técnica para decifrar a cópia/
    )
  }
)

test(
  'v3 must change authentication as well as backup key storage because the current public flows submit the personal password',
  () => {
    assert.match(
      accessApi,
      /body\.accountPassword = accountPassword/
    )
    assert.match(
      accessApi,
      /postJson<MAProfessorAccessResponse>\( '\/login', \{ email, password, deviceId \}/
    )
    assert.match(
      authWorker,
      /const password = normalizePassword\( body\.password \)/
    )
    assert.match(
      authWorker,
      /verifyAccountPassword\( credential, password \)/
    )
  }
)
