import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const project = fileURLToPath(new URL('../../', import.meta.url))
await mkdir(join(project, 'node_modules/.cache'), { recursive: true })
const temporary = await mkdtemp(join(project, 'node_modules/.cache/activation-link-gate-'))
const result = await build({
  stdin: {
    contents: "export { default as Component } from './src/components/ma-professor/access/MAProfessorActivationLinkGate'; export { default as Page } from './src/pages/MAProfessorPage'; export * from './src/components/ma-professor/access/accessStorage'",
    resolveDir: project,
    loader: 'ts'
  },
  jsx: 'automatic', platform: 'node', format: 'cjs', bundle: true,
  write: false, packages: 'external',
  plugins: [{
    name: 'activation-page-fixture',
    setup(builder) {
      // Exercise the real page and both gates, without mounting the school workspace.
      builder.onLoad({ filter: /MAProfessorProduct\.tsx$/ }, () => ({
        loader: 'js',
        contents: "import { createElement } from 'react'; export function MAProfessorProduct() { return createElement('p', { id: 'application' }, 'MA-Professor aberto') }"
      }))
      builder.onLoad({ filter: /AccessVerificationNotice\.tsx$/ }, () => ({
        loader: 'js', contents: 'export default function Notice() { return null }'
      }))
      builder.onLoad({ filter: /\.wasm$/ }, async args => ({
        loader: 'js',
        contents: `export default new WebAssembly.Module(Uint8Array.from(Buffer.from('${(await readFile(args.path)).toString('base64')}', 'base64')))`
      }))
    }
  }]
})
const modulePath = join(temporary, 'gate.cjs')
await writeFile(modulePath, result.outputFiles[0].text)
const gate = createRequire(import.meta.url)(modulePath)
test.after(() => rm(temporary, { recursive: true, force: true }))

const email = 'link-professor@example.com'
const accessKey = 'ma-professor-access-v1'
const href = `https://ma-code.pt/ma-professor?email=${encodeURIComponent(email)}&keep=1#acesso=ativar&senha=MP-LINK-TEST`
const license = {
  email, plan: 'beta_30_days', status: 'active',
  validFrom: '2026-10-05T10:00:00.000Z',
  validUntil: '2099-12-31T23:59:59.999Z',
  daysRemaining: 30, renewalRequestedAt: null
}

function setup(t, url = href) {
  const dom = new JSDOM('<div id="root"></div>', { url })
  const originals = new Map()
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  gate.clearMAProfessorStoredAccess()
  gate.clearMAProfessorOpaqueExportKey()
  const { createRoot } = createRequire(import.meta.url)('react-dom/client')
  const root = createRoot(document.getElementById('root'))
  const requests = []
  t.mock.method(globalThis, 'fetch', async (path, init) => {
    requests.push({ path, init, body: JSON.parse(init.body) })
    return Response.json({ success: true, license })
  })
  t.after(async () => {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return {
    dom, requests,
    render: () => act(async () => root.render(
      React.createElement(React.StrictMode, null,
        React.createElement(gate.Component, null,
          React.createElement('p', { id: 'application' }, 'MA-Professor aberto')
        )
      )
    )),
    renderPage: () => act(async () => root.render(
      React.createElement(React.StrictMode, null, React.createElement(gate.Page))
    ))
  }
}

test('email link activates without local session and shows the confirmation before opening the app', async t => {
  const fixture = setup(t)
  await fixture.render()
  assert.equal(fixture.requests.length, 1, 'StrictMode must not send duplicate activations')
  assert.deepEqual(fixture.requests[0].body, {
    email, activationPassword: 'MP-LINK-TEST', activationOnly: true
  })
  assert.equal(fixture.requests[0].path, '/api/ma-professor/access/activate')
  assert.equal(fixture.requests[0].init.headers.Authorization, undefined)
  assert.equal(document.querySelector('h1').textContent.trim(), 'Acesso ativado')
  assert.equal(document.querySelectorAll('input').length, 0)
  assert.equal(document.getElementById('application'), null)
  assert.equal(window.localStorage.getItem(accessKey), null)
  assert.equal(window.localStorage.getItem('ma-professor-device-id-v1'), null)
  assert.equal(window.location.href, 'https://ma-code.pt/ma-professor?keep=1')
  const button = [...document.querySelectorAll('button')].find(item => item.textContent.trim() === 'Entrar')
  assert.ok(button)
  await act(async () => button.click())
  assert.ok(document.getElementById('application'))
  assert.equal(fixture.requests.length, 1)
})

test('matching existing session receives the activated license without changing its token or device', async t => {
  const fixture = setup(t)
  gate.saveMAProfessorStoredAccess({ email, token: 'original-session', deviceId: 'original-device', license: null })
  await fixture.render()
  assert.equal(fixture.requests.length, 1)
  assert.deepEqual(gate.readMAProfessorStoredAccess(), {
    email, token: 'original-session', deviceId: 'original-device', license,
    checkedAt: gate.readMAProfessorStoredAccess().checkedAt
  })
  assert.equal(document.querySelector('h1').textContent.trim(), 'Acesso ativado')
})

test('opening a link for another account preserves the signed-in account', async t => {
  const fixture = setup(t)
  const otherAccount = { email: 'other@example.com', token: 'other-session', deviceId: 'other-device', license: null }
  gate.saveMAProfessorStoredAccess(otherAccount)
  const stored = window.localStorage.getItem(accessKey)
  await fixture.render()
  assert.equal(fixture.requests.length, 1)
  assert.equal(document.querySelector('h1').textContent.trim(), 'Acesso ativado')
  assert.equal(window.localStorage.getItem(accessKey), stored)
  assert.deepEqual(gate.readMAProfessorStoredAccess(), otherAccount)
})

test('a local usable license cannot mask a failed server activation', async t => {
  const fixture = setup(t)
  gate.saveMAProfessorStoredAccess({ email, token: 'existing-session', deviceId: 'existing-device', license })
  const stored = window.localStorage.getItem(accessKey)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: false, message: 'Link inválido.' }, { status: 401 }))
  await fixture.render()
  assert.ok(document.body.textContent.includes('Link inválido.'))
  assert.ok(!document.body.textContent.includes('Acesso ativado'))
  assert.equal(window.localStorage.getItem(accessKey), stored)
})

test('a failed activation can be retried after credentials have been removed from the URL', async t => {
  const fixture = setup(t)
  const requests = []
  t.mock.method(globalThis, 'fetch', async (path, init) => {
    requests.push(JSON.parse(init.body))
    return requests.length === 1
      ? Response.json({ success: false, message: 'Serviço indisponível.' }, { status: 503 })
      : Response.json({ success: true, license })
  })
  await fixture.render()
  assert.ok(document.body.textContent.includes('Serviço indisponível.'))
  assert.equal(window.location.href, 'https://ma-code.pt/ma-professor?keep=1')
  const retry = [...document.querySelectorAll('button')].find(item => item.textContent.includes('Tentar novamente'))
  await act(async () => retry.click())
  assert.equal(document.querySelector('h1').textContent.trim(), 'Acesso ativado')
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[0], requests[1])
})

test('activation still works when the browser blocks local and session storage', async t => {
  const fixture = setup(t)
  for (const key of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(fixture.dom.window, key, { get() { throw new Error('Storage blocked') } })
  }
  await fixture.render()
  assert.equal(fixture.requests.length, 1)
  assert.equal(document.querySelector('h1').textContent.trim(), 'Acesso ativado')
})

test('a normal visit or incomplete link does not attempt activation', async t => {
  const fixture = setup(t, 'https://ma-code.pt/ma-professor?acesso=ativar&email=missing-code@example.com')
  await fixture.render()
  assert.equal(fixture.requests.length, 0)
  assert.ok(document.getElementById('application'))
})

async function clickButton(label) {
  const button = [...document.querySelectorAll('button')].find(item => item.textContent.trim() === label)
  assert.ok(button, `Expected button: ${label}`)
  await act(async () => button.click())
}

test('activated link opens the real login form with the email filled and only one password field', async t => {
  const fixture = setup(t)
  await fixture.renderPage()
  await clickButton('Entrar')
  assert.equal(document.querySelector('h1').textContent.trim(), 'Aceder à sua conta MA-Professor')
  assert.equal(document.querySelector('input[type=email]').value, email)
  assert.equal(document.querySelectorAll('input[type=password]').length, 1)
  assert.equal(document.querySelector('input[type=password]').value, '')
  assert.equal(document.querySelectorAll('input[type=checkbox]').length, 0)
  assert.equal(gate.readMAProfessorStoredAccess(), null)
  assert.equal(gate.readMAProfessorOpaqueExportKey(email), null)
  assert.equal(window.location.href, 'https://ma-code.pt/ma-professor?keep=1')
  assert.equal(fixture.requests.length, 1)
})

test('activated link for the existing account opens the application with its original session and key', async t => {
  const fixture = setup(t)
  gate.saveMAProfessorStoredAccess({ email, token: 'same-session', deviceId: 'same-device', license: null })
  gate.saveMAProfessorOpaqueExportKey(email, 'same-export-key')
  await fixture.renderPage()
  await clickButton('Abrir o MA-Professor')
  assert.ok(document.getElementById('application'))
  assert.equal(document.querySelectorAll('input').length, 0)
  assert.equal(gate.readMAProfessorStoredAccess().token, 'same-session')
  assert.equal(gate.readMAProfessorStoredAccess().deviceId, 'same-device')
  assert.equal(gate.readMAProfessorOpaqueExportKey(email), 'same-export-key')
  assert.equal(fixture.requests.length, 1)
})

test('another account stays signed in while opening the linked login and after a failed password attempt', async t => {
  const fixture = setup(t)
  const otherAccount = { email: 'other@example.com', token: 'other-session', deviceId: 'other-device', license: null }
  gate.saveMAProfessorStoredAccess(otherAccount)
  gate.saveMAProfessorOpaqueExportKey(otherAccount.email, 'other-export-key')
  const original = window.localStorage.getItem(accessKey)
  await fixture.renderPage()
  await clickButton('Entrar')
  assert.equal(document.querySelector('input[type=email]').value, email)
  assert.ok(document.body.textContent.includes(otherAccount.email))
  assert.equal(window.localStorage.getItem(accessKey), original)
  assert.equal(gate.readMAProfessorOpaqueExportKey(otherAccount.email), 'other-export-key')

  let loginAttempts = 0
  t.mock.method(globalThis, 'fetch', async path => {
    assert.equal(path, '/api/ma-professor/access/opaque/login/start')
    loginAttempts++
    return Response.json({ success: false, message: 'Password incorreta.' }, { status: 401 })
  })
  await act(async () => {
    const input = document.querySelector('input[type=password]')
    const setter = Object.getOwnPropertyDescriptor(fixture.dom.window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'password incorreta de teste')
    input.dispatchEvent(new fixture.dom.window.Event('input', { bubbles: true }))
  })
  await act(async () => document.querySelector('form').dispatchEvent(
    new fixture.dom.window.Event('submit', { bubbles: true, cancelable: true })
  ))
  assert.equal(loginAttempts, 1)
  assert.ok(document.body.textContent.includes('Password incorreta.'))
  assert.equal(window.localStorage.getItem(accessKey), original)
  assert.deepEqual(gate.readMAProfessorStoredAccess(), otherAccount)
  assert.equal(gate.readMAProfessorOpaqueExportKey(otherAccount.email), 'other-export-key')
  await clickButton('Continuar na conta aberta')
  assert.ok(document.getElementById('application'))
  assert.equal(window.localStorage.getItem(accessKey), original)
})

test('a consumed link uses a neutral 409 message and the same prefilled login destination', async t => {
  const fixture = setup(t)
  t.mock.method(globalThis, 'fetch', async () => Response.json(
    { success: false, message: 'A senha já foi utilizada.' }, { status: 409 }
  ))
  await fixture.renderPage()
  assert.ok(document.body.textContent.includes('Se já ativou este acesso, entre com o seu email e a sua password.'))
  assert.ok(!document.body.textContent.includes('Acesso ativado'))
  assert.ok([...document.querySelectorAll('button')].some(item => item.textContent.includes('Continuar para ativação manual')))
  assert.equal(window.location.href, 'https://ma-code.pt/ma-professor?keep=1')
  await clickButton('Entrar')
  assert.equal(document.querySelector('input[type=email]').value, email)
  assert.equal(document.querySelectorAll('input[type=password]').length, 1)
  assert.equal(gate.readMAProfessorStoredAccess(), null)
})
