import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import ts from 'typescript'

const session = { email: 'professor@example.com', deviceId: 'device-a', token: 'token-a' }

async function stage(t, sourceName, replacements = {}) {
  const directory = await mkdtemp(new URL('../../.backup-preference-test-', import.meta.url))
  t.after(() => rm(directory, { recursive: true, force: true }))

  async function compile(file, target, imports = replacements) {
    let source = await readFile(new URL(`../../src/components/ma-professor/${file}`, import.meta.url), 'utf8')
    for (const [from, to] of Object.entries(imports)) source = source.replaceAll(`'${from}'`, `'${to}'`)
    const output = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
    })
    await writeFile(join(directory, target), output.outputText)
  }

  await compile(sourceName, 'subject.mjs')
  return {
    directory,
    compile,
    write: (name, source) => writeFile(join(directory, name), source),
    load: name => import(pathToFileURL(join(directory, name || 'subject.mjs')).href)
  }
}

function browser(t) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://ma-code.pt' })
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, Event: dom.window.Event,
    navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value, writable: true })
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key])
  }
  t.after(() => dom.window.close())
  return dom
}

test('automatic consent defaults off, is isolated by account/device and never follows a restore trust record', async t => {
  browser(t)
  const files = await stage(t, 'sync/cloudBackupPreference.ts', { './cloudBackupTrust': './trust.mjs' })
  await files.compile('sync/cloudBackupTrust.ts', 'trust.mjs')
  const preference = await files.load()
  window.localStorage.setItem('ma-professor-cloud-backup-trust-v1:professor%40example.com:device-a', '{"serverRevision":4}')
  assert.equal(preference.readCloudBackupPreference(session), 'unset')
  assert.equal(preference.writeCloudBackupPreference(session, 'enabled'), true)
  assert.equal(preference.readCloudBackupPreference({ ...session, email: ' PROFESSOR@example.com ' }), 'enabled')
  assert.equal(preference.readCloudBackupPreference({ ...session, email: 'other@example.com' }), 'unset')
  assert.equal(preference.readCloudBackupPreference({ ...session, deviceId: 'device-b' }), 'unset')
  preference.writeCloudBackupPreference(session, 'disabled')
  assert.equal(preference.readCloudBackupPreference(session), 'disabled')
  assert.equal(window.localStorage.getItem('ma-professor-cloud-backup-trust-v1:professor%40example.com:device-a'), '{"serverRevision":4}')
  t.mock.method(window.Storage.prototype, 'getItem', () => { throw new Error('storage unavailable') })
  assert.equal(preference.readCloudBackupPreference(session), 'unset')
  t.mock.method(window.Storage.prototype, 'setItem', () => { throw new Error('storage unavailable') })
  assert.equal(preference.writeCloudBackupPreference(session, 'enabled'), false)
})

async function automaticHarness(t, initialize) {
  let root
  t.after(async () => { if (root) await act(async () => root.unmount()) })
  browser(t)
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-09-20T12:00:00Z') })
  const replacements = {
    dexie: './dexie.mjs', '../access/AccessGate': './access.mjs', '../db': './db.mjs',
    '../settings/backupRepository': './backup.mjs', './cloudBackupService': './service.mjs',
    './cloudBackupTrust': './trust.mjs', './cloudBackupPreference': './preference.mjs',
    './CloudBackupPreferencePanel': './panel.mjs',
    '../access/accessStorage': './access-storage.mjs',
    './CloudBackupReauthentication': './reauth.mjs'
  }
  const files = await stage(t, 'sync/AutomaticCloudBackup.tsx', replacements)
  await files.compile('sync/cloudBackupPreference.ts', 'preference.mjs')
  await files.compile('sync/CloudBackupPreferencePanel.tsx', 'panel.mjs')
  await files.compile('sync/cloudBackupTrust.ts', 'trust.mjs')
  await files.compile('sync/CloudBackupReauthentication.tsx', 'reauth.mjs')
  await files.write('access-storage.mjs', `
    let key = 'memory-key'
    export const MA_PROFESSOR_OPAQUE_KEY_EVENT = 'opaque-key-change'
    export const readMAProfessorOpaqueExportKey = () => key
    export function setKey(value) { key = value; window.dispatchEvent(new Event(MA_PROFESSOR_OPAQUE_KEY_EVENT)) }
  `)
  await files.write('access.mjs', `import { setKey } from './access-storage.mjs'; export const useMAProfessorAccess = () => ({ session: ${JSON.stringify(session)}, reauthenticate: async password => { if (password !== 'correct-password') throw new Error('wrong password'); setKey('memory-key') } })`)
  await files.write('db.mjs', "export const MA_PROFESSOR_DATABASE_NAME = 'ma-professor'")
  await files.write('backup.mjs', "export async function createMAProfessorBackup() { return { product: 'ma-professor', schemaVersion: 1, data: { students: [{ name: 'Test' }] } } }")
  await files.write('dexie.mjs', `
    export const listeners = new Set()
    export default { on(event, listener) {
      if (listener) listeners.add(listener)
      return { unsubscribe(listener) { listeners.delete(listener) } }
    } }
    export function mutate() { for (const listener of listeners) listener({ 'idb://ma-professor/students': true }) }
  `)
  await files.write('service.mjs', `
    export const calls = { inspect: 0, upload: 0, download: 0 }
    let waitForStatus = null
    let revision = 0
    export function setRevision(value) { revision = value }
    export function holdStatus(promise) { waitForStatus = promise }
    export const MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT = 'backup-auth-required'
    export class MAProfessorCloudBackupAuthenticationRequiredError extends Error {
      constructor(email) { super('unlock required'); window.dispatchEvent(new window.CustomEvent(MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT, { detail: email })) }
    }
    export class MAProfessorCloudBackupRevisionConflictError extends Error {}
    export async function inspectMAProfessorCloudBackup() {
      calls.inspect++
      if (waitForStatus) await waitForStatus
      return { cryptoVersion: 3, serverRevision: revision, backup: { found: revision > 0 } }
    }
    export async function downloadMAProfessorCloudBackup() { calls.download++; return null }
    export async function downloadCompatibleMAProfessorCloudBackup() { calls.download++; return null }
    export async function uploadAndVerifyCompatibleMAProfessorCloudBackup(session, backup, options) {
      if (!options.canUpload()) throw new Error('disabled')
      calls.upload++
      revision++
      return { serverRevision: revision, recordRevision: revision, updatedAt: new Date().toISOString() }
    }
  `)
  const [subject, preference, service, dexie, panel] = await Promise.all([
    files.load(), files.load('preference.mjs'), files.load('service.mjs'), files.load('dexie.mjs'), files.load('panel.mjs')
  ])
  const trust = await files.load('trust.mjs')
  const storage = await files.load('access-storage.mjs')
  if (initialize) initialize({ preference, service, trust, storage })
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(subject.default),
    React.createElement(panel.default, { onlyUnanswered: true })
  )))
  return { preference, service, dexie, storage, tick: async ms => act(async () => t.mock.timers.tick(ms)) }
}

test('no automatic network access before a choice; enabling protects existing local data and disabling cancels queued work', async t => {
  const { preference, service, dexie, tick } = await automaticHarness(t)
  assert.match(document.body.textContent, /não recebe a sua password pessoal/)
  assert.match(document.body.textContent, /dados são cifrados neste dispositivo antes do envio/)
  assert.doesNotMatch(document.body.textContent, /proteção v[23]/)
  assert.match(document.body.textContent, /Manter desativada/)
  dexie.mutate()
  await tick(15 * 60 * 1000)
  assert.deepEqual(service.calls, { inspect: 0, upload: 0, download: 0 })
  assert.equal(dexie.listeners.size, 0)

  await act(async () => {
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Ativar cópia automática').click()
  })
  assert.equal(preference.readCloudBackupPreference(session), 'enabled')
  assert.equal(dexie.listeners.size, 1)
  await tick(90 * 1000)
  assert.equal(service.calls.upload, 1, 'Existing persisted data is backed up after opting in without requiring another edit.')
  dexie.mutate()
  await act(async () => preference.writeCloudBackupPreference(session, 'disabled'))
  await tick(15 * 60 * 1000)
  assert.equal(service.calls.upload, 1)
  assert.equal(dexie.listeners.size, 0)
})

test('a disable arriving from another tab during reconciliation prevents upload and removes observers', async t => {
  const { preference, service, dexie, tick } = await automaticHarness(t)
  let release
  service.holdStatus(new Promise(resolve => { release = resolve }))
  await act(async () => preference.writeCloudBackupPreference(session, 'enabled'))
  assert.equal(service.calls.inspect, 1)
  await act(async () => {
    const key = Object.keys(window.localStorage).find(key => key.startsWith('ma-professor-cloud-backup-choice-v1:'))
    window.localStorage.setItem(key, 'disabled')
    window.dispatchEvent(new window.StorageEvent('storage', { key, newValue: 'disabled' }))
    release()
  })
  await tick(15 * 60 * 1000)
  assert.equal(service.calls.upload, 0)
  assert.equal(dexie.listeners.size, 0)
})

test('reopening an enabled and clean device makes no redundant upload; re-enabling covers edits made while disabled', async t => {
  const { preference, service, tick } = await automaticHarness(t, ({ preference, service, trust }) => {
    preference.writeCloudBackupPreference(session, 'enabled')
    trust.writeMAProfessorCloudBackupTrust(session, {
      serverRevision: 4, recordRevision: 4, updatedAt: new Date().toISOString()
    })
    service.setRevision(4)
  })
  await tick(15 * 60 * 1000)
  assert.equal(service.calls.upload, 0)
  await act(async () => preference.writeCloudBackupPreference(session, 'disabled'))
  await act(async () => preference.writeCloudBackupPreference(session, 'enabled'))
  await tick(90 * 1000)
  assert.equal(service.calls.upload, 1)
})

test('v3 preparation fails closed without an in-memory OPAQUE export key and performs no request', async t => {
  const files = await stage(t, 'sync/cloudBackupService.ts', {
    '../settings/backupRepository': './validation.mjs',
    '../access/accessStorage': './access-storage.mjs',
    './cloudBackupV3Crypto': './cloud-backup-v3-crypto.mjs'
  })
  await files.write('validation.mjs', 'export const validateMAProfessorBackup = () => ({ valid: true })')
  await files.write('access-storage.mjs', 'export const readMAProfessorOpaqueExportKey = () => null')
  await files.write('cloud-backup-v3-crypto.mjs', [
    'export const createMAProfessorBackupV3KeyMaterial = async () => { throw new Error("must not run") }',
    'export const encryptMAProfessorBackupV3Data = async () => { throw new Error("must not run") }',
    'export const decryptMAProfessorBackupV3Data = async () => { throw new Error("must not run") }',
    'export const unwrapMAProfessorBackupV3MasterKey = async () => { throw new Error("unused") }',
  ].join('\n'))
  const service = await files.load()
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network must not run')
  })
  const backup = { product: 'ma-professor', data: { students: [] } }
  await assert.rejects(
    service.prepareMAProfessorCloudBackupV3Promotion(session, backup),
    /sessão OPAQUE necessária/
  )
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('v3 preparation validates locally and never contacts the server', async t => {
  const files = await stage(t, 'sync/cloudBackupService.ts', {
    '../settings/backupRepository': './validation.mjs',
    '../access/accessStorage': './access-storage.mjs',
    './cloudBackupV3Crypto': './cloud-backup-v3-crypto.mjs'
  })
  await files.write('validation.mjs', 'export const validateMAProfessorBackup = value => ({ valid: value?.product === "ma-professor" })')
  await files.write('access-storage.mjs', 'export const readMAProfessorOpaqueExportKey = () => "opaque-export-key"')
  await files.write('cloud-backup-v3-crypto.mjs', [
    'let bytes;',
    'export const createMAProfessorBackupV3KeyMaterial = async key => ({ masterKey: { key }, wrapped: { cryptoVersion: 3 } })',
    'export const encryptMAProfessorBackupV3Data = async (_key, value, context) => { bytes = value; return { encryptionVersion: 3, encryptionAlgorithm: "AES-256-GCM", nonce: "nonce", ciphertext: "ciphertext", ciphertextHash: "hash", context } }',
    'export const decryptMAProfessorBackupV3Data = async (_key, _encrypted, context) => { if (context !== "database-v1") throw new Error("wrong context"); return bytes }',
    'export const unwrapMAProfessorBackupV3MasterKey = async () => { throw new Error("unused") }',
  ].join('\n'))
  const service = await files.load()
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network must not run')
  })
  const backup = { product: 'ma-professor', data: { students: [{ name: 'Private student' }] } }
  const prepared = await service.prepareMAProfessorCloudBackupV3Promotion(session, backup)
  assert.equal(prepared.profile.cryptoVersion, 3)
  assert.equal(prepared.encrypted.encryptionVersion, 3)
  assert.equal(prepared.encrypted.context, 'database-v1')
  assert.equal(prepared.plaintextBytes > 0, true)
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('explicit v3 promotion sends only the prepared envelope with CAS revision', async t => {
  const files = await stage(t, 'sync/cloudBackupService.ts', {
    '../settings/backupRepository': './validation.mjs',
    '../access/accessStorage': './access-storage.mjs',
    './cloudBackupV3Crypto': './cloud-backup-v3-crypto.mjs'
  })
  await files.write('validation.mjs', 'export const validateMAProfessorBackup = () => ({ valid: true })')
  await files.write('access-storage.mjs', 'export const readMAProfessorOpaqueExportKey = () => null')
  await files.write('cloud-backup-v3-crypto.mjs', [
    'export const createMAProfessorBackupV3KeyMaterial = async () => { throw new Error("unused") }',
    'export const encryptMAProfessorBackupV3Data = async () => { throw new Error("unused") }',
    'export const decryptMAProfessorBackupV3Data = async () => { throw new Error("unused") }',
    'export const unwrapMAProfessorBackupV3MasterKey = async () => { throw new Error("unused") }',
  ].join('\n'))
  const service = await files.load()
  const prepared = {
    profile: { cryptoVersion: 3, recoveryKdfAlgorithm: 'OPAQUE-RFC9807-EXPORT-HKDF-SHA256' },
    encrypted: { encryptionVersion: 3, encryptionAlgorithm: 'AES-256-GCM', nonce: 'nonce', ciphertext: 'ciphertext', ciphertextHash: 'hash' },
    plaintextHash: 'local-only', plaintextBytes: 123, encryptedBytes: 456
  }
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.endsWith('/promote-v3'), true)
    const body = JSON.parse(options.body)
    assert.deepEqual(body, {
      token: session.token,
      deviceId: session.deviceId,
      recordId: 'database-v1',
      expectedServerRevision: 7,
      expectedRecordRevision: 3,
      profile: prepared.profile,
      encrypted: prepared.encrypted
    })
    assert.equal(JSON.stringify(body).includes('local-only'), false)
    return Response.json({ success: true, cryptoVersion: 3, recordId: 'database-v1', serverRevision: 8, recordRevision: 4, updatedAt: '2026-09-21T13:00:00Z' })
  })
  const result = await service.promotePreparedMAProfessorCloudBackupV3(session, prepared, 7, 3)
  assert.deepEqual(result, { cryptoVersion: 3, serverRevision: 8, recordRevision: 4, updatedAt: '2026-09-21T13:00:00Z' })
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('v3 promotion exposes a typed conflict on 409 and does not retry or fall back to v2', async t => {
  const files = await stage(t, 'sync/cloudBackupService.ts', {
    '../settings/backupRepository': './validation.mjs',
    '../access/accessStorage': './access-storage.mjs',
    './cloudBackupV3Crypto': './cloud-backup-v3-crypto.mjs'
  })
  await files.write('validation.mjs', 'export const validateMAProfessorBackup = () => ({ valid: true })')
  await files.write('access-storage.mjs', 'export const readMAProfessorOpaqueExportKey = () => null')
  await files.write('cloud-backup-v3-crypto.mjs', [
    'export const createMAProfessorBackupV3KeyMaterial = async () => { throw new Error("unused") }',
    'export const encryptMAProfessorBackupV3Data = async () => { throw new Error("unused") }',
    'export const decryptMAProfessorBackupV3Data = async () => { throw new Error("unused") }',
    'export const unwrapMAProfessorBackupV3MasterKey = async () => { throw new Error("unused") }',
  ].join('\n'))
  const service = await files.load()
  const paths = []
  t.mock.method(globalThis, 'fetch', async url => {
    paths.push(url.split('/').at(-1))
    return Response.json(
      { message: 'Existe uma cópia online mais recente.' },
      { status: 409 }
    )
  })
  const prepared = {
    profile: { cryptoVersion: 3 },
    encrypted: { encryptionVersion: 3 },
    plaintextHash: 'local-only', plaintextBytes: 1, encryptedBytes: 1
  }
  await assert.rejects(
    service.promotePreparedMAProfessorCloudBackupV3(session, prepared, 7, 3),
    error => error?.name === 'MAProfessorCloudBackupRevisionConflictError' && /mais recente/.test(error.message)
  )
  assert.deepEqual(paths, ['promote-v3'])
})

test('v3 promotion rejects an invalid record revision before making a request', async t => {
  const files = await stage(t, 'sync/cloudBackupService.ts', {
    '../settings/backupRepository': './validation.mjs',
    '../access/accessStorage': './access-storage.mjs',
    './cloudBackupV3Crypto': './cloud-backup-v3-crypto.mjs'
  })
  await files.write('validation.mjs', 'export const validateMAProfessorBackup = () => ({ valid: true })')
  await files.write('access-storage.mjs', 'export const readMAProfessorOpaqueExportKey = () => null')
  await files.write('cloud-backup-v3-crypto.mjs', [
    'export const createMAProfessorBackupV3KeyMaterial = async () => { throw new Error("unused") }',
    'export const encryptMAProfessorBackupV3Data = async () => { throw new Error("unused") }',
    'export const decryptMAProfessorBackupV3Data = async () => { throw new Error("unused") }',
    'export const unwrapMAProfessorBackupV3MasterKey = async () => { throw new Error("unused") }',
  ].join('\n'))
  const service = await files.load()
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network must not run')
  })
  const prepared = {
    profile: { cryptoVersion: 3 }, encrypted: { encryptionVersion: 3 },
    plaintextHash: 'local-only', plaintextBytes: 1, encryptedBytes: 1
  }
  await assert.rejects(
    service.promotePreparedMAProfessorCloudBackupV3(session, prepared, 7, -1),
    /revisão esperada/
  )
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('revoking the choice while encryption is in progress prevents push; manual upload still encrypts and verifies', async t => {
  const files = await stage(t, 'sync/cloudBackupService.ts', {
    '../settings/backupRepository': './validation.mjs',
    '../access/accessStorage': './access-storage.mjs',
    './cloudBackupV3Crypto': './cloud-backup-v3-crypto.mjs'
  })
  await files.write('validation.mjs', 'export const validateMAProfessorBackup = () => ({ valid: true })')
  await files.write('access-storage.mjs', 'export const readMAProfessorOpaqueExportKey = () => null')
  await files.write('cloud-backup-v3-crypto.mjs', [
    'export const createMAProfessorBackupV3KeyMaterial = async () => { throw new Error("unused") }',
    'export const encryptMAProfessorBackupV3Data = async () => { throw new Error("unused") }',
    'export const decryptMAProfessorBackupV3Data = async () => { throw new Error("unused") }',
    'export const unwrapMAProfessorBackupV3MasterKey = async () => { throw new Error("unused") }',
  ].join('\n'))
  const service = await files.load()
  let allowed = true
  let revokeDuringEncryption = true
  const key = Buffer.alloc(32, 17).toString('base64')
  const paths = []
  let encrypted
  let revision = 0
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
    getRandomValues: value => webcrypto.getRandomValues(value),
    subtle: new Proxy(webcrypto.subtle, { get(target, name) {
      if (name === 'encrypt') return async (...args) => {
        const result = await target.encrypt(...args)
        if (revokeDuringEncryption) allowed = false
        return result
      }
      return target[name].bind(target)
    } })
  } })
  t.after(() => originalCrypto ? Object.defineProperty(globalThis, 'crypto', originalCrypto) : delete globalThis.crypto)
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = url.split('/').at(-1)
    paths.push(path)
    const body = JSON.parse(options.body)
    assert.equal(body.token, session.token)
    assert.equal(body.deviceId, session.deviceId)
    if (path === 'status') return Response.json({ success: true, serverRevision: revision, cryptoVersion: 2, protection: null, updatedAt: '2026-09-20T12:00:00Z', backup: { found: false, recordRevision: null, updatedAt: null, ciphertextBytes: null } })
    if (path === 'key') return Response.json({ success: true, cryptoVersion: 2, keyAlgorithm: 'AES-256-GCM', key })
    if (path === 'push') {
      assert.equal(body.backup, undefined)
      assert.equal(body.expectedServerRevision, revision)
      encrypted = body.encrypted
      revision++
      return Response.json({ success: true, serverRevision: revision, recordRevision: revision, updatedAt: '2026-09-20T12:00:00Z' })
    }
    if (path === 'get') return Response.json({ success: true, found: true, recordId: 'database-v1', serverRevision: revision, cryptoVersion: 2, recordRevision: revision, updatedAt: '2026-09-20T12:00:00Z', encrypted })
    throw new Error(`Unexpected route: ${path}`)
  })
  const backup = { product: 'ma-professor', data: { students: [{ name: 'Private student' }] } }
  await assert.rejects(service.uploadAndVerifyMAProfessorCloudBackup(session, backup, {
    expectedServerRevision: 0, canUpload: () => allowed
  }), /desativada/)
  assert.deepEqual(paths, ['status', 'key'])
  paths.length = 0
  await assert.rejects(service.uploadAndVerifyMAProfessorCloudBackup(session, backup, { canUpload: () => false }), /desativada/)
  assert.deepEqual(paths, [])
  revokeDuringEncryption = false
  const result = await service.uploadAndVerifyMAProfessorCloudBackup(session, backup)
  assert.equal(result.serverRevision, 1)
  assert.deepEqual(paths, ['status', 'key', 'push', 'get'])
  assert.doesNotMatch(JSON.stringify(encrypted), /Private student/)
  const downloaded = await service.downloadMAProfessorCloudBackup(session)
  assert.deepEqual(downloaded.backup, backup)
})

test('reload with v3 loses only the memory key: show unlock, stop retries, preserve local edits and resume after password', async t => {
  const { service, dexie, storage, tick } = await automaticHarness(t, ({ preference, storage }) => {
    storage.setKey(null)
    preference.writeCloudBackupPreference(session, 'enabled')
  })
  assert.match(document.body.textContent, /Confirme a sua password/)
  const initialCalls = { ...service.calls }
  dexie.mutate()
  await tick(60 * 60 * 1000)
  assert.deepEqual(service.calls, initialCalls, 'No silent retry requests while locked')
  const input = document.querySelector('input[type=password]')
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setValue.call(input, 'wrong-password')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  // Exercise the form with React's native change tracker in jsdom.
  await act(async () => document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  assert.match(document.body.textContent, /Não foi possível confirmar a password/)
  assert.equal(document.querySelector('input[type=password]').value, '')
  assert.equal(service.calls.upload, 0)
  await act(async () => storage.setKey('memory-key'))
  assert.doesNotMatch(document.body.textContent, /A cópia protegida precisa da sua password/)
  await tick(90 * 1000)
  assert.equal(service.calls.upload, 1)
  assert.equal(Object.values(window.localStorage).some(value => value.includes('memory-key')), false)
})
