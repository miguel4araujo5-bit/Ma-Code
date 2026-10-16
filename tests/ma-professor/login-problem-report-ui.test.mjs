import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'
import test from 'node:test'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const rootPath = fileURLToPath(new URL('../../', import.meta.url))

test('login failures stay plain and reports retain only safe diagnostics after an explicit send', async t => {
  const dom = new JSDOM('<!doctype html><html><head><script type="module" src="/assets/test-build.js"></script></head><body><div id="root"></div></body></html>', {
    url: 'https://ma-code.pt/produtos/ma-professor?token=PRIVATE_URL#PRIVATE_HASH'
  })
  const previous = new Map()
  for (const [name, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, CustomEvent: dom.window.CustomEvent,
    IS_REACT_ACT_ENVIRONMENT: true
  })) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  const directory = await mkdtemp(join(rootPath, '.tmp-auth-feedback-'))
  let reactRoot
  t.after(async () => {
    if (reactRoot) await act(async () => reactRoot.unmount())
    delete globalThis.__maTestLogin
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
    dom.window.close()
    await rm(directory, { recursive: true, force: true })
  })
  const bundle = await build({
    stdin: { resolveDir: rootPath, contents: `
      export { default as Gate } from './src/components/ma-professor/access/MAProfessorAuthGate.tsx';
      export { MAProfessorAccessApiError } from './src/components/ma-professor/access/accessApi.ts';
      export { MAProfessorErrorBoundary } from './src/components/ma-professor/support/MAProfessorErrorBoundary.tsx';
    ` },
    bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
    external: ['react', 'react-dom'],
    plugins: [{ name: 'test-login-outcome', setup(builder) {
      builder.onResolve({ filter: /^\.\/opaqueAccess$/ }, () => ({ path: 'test-login', namespace: 'test' }))
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
        export const loginMAProfessorOpaqueOnly = (...args) => globalThis.__maTestLogin(...args);
        export const enrollMAProfessorOpaqueForActivation = () => { throw new Error('Unused'); };
        export const registerMAProfessorOpaqueAccount = () => { throw new Error('Unused'); };
      ` }))
    } }]
  })
  const bundlePath = join(directory, 'ui.mjs')
  await writeFile(bundlePath, bundle.outputFiles[0].text)
  const { Gate, MAProfessorAccessApiError, MAProfessorErrorBoundary } = await import(pathToFileURL(bundlePath).href)
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(document.getElementById('root'))
  reactRoot = root
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) })
    return Response.json({ success: true })
  })
  const click = async text => {
    const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent.trim() === text)
    assert.ok(button, `Missing button: ${text}`)
    await act(async () => button.click())
  }
  const enterPassword = async () => {
    const input = document.querySelector('input[type="password"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'PRIVATE_PERSONAL_PASSWORD')
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }
  const cases = [
    [Object.assign(new Error('OPAQUE v3 Argon2 exportKey=PRIVATE_KEY'), { name: 'MAProfessorOpaqueMobileCompatibilityError' }), 'MAProfessorOpaqueMobileCompatibilityError', /Não foi possível iniciar sessão/],
    [Object.assign(new Error('PRIVATE_TIMEOUT'), { name: 'MAProfessorOpaqueTimeoutError' }), 'MAProfessorOpaqueTimeoutError', /demorou demasiado/],
    [new Error('OPAQUE PRIVATE_KEY PRIVATE_PERSONAL_PASSWORD'), 'UnexpectedError', /Não foi possível iniciar sessão/],
    [new MAProfessorAccessApiError('OPAQUE PRIVATE_KEY', 401), 'HTTP 401', /Verifique o email e a password/],
    [new MAProfessorAccessApiError('OPAQUE PRIVATE_KEY', 429), 'HTTP 429', /Aguarde um pouco/],
    [new MAProfessorAccessApiError('Foi atingido o número máximo de dispositivos associados a esta conta.', 403), 'HTTP 403', /número máximo de dispositivos/]
  ]
  for (const [error, diagnostic, message] of cases) {
    globalThis.__maTestLogin = async () => { throw error }
    await act(async () => root.render(React.createElement(Gate, { initialMode: 'login', initialEmail: 'PRIVATE_EMAIL@example.test' }, 'Conta aberta')))
    await enterPassword()
    const before = requests.length
    await act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(document.querySelector('[role="alert"]').textContent, message)
    assert.doesNotMatch(document.body.textContent, /OPAQUE|Argon2|PRIVATE_KEY|PRIVATE_PERSONAL_PASSWORD|PRIVATE_TIMEOUT/)
    assert.equal(requests.length, before, 'A login failure does not send telemetry')
    await click('Comunicar um problema')
    const dialog = document.querySelector('[role="dialog"]')
    assert.ok(dialog)
    assert.doesNotMatch(dialog.textContent, /OPAQUE|Argon2|Versão|PRIVATE_|test-build/)
    assert.equal(requests.length, before, 'Opening the existing report does not send it')
    await click('Enviar')
    assert.equal(requests.length, before + 1)
    const report = requests.at(-1)
    assert.equal(report.url, '/api/ma-professor/problem-report')
    assert.ok(report.body.error.includes(diagnostic))
    assert.equal(report.body.version, 'test-build.js')
    assert.equal(report.body.screen, 'Entrar')
    assert.doesNotMatch(JSON.stringify(report.body), /PRIVATE_|password|exportKey|registrationRecord/)
    await click('Fechar')
  }

  t.mock.method(console, 'error', () => {})
  function Broken() { throw new TypeError('OPAQUE PRIVATE_KEY') }
  await act(async () => root.render(React.createElement(MAProfessorErrorBoundary, null, React.createElement(Broken))))
  assert.match(document.body.textContent, /Algo correu mal/)
  assert.doesNotMatch(document.body.textContent, /Detalhe técnico|TypeError|OPAQUE|PRIVATE_KEY/)
  await click('Reportar problema')
  assert.doesNotMatch(document.querySelector('[role="dialog"]').textContent, /TypeError|Versão|OPAQUE/)
  await click('Enviar')
  assert.equal(requests.at(-1).body.error, 'Erro inesperado: TypeError')
})
