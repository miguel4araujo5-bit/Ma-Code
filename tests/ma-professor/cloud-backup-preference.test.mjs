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
    "export async function createMAProfessorBackup() { return { product: 'ma-professor', schemaVersion: 1, data: { students: [{ name: 'Test' }] } } }"
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
    tick:
      async ms =>
        act(
          async () =>
            t.mock.timers.tick(ms)
        )
  }
}

test(
  'no automatic network access before a choice; enabling protects existing local data and disabling cancels queued work',
  async t => {
    const {
      preference,
      service,
      dexie,
      tick
    } =
      await automaticHarness(t)

    assert.match(
      document.body.textContent,
      /não recebe a sua password pessoal/
    )
    assert.match(
      document.body.textContent,
      /dados são cifrados neste dispositivo antes do envio/
    )
    assert.doesNotMatch(
      document.body.textContent,
      /proteção v[23]/
    )
    assert.match(
      document.body.textContent,
      /Manter desativada/
    )

    dexie.mutate()
    await tick(
      15 * 60 * 1000
    )

    assert.deepEqual(
      service.calls,
      {
        inspect: 0,
        upload: 0,
        download: 0
      }
    )
    assert.equal(
      dexie.listeners.size,
      0
    )

    await act(
      async () => {
        [...document.querySelectorAll('button')]
          .find(
            button =>
              button.textContent ===
              'Ativar cópia automática'
          )
          .click()
      }
    )

    assert.equal(
      preference.readCloudBackupPreference(
        session
      ),
      'enabled'
    )
    assert.equal(
      dexie.listeners.size,
      1
    )

    await tick(
      90 * 1000
    )

    assert.equal(
      service.calls.upload,
      1,
      'Existing persisted data is backed up after opting in without requiring another edit.'
    )

    dexie.mutate()

    await act(
      async () =>
        preference.writeCloudBackupPreference(
          session,
          'disabled'
        )
    )

    await tick(
      15 * 60 * 1000
    )

    assert.equal(
      service.calls.upload,
      1
    )
    assert.equal(
      dexie.listeners.size,
      0
    )
  }
)

test(
  'a disable arriving from another tab during reconciliation prevents upload and removes observers',
  async t => {
    const {
      preference,
      service,
      dexie,
      tick
    } =
      await automaticHarness(t)

    let release

    service.holdStatus(
      new Promise(
        resolve => {
          release = resolve
        }
      )
    )

    await act(
      async () =>
        preference.writeCloudBackupPreference(
          session,
          'enabled'
        )
    )

    assert.equal(
      service.calls.inspect,
      1
    )

    await act(
      async () => {
        const key =
          Object.keys(
            window.localStorage
          ).find(
            item =>
              item.startsWith(
                'ma-professor-cloud-backup-choice-v1:'
              )
          )

        window.localStorage.setItem(
          key,
          'disabled'
        )
        window.dispatchEvent(
          new window.StorageEvent(
            'storage',
            {
              key,
              newValue: 'disabled'
            }
          )
        )
        release()
      }
    )

    await tick(
      15 * 60 * 1000
    )

    assert.equal(
      service.calls.upload,
      0
    )
    assert.equal(
      dexie.listeners.size,
      0
    )
  }
)

test(
  'reopening an enabled and clean device makes no redundant upload; re-enabling covers edits made while disabled',
  async t => {
    const {
      preference,
      service,
      tick
    } =
      await automaticHarness(
        t,
        ({
          preference,
          service,
          trust
        }) => {
          preference.writeCloudBackupPreference(
            session,
            'enabled'
          )
          trust.writeMAProfessorCloudBackupTrust(
            session,
            {
              serverRevision: 4,
              recordRevision: 4,
              updatedAt:
                new Date().toISOString()
            }
          )
          service.setRevision(4)
        }
      )

    await tick(
      15 * 60 * 1000
    )

    assert.equal(
      service.calls.upload,
      0
    )

    await act(
      async () =>
        preference.writeCloudBackupPreference(
          session,
          'disabled'
        )
    )
    await act(
      async () =>
        preference.writeCloudBackupPreference(
          session,
          'enabled'
        )
    )

    await tick(
      90 * 1000
    )

    assert.equal(
      service.calls.upload,
      1
    )
  }
)

test(
  'reload without the in-memory OPAQUE key stops automatic backup and resumes after unlock',
  async t => {
    const {
      service,
      dexie,
      storage,
      tick
    } =
      await automaticHarness(
        t,
        ({
          preference,
          storage
        }) => {
          storage.setKey(null)
          preference.writeCloudBackupPreference(
            session,
            'enabled'
          )
        }
      )

    assert.equal(
      document.querySelector(
        'input[type=password]'
      ),
      null
    )
    assert.doesNotMatch(
      document.body.textContent,
      /Confirme a sua password/
    )

    const initialCalls = {
      ...service.calls
    }

    dexie.mutate()
    await tick(
      60 * 60 * 1000
    )

    assert.deepEqual(
      service.calls,
      initialCalls,
      'No silent retry requests while locked'
    )
    assert.equal(
      service.calls.upload,
      0
    )

    await act(
      async () =>
        storage.setKey(
          'memory-key'
        )
    )
    await tick(
      90 * 1000
    )

    assert.equal(
      service.calls.upload,
      1
    )
    assert.equal(
      Object.values(
        window.localStorage
      ).some(
        value =>
          value.includes(
            'memory-key'
          )
      ),
      false
    )
  }
)
