import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import {
  join,
  resolve
} from 'node:path'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createCloudBackupWorkerHarness } from './cloud-backup-worker-harness.mjs'

const root =
  resolve(
    new URL(
      '../..',
      import.meta.url
    ).pathname
  )
const cache =
  join(
    root,
    'node_modules/.cache'
  )
mkdirSync(
  cache,
  {
    recursive: true
  }
)
const output =
  mkdtempSync(
    join(
      cache,
      'backup-cross-device-'
    )
  )
const runtimePath =
  join(
    output,
    'runtime.cjs'
  )
const base =
  './src/components/ma-professor/'

const bundle =
  await build({
    stdin: {
      contents: `
        export { maProfessorDb } from '${base}db';
        export { scheduleWorkspaceRepository } from '${base}schedule/scheduleWorkspaceRepository';
        export { loadPAAActivities } from '${base}calendar/PAAActivitiesLayer';
        export { createMAProfessorDatabaseSnapshot } from '${base}sync/databaseSnapshotService';
        export { previewMAProfessorCloudRestore, restoreMAProfessorCloudRestore } from '${base}sync/cloudBackupRestoreService';
        export { default as BackupDraftNotice } from '${base}settings/BackupDraftNotice';
        export { saveMAProfessorDailyDraft, deleteMAProfessorDailyDraft, clearMAProfessorDailyDrafts, countMAProfessorDailyDrafts, listMAProfessorDailyDrafts } from '${base}daily/dailyDraftStorage';
        export {
          createMAProfessorBackup,
          createMAProfessorLocalBackupSignature,
          restoreMAProfessorBackup,
          validateMAProfessorBackup
        } from '${base}settings/backupRepository';
        export {
          uploadAndVerifyCompatibleMAProfessorCloudBackup,
          downloadCompatibleMAProfessorCloudBackup
        } from '${base}sync/cloudBackupService';
        export {
          saveMAProfessorOpaqueExportKey,
          clearMAProfessorOpaqueExportKey
        } from '${base}access/accessStorage';
      `,
      resolveDir:
        root
    },
    bundle: true,
    jsx: 'automatic',
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external'
  })

writeFileSync(
  runtimePath,
  bundle.outputFiles[0].text
)

const dom =
  new JSDOM(
    '',
    {
      url:
        'https://example.test'
    }
  )

for (const key of [
  'window',
  'document',
  'Element',
  'HTMLElement',
  'Node',
  'Event',
  'CustomEvent'
]) {
  globalThis[key] =
    key === 'window'
      ? dom.window
      : dom.window[key]
}

Object.defineProperty(
  globalThis,
  'navigator',
  {
    configurable: true,
    value:
      dom.window.navigator
  }
)
Object.defineProperty(
  window,
  'indexedDB',
  {
    value:
      globalThis.indexedDB
  }
)

const runtime =
  createRequire(
    import.meta.url
  )(
    runtimePath
  )
const db =
  runtime.maProfessorDb

const timestamp =
  '2026-09-28T10:00:00.000Z'
const audit = {
  createdAt:
    timestamp,
  updatedAt:
    timestamp
}

const REMINDER_TEXT = 'Trazer materiais para expressão dramática.\nConfirmar a preparação semanal.'
const paa = [
  { id: 'paa-manual', academicYearId: 'year-2026', title: 'Atividade manual', date: '2026-10-05', description: 'Descrição manual', source: 'manual', ...audit },
  { id: 'paa-imported', academicYearId: 'year-2026', title: 'Atividade importada', date: '2026-10-06', description: 'Descrição importada', source: 'imported', ...audit }
]

async function seedSourceDevice() {
  await db.delete()
  await db.open()

  await db.academicYears.add({
    id: 'year-2026',
    name: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    active: true,
    setupCompletedAt:
      timestamp,
    ...audit
  })

  await db.groups.add({
    id: 'group-10d',
    academicYearId:
      'year-2026',
    name: '10.º D',
    educationType:
      'professional',
    grade: 10,
    courseName: 'TAP',
    active: true,
    ...audit
  })

  await db.subjects.add({
    id: 'subject-ae',
    academicYearId:
      'year-2026',
    name: 'Área de Expressões',
    shortName: 'AE',
    code: 'AE',
    active: true,
    ...audit
  })

  await db.teachingAssignments.add({
    id: 'assignment-ae-10d',
    academicYearId:
      'year-2026',
    groupId: 'group-10d',
    subjectId:
      'subject-ae',
    displayName:
      'AE · 10.º D',
    active: true,
    ...audit
  })

  await db.modules.add({
    id: 'module-10385',
    academicYearId:
      'year-2026',
    teachingAssignmentId:
      'assignment-ae-10d',
    code: '10385',
    name: 'Expressão Dramática',
    plannedPeriods: 50,
    order: 1,
    plannedStartDate: null,
    plannedEndDate: null,
    active: true,
    ...audit
  })

  await db.weeklyScheduleSlots.add({
    id: 'slot-monday',
    academicYearId:
      'year-2026',
    teachingAssignmentId:
      'assignment-ae-10d',
    weekday: 1,
    startTime: '09:00',
    endTime: '09:50',
    periodCount: 1,
    validFrom: '2026-09-01',
    validUntil: '2027-08-31',
    room: '',
    active: true,
    ...audit
  })

  await db.lessons.bulkAdd([
    {
      id: 'lesson-b',
      academicYearId:
        'year-2026',
      teachingAssignmentId:
        'assignment-ae-10d',
      moduleId:
        'module-10385',
      scheduleSlotId:
        'slot-monday',
      origin: 'scheduled',
      status: 'taught',
      date: '2026-09-28',
      startTime: '09:00',
      endTime: '09:50',
      periodCount: 1,
      countTowardProgress: true,
      plannedActivity:
        'Exercício de expressão dramática',
      summary:
        'Respiração, projeção de voz e exercício prático.',
      summarySource:
        'manual',
      planificationItemIds: [],
      giaeStatus:
        'submitted',
      giaeSubmittedAt:
        timestamp,
      notes: '',
      ...audit
    },
    {
      id: 'lesson-a',
      academicYearId:
        'year-2026',
      teachingAssignmentId:
        'assignment-ae-10d',
      moduleId:
        'module-10385',
      scheduleSlotId:
        'slot-monday',
      origin: 'scheduled',
      status: 'taught',
      date: '2026-09-21',
      startTime: '09:00',
      endTime: '09:50',
      periodCount: 1,
      countTowardProgress: true,
      plannedActivity:
        'Trabalho de grupo',
      summary:
        'Criação e apresentação de pequenas histórias.',
      summarySource:
        'manual',
      planificationItemIds: [],
      giaeStatus:
        'submitted',
      giaeSubmittedAt:
        timestamp,
      notes: '',
      ...audit
    }
  ])

  await db.students.add({
    id: 'student-1', academicYearId: 'year-2026', groupId: 'group-10d',
    number: '1', name: 'Aluno de teste', active: true, notes: '', ...audit
  })
  await db.assessmentSchemes.add({
    id: 'scheme-ae', academicYearId: 'year-2026', teachingAssignmentId: 'assignment-ae-10d',
    moduleId: 'module-10385', scope: 'module', name: 'Critérios de teste', active: true, ...audit
  })
  await db.assessmentCriteria.add({
    id: 'criterion-practical', schemeId: 'scheme-ae', name: 'Trabalho prático', description: '',
    weightPercent: 100, order: 1, active: true, ...audit
  })
  await db.lessonAttendance.add({
    id: 'attendance-1', lessonId: 'lesson-a', studentId: 'student-1',
    status: 'absent', code: 'F', note: 'Falta de teste', ...audit
  })
  await db.lessonAssessments.add({
    id: 'assessment-1', academicYearId: 'year-2026', lessonId: 'lesson-b',
    teachingAssignmentId: 'assignment-ae-10d', moduleId: 'module-10385', criterionId: 'criterion-practical',
    title: 'Exercício prático', activityType: 'practical_work', description: '', absentScore: 0, exemptScore: 0, ...audit
  })
  await db.assessmentResults.add({
    id: 'result-1', assessmentId: 'assessment-1', studentId: 'student-1',
    status: 'evaluated', score: 17, note: 'Avaliação de teste', ...audit
  })
  await db.moduleFinalGrades.add({
    id: 'grade-1', academicYearId: 'year-2026', teachingAssignmentId: 'assignment-ae-10d',
    moduleId: 'module-10385', studentId: 'student-1', calculatedAverage: 17, suggestedGrade: 17,
    selfAssessmentGrade: 16, finalGrade: 17, confirmedAt: timestamp, note: '', ...audit
  })
  await runtime.scheduleWorkspaceRepository.updateSummaryReminder('slot-monday', REMINDER_TEXT)
  await db.paaActivities.bulkAdd(paa)
}

after(
  async () => {
    await db.delete()
    dom.window.close()
    rmSync(
      output,
      {
        recursive: true,
        force: true
      }
    )
  }
)

test(
  'a serialized backup restores summaries into a fresh database and survives reopening',
  async () => {
    await seedSourceDevice()

    const sourceBackup =
      await runtime.createMAProfessorBackup()
    const sourceValidation =
      runtime.validateMAProfessorBackup(
        sourceBackup
      )

    assert.equal(
      sourceValidation.valid,
      true,
      JSON.stringify(
        sourceValidation.issues
      )
    )
    assert.equal(
      sourceBackup.data.lessons.length,
      2
    )

    assert.deepEqual(Object.keys(sourceBackup.data).sort(), db.tables.map(table => table.name).sort())
    assert.equal(sourceBackup.data.weeklyScheduleSlots[0].summaryReminderText, REMINDER_TEXT)
    assert.equal(sourceBackup.data.paaActivities.length, 2)

    const transferredBackup =
      JSON.parse(
        JSON.stringify(
          sourceBackup
        )
      )

    await db.delete()
    await db.open()

    assert.equal(
      await db.lessons.count(),
      0
    )

    await runtime.restoreMAProfessorBackup(
      transferredBackup
    )

    db.close()
    await db.open()

    const restoredLessons =
      await db.lessons
        .orderBy('id')
        .toArray()

    assert.deepEqual(
      restoredLessons.map(
        lesson => ({
          id:
            lesson.id,
          summary:
            lesson.summary,
          giaeStatus:
            lesson.giaeStatus
        })
      ),
      [
        {
          id: 'lesson-a',
          summary:
            'Criação e apresentação de pequenas histórias.',
          giaeStatus:
            'submitted'
        },
        {
          id: 'lesson-b',
          summary:
            'Respiração, projeção de voz e exercício prático.',
          giaeStatus:
            'submitted'
        }
      ]
    )

    assert.deepEqual(await runtime.loadPAAActivities('year-2026'), paa)
    assert.equal((await db.weeklyScheduleSlots.get('slot-monday')).summaryReminderText, REMINDER_TEXT)
    const restoredBackup =
      await runtime.createMAProfessorBackup()

    assert.equal(
      restoredBackup.data.academicYears.length,
      1
    )
    assert.equal(
      restoredBackup.data.groups.length,
      1
    )
    assert.equal(
      restoredBackup.data.modules.length,
      1
    )
    assert.equal(
      restoredBackup.data.lessons.length,
      2
    )
  }
)

test('replacing an older V3 copy includes PAA and weekly reminders; guarded fresh-device restore preserves all data after reopening', async t => {
  const session = { email: 'roundtrip@example.test', token: 'roundtrip-token', deviceId: 'device-a' }
  const exportKey = Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString('base64url')
  const worker = await createCloudBackupWorkerHarness(session.email, session.token)
  t.after(() => { runtime.clearMAProfessorOpaqueExportKey(); worker.close() })
  t.mock.method(globalThis, 'fetch', (url, init) => worker.handle(new Request(new URL(url, 'https://ma-code.pt'), {
    ...init, headers: { ...init.headers, Origin: 'https://ma-code.pt' }
  })))
  await seedSourceDevice()
  const sourceBackup = await runtime.createMAProfessorBackup()
  assert.equal(runtime.validateMAProfessorBackup(sourceBackup).valid, true)
  runtime.saveMAProfessorOpaqueExportKey(session.email, exportKey)
  const previousBackup = structuredClone(sourceBackup)
  delete previousBackup.data.paaActivities
  const first = await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, previousBackup, { expectedServerRevision: 0 })
  assert.equal(first.serverRevision, 1)
  const previousDownload = await runtime.downloadCompatibleMAProfessorCloudBackup(session)
  assert.equal(previousDownload.backup.data.paaActivities, undefined)
  worker.advance(31_000)
  const nextClientTime = Date.now() + 31_000
  t.mock.method(Date, 'now', () => nextClientTime)
  const saved = await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, sourceBackup, { expectedServerRevision: 1 })
  assert.equal(saved.serverRevision, 2)

  runtime.clearMAProfessorOpaqueExportKey()
  await db.delete()
  await db.open()
  assert.equal(await db.lessons.count(), 0)
  assert.equal(await db.lessonAttendance.count(), 0)
  assert.equal(await db.assessmentResults.count(), 0)
  runtime.saveMAProfessorOpaqueExportKey(session.email, exportKey)
  const downloaded = await runtime.downloadCompatibleMAProfessorCloudBackup({ ...session, deviceId: 'device-b' })
  assert.deepEqual(downloaded.backup, sourceBackup)
  const preview = await runtime.previewMAProfessorCloudRestore({ ...session, deviceId: 'device-b' })
  await runtime.restoreMAProfessorCloudRestore({ ...session, deviceId: 'device-b' }, {
    expectedServerRevision: preview.serverRevision,
    expectedRecordRevision: preview.recordRevision,
    expectedCiphertextHash: preview.ciphertextHash,
    expectedPlaintextHash: preview.plaintextHash,
    expectedLocalContentSignature: preview.localContentSignature
  })
  db.close()
  await db.open()

  const restored = await runtime.createMAProfessorBackup()
  for (const table of Object.keys(sourceBackup.data).filter(table => table !== 'settings')) {
    assert.deepEqual(restored.data[table], sourceBackup.data[table], `${table} must survive the complete cloud round trip.`)
  }
  assert.equal((await db.lessonAttendance.get('attendance-1')).status, 'absent')
  assert.equal((await db.assessmentResults.get('result-1')).score, 17)
  assert.equal((await db.moduleFinalGrades.get('grade-1')).finalGrade, 17)
  assert.equal((await db.lessons.get('lesson-a')).summary, 'Criação e apresentação de pequenas histórias.')
})


async function seedPreviousDatabase() {
  await seedSourceDevice()
  const backup = await runtime.createMAProfessorBackup()
  const schema = Object.fromEntries(db.tables.filter(table => table.name !== 'paaActivities').map(table => [table.name, [table.schema.primKey.src, ...table.schema.indexes.map(index => index.src)].join(', ')]))
  await db.delete()
  const previous = new Dexie('ma-professor')
  previous.version(1).stores(schema)
  await previous.open()
  for (const table of previous.tables) await table.bulkPut(backup.data[table.name])
  await previous.table('academicYears').add({ ...backup.data.academicYears[0], id: 'year-2025', name: '2025/2026', startDate: '2025-09-01', endDate: '2026-08-31', active: false })
  previous.close()
  window.localStorage.clear()
  window.localStorage.setItem('ma-professor:paa:year-2026', JSON.stringify(paa))
  window.localStorage.setItem('ma-professor:paa:year-2025', JSON.stringify([{ ...paa[0], id: 'paa-old-year', academicYearId: 'year-2025', date: '2025-10-06' }]))
  return { previous, backup }
}

test('the additive database migration imports manual and imported PAA for every year without changing lessons or summaries', async () => {
  const { backup } = await seedPreviousDatabase()
  await db.open()
  assert.equal(db.verno, 2)
  assert.deepEqual(await runtime.loadPAAActivities('year-2026'), paa)
  assert.equal((await runtime.loadPAAActivities('year-2025')).length, 1)
  assert.deepEqual(await db.lessons.toArray(), backup.data.lessons)
  assert.deepEqual(await db.weeklyScheduleSlots.toArray(), backup.data.weeklyScheduleSlots)
  assert.equal(await db.schoolCalendarEvents.count(), 0)
  const nextCopy = await runtime.createMAProfessorBackup()
  assert.equal(nextCopy.data.paaActivities.length, 3)
  assert.equal(runtime.validateMAProfessorBackup(nextCopy).valid, true)
  await db.delete()
  await db.open()
  await runtime.restoreMAProfessorBackup(JSON.parse(JSON.stringify(nextCopy)))
  assert.equal(await db.paaActivities.count(), 3)
  const snapshot = await runtime.createMAProfessorDatabaseSnapshot()
  assert.equal(snapshot.recordCounts.paaActivities, 3)
})

test('a failed PAA migration rolls back and retains the original activities and existing school data', async () => {
  const { previous, backup } = await seedPreviousDatabase()
  window.localStorage.setItem('ma-professor:paa:year-2026', '{invalid json')
  await assert.rejects(db.open(), /Os dados anteriores não foram apagados/)
  await previous.open()
  assert.equal(previous.verno, 1)
  assert.deepEqual(await previous.table('lessons').toArray(), backup.data.lessons)
  previous.close()
  assert.equal(window.localStorage.getItem('ma-professor:paa:year-2026'), '{invalid json')
  window.localStorage.setItem('ma-professor:paa:year-2026', JSON.stringify(paa))
  await db.open()
  assert.deepEqual(await runtime.loadPAAActivities('year-2026'), paa)
})

test('old JSON copies still restore and stale localStorage PAA is never reapplied after restore', async () => {
  await seedSourceDevice()
  const old = await runtime.createMAProfessorBackup()
  delete old.data.paaActivities
  window.localStorage.setItem('ma-professor:paa:year-2026', JSON.stringify(paa))
  await runtime.restoreMAProfessorBackup(old)
  db.close()
  await db.open()
  assert.deepEqual(await runtime.loadPAAActivities('year-2026'), [])
  assert.equal((await db.weeklyScheduleSlots.get('slot-monday')).summaryReminderText, REMINDER_TEXT)
  assert.equal((await db.lessons.get('lesson-a')).summary, old.data.lessons[0].summary)
})

test('PAA changes after preview are protected by the existing local restore signature', async () => {
  await seedSourceDevice()
  const original = await runtime.createMAProfessorBackup()
  await db.paaActivities.update('paa-manual', { title: 'Atividade atualizada' })
  await assert.rejects(runtime.restoreMAProfessorBackup(original, runtime.createMAProfessorLocalBackupSignature(original)), /dados deste dispositivo foram alterados/i)
  assert.equal((await db.paaActivities.get('paa-manual')).title, 'Atividade atualizada')
})

async function waitFor(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
  }
  assert.ok(check(), 'O aviso deve atualizar após a operação local.')
}

test('the draft warning counts only the current account, updates after save/delete and never includes drafts in the backup', async t => {
  await seedSourceDevice()
  await runtime.clearMAProfessorDailyDrafts()
  const draft = { accountEmail: 'roundtrip@example.test', academicYearId: 'year-2026', lessonId: 'lesson-a', date: '2026-09-21', baseSavedSignature: 'base', draftSignature: 'edited', assessmentIdToDelete: null, lesson: { status: 'taught', startTime: '09:00', endTime: '09:50', periodCount: '1', countTowardProgress: true, plannedActivity: '', summary: 'Rascunho por guardar', summarySource: 'manual', planificationItemIds: [], notes: '', giaeStatus: 'pending' }, assessment: { choice: 'none', criterionId: '', title: '', activityType: 'other', description: '' }, students: [] }
  await runtime.saveMAProfessorDailyDraft({ ...draft, accountEmail: 'other@example.test' })
  await runtime.saveMAProfessorDailyDraft(draft)
  assert.equal(await runtime.countMAProfessorDailyDrafts('roundtrip@example.test'), 1)
  const element = document.createElement('div')
  document.body.append(element)
  const reactRoot = createRoot(element)
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  t.after(async () => { await act(async () => reactRoot.unmount()); element.remove(); await runtime.clearMAProfessorDailyDrafts(); delete globalThis.IS_REACT_ACT_ENVIRONMENT })
  await act(async () => reactRoot.render(React.createElement(runtime.BackupDraftNotice, { accountEmail: 'roundtrip@example.test' })))
  await waitFor(() => element.textContent.includes('1 aula com alterações por guardar'))
  assert.ok(element.textContent.includes('Os rascunhos não entram nesta cópia'))
  const openLesson = element.querySelector('button')
  assert.ok(openLesson.textContent.includes('21/09/2026 · 09:00–09:50 · 10.º D · Área de Expressões'))
  let target
  const onOpen = event => { target = event.detail }
  window.addEventListener('ma-professor-open-daily', onOpen)
  t.after(() => window.removeEventListener('ma-professor-open-daily', onOpen))
  await act(async () => openLesson.click())
  assert.deepEqual(target, { academicYearId: 'year-2026', date: '2026-09-21', lessonId: 'lesson-a' })
  assert.equal((await db.lessons.get('lesson-a')).summary, 'Criação e apresentação de pequenas histórias.', 'Abrir uma aula não deve gravar o rascunho.')

  await act(async () => runtime.saveMAProfessorDailyDraft({ ...draft, lessonId: 'lesson-b', date: '2026-09-28' }))
  await waitFor(() => element.querySelectorAll('button').length === 2)
  assert.ok(element.textContent.includes('2 aulas com alterações por guardar'))
  assert.deepEqual([...element.querySelectorAll('time')].map(item => item.dateTime), ['2026-09-21', '2026-09-28'])
  assert.equal((await runtime.listMAProfessorDailyDrafts('roundtrip@example.test')).length, 2)
  await act(async () => runtime.deleteMAProfessorDailyDraft('roundtrip@example.test', 'year-2026', 'lesson-b'))
  await waitFor(() => element.querySelectorAll('button').length === 1)

  await act(async () => runtime.saveMAProfessorDailyDraft({ ...draft, lessonId: 'unchanged', draftSignature: 'base' }))
  await act(async () => runtime.saveMAProfessorDailyDraft({ ...draft, academicYearId: 'year-inactive', lessonId: 'old-lesson', date: '2025-09-21' }))
  await waitFor(() => element.textContent.includes('Ano letivo inativo'))
  assert.equal(element.querySelectorAll('button').length, 1, 'Rascunhos de outro ano não devem abrir uma aula do ano ativo.')
  await act(async () => runtime.deleteMAProfessorDailyDraft('roundtrip@example.test', 'year-inactive', 'old-lesson'))
  await waitFor(() => !element.textContent.includes('Ano letivo inativo'))
  const backup = await runtime.createMAProfessorBackup()
  assert.equal(JSON.stringify(backup).includes('Rascunho por guardar'), false)
  await act(async () => runtime.deleteMAProfessorDailyDraft('roundtrip@example.test', 'year-2026', 'lesson-a'))
  await waitFor(() => element.textContent === '')
  assert.equal(await runtime.countMAProfessorDailyDrafts('other@example.test'), 1)
})
