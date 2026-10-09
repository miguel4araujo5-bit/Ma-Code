import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import 'fake-indexeddb/auto'
globalThis.window = { indexedDB: globalThis.indexedDB }
await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/move-decisions-'))
const outfile = resolve(temp, 'runtime.mjs')
await build({ stdin: { contents: `
export * from './src/components/ma-professor/db'
export * from './src/components/ma-professor/lessons/lessonRepository'
export * from './src/components/ma-professor/lessons/scheduledLessonReconciliationRepository'
export * from './src/components/ma-professor/assessments/assessmentWorkspaceRepository'
export * from './src/components/ma-professor/attendance/attendanceRepository'
export * from './src/components/ma-professor/settings/backupRepository'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile })
const api = await import(pathToFileURL(outfile).href)
const db = api.maProfessorDb
const stamp = '2026-09-01T08:00:00.000Z'
const audit = { createdAt: stamp, updatedAt: stamp }
const slot = (id = 'slot', weekday = 1, startTime = '09:00', endTime = '09:50') => ({ ...audit, id, academicYearId: 'y', teachingAssignmentId: 'a', weekday, startTime, endTime, periodCount: 1, validFrom: '2026-09-01', validUntil: '2027-07-31', active: true })
const lesson = (id, date, changes = {}) => ({ ...audit, id, date, academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm', scheduleSlotId: 'slot', origin: 'scheduled', status: 'planned', startTime: '09:00', endTime: '09:50', periodCount: 1, countTowardProgress: true, summary: 'Sumário ' + id, plannedActivity: 'Atividade ' + id, summarySource: 'manual', planificationItemIds: [], notes: 'Nota ' + id, giaeStatus: 'pending', giaeSubmittedAt: null, ...changes })
const attendance = (id, lessonId) => ({ ...audit, id, lessonId, studentId: 'student', status: 'absent', code: 'F', note: 'Nota da falta' })
const assessment = (id, lessonId) => ({ ...audit, id, lessonId, academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm', criterionId: 'criterion', title: 'Avaliação ' + id, activityType: 'practical_work', description: '', absentScore: 0, exemptScore: 0 })
const position = { date: '2026-09-15', startTime: '10:00', endTime: '10:50' }
async function capture(move, Type) {
  let captured
  await assert.rejects(move(), error => { assert.ok(error instanceof Type, error.message); captured = error; return true })
  return captured
}
async function confirm(move, { submitted = 'clear', records = 'transfer' } = {}) {
  const options = {}
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await move(options) } catch (error) {
      if (error instanceof api.LessonMoveBlockedError) options.submitted = { action: submitted, confirmationKey: error.confirmationKey }
      else if (error instanceof api.LessonMoveRecordsError) options.records = { action: records, confirmationKey: error.confirmationKey, deletionConfirmed: records === 'delete' }
      else throw error
    }
  }
  assert.fail('Move never completed after explicit decisions')
}
async function snapshot() {
  const entries = await Promise.all(db.tables.map(async table => [table.name, await table.toArray()]))
  return Object.fromEntries(entries)
}
beforeEach(async () => {
  await db.open()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await db.academicYears.put({ ...audit, id: 'y', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31', active: true })
  await db.groups.put({ ...audit, id: 'g', academicYearId: 'y', name: '10 D', courseName: 'TAP', gradeLevel: '10', educationType: 'professional', active: true })
  await db.subjects.put({ ...audit, id: 's', academicYearId: 'y', name: 'Expressões', shortName: 'AE', active: true })
  await db.teachingAssignments.put({ ...audit, id: 'a', academicYearId: 'y', groupId: 'g', subjectId: 's', displayName: 'AE', active: true })
  await db.modules.put({ ...audit, id: 'm', academicYearId: 'y', teachingAssignmentId: 'a', code: 'UC00033', name: 'Comunicar', order: 1, plannedPeriods: 120, plannedStartDate: null, plannedEndDate: null, active: true })
  await db.students.put({ ...audit, id: 'student', academicYearId: 'y', groupId: 'g', number: '1', name: 'Aluno fictício', active: true, notes: '' })
  await db.assessmentSchemes.put({ ...audit, id: 'scheme', academicYearId: 'y', teachingAssignmentId: 'a', moduleId: null, scope: 'subject', name: 'Critérios', active: true })
  await db.assessmentCriteria.put({ ...audit, id: 'criterion', schemeId: 'scheme', name: 'Desempenho', weightPercent: 100, order: 1, active: true })
  await db.weeklyScheduleSlots.put(slot())
  await db.lessons.bulkPut([lesson('source', '2026-09-14'), lesson('future', '2026-09-21'), lesson('other', '2026-09-16', { origin: 'extra', scheduleSlotId: null, startTime: '11:00', endTime: '11:50' })])
  await db.lessonAttendance.bulkPut([attendance('absence', 'source'), attendance('other-absence', 'other')])
  await db.lessonAssessments.bulkPut([assessment('assessment', 'source'), assessment('other-assessment', 'other')])
  await db.assessmentResults.bulkPut([
    { ...audit, id: 'result', assessmentId: 'assessment', studentId: 'student', status: 'evaluated', score: 15, note: '' },
    { ...audit, id: 'other-result', assessmentId: 'other-assessment', studentId: 'student', status: 'evaluated', score: 18, note: '' }
  ])
})
after(async () => { db.close(); await rm(temp, { recursive: true, force: true }) })

test('single move requires a fresh records decision and preserves identities and evidence on transfer', async () => {
  const before = await snapshot()
  const move = options => api.lessonRepository.moveLesson('source', position, stamp, undefined, options)
  const notice = await capture(() => move({}), api.LessonMoveRecordsError)
  assert.deepEqual(notice.lessons.map(row => row.id), ['source'])
  assert.equal(notice.absenceCount, 1)
  assert.equal(notice.assessmentCount, 1)
  assert.deepEqual(await snapshot(), before)
  const moved = await move({ records: { action: 'transfer', confirmationKey: notice.confirmationKey } })
  assert.equal(moved.date, position.date)
  assert.equal(moved.summary, before.lessons.find(row => row.id === 'source').summary)
  assert.deepEqual(moved.scheduleOriginalPosition, { date: '2026-09-14', startTime: '09:00' })
  assert.deepEqual(await db.lessonAttendance.toArray(), before.lessonAttendance)
  assert.deepEqual(await db.lessonAssessments.toArray(), before.lessonAssessments)
  assert.deepEqual(await db.assessmentResults.toArray(), before.assessmentResults)
})

test('deletion requires separate confirmation, removes only linked evidence and updates derived averages', async () => {
  const move = options => api.lessonRepository.moveLesson('source', position, stamp, undefined, options)
  const notice = await capture(() => move({}), api.LessonMoveRecordsError)
  const records = { action: 'delete', confirmationKey: notice.confirmationKey }
  const before = await snapshot()
  await capture(() => move({ records }), api.LessonMoveRecordsError)
  assert.deepEqual(await snapshot(), before)
  await move({ records: { ...records, deletionConfirmed: true } })
  assert.equal(await db.lessonAttendance.get('absence'), undefined)
  assert.equal(await db.lessonAssessments.get('assessment'), undefined)
  assert.equal(await db.assessmentResults.get('result'), undefined)
  assert.deepEqual(await db.lessons.get('other'), before.lessons.find(row => row.id === 'other'))
  assert.deepEqual(await db.assessmentResults.get('other-result'), before.assessmentResults.find(row => row.id === 'other-result'))
  await db.lessons.update('source', { giaeStatus: 'submitted', giaeSubmittedAt: stamp })
  const workspace = await api.assessmentWorkspaceRepository.getWorkspace('y', { teachingAssignmentId: 'a', moduleId: 'm' })
  assert.equal(workspace.studentRows[0].gradeSummary.provisionalAverage, null)
})

test('a stale confirmation cannot silently erase a new score or absence', async () => {
  const move = options => api.lessonRepository.moveLesson('source', position, stamp, undefined, options)
  const notice = await capture(() => move({}), api.LessonMoveRecordsError)
  await db.assessmentResults.update('result', { score: 19 })
  const before = await snapshot()
  const changed = await capture(() => move({ records: { action: 'delete', confirmationKey: notice.confirmationKey, deletionConfirmed: true } }), api.LessonMoveRecordsError)
  assert.notEqual(changed.confirmationKey, notice.confirmationKey)
  assert.deepEqual(await snapshot(), before)
})

for (const scope of ['from_here', 'whole_schedule']) {
  test('a submitted selected source can be skipped while the remaining timetable changes: ' + scope, async () => {
    await db.lessons.update('source', { giaeStatus: 'submitted', giaeSubmittedAt: stamp, status: 'taught' })
    const protectedSource = await db.lessons.get('source')
    const before = await snapshot()
    await confirm(options => api.lessonRepository.moveLessonWithScope('source', position, stamp, scope, undefined, options), { submitted: 'skip' })
    assert.deepEqual(await db.lessons.get('source'), protectedSource)
    assert.equal((await db.lessons.get('future')).date, '2026-09-22')
    assert.deepEqual(await db.lessonAttendance.toArray(), before.lessonAttendance)
    assert.deepEqual(await db.assessmentResults.toArray(), before.assessmentResults)
  })
  test('skip keeps submitted lessons intact and prevents regeneration after split, reload and backup: ' + scope, async () => {
    await db.lessons.update('future', { giaeStatus: 'submitted', giaeSubmittedAt: stamp, status: 'taught' })
    const protectedLesson = await db.lessons.get('future')
    await confirm(options => api.lessonRepository.moveLessonWithScope('source', position, stamp, scope, undefined, options), { submitted: 'skip' })
    assert.deepEqual(await db.lessons.get('future'), protectedLesson)
    const moved = await db.lessons.get('source')
    assert.ok((await db.weeklyScheduleSlots.get(moved.scheduleSlotId)).excludedDates.includes('2026-09-22'))
    const backup = JSON.parse(JSON.stringify(await api.createMAProfessorBackup()))
    assert.equal(api.validateMAProfessorBackup(backup).valid, true)
    await api.restoreMAProfessorBackup(backup)
    await api.scheduledLessonReconciliationRepository.reconcile({ academicYearId: 'y', dateFrom: '2026-09-14', dateTo: '2026-10-04' })
    await api.lessonRepository.generateScheduledLessons({ academicYearId: 'y', dateFrom: '2026-09-14', dateTo: '2026-10-04' })
    assert.deepEqual(await db.lessons.get('future'), protectedLesson)
    const all = await db.lessons.toArray()
    assert.equal(all.filter(row => row.date === '2026-09-22').length, 0)
    assert.equal(all.filter(row => row.date === '2026-09-28' && row.teachingAssignmentId === 'a').length, 0)
    assert.equal(all.filter(row => row.date === '2026-09-29' && row.teachingAssignmentId === 'a').length, 1)
  })
}

test('a previously displaced occurrence stays unique when from-here creates a new slot', async () => {
  await db.lessons.update('future', { date: '2026-09-23', startTime: '12:00', endTime: '12:50', scheduleOriginalPosition: { date: '2026-09-21', startTime: '09:00' } })
  const exception = await db.lessons.get('future')
  await confirm(options => api.lessonRepository.moveLessonWithScope('source', position, stamp, 'from_here', undefined, options))
  await api.scheduledLessonReconciliationRepository.reconcile({ academicYearId: 'y', dateFrom: '2026-09-21', dateTo: '2026-09-27' })
  assert.deepEqual(await db.lessons.get('future'), exception)
  assert.equal((await db.lessons.toArray()).filter(row => row.date === '2026-09-22').length, 0)
})

test('clearing submitted ticks and deleting records rolls back completely when a later write fails', async () => {
  await db.lessons.update('future', { giaeStatus: 'submitted', giaeSubmittedAt: stamp })
  const move = options => api.lessonRepository.moveLessonWithScope('source', position, stamp, 'from_here', undefined, options)
  const submitted = await capture(() => move({}), api.LessonMoveBlockedError)
  const options = { submitted: { action: 'clear', confirmationKey: submitted.confirmationKey } }
  const records = await capture(() => move(options), api.LessonMoveRecordsError)
  options.records = { action: 'delete', confirmationKey: records.confirmationKey, deletionConfirmed: true }
  const before = await snapshot()
  function failCreating() { throw new Error('Falha fictícia depois da eliminação') }
  db.weeklyScheduleSlots.hook('creating', failCreating)
  try { await assert.rejects(move(options), /Falha fictícia/) } finally { db.weeklyScheduleSlots.hook('creating').unsubscribe(failCreating) }
  assert.deepEqual(await snapshot(), before)
  await move(options)
  assert.equal((await db.lessons.get('future')).giaeStatus, 'pending')
  assert.equal((await db.lessons.get('future')).giaeSubmittedAt, null)
})

test('skipping a submitted swap partner identifies the occupied date and leaves the whole operation intact', async () => {
  await db.weeklyScheduleSlots.put(slot('second', 2, '10:00', '10:50'))
  await db.lessons.bulkPut([
    lesson('target', '2026-09-15', { scheduleSlotId: 'second', startTime: '10:00', endTime: '10:50' }),
    lesson('target-future', '2026-09-22', { scheduleSlotId: 'second', startTime: '10:00', endTime: '10:50' })
  ])
  await db.lessons.update('future', { giaeStatus: 'submitted', giaeSubmittedAt: stamp })
  const move = options => api.lessonRepository.moveLessonWithScope('source', position, stamp, 'from_here', { id: 'target', updatedAt: stamp }, options)
  const notice = await capture(() => move({}), api.LessonMoveBlockedError)
  const before = await snapshot()
  await assert.rejects(move({ submitted: { action: 'skip', confirmationKey: notice.confirmationKey } }), /2026-09-21/)
  assert.deepEqual(await snapshot(), before)
})

test('same-day swapping preserves both subjects and asks explicitly about both sets of records', async () => {
  await db.teachingAssignments.put({ ...await db.teachingAssignments.get('a'), id: 'a2', displayName: 'AS' })
  await db.modules.put({ ...await db.modules.get('m'), id: 'm2', teachingAssignmentId: 'a2' })
  await db.lessons.put(lesson('target', '2026-09-14', { origin: 'extra', scheduleSlotId: null, teachingAssignmentId: 'a2', moduleId: 'm2', startTime: '10:00', endTime: '10:50' }))
  await db.lessonAttendance.put(attendance('target-absence', 'target'))
  const move = options => api.lessonRepository.moveLesson('source', { ...position, date: '2026-09-14' }, stamp, { id: 'target', updatedAt: stamp }, options)
  const notice = await capture(() => move({}), api.LessonMoveRecordsError)
  assert.deepEqual(new Set(notice.lessons.map(row => row.id)), new Set(['source', 'target']))
  await move({ records: { action: 'transfer', confirmationKey: notice.confirmationKey } })
  assert.equal((await db.lessons.get('source')).teachingAssignmentId, 'a')
  assert.equal((await db.lessons.get('source')).startTime, '10:00')
  assert.equal((await db.lessons.get('target')).teachingAssignmentId, 'a2')
  assert.equal((await db.lessons.get('target')).startTime, '09:00')
  assert.equal((await db.lessonAttendance.get('target-absence')).lessonId, 'target')
  assert.equal((await db.assessmentResults.get('result')).score, 15)
  assert.equal(await db.lessons.count(), 4)
})

test('recovered absence references move with their lesson; deletion prunes only those links and keeps recovery history', async () => {
  await db.lessonAttendance.update('absence', { status: 'present' })
  const recovery = { ...audit, id: 'recovery', academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm', studentId: 'student', triggeredAt: stamp, lessonCountAtTrigger: 10, absenceCountAtTrigger: 2, absencePercentAtTrigger: 20, contents: 'Conteúdos preservados', activity: 'Atividade preservada', plannedDate: null, status: 'completed', result: 'Concluída', completedAt: stamp, selectedAbsenceIds: ['absence', 'other-absence'], removedAbsences: [
    { attendanceId: 'absence', lessonId: 'source', date: '2026-09-14', periods: 1 },
    { attendanceId: 'other-absence', lessonId: 'other', date: '2026-09-16', periods: 1 }
  ] }
  await db.learningRecoveries.put(recovery)
  await confirm(options => api.lessonRepository.moveLesson('source', position, stamp, undefined, options))
  assert.equal((await db.learningRecoveries.get('recovery')).removedAbsences[0].date, '2026-09-15')
  const moved = await db.lessons.get('source')
  await confirm(options => api.lessonRepository.moveLesson('source', { ...position, date: '2026-09-17' }, moved.updatedAt, undefined, options), { records: 'delete' })
  const saved = await db.learningRecoveries.get('recovery')
  assert.deepEqual(saved.selectedAbsenceIds, ['other-absence'])
  assert.deepEqual(saved.removedAbsences, [recovery.removedAbsences[1]])
  assert.equal(saved.contents, recovery.contents)
  assert.equal(saved.status, 'completed')
})
