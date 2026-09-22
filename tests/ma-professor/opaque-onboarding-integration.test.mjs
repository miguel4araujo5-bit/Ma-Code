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
  const approve = async (email, approvalPlan = 'free') => {
    const response = await post('/__internal/ma-professor/admin/requests/approve-explicit', {
      email, approvalPlan
    })
    const body = await response.json()
    assert.equal(response.status, 200, JSON.stringify(body))
    return body.credential.password
  }
  const readAccess = async () => {
    const access = await storage.get(ACCESS_KEY)
    for (const field of ['accessRequests', 'licenses', 'credentials', 'sessions']) {
      const suffix = field === 'accessRequests' ? 'requests' : field
      access[field] = (await storage.get(`ma-professor-access-${suffix}-v1`))?.[field] ?? access[field] ?? {}
    }
    return access
  }
  return { storage, requests, post, fetch, approve, readAccess }
}

for (const plan of ['free', 'paid_30_days', 'school_year']) {
  test(`pending OPAQUE account can sign in and choose ${plan}, while tools require approval and activation`, async t => {
    const fixture = setup()
    t.mock.method(globalThis, 'fetch', fixture.fetch)
    const email = `pending-${plan}@example.com`
    const password = 'palavras locais para a conta pendente'
    const deviceId = `pending-${plan}-device`

    await api.submitMAProfessorAccessRequest(email)
    await client.registerMAProfessorOpaqueAccount(email, password, deviceId)
    const accountState = await fixture.readAccess()
    assert.equal(accountState.accessRequests[email].status, 'pending')
    assert.equal(accountState.accessRequests[email].termsVersionAccepted, api.MA_PROFESSOR_TERMS_VERSION)
    assert.ok(accountState.accessRequests[email].termsAcceptedAt)
    assert.equal(accountState.licenses[email], undefined)
    assert.equal(accountState.credentials[email], undefined)

    const pending = await client.loginMAProfessorOpaqueOnly(email, password, deviceId)
    assert.ok(pending.response.token)
    assert.equal(pending.response.license, null)
    const auth = { token: pending.response.token, deviceId }
    assert.equal((await fixture.post('/api/ma-professor/access/status', auth)).status, 200)
    assert.equal((await fixture.post('/api/ma-professor/access/verify', auth)).status, 401)
    const wrongDevice = await fixture.post('/api/ma-professor/access/account/verify', { ...auth, deviceId: 'other-device' })
    assert.equal(wrongDevice.status, 401)

    if (plan !== 'free') {
      const selected = await fixture.post('/api/ma-professor/access/request', { ...auth, email, plan })
      assert.equal(selected.status, 200, JSON.stringify(await selected.clone().json()))
      assert.equal((await fixture.readAccess()).licenses[email], undefined)
    }
    await assert.rejects(api.activateMAProfessorAccessPeriod(email, 'MP-INVALID', deviceId))
    const mp = await fixture.approve(email, plan)
    const approved = await api.verifyMAProfessorAccountSession(pending.response.token, deviceId)
    assert.equal(approved.license, null, 'Approval alone must not activate the tools')
    const activated = await api.activateMAProfessorAccessPeriod(email, mp, deviceId)
    assert.ok(activated.license)
    const reopened = await client.loginMAProfessorOpaqueOnly(email, password, `${deviceId}-reopened`)
    assert.equal(reopened.exportKey, pending.exportKey)
    assert.ok(reopened.response.license)
    assert.equal((await fixture.readAccess()).accessRequests[email].termsVersionAccepted, api.MA_PROFESSOR_TERMS_VERSION)
    for (const { body } of fixture.requests) {
      assert.equal(Object.hasOwn(body, 'password'), false)
      assert.equal(Object.hasOwn(body, 'accountPassword'), false)
      assert.equal(JSON.stringify(body).includes(password), false)
      assert.equal(JSON.stringify(body).includes(pending.exportKey), false)
    }
  })
}

test('anonymous signup retries neither enumerate nor replace pending, approved or existing accounts', async t => {
  const fixture = setup()
  t.mock.method(globalThis, 'fetch', fixture.fetch)
  const email = 'retry-pending@example.com'
  const password = 'uma password pessoal que fica local'
  await api.submitMAProfessorAccessRequest(email)
  await client.registerMAProfessorOpaqueAccount(email, password, 'first-device')
  const original = (await fixture.storage.get(OPAQUE_KEY)).registrations[email]
  await client.registerMAProfessorOpaqueAccount(email, 'a different password from an attacker', 'attacker-device')
  assert.deepEqual((await fixture.storage.get(OPAQUE_KEY)).registrations[email], original)
  await assert.rejects(client.loginMAProfessorOpaqueOnly(email, 'a different password from an attacker', 'attacker-device'))
  await client.registerMAProfessorOpaqueAccount(email, password, 'retry-device')
  const retried = await client.loginMAProfessorOpaqueOnly(email, password, 'retry-device')
  assert.equal(retried.response.license, null)

  const approvedEmail = 'approved-invitation@example.com'
  await api.submitMAProfessorAccessRequest(approvedEmail)
  const mp = await fixture.approve(approvedEmail)
  await client.registerMAProfessorOpaqueAccount(approvedEmail, password, 'attacker-device')
  await client.registerMAProfessorOpaqueAccount('no-request@example.com', password, 'attacker-device')
  assert.equal((await fixture.storage.get(OPAQUE_KEY)).registrations[approvedEmail], undefined)
  assert.equal((await fixture.storage.get(OPAQUE_KEY)).registrations['no-request@example.com'], undefined)
  await client.enrollMAProfessorOpaqueForActivation(approvedEmail, password, mp, 'invited-device')
  assert.ok((await fixture.storage.get(OPAQUE_KEY)).registrations[approvedEmail])
})

test('twenty teachers sharing a school IP can register; public enrollment remains rate limited even with a fake token', async t => {
  const fixture = setup()
  t.mock.method(globalThis, 'fetch', fixture.fetch)
  for (let i = 0; i < 20; i++) {
    const email = `school-teacher-${i}@example.com`
    await api.submitMAProfessorAccessRequest(email)
    await client.registerMAProfessorOpaqueAccount(email, 'palavras da escola para a password', `school-device-${i}`)
  }
  const start = fixture.requests.find(item => item.path.endsWith('/opaque/enroll/start')).body
  for (let i = 20; i < 30; i++) {
    const response = await fixture.post('/api/ma-professor/access/opaque/enroll/start', { ...start, token: 'fake-session-token' })
    assert.equal(response.status, 200)
  }
  const limited = await fixture.post('/api/ma-professor/access/opaque/enroll/start', { ...start, token: 'fake-session-token' })
  assert.equal(limited.status, 429)
  assert.ok(limited.headers.get('Retry-After'))
  assert.equal(Object.keys((await fixture.storage.get(OPAQUE_KEY)).registrations).length, 20)
})

test('public enrollment rechecks approval at finish and cannot claim a legacy account or forge eligibility', async t => {
  const fixture = setup()
  t.mock.method(globalThis, 'fetch', fixture.fetch)
  await api.submitMAProfessorAccessRequest('registration-seed@example.com')
  await client.registerMAProfessorOpaqueAccount('registration-seed@example.com', 'password usada apenas no dispositivo', 'seed-device')
  const registrationRequest = fixture.requests.find(item => item.path.endsWith('/opaque/enroll/start')).body.registrationRequest
  const email = 'approval-race@example.com'
  await api.submitMAProfessorAccessRequest(email)
  const started = await api.startMAProfessorOpaqueAccountEnrollment(email, 'race-device', registrationRequest)
  await fixture.approve(email)
  const finish = await fixture.post('/api/ma-professor/access/opaque/enroll/finish', {
    email, deviceId: 'race-device', enrollmentId: started.enrollmentId,
    registrationRecord: 'untrusted-record', skipRegistration: false, canCreateAccount: true
  })
  assert.equal(finish.status, 200)
  assert.equal((await fixture.storage.get(OPAQUE_KEY)).registrations[email], undefined)

  const legacyEmail = 'legacy-pending@example.com'
  await api.submitMAProfessorAccessRequest(legacyEmail)
  const legacy = { credentials: { [legacyEmail]: { existing: true } } }
  await fixture.storage.put('ma-professor-account-auth-v1', legacy)
  await client.registerMAProfessorOpaqueAccount(legacyEmail, 'tentativa de substituir uma conta antiga', 'legacy-device')
  assert.equal((await fixture.storage.get(OPAQUE_KEY)).registrations[legacyEmail], undefined)
  assert.deepEqual(await fixture.storage.get('ma-professor-account-auth-v1'), legacy)
  const missingTerms = await fixture.post('/api/ma-professor/access/opaque/enroll/start', {
    email, deviceId: 'race-device', registrationRequest, accountRequest: true
  })
  assert.equal(missingTerms.status, 400)
})

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
