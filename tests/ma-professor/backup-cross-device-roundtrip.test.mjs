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
        export {
          createMAProfessorBackup,
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

test('V3 cloud upload, verified download and fresh-device IndexedDB restore preserve summaries, absences and grades after reopening', async t => {
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
  const saved = await runtime.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, sourceBackup, { expectedServerRevision: 0 })
  assert.equal(saved.serverRevision, 1)

  runtime.clearMAProfessorOpaqueExportKey()
  await db.delete()
  await db.open()
  assert.equal(await db.lessons.count(), 0)
  assert.equal(await db.lessonAttendance.count(), 0)
  assert.equal(await db.assessmentResults.count(), 0)
  runtime.saveMAProfessorOpaqueExportKey(session.email, exportKey)
  const downloaded = await runtime.downloadCompatibleMAProfessorCloudBackup({ ...session, deviceId: 'device-b' })
  assert.deepEqual(downloaded.backup, sourceBackup)
  await runtime.restoreMAProfessorBackup(downloaded.backup)
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
