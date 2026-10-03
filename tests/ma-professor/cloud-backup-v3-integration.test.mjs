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
    export * from './worker/maProfessorSync.ts';
  `, resolveDir: root }, bundle: true, write: false, format: 'esm', platform: 'node'
})
const runtime = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const session = { token: 'test-token', email: 'new-teacher@example.test', deviceId: 'device-a' }
const exportKey = Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString('base64url')
const keys = ['teacherProfiles', 'academicYears', 'groups', 'subjects', 'teachingAssignments', 'modules', 'students', 'assessmentSchemes', 'assessmentCriteria', 'planifications', 'planificationItems', 'weeklyScheduleSlots', 'schoolCalendarEvents', 'lessons', 'summarySuggestions', 'lessonAttendance', 'lessonAssessments', 'assessmentResults', 'moduleFinalGrades', 'learningRecoveries', 'settings', 'setupProgress']
const backup = { product: 'ma-professor', schemaVersion: 1, exportedAt: '2026-09-21T12:00:00Z', data: Object.fromEntries(keys.map(key => [key, []])) }
const cutoverSql = await readFile(new URL('../../migrations/ma-professor/0005_cloud_backup_v3_only.sql', import.meta.url), 'utf8')
const adminSource = await readFile(new URL('../../worker/maProfessorAccountAdmin.ts', import.meta.url), 'utf8')
const adminBundle = await build({
  stdin: { contents: `${adminSource}\nexport { deleteCloudAccountData };`, resolveDir: `${root}/worker`, loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node'
})
const adminRuntime = await import(`data:text/javascript;base64,${Buffer.from(adminBundle.outputFiles[0].text).toString('base64')}`)

function insertRow(db, table, row) {
  const columns = Object.keys(row)
  db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(row))
}

async function accountIdFor(email) {
  return 'account-' + Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ma-professor-account-v1:${email.trim().toLowerCase()}`))).toString('hex')
}

let fixtureTime = Date.parse('2026-10-03T12:00:00Z')

async function fixture(t, { cutover = true } = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: fixtureTime += 120_000 })
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  const migrations = new URL('../../migrations/ma-professor/', import.meta.url)
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    if (!cutover && name === '0005_cloud_backup_v3_only.sql') continue
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
  return { db, env, requests, post, advance: (ms = 30_000) => t.mock.timers.tick(ms), failRecord: value => { failRecord = value }, beforeBatch: callback => { beforeBatch = callback } }
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
  f.advance()
  const second = await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { expectedServerRevision: 1 })
  assert.equal(second.serverRevision, 2, 'real push-v3 response must satisfy the client parser')
  runtime.clearMAProfessorOpaqueExportKey()
  await assert.rejects(runtime.downloadCompatibleMAProfessorCloudBackup({ ...session, deviceId: 'device-b' }), runtime.MAProfessorCloudBackupAuthenticationRequiredError)
  runtime.saveMAProfessorOpaqueExportKey(session.email, exportKey)
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup({ ...session, deviceId: 'device-b' })).backup, backup)
  assert.equal((await f.post('/key', session)).status, 404)
  assert.equal((await f.post('/push', session)).status, 404)
  assert.equal((await f.post('/promote-v3', session)).status, 404)
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
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup(session)).backup, backup)
})

test('initialization validates session and envelope, and opt-out or lost export key prevents every write', async t => {
  const f = await fixture(t)
  const prepared = await runtime.prepareMAProfessorCloudBackupV3Promotion(session, backup)
  assert.equal((await f.post('/initialize-v3', { ...initialization(prepared), token: 'wrong-token' })).status, 401)
  assert.equal((await f.post('/initialize-v3', { ...initialization(prepared), profile: { ...prepared.profile, recoveryWrappedMasterKey: 'bad' } })).status, 400)
  let checks = 0
  await assert.rejects(runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { canUpload: () => ++checks === 1 }), /cancelada/)
  runtime.clearMAProfessorOpaqueExportKey()
  await assert.rejects(runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup), runtime.MAProfessorCloudBackupAuthenticationRequiredError)
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM ma_professor_sync_profiles').get().n, 0)
})

test('v3 concurrent updates return a typed 409 and preserve the winning ciphertext', async t => {
  const f = await fixture(t)
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  f.advance()
  f.beforeBatch(() => {
    f.db.exec('UPDATE ma_professor_encrypted_records SET server_revision = 2, record_revision = 2; UPDATE ma_professor_sync_profiles SET server_revision = 2;')
  })
  await assert.rejects(runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { expectedServerRevision: 1 }), runtime.MAProfessorCloudBackupRevisionConflictError)
  assert.equal(f.db.prepare('SELECT server_revision FROM ma_professor_sync_profiles').get().server_revision, 2)
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup(session)).backup, backup)
})

test('legacy v2 profiles are rejected and cannot be read, overwritten or promoted', async t => {
  // A database that has not yet applied the cutover must still fail closed.
  const f = await fixture(t, { cutover: false })
  const accountId = 'account-' + Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ma-professor-account-v1:${session.email}`))).toString('hex')
  const legacyKey = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
  f.db.prepare(`INSERT INTO ma_professor_sync_profiles VALUES (?,0,2,'SESSION-AUTH-V1','','{}','RAW-AES-256-GCM-SESSION-V1',?,'',1,1,NULL)`).run(accountId, legacyKey)

  await assert.rejects(runtime.inspectMAProfessorCloudBackup(session), /v3 atual/)
  await assert.rejects(runtime.downloadCompatibleMAProfessorCloudBackup(session), /v3 atual/)
  await assert.rejects(runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup), /v3 atual/)

  const prepared = await runtime.prepareMAProfessorCloudBackupV3Promotion(session, backup)
  assert.equal((await f.post('/initialize-v3', initialization(prepared))).status, 409)
  assert.equal((await f.post('/key', session)).status, 404)
  assert.equal((await f.post('/push', session)).status, 404)
  assert.equal((await f.post('/promote-v3', session)).status, 404)

  const profile = f.db.prepare('SELECT * FROM ma_professor_sync_profiles').get()
  assert.equal(profile.crypto_version, 2)
  assert.equal(profile.recovery_wrapped_master_key, legacyKey)
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM ma_professor_encrypted_records').get().n, 0)
  assert.equal(f.requests.some(r => /\/(key|push|promote-v3)$/.test(r.path)), false)
})

test('cutover removes legacy profiles and children but preserves every V3 profile, ciphertext and history byte', async t => {
  const f = await fixture(t, { cutover: false })
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  f.advance()
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { expectedServerRevision: 1 })
  const profile = f.db.prepare('SELECT * FROM ma_professor_sync_profiles').get()
  const record = f.db.prepare('SELECT * FROM ma_professor_encrypted_records').get()
  const history = f.db.prepare('SELECT * FROM ma_professor_encrypted_record_history').get()
  insertRow(f.db, 'ma_professor_sync_profiles', { ...profile, account_id: 'deleted-v3', deleted_at: 1 })
  const snapshot = () => ['ma_professor_sync_profiles', 'ma_professor_encrypted_records', 'ma_professor_encrypted_record_history']
    .map(table => f.db.prepare(`SELECT * FROM ${table} ORDER BY account_id, server_revision`).all())
  const preserved = snapshot()
  f.db.exec('PRAGMA foreign_keys = OFF')

  for (const [version, deletedAt] of [[1, null], [2, null], [2, 1]]) {
    const accountId = `legacy-${version}-${deletedAt}`
    insertRow(f.db, 'ma_professor_sync_profiles', {
      ...profile, account_id: accountId, crypto_version: version,
      recovery_kdf_algorithm: version === 1 ? 'PBKDF2-HMAC-SHA-256' : 'SESSION-AUTH-V1', deleted_at: deletedAt
    })
    insertRow(f.db, 'ma_professor_encrypted_records', { ...record, account_id: accountId, encryption_version: version })
    insertRow(f.db, 'ma_professor_encrypted_record_history', { ...history, account_id: accountId, encryption_version: version })
    insertRow(f.db, 'ma_professor_sync_devices', {
      account_id: accountId, device_id_hash: 'old-device', device_public_key: '{}', key_wrap_algorithm: 'RSA-OAEP-3072-SHA-256',
      wrapped_master_key: 'old-key', wrapped_master_key_nonce: '', created_at: 1, last_seen_at: 1, revoked_at: null
    })
  }
  // A former V2-to-V3 promotion can have left V2 history beneath a V3 profile.
  insertRow(f.db, 'ma_professor_encrypted_record_history', { ...history, server_revision: 9, encryption_version: 2 })
  f.db.exec(cutoverSql)
  assert.deepEqual(snapshot(), preserved)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ma_professor_sync_devices').get().n, 0)
  assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(), [])
  f.db.exec(cutoverSql)
  assert.deepEqual(snapshot(), preserved, 'Reapplying the cutover must leave V3 data unchanged.')
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup(session)).backup, backup)
})

test('D1 rejects old Worker INSERT, UPDATE and REPLACE writes after the cutover', async t => {
  const f = await fixture(t)
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  f.advance()
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  const profile = f.db.prepare('SELECT * FROM ma_professor_sync_profiles').get()
  const record = f.db.prepare('SELECT * FROM ma_professor_encrypted_records').get()
  const history = f.db.prepare('SELECT * FROM ma_professor_encrypted_record_history').get()
  for (const version of [1, 2]) {
    assert.throws(() => insertRow(f.db, 'ma_professor_sync_profiles', { ...profile, account_id: `legacy-${version}`, crypto_version: version }), /must use V3/)
    assert.throws(() => f.db.prepare('UPDATE ma_professor_sync_profiles SET crypto_version = ?').run(version), /must use V3/)
    assert.throws(() => f.db.prepare('INSERT OR REPLACE INTO ma_professor_sync_profiles SELECT account_id,server_revision,?,recovery_kdf_algorithm,recovery_kdf_salt,recovery_kdf_parameters,recovery_key_wrap_algorithm,recovery_wrapped_master_key,recovery_wrapped_master_key_nonce,created_at,updated_at,deleted_at FROM ma_professor_sync_profiles').run(version), /must use V3/)
    assert.throws(() => insertRow(f.db, 'ma_professor_encrypted_records', { ...record, record_id: `legacy-${version}`, encryption_version: version }), /must use V3/)
    assert.throws(() => f.db.prepare('UPDATE ma_professor_encrypted_records SET encryption_version = ?').run(version), /must use V3/)
    assert.throws(() => insertRow(f.db, 'ma_professor_encrypted_record_history', { ...history, server_revision: 9, encryption_version: version }), /must use V3/)
    assert.throws(() => f.db.prepare('UPDATE ma_professor_encrypted_record_history SET encryption_version = ?').run(version), /must use V3/)
  }
  assert.throws(() => f.db.exec("UPDATE ma_professor_sync_profiles SET recovery_kdf_algorithm='SESSION-AUTH-V1'"), /must use V3/)
  assert.throws(() => f.db.exec("UPDATE ma_professor_sync_profiles SET recovery_key_wrap_algorithm='RAW-AES-256-GCM-SESSION-V1'"), /must use V3/)
  assert.throws(() => f.db.exec("INSERT INTO ma_professor_sync_devices VALUES ('old','hash','{}','RSA','key','',1,1,NULL)"), /disabled/)
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_sync_profiles').get(), profile)
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_encrypted_records').get(), record)
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_encrypted_record_history').get(), history)
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup(session)).backup, backup)
})

test('legacy sync initialization returns 410 without consulting access or D1; read-only status remains compatible', async t => {
  const f = await fixture(t)
  const request = action => new Request(`https://ma-code.pt/api/ma-professor/sync/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://ma-code.pt' }, body: JSON.stringify(session)
  })
  const forbidden = () => { throw new Error('The retired endpoint must not access a binding.') }
  const result = await runtime.handleMAProfessorSyncApiRequest(request('initialize'), {
    MA_PROFESSOR_DB: { prepare: forbidden, batch: forbidden },
    MA_PROFESSOR_ACCESS: { idFromName: forbidden, get: forbidden }
  })
  assert.equal(result.status, 410)
  assert.equal((await result.json()).success, false)
  const empty = await (await runtime.handleMAProfessorSyncApiRequest(request('status'), f.env)).json()
  assert.equal(empty.profileExists, false)
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  const ready = await (await runtime.handleMAProfessorSyncApiRequest(request('status'), f.env)).json()
  assert.equal(ready.databaseReady, true)
  assert.equal(ready.profileExists, true)
  assert.equal(ready.cryptoVersion, 3)
  assert.equal(ready.serverRevision, 1)
})

test('a reused email blocked by V2 becomes a fresh V3 account after cleanup and survives reload and new-device download', async t => {
  const f = await fixture(t, { cutover: false })
  const accountId = await accountIdFor(session.email)
  f.db.prepare("INSERT INTO ma_professor_sync_profiles VALUES (?,0,2,'SESSION-AUTH-V1','','{}','RAW-AES-256-GCM-SESSION-V1','old-test-key','',1,1,NULL)").run(accountId)
  await assert.rejects(runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup), /v3 atual/)
  f.db.exec(cutoverSql)
  assert.equal((await runtime.inspectMAProfessorCloudBackup(session)).cryptoVersion, null)
  f.advance()
  const recreatedKey = Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString('base64url')
  runtime.saveMAProfessorOpaqueExportKey(session.email, recreatedKey)
  assert.equal((await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { expectedServerRevision: 0 })).serverRevision, 1)
  runtime.clearMAProfessorOpaqueExportKey()
  assert.equal((await runtime.inspectMAProfessorCloudBackup(session)).cryptoVersion, 3)
  await assert.rejects(runtime.downloadCompatibleMAProfessorCloudBackup({ ...session, deviceId: 'device-b' }), runtime.MAProfessorCloudBackupAuthenticationRequiredError)
  runtime.saveMAProfessorOpaqueExportKey(session.email, recreatedKey)
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup({ ...session, deviceId: 'device-b' })).backup, backup)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ma_professor_sync_profiles WHERE crypto_version <> 3').get().n, 0)
})

test('canonical account deletion removes cloud history even without cascades and permits the same email with a new key', async t => {
  const f = await fixture(t)
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  f.advance()
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  f.db.exec('PRAGMA foreign_keys = OFF')
  const otherProfile = { ...f.db.prepare('SELECT * FROM ma_professor_sync_profiles').get(), account_id: 'other-account' }
  const otherRecord = { ...f.db.prepare('SELECT * FROM ma_professor_encrypted_records').get(), account_id: 'other-account' }
  const otherHistory = { ...f.db.prepare('SELECT * FROM ma_professor_encrypted_record_history').get(), account_id: 'other-account' }
  insertRow(f.db, 'ma_professor_sync_profiles', otherProfile)
  insertRow(f.db, 'ma_professor_encrypted_records', otherRecord)
  insertRow(f.db, 'ma_professor_encrypted_record_history', otherHistory)
  const report = { id: 'teacher-report', account_id: await accountIdFor(session.email), contact_email: session.email, error_type: 'Falha técnica', app_version: 'test', screen: '/ma-professor', browser: 'Chromium', device: 'Desktop', occurred_at: '2026-10-03T12:00:00Z', message: '', status: 'new', internal_note: '', created_at: Date.now(), updated_at: Date.now() }
  const otherReport = { ...report, id: 'other-report', account_id: 'other-account', contact_email: 'other@example.test' }
  insertRow(f.db, 'ma_professor_problem_reports', report)
  insertRow(f.db, 'ma_professor_problem_reports', otherReport)
  await adminRuntime.deleteCloudAccountData(f.env, [session.email])
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_sync_profiles').all().map(row => ({ ...row })), [otherProfile])
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_encrypted_records').all().map(row => ({ ...row })), [otherRecord])
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_encrypted_record_history').all().map(row => ({ ...row })), [otherHistory])
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_problem_reports').all().map(row => ({ ...row })), [otherReport])
  assert.equal((await runtime.inspectMAProfessorCloudBackup(session)).cryptoVersion, null)
  f.advance()
  const recreatedKey = Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString('base64url')
  runtime.saveMAProfessorOpaqueExportKey(session.email, recreatedKey)
  assert.equal((await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { expectedServerRevision: 0 })).serverRevision, 1)
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup({ ...session, deviceId: 'device-b' })).backup, backup)
})

test('30-second upload interval is enforced by the server across devices without changing ciphertext or revisions', async t => {
  const f = await fixture(t)
  const prepared = await runtime.prepareMAProfessorCloudBackupV3Promotion(session, backup)
  assert.equal((await f.post('/initialize-v3', initialization(prepared))).status, 200)
  const before = f.db.prepare('SELECT * FROM ma_professor_encrypted_records').get()
  const body = { ...session, deviceId: 'device-b', recordId: 'database-v1', expectedServerRevision: 1, expectedRecordRevision: 1, encrypted: prepared.encrypted }
  const limited = await f.post('/push-v3', body)
  assert.equal(limited.status, 429)
  assert.equal((await limited.json()).retryAfterSeconds, 30)
  f.advance(29_999)
  assert.equal((await f.post('/push-v3', body)).status, 429)
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_encrypted_records').get(), before)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ma_professor_encrypted_record_history').get().n, 0)
  f.advance(1)
  assert.equal((await f.post('/push-v3', body)).status, 200)
  assert.equal(f.db.prepare('SELECT server_revision FROM ma_professor_sync_profiles').get().server_revision, 2)
})

test('online deletion requires APAGAR and the reviewed revisions; removes ciphertext/history and keeps protection for the next V3 copy', async t => {
  const f = await fixture(t)
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  f.advance()
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  const status = await runtime.inspectMAProfessorCloudBackup(session)
  const profile = f.db.prepare('SELECT * FROM ma_professor_sync_profiles').get()
  const body = { ...session, recordId: 'database-v1', expectedServerRevision: status.serverRevision, expectedRecordRevision: status.backup.recordRevision, confirmation: 'APAGAR' }
  assert.equal((await f.post('/delete-v3', { ...body, confirmation: 'apagar' })).status, 400)
  assert.equal((await f.post('/delete-v3', { ...body, token: 'wrong' })).status, 401)
  assert.equal((await f.post('/delete-v3', { ...body, expectedServerRevision: 1 })).status, 409)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ma_professor_encrypted_record_history').get().n, 1)
  const deleted = await runtime.deleteMAProfessorCloudBackup(session, status, 'APAGAR')
  assert.equal(deleted.backup.found, false)
  assert.equal(deleted.cryptoVersion, 3)
  assert.deepEqual(deleted.protection, status.protection)
  assert.equal(deleted.serverRevision, 3)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ma_professor_encrypted_records').get().n, 0)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ma_professor_encrypted_record_history').get().n, 0)
  assert.deepEqual({ ...f.db.prepare('SELECT * FROM ma_professor_sync_profiles').get(), server_revision: profile.server_revision }, { ...profile })
  assert.equal(await runtime.downloadCompatibleMAProfessorCloudBackup(session), null)
  f.advance()
  const saved = await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { expectedServerRevision: 3 })
  assert.equal(saved.serverRevision, 4)
  assert.equal(saved.recordRevision, 1)
  runtime.clearMAProfessorOpaqueExportKey()
  runtime.saveMAProfessorOpaqueExportKey(session.email, exportKey)
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup({ ...session, deviceId: 'device-b' })).backup, backup)
  assert.deepEqual((await runtime.inspectMAProfessorCloudBackup(session)).protection, status.protection)
})

test('a deletion prepared before another device saves never deletes the newer copy or its history', async t => {
  const f = await fixture(t)
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  const stale = await runtime.inspectMAProfessorCloudBackup(session)
  f.advance()
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  const records = f.db.prepare('SELECT * FROM ma_professor_encrypted_records').all()
  const history = f.db.prepare('SELECT * FROM ma_professor_encrypted_record_history').all()
  await assert.rejects(runtime.deleteMAProfessorCloudBackup(session, stale, 'APAGAR'), runtime.MAProfessorCloudBackupRevisionConflictError)
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_encrypted_records').all(), records)
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_encrypted_record_history').all(), history)
})

test('online deletion rolls back content and history if a D1 statement fails', async t => {
  const f = await fixture(t)
  await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup)
  const status = await runtime.inspectMAProfessorCloudBackup(session)
  const record = f.db.prepare('SELECT * FROM ma_professor_encrypted_records').get()
  f.db.exec("CREATE TRIGGER injected_delete_failure BEFORE UPDATE ON ma_professor_sync_profiles BEGIN SELECT RAISE(ABORT, 'injected'); END")
  await assert.rejects(runtime.deleteMAProfessorCloudBackup(session, status, 'APAGAR'))
  assert.deepEqual(f.db.prepare('SELECT * FROM ma_professor_encrypted_records').get(), record)
  assert.equal(f.db.prepare('SELECT server_revision FROM ma_professor_sync_profiles').get().server_revision, 1)
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
