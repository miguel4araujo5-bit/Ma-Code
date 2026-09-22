import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'esbuild'

const root = new URL('../../', import.meta.url)
const ACCESS_KEY = 'ma-professor-access-state-v1'
const OPAQUE_KEY = 'ma-professor-opaque-auth-v1'

// Execute the production bridges and the vendored OPAQUE implementation.
// Only the storage and Wasm loading are adapted to the Node test runtime.
async function loadRuntime(path) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(path, root))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    plugins: [{
      name: 'node-test-wasm',
      setup(builder) {
        builder.onLoad({ filter: /\.wasm$/ }, async args => {
          const bytes = await readFile(args.path)
          return {
            loader: 'js',
            contents: `export default new WebAssembly.Module(Uint8Array.from(Buffer.from('${bytes.toString('base64')}', 'base64')))`
          }
        })
      }
    }]
  })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}

const [worker, client, api] = await Promise.all([
  loadRuntime('worker/maProfessorAccessRetentionBridge.ts'),
  loadRuntime('src/components/ma-professor/access/opaqueAccess.ts'),
  loadRuntime('src/components/ma-professor/access/accessApi.ts')
])

class MemoryStorage {
  values = new Map()
  async get(key) { return structuredClone(this.values.get(key)) }
  async put(key, value) {
    for (const [name, entry] of typeof key === 'string' ? [[key, value]] : Object.entries(key)) {
      this.values.set(name, structuredClone(entry))
    }
  }
}

function setup() {
  const storage = new MemoryStorage()
  const state = { storage, blockConcurrencyWhile: callback => callback() }
  const object = new worker.MaProfessorAccessDurableObject(state, {})
  const requests = []
  const post = (path, body, ip = '203.0.113.80') => object.fetch(new Request(`https://ma-code.pt${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body)
  }))
  const fetch = (path, init) => {
    const body = JSON.parse(init.body)
    requests.push({ path, body })
    return post(path, body)
  }
  const approve = async email => {
    const response = await post('/__internal/ma-professor/admin/requests/approve-explicit', {
      email, approvalPlan: 'free'
    })
    const body = await response.json()
    assert.equal(response.status, 200, JSON.stringify(body))
    return body.credential.password
  }
  return { storage, requests, post, fetch, approve }
}

test('email request, approval, interrupted enrollment, activation, new-device login and deletion preserve the OPAQUE boundary', async t => {
  const fixture = setup()
  t.mock.method(globalThis, 'fetch', fixture.fetch)
  const email = 'opaque-integration@example.com'
  const password = 'Local-only-test-password-123!'
  const deviceId = 'opaque-first-device'

  await api.submitMAProfessorAccessRequest(email)
  assert.deepEqual(fixture.requests[0].body, { email })
  const activationPassword = await fixture.approve(email)
  assert.equal(typeof activationPassword, 'string')

  const enrolled = await client.enrollMAProfessorOpaqueForActivation(email, password, activationPassword, deviceId)
  const initial = await fixture.storage.get(OPAQUE_KEY)
  assert.ok(initial.registrations[email])
  assert.equal(await fixture.storage.get('ma-professor-account-auth-v1'), undefined)

  // A connection loss after enrollment must not require a new password or overwrite the record.
  await assert.rejects(client.enrollMAProfessorOpaqueForActivation(email, 'Wrong-password-123!', activationPassword, deviceId))
  const resumed = await client.enrollMAProfessorOpaqueForActivation(email, password, activationPassword, deviceId)
  assert.equal(resumed.exportKey, enrolled.exportKey)
  assert.deepEqual((await fixture.storage.get(OPAQUE_KEY)).registrations[email], initial.registrations[email])

  const activated = await api.activateMAProfessorAccessPeriod(email, activationPassword, deviceId)
  assert.ok(activated.token)
  assert.ok(activated.license)
  const loggedIn = await client.loginMAProfessorOpaqueOnly(email, password, 'opaque-second-device')
  assert.equal(loggedIn.exportKey, enrolled.exportKey)
  assert.ok(loggedIn.response.token)
  const verified = await api.verifyMAProfessorAccountSession(loggedIn.response.token, 'opaque-second-device')
  assert.equal(verified.email, email)

  for (const { body } of fixture.requests) {
    assert.equal(Object.hasOwn(body, 'password'), false)
    assert.equal(Object.hasOwn(body, 'accountPassword'), false)
    assert.equal(JSON.stringify(body).includes(password), false)
    assert.equal(JSON.stringify(body).includes(enrolled.exportKey), false)
  }

  const opaqueState = await fixture.storage.get(OPAQUE_KEY)
  const other = 'other-account@example.com'
  opaqueState.registrations[other] = { ...initial.registrations[email], email: other }
  opaqueState.pendingEnrollments.target = { email, id: 'target' }
  opaqueState.pendingLogins.target = { email, id: 'target' }
  opaqueState.pendingLogins.other = { email: other, id: 'other' }
  await fixture.storage.put(OPAQUE_KEY, opaqueState)
  const deleted = await fixture.post('/__internal/ma-professor/admin/accounts/delete', { emails: [email] })
  assert.equal(deleted.status, 200)
  const after = await fixture.storage.get(OPAQUE_KEY)
  assert.equal(after.registrations[email], undefined)
  assert.equal(after.pendingEnrollments.target, undefined)
  assert.equal(after.pendingLogins.target, undefined)
  assert.deepEqual(after.registrations[other], opaqueState.registrations[other])
  assert.deepEqual(after.pendingLogins.other, opaqueState.pendingLogins.other)
  assert.equal(after.serverSetup, opaqueState.serverSetup)
  await assert.rejects(client.loginMAProfessorOpaqueOnly(email, password, deviceId))

  // The same email can start again after administrative deletion.
  await api.submitMAProfessorAccessRequest(email)
  const freshMP = await fixture.approve(email)
  await client.enrollMAProfessorOpaqueForActivation(email, password, freshMP, deviceId)
  assert.ok((await fixture.storage.get(OPAQUE_KEY)).registrations[email])
})

test('OPAQUE enrollment shares the MP activation attempt limit and generic failure', async () => {
  const fixture = setup()
  let response
  for (let attempt = 0; attempt < 12; attempt++) {
    response = await fixture.post('/api/ma-professor/access/opaque/enroll/start', {
      email: 'unknown@example.com', activationPassword: 'MP-INVALID',
      deviceId: 'opaque-guard-device', registrationRequest: 'not-a-valid-record'
    })
    if (response.status === 429) break
    assert.equal(response.status, 401)
  }
  assert.equal(response.status, 429)
  const blocked = await fixture.post('/api/ma-professor/access/activate', {
    email: 'unknown@example.com', activationPassword: 'MP-INVALID', deviceId: 'opaque-guard-device'
  })
  assert.equal(blocked.status, 429)
  assert.equal(await fixture.storage.get(OPAQUE_KEY), undefined)
})
