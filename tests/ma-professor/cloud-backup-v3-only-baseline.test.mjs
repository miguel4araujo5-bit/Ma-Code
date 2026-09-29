import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../../', import.meta.url))
const read = path => readFile(join(root, path), 'utf8')
const compact = value => value.replace(/\s+/g, ' ')

const client = compact(await read('src/components/ma-professor/sync/cloudBackupService.ts'))
const worker = compact(await read('worker/maProfessorCloudBackup.ts'))

async function walk(directory) {
  const entries = await readdir(directory)
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry)
    const info = await stat(path)
    if (info.isDirectory()) files.push(...await walk(path))
    else if (/\.(ts|tsx)$/.test(entry)) files.push(path)
  }
  return files
}

test('client cloud backup service contains only v3 crypto and routes', () => {
  assert.match(client, /const CRYPTO_VERSION = 3 as const/)
  assert.match(client, /'\/initialize-v3'/)
  assert.match(client, /'\/push-v3'/)
  assert.match(client, /downloadMAProfessorCloudBackupV3/)
  assert.doesNotMatch(client, /postJson\( '\/key'/)
  assert.doesNotMatch(client, /postJson\( '\/push'/)
  assert.doesNotMatch(client, /'\/promote-v3'/)
  assert.doesNotMatch(client, /cryptoVersion === 2/)
  assert.doesNotMatch(client, /const CRYPTO_VERSION = 2/)
  assert.doesNotMatch(client, /migrateMAProfessorCloudBackupV2ToV3/)
  assert.doesNotMatch(client, /export async function downloadMAProfessorCloudBackup\(/)
  assert.doesNotMatch(client, /export async function uploadAndVerifyMAProfessorCloudBackup\(/)
})

test('server cloud backup worker exposes only v3 routes', () => {
  assert.match(worker, /const CRYPTO_VERSION = 3/)
  assert.match(worker, /case '\/initialize-v3'/)
  assert.match(worker, /case '\/push-v3'/)
  assert.doesNotMatch(worker, /case '\/key'/)
  assert.doesNotMatch(worker, /case '\/push'/)
  assert.doesNotMatch(worker, /case '\/promote-v3'/)
  assert.doesNotMatch(worker, /async function handleKey/)
  assert.doesNotMatch(worker, /async function handlePush\b/)
  assert.doesNotMatch(worker, /async function handlePromoteV3/)
  assert.doesNotMatch(worker, /const CRYPTO_VERSION = 2/)
  assert.doesNotMatch(worker, /SESSION_KEY_MARKER|RAW-AES-256-GCM-SESSION-V1|SESSION-AUTH-V1/)
})

test('production MA-Professor code has no remaining legacy v2 cloud backup references', async () => {
  const sourceRoot = join(root, 'src/components/ma-professor')
  const files = await walk(sourceRoot)
  const forbidden = /migrateMAProfessorCloudBackupV2ToV3|promotePreparedMAProfessorCloudBackupV3|downloadMAProfessorCloudBackup\(?!V3\)|uploadAndVerifyMAProfessorCloudBackup\(?!V3\)|cryptoVersion\s*===\s*2/

  for (const path of files) {
    const source = await readFile(path, 'utf8')
    assert.doesNotMatch(source, forbidden, path)
  }
})
