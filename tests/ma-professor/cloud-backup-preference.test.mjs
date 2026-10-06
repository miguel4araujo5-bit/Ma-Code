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

    source = source.replaceAll("'../settings/BackupDraftNotice'", "'./draft-notice.mjs'")
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

  await compile('daily/dailyDraftStorage.ts', 'daily-drafts.mjs', {})
  await compile('setup/setupReadiness.ts', 'readiness.mjs', {})
  await writeFile(join(directory, 'draft-db.mjs'), `
    export const openMAProfessorDatabase = async () => {};
    export const maProfessorDb = {
      lessons: { bulkGet: async ids => ids.map(() => undefined) },
      academicYears: { toArray: async () => [] },
      teachingAssignments: { bulkGet: async () => [] },
      groups: { bulkGet: async () => [] }, subjects: { bulkGet: async () => [] }
    };
  `)
  await compile('settings/BackupDraftNotice.tsx', 'draft-notice.mjs', {
    '../daily/dailyDraftStorage': './daily-drafts.mjs',
    '../db': './draft-db.mjs', '../setup/setupReadiness': './readiness.mjs'
  })

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
      new Date(2026, 8, 20, 12, 18, 30)
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
    './CloudBackupPreview': './preview.mjs',
    './cloudBackupCooldown': './cooldown.mjs',
    '../support/ProblemReportDialog': './report.mjs',
    './CloudBackupReauthentication':
      './reauth.mjs'
  }

  const files =
    await stage(
      t,
      'sync/AutomaticCloudBackup.tsx',
      replacements
    )

  await files.compile('sync/CloudBackupPreview.tsx', 'preview.mjs')
  await files.compile('sync/cloudBackupCooldown.ts', 'cooldown.mjs')
  await files.write('report.mjs', `import React from 'react'; export function ProblemReportDialog({open,onClose}) { return open ? React.createElement('section', {role:'dialog', 'aria-label':'Relatório técnico'}, React.createElement('button', {onClick:onClose}, 'Fechar relatório')) : null }`)
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
        return { product: 'ma-professor', schemaVersion: 1, exportedAt: new Date().toISOString(), data: { ...Object.fromEntries(['teacherProfiles','academicYears','groups','subjects','teachingAssignments','modules','weeklyScheduleSlots','schoolCalendarEvents','planifications','planificationItems','assessmentCriteria','assessmentSchemes','lessons','lessonAttendance','summarySuggestions','lessonAssessments','assessmentResults','moduleFinalGrades','learningRecoveries','settings','setupProgress'].map(key => [key, []])), students: [{ name: currentName }] } }
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
      import { reserveCloudBackupUpload } from './cooldown.mjs'
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
        reserveCloudBackupUpload(session.email)
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
    nextSlot: async () => {
      const now = new Date(); const next = new Date(now);
      const slots = [[12,19],[16,59]]; let found = false;
      for (const [hour,minute] of slots) { next.setHours(hour,minute,0,0); if (next > now) { found=true; break } }
      if (!found) { next.setDate(next.getDate()+1); next.setHours(12,19,0,0) }
      await act(async () => t.mock.timers.tick(next.getTime()-now.getTime()))
    },
    click: async label => act(async () => {
      const button = [...document.querySelectorAll('button')].find(item => item.textContent === label)
      assert.ok(button, `Missing button: ${label}`)
      button.click()
    }),
    confirm: async () => act(async () => {
      document.querySelector('input[type=checkbox]').click()
      const button = [...document.querySelectorAll('button')].find(item => item.textContent === 'Confirmar e enviar para a nuvem')
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

const reminderTitle = 'Tem alterações por guardar. Deseja guardar o seu progresso?'
const dialog = () => document.querySelector('[aria-labelledby=cloud-backup-reminder-title]')
const noNetwork = service => assert.deepEqual(service.calls, { inspect: 0, upload: 0, download: 0 })
const enabled = ({ preference }) => preference.writeCloudBackupPreference(session, 'enabled')

test('Guardar agora prepares locally; final confirmation alone uploads the reviewed snapshot and restores focus', async t => {
  const h = await automaticHarness(t, enabled)
  const editor = document.createElement('button'); editor.textContent='Editor'; document.body.append(editor); editor.focus()
  await h.mutate(); await h.tick(29_999); assert.equal(dialog(), null)
  await h.tick(1); noNetwork(h.service); assert.ok(dialog()); assert.match(dialog().textContent, /Tem alterações por guardar/)
  assert.deepEqual([...dialog().querySelectorAll('button')].map(b => b.textContent), ['Guardar agora','Agora não'])
  h.backup.setName('Reviewed snapshot'); await h.click('Guardar agora'); noNetwork(h.service)
  assert.ok(document.querySelector('[aria-label="Dados que vão ser enviados"]'))
  await h.confirm(); assert.equal(h.service.calls.upload, 1); assert.equal(dialog(), null)
  assert.equal(document.activeElement, editor)
  assert.equal(h.service.lastUpload.backup.data.students[0].name, 'Reviewed snapshot')
  assert.equal(h.service.lastUpload.options.expectedServerRevision, undefined)
  await h.tick(60_000); assert.equal(h.service.calls.upload, 1)
})

test('Agora não retains pending changes through reload and asks only at the next scheduled slot', async t => {
  const h = await automaticHarness(t, enabled); await h.mutate(); await h.nextSlot(); await h.click('Agora não')
  assert.ok(h.trust.readMAProfessorCloudBackupTrust(session).dirtyAt)
  await h.remount(); await h.tick(60_000); assert.equal(dialog(), null)
  await h.nextSlot(); assert.ok(dialog()); assert.equal(new Date().getHours(),16); assert.equal(new Date().getMinutes(),59); noNetwork(h.service)
})

test('disabled reminders stay off across reload; re-enabling uses the next slot without an immediate prompt', async t => {
  const h = await automaticHarness(t, enabled); await h.mutate()
  await act(async () => h.preference.writeCloudBackupPreference(session,'disabled'))
  await h.remount(); await h.nextSlot(); assert.equal(dialog(),null); noNetwork(h.service)
  await act(async () => h.preference.writeCloudBackupPreference(session,'enabled'))
  await h.tick(1); assert.equal(dialog(),null); await h.nextSlot(); assert.ok(dialog())
})

test('legacy enabled preference becomes reminders and never silently uploads', async t => {
  const key='ma-professor-cloud-backup-choice-v1:professor%40example.com:device-a'
  const h=await automaticHarness(t,()=>window.localStorage.setItem(key,'enabled'))
  assert.equal(window.localStorage.getItem(key),'reminders')
  await h.mutate(); await h.nextSlot(); assert.ok(dialog()); noNetwork(h.service)
})

test('disabling from another window during preparation prevents the confirmed upload', async t => {
  const h=await automaticHarness(t,enabled); let release
  h.backup.holdPreparation(new Promise(resolve=>{release=resolve}))
  await h.mutate(); await h.nextSlot(); await h.click('Guardar agora')
  const key=Object.keys(window.localStorage).find(key=>key.startsWith('ma-professor-cloud-backup-choice-v1:'))
  await act(async()=>{window.localStorage.setItem(key,'disabled');window.dispatchEvent(new window.StorageEvent('storage',{key,newValue:'disabled'}));release()})
  await h.tick(60_000); noNetwork(h.service); assert.equal(dialog(),null)
})

test('clean devices do not prompt, and disabled local edits remain pending through reload', async t => {
  const h=await automaticHarness(t,enabled); await h.nextSlot(); assert.equal(dialog(),null)
  await act(async()=>h.preference.writeCloudBackupPreference(session,'disabled'))
  await h.mutate(); await h.remount(); await act(async()=>h.preference.writeCloudBackupPreference(session,'enabled'))
  await h.nextSlot(); assert.ok(dialog()); noNetwork(h.service)
})

test('no OPAQUE key skips a slot; unlocking never uploads or replays a missed reminder', async t => {
  const h=await automaticHarness(t,({preference,storage})=>{storage.setKey(null);enabled({preference})})
  await h.mutate(); await h.nextSlot(); assert.equal(dialog(),null); noNetwork(h.service)
  await act(async()=>h.storage.setKey('memory-key')); await h.tick(1); assert.equal(dialog(),null)
  await h.nextSlot(); assert.ok(dialog()); noNetwork(h.service)
  await h.click('Guardar agora'); await h.confirm(); assert.equal(h.service.calls.upload,1)
  assert.equal(Object.values(window.localStorage).some(value=>value.includes('memory-key')),false)
})

test('edits during a confirmed upload remain pending and only cause a question at the next slot', async t => {
  const h=await automaticHarness(t,enabled); let release
  h.service.holdUpload(new Promise(resolve=>{release=resolve}))
  await h.mutate(); await h.nextSlot(); await h.click('Guardar agora'); await h.confirm(); await h.mutate()
  await act(async()=>release()); assert.ok(h.trust.readMAProfessorCloudBackupTrust(session).dirtyAt)
  await h.remount(); await h.nextSlot(); assert.ok(dialog()); assert.equal(h.service.calls.upload,1)
})

test('failures allow reporting, retry after 30 seconds and fresh confirmation, or ignore without an automatic retry', async t => {
  const h=await automaticHarness(t,enabled); h.service.setUploadError(new Error('Rejected'))
  await h.mutate(); await h.nextSlot(); await h.click('Guardar agora'); await h.confirm()
  assert.match(document.querySelector('[role=alert]').textContent,/Não foi possível confirmar/)
  assert.equal([...dialog().querySelectorAll('button')].find(b=>b.textContent==='Tentar novamente').disabled,true)
  await h.click('Enviar relatório'); assert.ok(document.querySelector('[aria-label="Relatório técnico"]')); assert.equal(h.service.calls.upload,1)
  await h.click('Fechar relatório'); await h.tick(30_000); h.service.setUploadError(null)
  await h.click('Tentar novamente'); assert.equal(document.querySelector('input[type=checkbox]').checked,false)
  await h.confirm(); assert.equal(h.service.calls.upload,2); assert.equal(dialog(),null)
})

test('inactive slots are discarded; the next active slot appears above an existing modal and restores that editor', async t => {
  let focused=false
  const h=await automaticHarness(t,({preference})=>{Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>focused});enabled({preference})})
  await h.mutate(); await h.nextSlot(); assert.equal(dialog(),null)
  focused=true; await act(async()=>window.dispatchEvent(new Event('focus'))); await h.tick(1); assert.equal(dialog(),null)
  const editor=document.createElement('button');editor.textContent='Previous modal'; const modal=document.createElement('div');modal.setAttribute('role','dialog');modal.append(editor);document.body.append(modal);editor.focus()
  await h.nextSlot(); assert.ok(dialog()); assert.match(dialog().parentElement.className,/z-\[1000\]/)
  await h.click('Agora não'); assert.equal(document.activeElement,editor); assert.ok(modal.isConnected); noNetwork(h.service)
})

test('suspended-browser timers do not show a late reminder when execution resumes', async t => {
  const h=await automaticHarness(t,enabled);await h.mutate();await h.tick(3*60_000)
  assert.equal(new Date().getMinutes(),21);assert.equal(dialog(),null);noNetwork(h.service)
  await h.nextSlot();assert.ok(dialog())
})

test('a successful manual copy clears pending changes without starting another copy', async t => {
  const h=await automaticHarness(t,enabled);await h.mutate()
  await act(async()=>h.trust.writeMAProfessorCloudBackupTrust(session,{serverRevision:2,recordRevision:2,updatedAt:new Date().toISOString()}))
  await h.nextSlot();assert.equal(dialog(),null);noNetwork(h.service)
})

test('preview refresh sends nothing; post-preview edits remain pending and cancel returns to the original screen', async t => {
  const h=await automaticHarness(t,enabled);await h.mutate();await h.nextSlot();await h.click('Guardar agora')
  h.backup.setName('Reviewed');await h.click('Atualizar pré-visualização');noNetwork(h.service)
  h.backup.setName('Later edit');await h.mutate();await h.confirm()
  assert.equal(h.service.lastUpload.backup.data.students[0].name,'Reviewed');assert.ok(h.trust.readMAProfessorCloudBackupTrust(session).dirtyAt)
  await h.nextSlot();await h.click('Guardar agora');await h.click('Cancelar');assert.equal(dialog(),null);assert.equal(h.service.calls.upload,1)
})

test('reset clears pending changes and does not arm a reminder until a new real edit', async t => {
  const h=await automaticHarness(t,enabled);await h.mutate()
  await act(async()=>{h.preference.writeCloudBackupPreference(session,'disabled');h.trust.clearMAProfessorCloudBackupTrust(session)})
  await h.mutate();assert.equal(h.trust.readMAProfessorCloudBackupTrust(session),null)
  await h.remount();await act(async()=>h.preference.writeCloudBackupPreference(session,'enabled'));await h.nextSlot();assert.equal(dialog(),null)
  await h.mutate();await h.nextSlot();assert.ok(dialog());noNetwork(h.service)
})
