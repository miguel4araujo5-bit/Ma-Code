import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../../', import.meta.url))
const wasmUrl = 'https://opaque.example.test/opaque.wasm'
const wasm = await readFile(new URL('../../worker/vendor/ma-professor-opaque/opaque_bg.wasm', import.meta.url))
let runtimeSequence = 0

async function loadRuntime() {
  const bundle = await build({
    stdin: { resolveDir: root, contents: `
      export * from './src/components/ma-professor/access/opaqueClient.ts'
      export * from './src/components/ma-professor/access/opaqueAccess.ts'
    ` },
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'test-wasm-url', setup(builder) {
      builder.onLoad({ filter: /\.wasm$/ }, () => ({
        loader: 'js', contents: `export default ${JSON.stringify(wasmUrl)}`
      }))
    } }]
  })
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}#${++runtimeSequence}`)
}

const wasmResponse = () => new Response(wasm, { headers: { 'Content-Type': 'application/wasm' } })
const requestUrl = input => typeof input === 'string' ? input : input.url
const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve() }

test('a failed OPAQUE download can be retried without reloading or changing credentials', async t => {
  const runtime = await loadRuntime()
  let downloads = 0
  t.mock.method(globalThis, 'fetch', async input => {
    assert.equal(requestUrl(input), wasmUrl)
    if (++downloads === 1) throw new TypeError('Temporary connection failure')
    return wasmResponse()
  })
  await assert.rejects(runtime.startMAProfessorOpaqueClientLogin('Local-test-password-123!'))
  const retried = await runtime.startMAProfessorOpaqueClientLogin('Local-test-password-123!')
  assert.ok(retried.startLoginRequest)
  assert.equal(downloads, 2)
  await runtime.startMAProfessorOpaqueClientLogin('Local-test-password-123!')
  assert.equal(downloads, 2, 'A successful module must remain cached.')
})

test('a stalled OPAQUE download times out and leaves the next manual attempt usable', async t => {
  const runtime = await loadRuntime()
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let downloads = 0
  let downloadSignal
  t.mock.method(globalThis, 'fetch', (input, options) => {
    assert.equal(requestUrl(input), wasmUrl)
    downloads += 1
    if (downloads > 1) return Promise.resolve(wasmResponse())
    downloadSignal = input.signal ?? options?.signal
    return new Promise(() => {})
  })
  let outcome = 'pending'
  const pending = runtime.startMAProfessorOpaqueClientLogin('Local-test-password-123!')
    .then(() => { outcome = 'success' }, error => { outcome = error.name })
  await flush()
  t.mock.timers.tick(30_000)
  await flush()
  assert.equal(outcome, 'MAProfessorOpaqueTimeoutError')
  assert.equal(downloadSignal.aborted, true)
  assert.equal(downloads, 1, 'Timeout must not start an automatic retry.')
  await pending
  assert.ok((await runtime.startMAProfessorOpaqueClientLogin('Local-test-password-123!')).startLoginRequest)
  assert.equal(downloads, 2)
})

test('a stalled password confirmation is bounded and cannot proceed to login finish after timeout', async t => {
  const runtime = await loadRuntime()
  const password = 'Local-test-password-123!'
  t.mock.method(globalThis, 'fetch', async () => wasmResponse())
  await runtime.startMAProfessorOpaqueClientLogin(password)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const requests = []
  let releaseStart
  let startSignal
  t.mock.method(globalThis, 'fetch', (input, options) => {
    requests.push({ url: requestUrl(input), body: options?.body })
    assert.equal(options.body.includes(password), false)
    startSignal = options.signal
    return new Promise(resolve => { releaseStart = resolve })
  })
  let outcome = 'pending'
  const pending = runtime.loginMAProfessorOpaqueOnly('professor@example.test', password, 'device-test')
    .then(() => { outcome = 'success' }, error => { outcome = error.name })
  await flush()
  assert.equal(requests.length, 1)
  t.mock.timers.tick(30_000)
  await flush()
  assert.equal(outcome, 'MAProfessorOpaqueTimeoutError')
  assert.equal(startSignal.aborted, true)
  releaseStart(Response.json({ loginId: 'late-login', loginResponse: 'not-a-valid-proof' }))
  await flush()
  await pending
  assert.equal(requests.length, 1, 'A late response must not start the finish request or retry.')
})
