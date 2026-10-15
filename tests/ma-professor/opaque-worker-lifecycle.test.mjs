import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Worker as NodeWorker } from 'node:worker_threads'
import test from 'node:test'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../../', import.meta.url))
let sequence = 0
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve() }

async function loadClient() {
  const bundle = await build({
    stdin: { resolveDir: root, contents: `
      export * from './src/components/ma-professor/access/opaqueClient.ts'
      export * from './src/components/ma-professor/access/opaqueAccess.ts'
    ` },
    bundle: true, write: false, format: 'esm', platform: 'node',
    define: { 'import.meta.url': JSON.stringify('file:///test/opaqueClient.ts') }
  })
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}#${++sequence}`)
}

function setWorker(t, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker')
  Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous)
    else delete globalThis.Worker
  })
}

function fakeWorkers(t) {
  const workers = []
  class FakeWorker {
    constructor(url, options) {
      assert.equal(options.type, 'module')
      assert.match(url.pathname, /opaqueClient\.worker\.ts$/)
      this.terminated = false
      workers.push(this)
    }
    postMessage(message) { this.request = message }
    terminate() { this.terminated = true }
    reply(result) { this.onmessage?.({ data: { success: true, result } }) }
  }
  setWorker(t, FakeWorker)
  return workers
}

test('OPAQUE operations dispose their worker on success and incorrect password', async t => {
  const workers = fakeWorkers(t)
  const client = await loadClient()
  const start = client.startMAProfessorOpaqueClientLogin('fictional-password')
  await flush()
  assert.deepEqual(workers[0].request, { operation: 'startLogin', args: ['fictional-password'] })
  const state = { clientLoginState: 'state', startLoginRequest: 'request' }
  workers[0].reply(state)
  assert.deepEqual(await start, state)
  assert.equal(workers[0].terminated, true)
  const finish = client.finishMAProfessorOpaqueClientLogin('wrong-password', 'state', 'response')
  await flush()
  workers[1].reply(null)
  assert.equal(await finish, null)
  assert.equal(workers[1].terminated, true)
})

test('a worker crash terminates its runtime and permits a manual retry without leaking vendor errors', async t => {
  const workers = fakeWorkers(t)
  const client = await loadClient()
  const failed = client.startMAProfessorOpaqueClientLogin('fictional-password')
  const rejection = assert.rejects(failed, error => !error.message.includes('SENSITIVE'))
  await flush()
  let prevented = false
  workers[0].onerror({ message: 'SENSITIVE vendor details', preventDefault() { prevented = true } })
  await rejection
  assert.equal(prevented, true)
  assert.equal(workers[0].terminated, true)
  const retry = client.startMAProfessorOpaqueClientLogin('fictional-password')
  await flush()
  workers[1].reply({ clientLoginState: 'new-state', startLoginRequest: 'new-request' })
  assert.equal((await retry).clientLoginState, 'new-state')
})

test('a stalled worker is terminated at the deadline without an automatic retry', async t => {
  const workers = fakeWorkers(t)
  const client = await loadClient()
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = client.finishMAProfessorOpaqueClientLogin('password', 'state', 'response')
  const rejection = assert.rejects(pending, { name: 'MAProfessorOpaqueTimeoutError' })
  await flush()
  const lateMessage = workers[0].onmessage
  t.mock.timers.tick(client.MA_PROFESSOR_OPAQUE_TIMEOUT_MS)
  await rejection
  assert.equal(workers[0].terminated, true)
  lateMessage({ data: { success: true, result: { exportKey: 'late-key', finishLoginRequest: 'late-proof' } } })
  await flush()
  assert.equal(workers.length, 1)
})

test('memory-heavy operations are serialized and an aborted queued operation never starts', async t => {
  const workers = fakeWorkers(t)
  const client = await loadClient()
  const controller = new AbortController()
  const first = client.finishMAProfessorOpaqueClientLogin('password', 'state', 'response')
  const second = client.startMAProfessorOpaqueClientLogin('password', controller.signal)
  const rejected = assert.rejects(second, { name: 'MAProfessorOpaqueTimeoutError' })
  await flush()
  assert.equal(workers.length, 1)
  controller.abort()
  workers[0].reply(null)
  await first
  await rejected
  assert.equal(workers.length, 1)
})

test('the login deadline cancels an active calculation and never submits a late proof', async t => {
  const workers = fakeWorkers(t)
  const client = await loadClient()
  const requests = []
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    requests.push({ input, body: options.body })
    return Response.json({ loginId: 'test-login', loginResponse: 'test-response' })
  })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = client.loginMAProfessorOpaqueOnly('professor@example.test', 'fictional-password', 'device-test')
  const rejection = assert.rejects(pending, { name: 'MAProfessorOpaqueTimeoutError' })
  await flush()
  workers[0].reply({ clientLoginState: 'state', startLoginRequest: 'request' })
  // Response.json parsing completes on the event loop, outside the microtask queue.
  for (let i = 0; i < 10 && workers.length < 2; i++) await new Promise(setImmediate)
  assert.equal(workers.length, 2)
  const lateMessage = workers[1].onmessage
  t.mock.timers.tick(client.MA_PROFESSOR_OPAQUE_TIMEOUT_MS)
  await rejection
  assert.equal(workers[1].terminated, true)
  lateMessage({ data: { success: true, result: { finishLoginRequest: 'late-proof', exportKey: 'late-key' } } })
  await flush()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].body.includes('fictional-password'), false)
})

test('the worker authenticates an existing RFC registration with the identical backup export key while the page remains responsive', { timeout: 90_000 }, async t => {
  const wasm = await readFile(new URL('../../worker/vendor/ma-professor-opaque/opaque_bg.wasm', import.meta.url))
  const vendor = await import('../../worker/vendor/ma-professor-opaque/opaque.js')
  await vendor.default({ module_or_path: wasm })
  const password = 'Fictional-Safari-Compatibility-2026!'
  const userIdentifier = 'safari-test@example.test'
  const serverSetup = vendor.createServerSetup()
  const registration = vendor.startClientRegistration({ password })
  const response = vendor.createServerRegistrationResponse({
    serverSetup, userIdentifier, registrationRequest: registration.registrationRequest
  })
  // Existing account, using the original code path and unchanged production KSF.
  const existing = vendor.finishClientRegistration({
    password, clientRegistrationState: registration.clientRegistrationState,
    registrationResponse: response.registrationResponse, keyStretching: 'rfc-recommended'
  })
  const workerBundle = await build({
    entryPoints: [root + '/src/components/ma-professor/access/opaqueClient.worker.ts'],
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'local-wasm', setup(builder) {
      builder.onLoad({ filter: /\.wasm$/ }, () => ({
        loader: 'js', contents: `export default Uint8Array.from(Buffer.from('${wasm.toString('base64')}', 'base64'))`
      }))
    } }]
  })
  const workerSource = `
    import { parentPort } from 'node:worker_threads';
    globalThis.self = globalThis;
    self.postMessage = message => parentPort.postMessage(message);
    ${workerBundle.outputFiles[0].text}
    parentPort.on('message', data => self.onmessage({ data }));
  `
  const workerUrl = new URL('data:text/javascript;base64,' + Buffer.from(workerSource).toString('base64'))
  const workers = []
  class ThreadWorker {
    constructor() {
      this.thread = new NodeWorker(workerUrl)
      this.thread.on('message', data => this.onmessage?.({ data }))
      this.thread.on('error', () => this.onerror?.({ preventDefault() {} }))
      workers.push(this)
    }
    postMessage(message) { this.thread.postMessage(message) }
    terminate() { this.termination = this.thread.terminate() }
  }
  setWorker(t, ThreadWorker)
  t.after(async () => { await Promise.all(workers.map(worker => worker.thread.terminate())) })
  const client = await loadClient()
  const started = await client.startMAProfessorOpaqueClientLogin(password)
  const serverStart = vendor.startServerLogin({
    serverSetup, userIdentifier, registrationRecord: existing.registrationRecord,
    startLoginRequest: started.startLoginRequest
  })
  let heartbeats = 0
  const heartbeat = setInterval(() => { heartbeats += 1 }, 10)
  t.after(() => clearInterval(heartbeat))
  const finished = await client.finishMAProfessorOpaqueClientLogin(password, started.clientLoginState, serverStart.loginResponse)
  assert.ok(finished)
  assert.equal(finished.exportKey, existing.exportKey, 'Existing V3 backups keep the exact same wrapping input.')
  assert.deepEqual(Object.keys(finished).sort(), ['exportKey', 'finishLoginRequest'])
  assert.ok(vendor.finishServerLogin({ serverLoginState: serverStart.serverLoginState, finishLoginRequest: finished.finishLoginRequest }))
  assert.ok(heartbeats > 10, 'The UI event loop must run while Argon2 is computing.')
  await Promise.all(workers.map(worker => worker.termination))
  assert.equal(workers.length, 2)
})
