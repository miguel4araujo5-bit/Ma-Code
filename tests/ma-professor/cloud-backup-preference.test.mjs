import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import ts from 'typescript'

const session = {
  email: 'professor@example.com',
  deviceId: 'device-a',
  token: 'token-a'
}

async function stage(
  t,
  sourceName,
  replacements = {}
) {
  const directory =
    await mkdtemp(
      new URL(
        '../../.backup-preference-test-',
        import.meta.url
      )
    )

  await writeFile(join(directory, 'backup.mjs'), 'export const canonicalizeMAProfessorBackupData = data => data')

  t.after(() =>
    rm(
      directory,
      {
        recursive: true,
        force: true
      }
    )
  )

  async function compile(
    file,
    target,
    imports = replacements
  ) {
    let source =
      await readFile(
        new URL(
          `../../src/components/ma-professor/${file}`,
          import.meta.url
        ),
        'utf8'
      )

    source = source.replaceAll("'../settings/backupRepository'", "'./backup.mjs'")

    for (
      const [from, to]
      of Object.entries(imports)
    ) {
      source =
        source.replaceAll(
          `'${from}'`,
          `'${to}'`
        )
    }

    const output =
      ts.transpileModule(
        source,
        {
          fileName: file,
          compilerOptions: {
            module:
              ts.ModuleKind.ESNext,
            target:
              ts.ScriptTarget.ES2022,
            jsx:
              ts.JsxEmit.ReactJSX
          }
        }
      )

    await writeFile(
      join(
        directory,
        target
      ),
      output.outputText
    )
  }

  await compile(
    sourceName,
    'subject.mjs'
  )

  return {
    directory,
    compile,
    write:
      (name, source) =>
        writeFile(
          join(directory, name),
          source
        ),
    load:
      name =>
        import(
          pathToFileURL(
            join(
              directory,
              name || 'subject.mjs'
            )
          ).href
        )
  }
}

function browser(t) {
  const dom =
    new JSDOM(
      '<div id="root"></div>',
      {
        url:
          'https://ma-code.pt'
      }
    )

  Object.defineProperty(dom.window.document, 'hasFocus', { configurable: true, value: () => true })

  for (
    const [key, value]
    of Object.entries({
      window: dom.window,
      document: dom.window.document,
      Event: dom.window.Event,
      navigator:
        dom.window.navigator,
      IS_REACT_ACT_ENVIRONMENT:
        true
    })
  ) {
    const original =
      Object.getOwnPropertyDescriptor(
        globalThis,
        key
      )

    Object.defineProperty(
      globalThis,
      key,
      {
        configurable: true,
        value,
        writable: true
      }
    )

    t.after(() =>
      original
        ? Object.defineProperty(
            globalThis,
            key,
            original
          )
        : delete globalThis[key]
    )
  }

  t.after(() =>
    dom.window.close()
  )

  return dom
}

test(
  'automatic consent defaults off, is isolated by account/device and never follows a restore trust record',
  async t => {
    browser(t)

    const files =
      await stage(
        t,
        'sync/cloudBackupPreference.ts',
        {
          './cloudBackupTrust':
            './trust.mjs'
        }
      )

    await files.compile(
      'sync/cloudBackupTrust.ts',
      'trust.mjs'
    )

    const preference =
      await files.load()

    window.localStorage.setItem(
      'ma-professor-cloud-backup-trust-v1:professor%40example.com:device-a',
      '{"serverRevision":4}'
    )

    assert.equal(
      preference.readCloudBackupPreference(
        session
      ),
      'unset'
    )
    assert.equal(
      preference.writeCloudBackupPreference(
        session,
        'enabled'
      ),
      true
    )
    assert.equal(
      preference.readCloudBackupPreference({
        ...session,
        email:
          ' PROFESSOR@example.com '
      }),
      'enabled'
    )
    assert.equal(
      preference.readCloudBackupPreference({
        ...session,
        email: 'other@example.com'
      }),
      'unset'
    )
    assert.equal(
      preference.readCloudBackupPreference({
        ...session,
        deviceId: 'device-b'
      }),
      'unset'
    )

    preference.writeCloudBackupPreference(
      session,
      'disabled'
    )

    assert.equal(
      preference.readCloudBackupPreference(
        session
      ),
      'disabled'
    )
    assert.equal(
      window.localStorage.getItem(
        'ma-professor-cloud-backup-trust-v1:professor%40example.com:device-a'
      ),
      '{"serverRevision":4}'
    )

    t.mock.method(
      window.Storage.prototype,
      'getItem',
      () => {
        throw new Error(
          'storage unavailable'
        )
      }
    )

    assert.equal(
      preference.readCloudBackupPreference(
        session
      ),
      'unset'
    )

    t.mock.method(
      window.Storage.prototype,
      'setItem',
      () => {
        throw new Error(
          'storage unavailable'
        )
      }
    )

    assert.equal(
      preference.writeCloudBackupPreference(
        session,
        'enabled'
      ),
      false
    )
  }
)

async function automaticHarness(
  t,
  initialize
) {
  let root

  t.after(
    async () => {
      if (root) {
        await act(
          async () =>
            root.unmount()
        )
      }
    }
  )

  browser(t)
  t.mock.timers.enable({
    apis: [
      'setTimeout',
      'Date'
    ],
    now:
      new Date(
        '2026-09-20T12:00:00Z'
      )
  })

  const replacements = {
    dexie: './dexie.mjs',
    '../access/AccessGate':
      './access.mjs',
    '../db': './db.mjs',
    '../settings/backupRepository':
      './backup.mjs',
    './cloudBackupService':
      './service.mjs',
    './cloudBackupTrust':
      './trust.mjs',
    './cloudBackupPreference':
      './preference.mjs',
    './CloudBackupPreferencePanel':
      './panel.mjs',
    '../access/accessStorage':
      './access-storage.mjs',
    './CloudBackupReauthentication':
      './reauth.mjs'
  }

  const files =
    await stage(
      t,
      'sync/AutomaticCloudBackup.tsx',
      replacements
    )

  await files.compile(
    'sync/cloudBackupPreference.ts',
    'preference.mjs'
  )
  await files.compile(
    'sync/CloudBackupPreferencePanel.tsx',
    'panel.mjs'
  )
  await files.compile(
    'sync/cloudBackupTrust.ts',
    'trust.mjs'
  )
  await files.compile(
    'sync/CloudBackupReauthentication.tsx',
    'reauth.mjs'
  )

  await files.write(
    'access-storage.mjs',
    `
      let key = 'memory-key'
      export const MA_PROFESSOR_OPAQUE_KEY_EVENT = 'opaque-key-change'
      export const readMAProfessorOpaqueExportKey = () => key
      export function setKey(value) {
        key = value
        window.dispatchEvent(new Event(MA_PROFESSOR_OPAQUE_KEY_EVENT))
      }
    `
  )

  await files.write(
    'access.mjs',
    `
      import { setKey } from './access-storage.mjs'
      export const useMAProfessorAccess = () => ({
        session: ${JSON.stringify(session)},
        reauthenticate: async password => {
          if (password !== 'correct-password') throw new Error('wrong password')
          setKey('memory-key')
        }
      })
    `
  )

  await files.write(
    'db.mjs',
    "export const MA_PROFESSOR_DATABASE_NAME = 'ma-professor'"
  )

  await files.write(
    'backup.mjs',
    `
      export const canonicalizeMAProfessorBackupData = data => data
      export let currentName = 'Test'
      export const setName = value => { currentName = value }
      let pending = null
      export const holdPreparation = promise => { pending = promise }
      export async function createMAProfessorBackup() {
        if (pending) await pending
        return { product: 'ma-professor', schemaVersion: 1, data: { students: [{ name: currentName }] } }
      }
    `
  )

  await files.write(
    'dexie.mjs',
    `
      export const listeners = new Set()
      export default {
        on(event, listener) {
          if (listener) listeners.add(listener)
          return {
            unsubscribe(listener) {
              listeners.delete(listener)
            }
          }
        }
      }
      export function mutate() {
        for (const listener of listeners) {
          listener({ 'idb://ma-professor/students': true })
        }
      }
    `
  )

  await files.write(
    'service.mjs',
    `
      export const calls = { inspect: 0, upload: 0, download: 0 }
      let waitForStatus = null
      let waitForUpload = null
      let uploadError = null
      export let lastUpload = null
      export const holdUpload = promise => { waitForUpload = promise }
      export const setUploadError = error => { uploadError = error }
      let revision = 0
      export function setRevision(value) { revision = value }
      export function holdStatus(promise) { waitForStatus = promise }
      export const MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT = 'backup-auth-required'
      export class MAProfessorCloudBackupAuthenticationRequiredError extends Error {
        constructor(email) {
          super('unlock required')
          window.dispatchEvent(new window.CustomEvent(MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT, { detail: email }))
        }
      }
      export class MAProfessorCloudBackupPermanentError extends Error {}
      export class MAProfessorCloudBackupRevisionConflictError extends Error {}
      export async function inspectMAProfessorCloudBackup() {
        calls.inspect++
        if (waitForStatus) await waitForStatus
        return {
          cryptoVersion: 3,
          serverRevision: revision,
          backup: { found: revision > 0 }
        }
      }
      export async function downloadMAProfessorCloudBackupV3() {
        calls.download++
        return null
      }
      export async function uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, options) {
        if (!options.canUpload()) throw new Error('disabled')
        calls.upload++
        lastUpload = { session, backup, options }
        if (waitForUpload) await waitForUpload
        if (uploadError) throw uploadError
        revision++
        return {
          serverRevision: revision,
          recordRevision: revision,
          updatedAt: new Date().toISOString()
        }
      }
    `
  )

  const [
    subject,
    preference,
    service,
    dexie,
    panel
  ] =
    await Promise.all([
      files.load(),
      files.load('preference.mjs'),
      files.load('service.mjs'),
      files.load('dexie.mjs'),
      files.load('panel.mjs')
    ])

  const trust =
    await files.load('trust.mjs')
  const storage =
    await files.load('access-storage.mjs')
  const backup = await files.load('backup.mjs')

  if (initialize) {
    initialize({
      preference,
      service,
      trust,
      storage
    })
  }

  root =
    createRoot(
      document.getElementById('root')
    )

  await act(
    async () =>
      root.render(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            subject.default
          ),
          React.createElement(
            panel.default,
            {
              onlyUnanswered: true
            }
          )
        )
      )
  )

  return {
    preference,
    service,
    dexie,
    storage,
    trust,
    backup,
    click: async label => act(async () => {
      const button = [...document.querySelectorAll('button')].find(item => item.textContent === label)
      assert.ok(button, `Missing button: ${label}`)
      button.click()
    }),
    mutate: async () => act(async () => dexie.mutate()),
    remount: async () => act(async () => {
      root.unmount()
      root = createRoot(document.getElementById('root'))
      root.render(React.createElement(subject.default))
    }),
    tick:
      async ms =>
        act(
          async () =>
            t.mock.timers.tick(ms)
        )
  }
}

const reminderTitle = 'Tem alterações significativas por guardar. Deseja guardar o seu progresso?'
const dialog = () => document.querySelector('[role=dialog]')
const noNetwork = service => assert.deepEqual(service.calls, { inspect: 0, upload: 0, download: 0 })

test('enabling reminders never sends data; only Sim saves the data current at the time of confirmation', async t => {
  const h = await automaticHarness(t)
  assert.match(document.body.textContent, /não recebe a sua password pessoal/)
  assert.match(document.body.textContent, /dados são cifrados neste dispositivo antes do envio/)
  await h.mutate()
  await h.tick(15 * 60 * 1000)
  noNetwork(h.service)
  assert.equal(h.dexie.listeners.size, 0)

  await h.click('Ativar lembretes de cópia')
  assert.equal(h.preference.readCloudBackupPreference(session), 'enabled')
  assert.equal(h.dexie.listeners.size, 1)
  await h.tick(90 * 1000)
  assert.ok(dialog())
  assert.match(dialog().textContent, new RegExp(reminderTitle.replace('?', '\?')))
  assert.deepEqual([...dialog().querySelectorAll('button')].map(b => b.textContent), ['Sim', 'Não', 'Não voltar a perguntar'])
  assert.equal(document.activeElement.textContent, 'Não')
  noNetwork(h.service)

  h.backup.setName('Data changed after the reminder appeared')
  await h.click('Sim')
  assert.equal(h.service.calls.upload, 1)
  assert.equal(h.service.lastUpload.backup.data.students[0].name, 'Data changed after the reminder appeared')
  assert.equal(h.service.lastUpload.options.expectedServerRevision, undefined)
  assert.equal(dialog(), null)
  assert.match(document.querySelector('[role=status]').textContent, /guardada e verificada/)
  await h.tick(15 * 60 * 1000)
  assert.equal(h.service.calls.upload, 1)
  assert.equal(dialog(), null)
})

test('Não sends nothing, retains pending changes and respects the interval across reload', async t => {
  const h = await automaticHarness(t, ({preference, trust}) => {
    preference.writeCloudBackupPreference(session, 'enabled')
    trust.writeMAProfessorCloudBackupTrust(session, {serverRevision: 2, recordRevision: 2, updatedAt: '2026-09-20T10:00:00Z'})
  })
  await h.mutate()
  await h.tick(90 * 1000)
  await h.click('Não')
  assert.equal(dialog(), null)
  assert.ok(h.trust.readMAProfessorCloudBackupTrust(session).dirtyAt)
  await h.remount()
  await h.tick(9 * 60 * 1000)
  assert.equal(dialog(), null)
  await h.tick(60 * 1000)
  assert.ok(dialog())
  noNetwork(h.service)
})

test('Não voltar a perguntar persists, does not send, and settings can re-enable reminders', async t => {
  const h = await automaticHarness(t, ({preference}) => preference.writeCloudBackupPreference(session, 'enabled'))
  await h.tick(90 * 1000)
  await h.click('Não voltar a perguntar')
  assert.equal(h.preference.readCloudBackupPreference(session), 'disabled')
  assert.equal(h.dexie.listeners.size, 0)
  await h.remount()
  await h.mutate()
  await h.tick(60 * 60 * 1000)
  assert.equal(dialog(), null)
  noNetwork(h.service)
  await act(async () => h.preference.writeCloudBackupPreference(session, 'enabled'))
  await h.tick(90 * 1000)
  assert.ok(dialog())
  noNetwork(h.service)
})

test('legacy enabled preference migrates to reminders so old windows cannot silently upload', async t => {
  const key = 'ma-professor-cloud-backup-choice-v1:professor%40example.com:device-a'
  const h = await automaticHarness(t, () => window.localStorage.setItem(key, 'enabled'))
  assert.equal(h.preference.readCloudBackupPreference(session), 'enabled')
  assert.equal(window.localStorage.getItem(key), 'reminders')
  // This is the exact authorization condition in the previous version.
  assert.notEqual(window.localStorage.getItem(key), 'enabled')
  await h.tick(90 * 1000)
  assert.ok(dialog())
  noNetwork(h.service)
})

test('a disable from another window during preparation prevents the confirmed upload', async t => {
  const h = await automaticHarness(t, ({preference}) => preference.writeCloudBackupPreference(session, 'enabled'))
  let release
  h.backup.holdPreparation(new Promise(resolve => { release = resolve }))
  await h.tick(90 * 1000)
  await h.click('Sim')
  const key = Object.keys(window.localStorage).find(key => key.startsWith('ma-professor-cloud-backup-choice-v1:'))
  await act(async () => {
    window.localStorage.setItem(key, 'disabled')
    window.dispatchEvent(new window.StorageEvent('storage', {key, newValue: 'disabled'}))
    release()
  })
  await h.tick(15 * 60 * 1000)
  noNetwork(h.service)
  assert.equal(dialog(), null)
  assert.equal(h.dexie.listeners.size, 0)
})

test('a clean device does not prompt; re-enabling covers edits made while disabled', async t => {
  const h = await automaticHarness(t, ({preference, trust}) => {
    preference.writeCloudBackupPreference(session, 'enabled')
    trust.writeMAProfessorCloudBackupTrust(session, {serverRevision: 4, recordRevision: 4, updatedAt: new Date().toISOString()})
  })
  await h.tick(15 * 60 * 1000)
  assert.equal(dialog(), null)
  noNetwork(h.service)
  await act(async () => h.preference.writeCloudBackupPreference(session, 'disabled'))
  await act(async () => h.preference.writeCloudBackupPreference(session, 'enabled'))
  await h.tick(90 * 1000)
  assert.ok(dialog())
  noNetwork(h.service)
})

test('missing OPAQUE key makes no silent network request and unlock resumes the reminder, not an upload', async t => {
  const h = await automaticHarness(t, ({preference, storage}) => {
    storage.setKey(null)
    preference.writeCloudBackupPreference(session, 'enabled')
  })
  await h.mutate()
  await h.tick(60 * 60 * 1000)
  assert.equal(dialog(), null)
  assert.equal(document.querySelector('input[type=password]'), null)
  noNetwork(h.service)
  await act(async () => h.storage.setKey('memory-key'))
  await h.tick(90 * 1000)
  assert.ok(dialog())
  noNetwork(h.service)
  await h.click('Sim')
  assert.equal(h.service.calls.upload, 1)
  assert.equal(Object.values(window.localStorage).some(value => value.includes('memory-key')), false)
})

test('changes during a confirmed upload remain pending after reload and never trigger a silent second upload', async t => {
  const h = await automaticHarness(t, ({preference, trust}) => {
    preference.writeCloudBackupPreference(session, 'enabled')
    trust.writeMAProfessorCloudBackupTrust(session, {serverRevision: 8, recordRevision: 8, updatedAt: '2026-09-20T10:00:00Z'})
  })
  let release
  h.service.holdUpload(new Promise(resolve => { release = resolve }))
  await h.mutate()
  await h.tick(90 * 1000)
  await h.click('Sim')
  await h.mutate()
  await act(async () => release())
  assert.ok(h.trust.readMAProfessorCloudBackupTrust(session).dirtyAt)
  await h.remount()
  await h.tick(10 * 60 * 1000)
  assert.ok(dialog())
  assert.equal(h.service.calls.upload, 1)
})

test('upload failures stay visible and require another Sim; no automatic retries', async t => {
  const h = await automaticHarness(t, ({preference}) => preference.writeCloudBackupPreference(session, 'enabled'))
  h.service.setUploadError(new h.service.MAProfessorCloudBackupPermanentError('The upload was rejected'))
  await h.tick(90 * 1000)
  await h.click('Sim')
  assert.match(document.querySelector('[role=alert]').textContent, /Não foi possível confirmar/)
  await h.tick(60 * 60 * 1000)
  await h.mutate()
  assert.equal(h.service.calls.upload, 1)
  h.service.setUploadError(null)
  await h.click('Sim')
  assert.equal(h.service.calls.upload, 2)
  assert.equal(dialog(), null)
})

test('a hidden window waits for focus; reminders do not interrupt another open dialog', async t => {
  let focused = false
  const h = await automaticHarness(t, ({preference}) => {
    Object.defineProperty(document, 'hasFocus', {configurable:true, value:() => focused})
    preference.writeCloudBackupPreference(session, 'enabled')
  })
  await h.tick(90 * 1000)
  assert.equal(dialog(), null)
  noNetwork(h.service)
  const editor = document.createElement('div')
  editor.setAttribute('aria-modal','true')
  document.body.append(editor)
  focused = true
  await act(async () => window.dispatchEvent(new Event('focus')))
  await h.tick(1)
  assert.equal(dialog(), null)
  editor.remove()
  await h.tick(90 * 1000)
  assert.ok(dialog())
  noNetwork(h.service)
})

test('quiet-period debounce and maximum dirty time only produce a question, never a network request', async t => {
  const h = await automaticHarness(t, ({preference, trust}) => {
    preference.writeCloudBackupPreference(session, 'enabled')
    trust.writeMAProfessorCloudBackupTrust(session, {serverRevision:1,recordRevision:1,updatedAt:'2026-09-20T10:00:00Z'})
  })
  await h.mutate()
  for (let i=0; i<4; i++) {
    await h.tick(60 * 1000)
    assert.equal(dialog(), null)
    await h.mutate()
  }
  await h.tick(60 * 1000)
  assert.ok(dialog())
  noNetwork(h.service)
})

test('a successful manual copy clears the queued question without sending another copy', async t => {
  const h = await automaticHarness(t, ({preference, trust}) => {
    preference.writeCloudBackupPreference(session, 'enabled')
    trust.writeMAProfessorCloudBackupTrust(session, {serverRevision:1,recordRevision:1,updatedAt:'2026-09-20T10:00:00Z'})
  })
  await h.mutate()
  await act(async () => h.trust.writeMAProfessorCloudBackupTrust(session,{serverRevision:2,recordRevision:2,updatedAt:new Date().toISOString()}))
  await h.tick(15 * 60 * 1000)
  assert.equal(dialog(), null)
  noNetwork(h.service)
})
