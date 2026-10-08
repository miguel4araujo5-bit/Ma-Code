import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const EMAIL = 'backup-session@example.test'
const DEVICE_ID = 'fictitious-backup-device'
const INITIAL_TOKEN = 'fictitious-initial-session'
const clone = value => value === undefined ? undefined : structuredClone(value)

// Exercise the exported production chain, replacing only the cryptographic
// protocol with fictitious proofs. No account or external service is contacted.
const bundle = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
    contents: `
      export { MaProfessorAccessDurableObject } from './worker/maProfessorAccessRetentionBridge.ts';
      export { handleMAProfessorCloudBackupApiRequest } from './worker/maProfessorCloudBackup.ts';
      export { saveMAProfessorOpaqueExportKey, clearMAProfessorOpaqueExportKey } from './src/components/ma-professor/access/accessStorage.ts';
      export { uploadAndVerifyCompatibleMAProfessorCloudBackup, downloadCompatibleMAProfessorCloudBackup } from './src/components/ma-professor/sync/cloudBackupService.ts';
    `
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  plugins: [{
    name: 'fictitious-opaque-protocol',
    setup(builder) {
      builder.onLoad({ filter: /maProfessorOpaqueServerRuntime\.ts$/ }, () => ({
        loader: 'js',
        contents: `
          export async function getMAProfessorOpaqueServerRuntime() {
            return {
              createServerSetup: () => 'fake-setup',
              createServerRegistrationResponse: () => { throw new Error('Unexpected enrollment'); },
              startServerLogin: ({ registrationRecord, userIdentifier }) => ({
                serverLoginState: JSON.stringify({ registrationRecord, userIdentifier }),
                loginResponse: 'fake-response'
              }),
              finishServerLogin: ({ serverLoginState, finishLoginRequest }) => {
                if (JSON.parse(serverLoginState).registrationRecord !== 'fake-record' || finishLoginRequest !== 'fake-proof') {
                  throw new Error('Invalid fictitious proof');
                }
                return { sessionKey: 'fake-protocol-key' };
              }
            };
          }
        `
      }))
    }
  }]
})
const runtime = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
)
const { MaProfessorAccessDurableObject } = runtime

function createAccess() {
  const now = Date.now()
  const tokenHash = createHash('sha256').update(INITIAL_TOKEN).digest('base64')
  const values = new Map(Object.entries({
    'ma-professor-access-state-v1': {
      schemaVersion: 2,
      createdAt: now,
      updatedAt: now,
      licenses: {
        [EMAIL]: {
          email: EMAIL,
          plan: 'paid_30_days',
          validFrom: now - 60_000,
          validUntil: now + 10 * 86_400_000,
          revokedAt: null,
          renewalRequestedAt: null
        }
      },
      sessions: {
        [tokenHash]: {
          tokenHash,
          email: EMAIL,
          deviceId: DEVICE_ID,
          createdAt: now - 10_000,
          lastSeenAt: now - 1_000,
          revokedAt: null
        }
      },
      accessRequests: {},
      credentials: {},
      renewals: []
    },
    'ma-professor-opaque-auth-v1': {
      schemaVersion: 1,
      protocol: 'OPAQUE-RFC9807',
      serverSetup: 'fake-setup',
      registrations: {
        [EMAIL]: {
          email: EMAIL,
          registrationRecord: 'fake-record',
          createdAt: now,
          updatedAt: now,
          migratedFromV2At: null
        }
      },
      pendingEnrollments: {},
      pendingLogins: {},
      createdAt: now,
      updatedAt: now
    }
  }))
  const storage = {
    async get(key) { return clone(values.get(key)) },
    async put(key, value) {
      if (typeof key === 'string') values.set(key, clone(value))
      else for (const [entryKey, entryValue] of Object.entries(key)) values.set(entryKey, clone(entryValue))
    },
    async delete(key) { return values.delete(key) },
    async list() { return new Map([...values].map(([key, value]) => [key, clone(value)])) }
  }
  const access = new MaProfessorAccessDurableObject({
    storage,
    blockConcurrencyWhile: async callback => callback()
  }, {})
  const call = async (path, body) => {
    const response = await access.fetch(new Request('https://example.test/api/ma-professor/access' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }))
    return { status: response.status, body: await response.json() }
  }
  call.fetch = request => access.fetch(request)
  return call
}

async function confirmPassword(call, proof = 'fake-proof') {
  const start = await call('/opaque/login/start', {
    email: EMAIL, deviceId: DEVICE_ID, startLoginRequest: 'fake-start'
  })
  assert.equal(start.status, 200)
  return call('/opaque/login/finish', {
    email: EMAIL, deviceId: DEVICE_ID, loginId: start.body.loginId, finishLoginRequest: proof
  })
}

test('backup accepts a new password-confirmed session immediately on a warm Durable Object', async () => {
  const call = createAccess()
  assert.equal((await call('/verify', { token: INITIAL_TOKEN, deviceId: DEVICE_ID })).status, 200)
  const confirmed = await confirmPassword(call)
  assert.equal(confirmed.status, 200)
  assert.ok(confirmed.body.token)
  assert.equal((await call('/verify', { token: confirmed.body.token, deviceId: DEVICE_ID })).status, 200,
    'The backup must accept the new token without account verification or page reopening.')
  assert.equal((await call('/verify', { token: INITIAL_TOKEN, deviceId: DEVICE_ID })).status, 401,
    'The replaced session must remain unusable.')
  assert.equal((await call('/verify', { token: confirmed.body.token, deviceId: 'another-device' })).status, 401)
  const repeated = await confirmPassword(call)
  assert.equal(repeated.status, 200)
  assert.equal((await call('/verify', { token: repeated.body.token, deviceId: DEVICE_ID })).status, 200)
  assert.equal((await call('/verify', { token: confirmed.body.token, deviceId: DEVICE_ID })).status, 401)
})

test('a rejected password proof leaves the current backup session usable', async () => {
  const call = createAccess()
  assert.equal((await call('/verify', { token: INITIAL_TOKEN, deviceId: DEVICE_ID })).status, 200)
  const rejected = await confirmPassword(call, 'invalid-proof')
  assert.equal(rejected.status, 401)
  assert.equal(rejected.body.token, undefined)
  assert.equal((await call('/verify', { token: INITIAL_TOKEN, deviceId: DEVICE_ID })).status, 200)
})

test('password confirmation permits an encrypted upload and readback through the real backup Worker', async t => {
  const call = createAccess()
  assert.equal((await call('/verify', { token: INITIAL_TOKEN, deviceId: DEVICE_ID })).status, 200)
  const confirmed = await confirmPassword(call)
  assert.equal(confirmed.status, 200)

  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  const migrations = new URL('../../migrations/ma-professor/', import.meta.url)
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(await readFile(new URL(name, migrations), 'utf8'))
  }
  const binding = {
    prepare(sql) {
      let values = []
      return {
        bind(...args) { values = args; return this },
        async first() { return db.prepare(sql).get(...values) ?? null },
        async run() {
          const before = db.prepare('SELECT total_changes() AS n').get().n
          db.prepare(sql).run(...values)
          return { success: true, meta: { changes: Number(db.prepare('SELECT total_changes() AS n').get().n - before) } }
        }
      }
    },
    async batch(statements) {
      db.exec('BEGIN')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        db.exec('COMMIT')
        return results
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    }
  }
  const env = {
    MA_PROFESSOR_DB: binding,
    MA_PROFESSOR_ACCESS: { idFromName: name => name, get: () => ({ fetch: call.fetch }) }
  }
  t.mock.method(globalThis, 'fetch', (url, init) => runtime.handleMAProfessorCloudBackupApiRequest(
    new Request(new URL(url, 'https://ma-code.pt'), { ...init, headers: { ...init.headers, Origin: 'https://ma-code.pt' } }), env
  ))
  const session = { email: EMAIL, deviceId: DEVICE_ID, token: confirmed.body.token }
  runtime.saveMAProfessorOpaqueExportKey(EMAIL, Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString('base64url'))
  t.after(() => runtime.clearMAProfessorOpaqueExportKey())
  const keys = ['teacherProfiles', 'academicYears', 'groups', 'subjects', 'teachingAssignments', 'modules', 'students', 'assessmentSchemes', 'assessmentCriteria', 'planifications', 'planificationItems', 'weeklyScheduleSlots', 'schoolCalendarEvents', 'lessons', 'summarySuggestions', 'lessonAttendance', 'lessonAssessments', 'assessmentResults', 'moduleFinalGrades', 'learningRecoveries', 'settings', 'setupProgress']
  const backup = {
    product: 'ma-professor', schemaVersion: 1, exportedAt: new Date().toISOString(),
    data: Object.fromEntries(keys.map(key => [key, []]))
  }
  const saved = await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, { expectedServerRevision: 0 })
  assert.equal(saved.serverRevision, 1)
  assert.deepEqual((await runtime.downloadCompatibleMAProfessorCloudBackup(session)).backup, backup)
  assert.equal(db.prepare('SELECT count(*) AS n FROM ma_professor_encrypted_records').get().n, 1)
})
