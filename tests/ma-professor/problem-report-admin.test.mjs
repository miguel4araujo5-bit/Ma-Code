import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../../', import.meta.url))
const bundle = await build({ stdin: { resolveDir: root, contents: `
  export * from './worker/maProfessorProblemReport.ts';
  export * from './worker/maProfessorAdminSupport.ts';
` }, bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'existing-admin-session', setup(builder) {
  builder.onResolve({ filter: /maProfessorAdminAtomicApproval$/ }, () => ({ path: 'admin-session', namespace: 'fixture' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
    export const isMAProfessorAdminApiPath = () => true;
    export const handleMAProfessorAdminApiRequest = async request => Response.json({success: request.headers.get('Cookie') === 'test-admin'}, {status: request.headers.get('Cookie') === 'test-admin' ? 200 : 401});
  ` }))
} }] })
const runtime = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const draft = { error: 'Falha ao guardar a cópia online V3', version: 'index-test.js', screen: 'settings?token=SECRET#private', browser: 'Safari', device: 'iPhone', occurredAt: '2026-10-03T20:00:00Z', message: 'Não consegui guardar.' }

async function fixture(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  for (const name of (await readdir(`${root}/migrations/ma-professor`)).filter(name => name.endsWith('.sql')).sort()) db.exec(await readFile(`${root}/migrations/ma-professor/${name}`, 'utf8'))
  const writes = []
  const binding = { prepare(sql) {
    let args = []
    return { bind(...values) { args = values; return this },
      async run() { writes.push({ sql, args }); return { success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } } },
      async all() { return { success: true, results: db.prepare(sql).all(...args) } }
    }
  } }
  const env = { MA_PROFESSOR_DB: binding, MA_PROFESSOR_ACCESS: {
    idFromName: name => name, get: () => ({ fetch: async request => {
      const body = await request.json()
      return Response.json(body.token === 'valid-session' && body.deviceId === 'device-a' ? { success: true, license: { email: 'teacher@example.test' } } : { success: false }, { status: body.token === 'valid-session' ? 200 : 401 })
    } })
  } }
  t.mock.method(console, 'error', () => {})
  const report = body => runtime.handleMAProfessorProblemReportApiRequest(new Request('https://ma-code.pt/api/ma-professor/problem-report', {
    method: 'POST', headers: { Origin: 'https://ma-code.pt', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.8' }, body: JSON.stringify(body)
  }), env)
  const admin = (path = '', body, { auth = true, origin = 'https://ma-code.pt' } = {}) => runtime.handleMAProfessorAdminApiRequest(new Request(`https://ma-code.pt/api/admin/ma-professor/problem-reports${path}`, {
    method: body ? 'POST' : 'GET', headers: { Cookie: auth ? 'test-admin' : '', Origin: origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {})
  }), env)
  return { db, env, report, admin, writes }
}

test('reviewed diagnostic persists with verified contact; caller-supplied account, school data and credentials are excluded', async t => {
  const f = await fixture(t)
  const response = await f.report({ ...draft, session: { token: 'valid-session', deviceId: 'device-a' }, email: 'forged@example.test', accountId: 'forged', students: ['PRIVATE_STUDENT'], exportKey: 'PRIVATE_KEY', internalNote: 'FORGED_NOTE' })
  assert.equal(response.status, 200)
  const row = f.db.prepare('SELECT * FROM ma_professor_problem_reports').get()
  assert.equal(row.contact_email, 'teacher@example.test')
  assert.match(row.account_id, /^account-[a-f0-9]{64}$/)
  assert.equal(row.screen, 'settings')
  assert.equal(row.device, 'iPhone')
  assert.equal(row.status, 'new')
  assert.equal(row.internal_note, '')
  assert.doesNotMatch(JSON.stringify(row), /valid-session|device-a|PRIVATE_STUDENT|PRIVATE_KEY|forged|SECRET|FORGED_NOTE/)
  assert.equal((await response.json()).reports, undefined)
})

test('failed or absent session still allows diagnostics but never associates a forged identity', async t => {
  const f = await fixture(t)
  assert.equal((await f.report({ ...draft, session: { token: 'expired', deviceId: 'device-a' }, email: 'forged@example.test' })).status, 200)
  const row = f.db.prepare('SELECT * FROM ma_professor_problem_reports').get()
  assert.equal(row.contact_email, null)
  assert.equal(row.account_id, null)
})

test('Admin authentication and origin protection precede report access; states and resolution notes are private and persistent', async t => {
  const f = await fixture(t)
  await f.report(draft)
  const row = f.db.prepare('SELECT * FROM ma_professor_problem_reports').get()
  assert.equal((await f.admin('', undefined, { auth: false })).status, 401)
  assert.equal((await f.admin('/update', { id: row.id, status: 'resolved', internalNote: 'Private resolution' }, { origin: 'https://evil.example' })).status, 403)
  assert.equal(f.db.prepare('SELECT status FROM ma_professor_problem_reports').get().status, 'new')
  assert.equal((await f.admin('/update', { id: row.id, status: 'closed', internalNote: 'bad' })).status, 400)
  assert.equal((await f.admin('/update', { id: row.id, status: 'in_review', internalNote: 'Investigação interna' })).status, 200)
  let saved = (await (await f.admin()).json()).reports[0]
  assert.equal(saved.status, 'in_review')
  assert.equal(saved.internal_note, 'Investigação interna')
  assert.equal((await f.admin('/update', { id: row.id, status: 'resolved', internalNote: 'Resolvido no suporte' })).status, 200)
  saved = (await (await f.admin()).json()).reports[0]
  assert.equal(saved.status, 'resolved')
  assert.equal(saved.internal_note, 'Resolvido no suporte')
  assert.equal((await f.admin('/update', { id: 'missing', status: 'new', internalNote: '' })).status, 404)
})

test('report storage failure is visible; rate-limited reports do not create a diagnostic row', async t => {
  const f = await fixture(t)
  f.db.exec("CREATE TRIGGER reject_report BEFORE INSERT ON ma_professor_problem_reports BEGIN SELECT RAISE(ABORT, 'disk failure'); END")
  assert.equal((await f.report(draft)).status, 503)
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM ma_professor_problem_reports').get().n, 0)
  f.db.exec('DROP TRIGGER reject_report')
  for (let i = 0; i < 7; i++) assert.equal((await f.report(draft)).status, 200)
  assert.equal((await f.report(draft)).status, 429)
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM ma_professor_problem_reports').get().n, 7)
})

test('before migration the existing email delivery remains available and never claims success if delivery fails', async t => {
  const f = await fixture(t)
  f.db.exec('DROP TABLE ma_professor_problem_reports')
  f.env.RESEND_API_KEY_MA_PROFESSOR = 'test-mail-key'
  const deliveries = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    deliveries.push({ url, body: JSON.parse(init.body) })
    return Response.json({ success: true })
  })
  assert.equal((await f.report({ ...draft, session: { token: 'valid-session', deviceId: 'device-a' }, students: ['PRIVATE_STUDENT'], exportKey: 'PRIVATE_KEY' })).status, 200)
  assert.equal(deliveries.length, 1)
  assert.match(deliveries[0].body.text, /Dispositivo: iPhone/)
  assert.doesNotMatch(JSON.stringify(deliveries), /valid-session|device-a|PRIVATE_STUDENT|PRIVATE_KEY/)
  assert.equal((await f.admin()).status, 503)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: false }, { status: 503 }))
  assert.equal((await f.report(draft)).status, 503)
})
