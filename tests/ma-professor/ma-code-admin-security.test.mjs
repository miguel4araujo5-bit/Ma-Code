import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const compiled = await build({ stdin: { resolveDir: root, contents: `
  export { handleMaCodeAdminApiRequest as api } from './worker/maCodeAdmin';
  export { MaProfessorAccessDurableObject as AccessObject } from './worker/maProfessorAccessRetentionBridge';
  export { handleMAProfessorAccessApiRequest as publicAccess } from './worker/maProfessorAccess';
  export { handleMAProfessorAdminApiRequest as professorAdmin } from './worker/maProfessorAdminSupport';
  export { handleMAProfessorAccountAdminApiRequest as accountAdmin } from './worker/maProfessorAccountAdmin';
` }, bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', loader: { '.wasm': 'binary' } })
const loaded = { exports: {} }
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports)
const rt = loaded.exports
const PASSWORD = 'FictitiousAdminPassword123'
const SECRET = 'fictitious-local-admin-secret-at-least-32-characters'
const PREFIX = 'ma-code-admin-security:'
const START = Date.UTC(2026, 10, 3, 8)
const realNow = Date.now
let now
test.beforeEach(() => { now = START; Date.now = () => now })
test.after(() => { Date.now = realNow })

class Storage {
  values = new Map()
  writes = []
  deletes = []
  lists = []
  failPut = false
  failGet = false
  failList = false
  async get(key) {
    if (this.failGet && key.startsWith(PREFIX)) throw new Error('Injected read failure')
    return structuredClone(this.values.get(key))
  }
  async put(key, value) {
    if (this.failPut && key.startsWith(PREFIX)) throw new Error('Injected write failure')
    if (typeof key === 'object') { for (const [name, entry] of Object.entries(key)) await this.put(name, entry); return }
    this.writes.push(key); this.values.set(key, structuredClone(value))
  }
  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) { this.deletes.push(key); this.values.delete(key) }
  }
  async list(options) {
    if (this.failList) throw new Error('Injected cleanup failure')
    this.lists.push(options)
    return new Map([...this.values].filter(([key]) => key.startsWith(options.prefix) && (!options.startAfter || key > options.startAfter))
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).slice(0, options.limit).map(([key, value]) => [key, structuredClone(value)]))
  }
}

function request(action, { password, cookie, ip = '192.0.2.1', headers = {}, method, body } = {}) {
  return new Request(`https://ma-code.pt/api/admin/${action}`, {
    method: method ?? (action === 'session' ? 'GET' : 'POST'),
    headers: { Origin: 'https://ma-code.pt', 'Content-Type': 'application/json',
      ...(ip === null ? {} : { 'CF-Connecting-IP': ip }), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    ...(password !== undefined ? { body: JSON.stringify({ password }) } : body !== undefined ? { body } : {})
  })
}

async function harness() {
  const storage = new Storage()
  const pending = []
  let object
  const env = { MA_CODE_ADMIN_PASSWORD: PASSWORD, MA_CODE_ADMIN_SESSION_SECRET: SECRET,
    MA_PROFESSOR_ACCESS: { idFromName(name) { assert.equal(name, 'ma-professor-access-global'); return name },
      get() { return { fetch(req) { return object.fetch(req) } } } } }
  async function restart() {
    object = new rt.AccessObject({ storage, blockConcurrencyWhile(fn) { const p = fn(); pending.push(p); return p } }, env)
    await Promise.all(pending.splice(0))
  }
  await restart()
  return { storage, env, restart,
    call: (action, options) => rt.api(request(action, options), env),
    async login(options = {}) {
      const response = await rt.api(request('login', { password: PASSWORD, ...options }), env)
      assert.equal(response.status, 200, await response.clone().text())
      return response.headers.get('set-cookie').split(';')[0]
    }, object: () => object }
}

test('logout revokes only that cookie, persists across object restart, and covers both administrative consumers', async () => {
  const h = await harness()
  const first = await h.login(), second = await h.login()
  assert.equal((await h.call('session', { cookie: first })).status, 200)
  const logout = await h.call('logout', { cookie: first })
  assert.equal(logout.status, 200)
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
  await h.restart()
  assert.equal((await h.call('session', { cookie: first })).status, 401)
  assert.equal((await h.call('session', { cookie: second })).status, 200)
  assert.equal((await h.call('logout', { cookie: first })).status, 200)
  for (const [handler, path, method] of [[rt.professorAdmin, '/api/admin/ma-professor/requests', 'GET'], [rt.accountAdmin, '/api/admin/ma-professor/accounts', 'POST']]) {
    const response = await handler(new Request(`https://ma-code.pt${path}`, { method, headers: { Cookie: first, Origin: 'https://ma-code.pt' } }), h.env)
    assert.equal(response.status, 401)
  }
})

test('twenty concurrent failures admit exactly five failed attempts, while a different origin and open session remain usable', async () => {
  const h = await harness(), cookie = await h.login()
  const responses = await Promise.all(Array.from({ length: 20 }, () => h.call('login', { password: 'wrong' })))
  assert.equal(responses.filter(r => r.status === 401).length, 5)
  assert.equal(responses.filter(r => r.status === 429).length, 15)
  assert.equal((await h.call('login', { password: PASSWORD })).status, 429)
  assert.equal((await h.call('session', { cookie })).status, 200)
  await h.login({ ip: '192.0.2.2' })
})

test('the five-minute pause never extends or writes during retries, survives restart and resets its old failures', async () => {
  const h = await harness()
  for (let i = 0; i < 5; i++) assert.equal((await h.call('login', { password: 'wrong' })).status, 401)
  const key = [...h.storage.values.keys()].find(key => key.startsWith(`${PREFIX}attempt:`))
  const initial = structuredClone(h.storage.values.get(key))
  const writes = h.storage.writes.length, deletes = h.storage.deletes.length
  now += 299_000
  await h.restart()
  for (const password of ['wrong', PASSWORD]) {
    const response = await h.call('login', { password })
    assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '1')
  }
  assert.deepEqual(h.storage.values.get(key), initial)
  assert.equal(h.storage.writes.length, writes); assert.equal(h.storage.deletes.length, deletes)
  now += 1000
  assert.equal((await h.call('login', { password: 'wrong' })).status, 401)
  assert.equal(h.storage.values.get(key).count, 1)
  assert.equal(h.storage.values.get(key).blockedUntil, null)
  await h.login()
  assert.equal(h.storage.values.has(key), false)
})

test('failure windows expire after fifteen minutes and successful login clears only its origin counter', async () => {
  const h = await harness()
  for (let i = 0; i < 4; i++) await h.call('login', { password: 'wrong' })
  await h.call('login', { password: 'wrong', ip: '192.0.2.2' })
  now += 15 * 60_000
  assert.equal((await h.call('login', { password: 'wrong' })).status, 401)
  await h.login()
  for (let i = 0; i < 4; i++) assert.equal((await h.call('login', { password: 'wrong' })).status, 401)
  const other = [...h.storage.values].filter(([key]) => key.startsWith(`${PREFIX}attempt:`))
  assert.ok(other.some(([, value]) => value.count === 4))
})

test('IPv6 equivalent forms share a counter, Pseudo IPv4 uses the real IPv6, and missing headers cannot create a global block', async () => {
  const h = await harness()
  for (let i = 0; i < 5; i++) await h.call('login', { password: 'wrong', ip: '2001:0db8:0:0:0:0:0:1' })
  assert.equal((await h.call('login', { password: PASSWORD, ip: '2001:db8::1' })).status, 429)
  assert.equal((await h.call('login', { password: PASSWORD, ip: '240.0.0.1', headers: { 'CF-Connecting-IPv6': '2001:db8::1' } })).status, 429)
  await h.login({ ip: '240.0.0.1', headers: { 'CF-Connecting-IPv6': '2001:db8::2' } })
  for (let i = 0; i < 5; i++) await h.call('login', { password: 'wrong' })
  assert.equal((await h.call('login', { password: PASSWORD, headers: { 'CF-Connecting-IPv6': '2001:db8::99' } })).status, 429)
  const before = structuredClone([...h.storage.values])
  for (const ip of [null, 'invalid', '1.2.3.999']) {
    assert.equal((await h.call('login', { password: PASSWORD, ip, headers: { 'X-Forwarded-For': '192.0.2.7', 'CF-Connecting-IPv6': '2001:db8::99' } })).status, 503)
  }
  assert.deepEqual([...h.storage.values], before)
  const serialized = JSON.stringify([...h.storage.values])
  for (const sensitive of [PASSWORD, SECRET, '2001:', '192.0.2.']) assert.ok(!serialized.includes(sensitive))
})

test('storage failure denies verification and does not claim logout; recovery permits a real logout retry', async () => {
  const h = await harness(), cookie = await h.login()
  h.storage.failPut = true
  const failed = await h.call('logout', { cookie })
  assert.equal(failed.status, 503); assert.equal(failed.headers.get('set-cookie'), null)
  h.storage.failPut = false
  h.storage.failGet = true
  assert.equal((await h.call('session', { cookie })).status, 503)
  h.storage.failGet = false
  assert.equal((await h.call('session', { cookie })).status, 200)
  assert.equal((await h.call('logout', { cookie })).status, 200)
  assert.equal((await h.call('session', { cookie })).status, 401)
  const missing = { ...h.env, MA_PROFESSOR_ACCESS: undefined }
  assert.equal((await rt.api(request('login', { password: PASSWORD }), missing)).status, 503)
})

test('cleanup is bounded, continues after restarts and never evicts live revocations or teacher state', async () => {
  const h = await harness()
  const teacherState = structuredClone([...h.storage.values].filter(([key]) => !key.startsWith('ma-code-admin')))
  for (let i = 0; i < 90; i++) h.storage.values.set(`${PREFIX}revoked:${String(i).padStart(43, '0')}`, { expiresAt: i % 2 ? now - 1 : now + 60 * 60_000 })
  for (let i = 0; i < 5; i++) { now += 61_000; await h.restart(); await h.login() }
  assert.equal([...h.storage.values].filter(([key, value]) => key.startsWith(PREFIX) && value.expiresAt < now).length, 0)
  assert.equal([...h.storage.values].filter(([key]) => key.startsWith(`${PREFIX}revoked:`)).length, 45)
  assert.ok(h.storage.lists.every(options => options.limit === 32))
  assert.deepEqual([...h.storage.values].filter(([key]) => !key.startsWith('ma-code-admin')), teacherState)
})

test('cleanup failures do not invalidate a durable logout and invalid/expired tokens remain rejected', async () => {
  const h = await harness(), cookie = await h.login()
  h.storage.failList = true; now += 61_000
  assert.equal((await h.call('logout', { cookie })).status, 200)
  assert.equal((await h.call('session', { cookie })).status, 401)
  assert.equal((await h.call('session', { cookie: `${cookie}tampered` })).status, 401)
  const second = await h.login()
  now += 12 * 60 * 60_000
  assert.equal((await h.call('session', { cookie: second })).status, 401)
})

test('CSRF/method protection and public routes never expose the internal security operations', async () => {
  const h = await harness(), cookie = await h.login()
  const before = structuredClone([...h.storage.values])
  assert.equal((await h.call('logout', { cookie, method: 'GET' })).status, 405)
  assert.equal((await h.call('logout', { cookie, headers: { Origin: 'https://invalid.example' } })).status, 403)
  assert.equal((await h.call('__internal/ma-code/admin/security', { body: JSON.stringify({ action: 'login-attempt', matched: true }) })).status, 404)
  const response = await rt.publicAccess(new Request('https://ma-code.pt/api/ma-professor/access/__internal/ma-code/admin/security', {
    method: 'POST', headers: { Origin: 'https://ma-code.pt', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login-attempt', matched: true })
  }), h.env)
  assert.equal(response.status, 404)
  assert.deepEqual([...h.storage.values], before)
})
