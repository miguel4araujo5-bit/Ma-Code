import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../../', import.meta.url))
const bundle = await build({
  stdin: { contents: `
    export * from './src/components/ma-professor/sync/cloudBackupService.ts';
    export * from './src/components/ma-professor/access/accessStorage.ts';
    export * from './worker/maProfessorCloudBackup.ts';
  `, resolveDir: root }, bundle: true, write: false, format: 'esm', platform: 'node'
})
const runtime = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const session = { token: 'test-token', email: 'new-teacher@example.test', deviceId: 'device-a' }
const exportKey = Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString('base64url')
const keys = ['teacherProfiles', 'academicYears', 'groups', 'subjects', 'teachingAssignments', 'modules', 'students', 'assessmentSchemes', 'assessmentCriteria', 'planifications', 'planificationItems', 'weeklyScheduleSlots', 'schoolCalendarEvents', 'lessons', 'summarySuggestions', 'lessonAttendance', 'lessonAssessments', 'assessmentResults', 'moduleFinalGrades', 'learningRecoveries', 'settings', 'setupProgress']
const backup = { product: 'ma-professor', schemaVersion: 1, exportedAt: '2026-09-21T12:00:00Z', data: Object.fromEntries(keys.map(key => [key, []])) }

async function fixture(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  const migrations = new URL('../../migrations/ma-professor/', import.meta.url)
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(await readFile(new URL(name, migrations), 'utf8'))
  }
  const requests = []
  let failRecord = false
  let beforeBatch = null
  const binding = {
    prepare(sql) {
      let values = []
      return {
        bind(...bound) { values = bound; return this },
        async first() { return db.prepare(sql).get(...values) ?? null },
        async run() {
          if (failRecord && /INSERT INTO ma_professor_encrypted_records/.test(sql)) throw new Error('injected disk failure')
          return { success: true, meta: { changes: Number(db.prepare(sql).run(...values).changes) } }
        }
      }
    },
    async batch(statements) {
      if (beforeBatch) { const callback = beforeBatch; beforeBatch = null; callback() }
      db.exec('BEGIN')
      try { const results = []; for (const statement of statements) results.push(await statement.run()); db.exec('COMMIT'); return results }
      catch (error) { db.exec('ROLLBACK'); throw error }
    }
  }
  const env = { MA_PROFESSOR_DB: binding, MA_PROFESSOR_ACCESS: {
    idFromName: name => name,
    get: () => ({ fetch: async request => {
      const body = await request.json()
      return Response.json(body.token === session.token && body.deviceId.startsWith('device-')
        ? { success: true, license: { email: session.email, status: 'active' } }
        : { success: false }, { status: body.token === session.token ? 200 : 401 })
    } })
  } }
  const post = (path, body) => runtime.handleMAProfessorCloudBackupApiRequest(new Request(`https://ma-code.pt/api/ma-professor/cloud-backup${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://ma-code.pt' }, body: JSON.stringify(body)
  }), env)
  t.mock.method(globalThis, 'fetch', (url, init) => {
    const body = JSON.parse(init.body)
    requests.push({ path: url, body })
    return post(url.replace('/api/ma-professor/cloud-backup', ''), body)
  })
  runtime.saveMAProfessorOpaqueExportKey(session.email, exportKey)
  t.after(() => runtime.clearMAProfessorOpaqueExportKey())
  return { db, requests, post, failRecord: value => { failRecord = value }, beforeBatch: callback => { beforeBatch = callback } }
}

function initialization(prepared) {
  return { token: session.token, deviceId: session.deviceId, recordId: 'database-v1', expectedServerRevision: 0, expectedRecordRevision: 0, profile: prepared.profile, encrypted: prepared.encrypted }
}

test('new account: read-only empty status, first v3 backup, real Worker update and new-device recovery', async t => {
  const f = await fixture(t)
  const empty = await runtime.inspectMAProfessorCloudBackup(session)
  assert.equal(empty.cryptoVersion, null)
  assert.equal(empty.backup.found, false)
  assert.equal(await runtime.downloadCompatibleMAProfessorCloudBackup(session), null)
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM ma_professor_sync_profiles').get().n, 0)
  const first = await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { expectedServerRevision: 0 })
  assert.equal(first.serverRevision, 1)
  assert.equal((await runtime.inspectMAProfessorCloudBackup(session)).cryptoVersion, 3)
  const second = await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { expectedServerRevision: 1 })
  assert.equal(second.serverRevision, 2, 'real push-v3 response must satisfy the client parser')
  runtime.clearMAProfessorOpaqueExportKey()
  await assert.rejects(runtime.downloadCompatibleMAProfessorCloudBackup({ ...session, deviceId: 'device-b' }), runtime.MAProfessorCloudBackupAuthenticationRequiredError)
  runtime.saveMAProfessorOpaqueExportKey(session.email, exportKey)
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup({ ...session, deviceId: 'device-b' })).backup, backup)
  assert.equal((await f.post('/key', session)).status, 409)
  assert.equal(f.requests.some(r => /\/(key|push|promote-v3)$/.test(r.path)), false)
  for (const request of f.requests) {
    assert.equal(JSON.stringify(request).includes(exportKey), false)
    assert.equal(JSON.stringify(request).includes('teacherProfiles'), false)
  }
  const profile = f.db.prepare('SELECT * FROM ma_professor_sync_profiles').get()
  assert.equal(Buffer.from(profile.recovery_wrapped_master_key, 'base64url').length, 48)
  assert.equal(JSON.stringify(profile).includes(exportKey), false)
})

test('first-copy failures roll back the profile; concurrent initialization cannot overwrite either record', async t => {
  const f = await fixture(t)
  const a = await runtime.prepareMAProfessorCloudBackupV3Promotion(session, backup)
  const b = await runtime.prepareMAProfessorCloudBackupV3Promotion(session, backup)
  f.failRecord(true)
  assert.equal((await f.post('/initialize-v3', initialization(a))).status, 500)
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM ma_professor_sync_profiles').get().n, 0)
  f.failRecord(false)
  const results = await Promise.all([f.post('/initialize-v3', initialization(a)), f.post('/initialize-v3', initialization(b))])
  // D1 serializes transactions; the adapter runs synchronous SQL between awaits.
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup(session)).backup, backup)
})

test('initialization validates session and envelope, and opt-out or lost export key prevents every write', async t => {
  const f = await fixture(t)
  const prepared = await runtime.prepareMAProfessorCloudBackupV3Promotion(session, backup)
  assert.equal((await f.post('/initialize-v3', { ...initialization(prepared), token: 'wrong-token' })).status, 401)
  assert.equal((await f.post('/initialize-v3', { ...initialization(prepared), profile: { ...prepared.profile, recoveryWrappedMasterKey: 'bad' } })).status, 400)
  let checks = 0
  await assert.rejects(runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { canUpload: () => ++checks === 1 }), /desativada/)
  runtime.clearMAProfessorOpaqueExportKey()
  await assert.rejects(runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup), runtime.MAProfessorCloudBackupAuthenticationRequiredError)
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM ma_professor_sync_profiles').get().n, 0)
})

test('v3 concurrent updates return a typed 409 and preserve the winning ciphertext', async t => {
  const f = await fixture(t)
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  // The revision changes after the client's status read, at the Worker batch boundary.
  f.beforeBatch(() => {
    f.db.exec('UPDATE ma_professor_encrypted_records SET server_revision = 2, record_revision = 2; UPDATE ma_professor_sync_profiles SET server_revision = 2;')
  })
  await assert.rejects(runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { expectedServerRevision: 1 }), runtime.MAProfessorCloudBackupRevisionConflictError)
  assert.equal(f.db.prepare('SELECT server_revision FROM ma_professor_sync_profiles').get().server_revision, 2)
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup(session)).backup, backup)
})

test('existing v2 stays readable and writable until explicit migration; the old server key is removed', async t => {
  const f = await fixture(t)
  const accountId = 'account-' + Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ma-professor-account-v1:${session.email}`))).toString('hex')
  const legacyKey = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
  f.db.prepare(`INSERT INTO ma_professor_sync_profiles VALUES (?,0,2,'SESSION-AUTH-V1','','{}','RAW-AES-256-GCM-SESSION-V1',?,'',1,1,NULL)`).run(accountId, legacyKey)
  const first = await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  assert.equal(first.serverRevision, 1)
  assert.equal((await runtime.inspectMAProfessorCloudBackup(session)).cryptoVersion, 2)
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup(session)).backup, backup)
  assert.equal((await f.post('/initialize-v3', initialization(await runtime.prepareMAProfessorCloudBackupV3Promotion(session, backup)))).status, 409)
  const migrated = await runtime.migrateMAProfessorCloudBackupV2ToV3(session)
  assert.deepEqual(migrated.backup, backup)
  assert.equal((await runtime.inspectMAProfessorCloudBackup(session)).cryptoVersion, 3)
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM ma_professor_sync_profiles').get()).includes(legacyKey), false)
  assert.equal((await f.post('/key', session)).status, 409)
  assert.equal((await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)).serverRevision, 3)
})

test('cloud authentication failures identify the originating session and preserve renewed credentials', async t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const target = new EventTarget()
  target.CustomEvent = CustomEvent
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target })
  t.after(() => {
    runtime.clearMAProfessorAccessSession()
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else delete globalThis.window
  })
  const notifications = []
  target.addEventListener(runtime.MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT, event => notifications.push(event.detail))
  const rejected = () => Response.json({ message: 'A sessão já não é válida.' }, { status: 401 })
  const renewed = { ...session, token: 'renewed-token' }
  runtime.saveMAProfessorAccessSession(session)
  runtime.saveMAProfessorOpaqueExportKey(session.email, exportKey)

  t.mock.method(globalThis, 'fetch', async () => rejected())
  await assert.rejects(runtime.inspectMAProfessorCloudBackup(session), runtime.MAProfessorCloudBackupAuthenticationRequiredError)
  assert.deepEqual(notifications, [session], 'The notification must identify the request session, not just the account.')

  notifications.length = 0
  let release
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { release = resolve }))
  const pending = runtime.inspectMAProfessorCloudBackup(session)
  runtime.saveMAProfessorAccessSession(renewed)
  release(rejected())
  await assert.rejects(pending, runtime.MAProfessorCloudBackupAuthenticationRequiredError)
  assert.deepEqual(notifications, [session], 'A late failure must retain its old token so the UI can ignore it.')
  assert.equal(runtime.readMAProfessorAccessSession().token, renewed.token)
  assert.equal(runtime.readMAProfessorOpaqueExportKey(session.email), exportKey)

  notifications.length = 0
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Serviço indisponível.' }, { status: 503 }))
  await assert.rejects(runtime.inspectMAProfessorCloudBackup(renewed), /Serviço indisponível/)
  assert.deepEqual(notifications, [], 'A service failure must not be treated as a wrong password.')
})
