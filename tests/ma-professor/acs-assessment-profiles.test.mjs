import assert from 'node:assert/strict'
import test, { after, beforeEach } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'

const root = resolve(new URL('../..', import.meta.url).pathname)
const cache = join(root, 'node_modules/.cache')
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(join(cache, 'acs-assessment-'))
const runtimePath = join(output, 'runtime.cjs')
const base = './src/components/ma-professor/'
const bundle = await build({
  stdin: { contents: `
    export { maProfessorDb } from '${base}db';
    export { maProfessorRepository } from '${base}repository';
    export { groupsWorkspaceRepository } from '${base}groups/groupsWorkspaceRepository';
    export { assessmentCriteriaBatchRepository } from '${base}assessmentCriteriaBatchRepository';
    export { assessmentCriteriaManagementRepository } from '${base}assessments/assessmentCriteriaManagementRepository';
    export { assessmentRepository } from '${base}assessments/assessmentRepository';
    export { assessmentWorkspaceRepository } from '${base}assessments/assessmentWorkspaceRepository';
    export { dailyCriteriaGridRepository, calculateDailyCriteriaAverage } from '${base}daily/dailyCriteriaGridRepository';
    export { recoveryAssessmentRepository } from '${base}attendance/recoveryAssessmentRepository';
    export { persistStudentsWithAssessmentProfiles, previewStudentAssessmentProfileChanges } from '${base}students/studentAssessmentProfileRepository';
    export { studentAssessmentProfile, canRestoreStudentAssessmentDraft } from '${base}assessments/assessmentProfiles';
    export { confirmStudentAssessmentProfileUpdate } from '${base}students/studentAssessmentProfileConfirmation';
    export { StudentAssessmentProfileFields } from '${base}students/StudentAssessmentProfileFields';
    export { buildUfcdCfpModel } from '${base}assessments/ufcdCfpModel';
    export { createMAProfessorDatabaseSnapshot, restoreMAProfessorDatabaseSnapshot } from '${base}sync/databaseSnapshotService';
    export { createMAProfessorBackup, restoreMAProfessorBackup } from '${base}settings/backupRepository';
  `, resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external'
})
writeFileSync(runtimePath, bundle.outputFiles[0].text)
const dom = new JSDOM('', { url: 'https://example.test' })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.CustomEvent = dom.window.CustomEvent
Object.defineProperty(window, 'indexedDB', { value: globalThis.indexedDB })
const rt = createRequire(import.meta.url)(runtimePath)
const db = rt.maProfessorDb
const audit = { createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' }
const student = (id, number) => ({ id, number: String(number), name: `Aluno ${number}`, academicYearId: 'year', groupId: 'group', active: true, notes: '', ...audit })
const lesson = (id, moduleId, date) => ({ id, moduleId, date, academicYearId: 'year', teachingAssignmentId: 'assignment', scheduleSlotId: null, origin: 'extra', status: 'taught', startTime: '09:00', endTime: '09:50', periodCount: 1, countTowardProgress: true, plannedActivity: '', summary: `Sumário ${id}`, summarySource: 'manual', planificationItemIds: [], giaeStatus: 'submitted', notes: '', ...audit })
let general, acs

beforeEach(async () => {
  await db.delete()
  await db.open()
  window.localStorage.clear()
  await db.academicYears.add({ id: 'year', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-08-31', active: true, setupCompletedAt: audit.createdAt, ...audit })
  await db.groups.add({ id: 'group', academicYearId: 'year', name: '10.º A', educationType: 'professional', grade: 10, courseName: 'TAP', active: true, ...audit })
  await db.subjects.add({ id: 'subject', academicYearId: 'year', name: 'Expressões', shortName: 'AE', code: 'AE', active: true, ...audit })
  await db.teachingAssignments.add({ id: 'assignment', academicYearId: 'year', groupId: 'group', subjectId: 'subject', displayName: 'AE · 10.º A', active: true, ...audit })
  await db.modules.bulkAdd(['finished', 'current', 'future'].map((id, i) => ({ id, academicYearId: 'year', teachingAssignmentId: 'assignment', code: String(i + 1), name: `UFCD ${i + 1}`, plannedPeriods: id === 'finished' ? 1 : 10, order: i + 1, plannedStartDate: null, plannedEndDate: null, active: true, ...audit })))
  await db.students.bulkAdd([student('regular', 1), student('changing', 2)])
  await db.lessons.bulkAdd([lesson('old', 'finished', '2026-09-07'), lesson('first', 'current', '2026-09-14'), lesson('second', 'current', '2026-09-21')])
  const created = await rt.assessmentCriteriaBatchRepository.createSubjectSchemes({ academicYearId: 'year', teachingAssignmentIds: ['assignment'], name: 'Gerais', criteria: [{ name: 'Conhecimentos', weightPercent: 60 }, { name: 'Participação', weightPercent: 20 }, { name: 'Autonomia', weightPercent: 20 }] })
  general = created[0]
  acs = (await rt.assessmentCriteriaBatchRepository.createSubjectSchemes({ academicYearId: 'year', teachingAssignmentIds: ['assignment'], name: 'ACS', profile: 'acs', criteria: [{ name: 'Interação', weightPercent: 70 }, { name: 'Envolvimento', weightPercent: 30 }] }))[0]
})

async function saveGrid(lessonId, scoresByStudent) {
  return rt.dailyCriteriaGridRepository.saveLessonGrid({ lesson: await db.lessons.get(lessonId), summary: `Sumário ${lessonId}`, activity: 'Atividade', rows: Object.entries(scoresByStudent).map(([studentId, scores]) => ({ studentId, attendanceStatus: 'present', scores })) })
}
const scores = (criteria, values) => Object.fromEntries(criteria.map((c, i) => [c.id, String(values[i])]))
const workspace = moduleId => rt.assessmentWorkspaceRepository.getWorkspace('year', { teachingAssignmentId: 'assignment', moduleId })
async function changeProfile(profile, assignment = 'assignment', studentId = 'changing') {
  const assessmentProfilesByAssignment = { [assignment]: profile }
  const preview = await rt.previewStudentAssessmentProfileChanges(studentId, assessmentProfilesByAssignment)
  return rt.groupsWorkspaceRepository.updateStudent(studentId, {
    assessmentProfilesByAssignment, assessmentProfileChangeConfirmation: preview.confirmation
  })
}
const activate = () => changeProfile('acs')

test('independent general and ACS imports, editing and duplicate protection', async () => {
  assert.equal((await db.assessmentSchemes.toArray()).length, 2)
  await assert.rejects(rt.assessmentCriteriaBatchRepository.createSubjectSchemes({ academicYearId: 'year', teachingAssignmentIds: ['assignment'], name: 'Duplicate ACS', profile: 'acs', criteria: [{ name: 'Único', weightPercent: 100 }] }))
  const normal = await rt.assessmentCriteriaManagementRepository.getSubjectContext('year', 'subject')
  const adapted = await rt.assessmentCriteriaManagementRepository.getSubjectContext('year', 'subject', 'acs')
  assert.equal(normal.scheme.id, general.scheme.id)
  assert.equal(adapted.scheme.id, acs.scheme.id)
  await rt.assessmentCriteriaManagementRepository.updateSubjectSchemes({ academicYearId: 'year', subjectId: 'subject', referenceSchemeId: acs.scheme.id, name: 'ACS atualizado', criteria: adapted.criteria.map((c, i) => ({ id: c.id, name: c.name, description: '', weightPercent: i === 0 ? 80 : 20 })) })
  assert.deepEqual((await rt.assessmentCriteriaManagementRepository.getSubjectContext('year', 'subject')).criteria.map(c => c.weightPercent), [60, 20, 20])
  assert.deepEqual((await rt.assessmentCriteriaManagementRepository.getSubjectContext('year', 'subject', 'acs')).criteria.map(c => c.weightPercent), [80, 20])
})

test('activation resets only this pupil in the current unit and preserves finished grades, summaries and attendance', async () => {
  const normalScores = scores(general.criteria, [16, 12, 10])
  await saveGrid('old', { regular: normalScores, changing: normalScores })
  await saveGrid('first', { regular: normalScores, changing: normalScores })
  await db.lessonAttendance.add({ id: 'absence', academicYearId: 'year', lessonId: 'first', studentId: 'regular', status: 'absent', code: 'F', note: '', ...audit })
  const final = id => ({ id, academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: id === 'finished-final' ? 'finished' : 'current', studentId: 'changing', calculatedAverage: 14, suggestedGrade: 14, finalGrade: 14, selfAssessmentGrade: null, note: '', confirmedAt: audit.createdAt, ...audit })
  await db.moduleFinalGrades.bulkAdd([final('finished-final'), final('current-final')])
  const beforeLessons = await db.lessons.toArray()
  const beforeAttendance = await db.lessonAttendance.toArray()
  const beforeResults = await db.assessmentResults.toArray()
  const beforeFinal = await db.moduleFinalGrades.get('finished-final')
  const oldAssessmentIds = new Set((await db.lessonAssessments.where('lessonId').equals('old').toArray()).map(a => a.id))
  await activate()
  assert.deepEqual(await db.lessons.toArray(), beforeLessons)
  assert.deepEqual(await db.lessonAttendance.toArray(), beforeAttendance)
  assert.deepEqual(await db.moduleFinalGrades.get('finished-final'), beforeFinal)
  assert.equal(await db.moduleFinalGrades.get('current-final'), undefined)
  assert.deepEqual(await db.assessmentResults.toArray(), beforeResults.filter(r => r.studentId !== 'changing' || oldAssessmentIds.has(r.assessmentId)))
  const saved = await db.students.get('changing')
  assert.equal(saved.assessmentProfilesByAssignment.assignment, 'acs')
  assert.deepEqual(saved.assessmentProfilesByModule, { finished: 'general' })
  const completed = await workspace('finished')
  const oldRow = completed.studentRows.find(r => r.student.id === 'changing')
  assert.equal(oldRow.assessmentProfile, 'general')
  assert.equal(oldRow.gradeSummary.provisionalAverage, 14)
  assert.equal(oldRow.finalGradeRecord.finalGrade, 14)
  const activeRow = (await workspace('current')).studentRows.find(r => r.student.id === 'changing')
  assert.equal(activeRow.assessmentProfile, 'acs')
  assert.equal(activeRow.gradeSummary.provisionalAverage, null)
  assert.equal((await workspace('future')).studentRows.find(r => r.student.id === 'changing').assessmentProfile, 'acs')
})

test('one day grid supports different criteria and weighted means; earlier unfinished lessons can be re-entered', async () => {
  await activate()
  const normalScores = scores(general.criteria, [16, 12, 10])
  const adaptedScores = scores(acs.criteria, [18, 10])
  // Even stale, irrelevant form fields cannot introduce results under the wrong profile.
  const grid = await saveGrid('first', { regular: { ...normalScores, ...adaptedScores }, changing: { ...normalScores, ...adaptedScores } })
  assert.equal(grid.criteria.length, 5)
  assert.deepEqual(grid.criterionIdsByStudentId.regular, general.criteria.map(c => c.id))
  assert.deepEqual(grid.criterionIdsByStudentId.changing, acs.criteria.map(c => c.id))
  assert.deepEqual(grid.scoresByStudentId.regular, Object.fromEntries(general.criteria.map((c, i) => [c.id, [16, 12, 10][i]])))
  assert.deepEqual(grid.scoresByStudentId.changing, Object.fromEntries(acs.criteria.map((c, i) => [c.id, [18, 10][i]])))
  assert.equal(await db.assessmentResults.count(), 5)
  assert.equal(rt.calculateDailyCriteriaAverage(adaptedScores, acs.criteria), 15.6)
  const snapshot = await workspace('current')
  const normal = snapshot.studentRows.find(r => r.student.id === 'regular')
  const adapted = snapshot.studentRows.find(r => r.student.id === 'changing')
  assert.equal(normal.gradeSummary.provisionalAverage, 14)
  assert.equal(adapted.gradeSummary.provisionalAverage, 15.6)
  assert.equal(adapted.gradeSummary.suggestedGrade, 16)
  assert.deepEqual(adapted.gradeSummary.criteria.map(c => c.criterionName), ['Interação', 'Envolvimento'])
  const cfp = rt.buildUfcdCfpModel(snapshot)
  const finalRow = cfp.rows.find(r => r.studentName === 'Aluno 2')
  assert.equal(finalRow.usesAcs, true)
  assert.equal(finalRow.acsScore, 15.6)
  assert.deepEqual(finalRow.criterionScores, [null, null, null])
  const final = await rt.assessmentWorkspaceRepository.saveModuleFinalGrade({ moduleId: 'current', studentId: 'changing', finalGrade: 16, usesAcs: false })
  assert.equal(final.usesAcs, true)
})

test('ACS without an imported set stays ungraded; a roster import does not reset the pupil flag', async () => {
  await db.assessmentSchemes.delete(acs.scheme.id)
  await db.assessmentCriteria.bulkDelete(acs.criteria.map(c => c.id))
  await activate()
  await rt.maProfessorRepository.saveStudentsForGroup('year', 'group', [{ number: '2', name: 'Aluno 2' }])
  assert.equal((await db.students.get('changing')).assessmentProfilesByAssignment.assignment, 'acs')
  const grid = await rt.dailyCriteriaGridRepository.getLessonGrid('first')
  assert.deepEqual(grid.criterionIdsByStudentId.changing, [])
  assert.deepEqual(grid.acsStudentIds, ['changing'])
  await saveGrid('first', { regular: scores(general.criteria, [16, 12, 10]), changing: scores(general.criteria, [20, 20, 20]) })
  const row = (await workspace('current')).studentRows.find(r => r.student.id === 'changing')
  assert.equal(row.gradeSummary.provisionalAverage, null)
  assert.equal(row.gradeSummary.allActiveCriteriaAssessed, false)
})

test('ACS persists after a database reopen and survives both backup formats', async () => {
  await activate()
  const saved = await db.students.get('changing')
  db.close()
  await db.open()
  assert.deepEqual(await db.students.get('changing'), saved)
  const backup = await rt.createMAProfessorBackup()
  await db.students.clear()
  await rt.restoreMAProfessorBackup(backup)
  assert.deepEqual(await db.students.get('changing'), saved)
  assert.equal((await db.assessmentSchemes.get(acs.scheme.id)).profile, 'acs')
  const cloud = await rt.createMAProfessorDatabaseSnapshot()
  await db.students.clear()
  await rt.restoreMAProfessorDatabaseSnapshot(cloud)
  assert.deepEqual(await db.students.get('changing'), saved)
  assert.equal((await db.assessmentSchemes.get(acs.scheme.id)).profile, 'acs')
})

test('ACS is independent in each subject and preserves the other subject grades', async () => {
  await db.subjects.add({ id: 'second-subject', academicYearId: 'year', name: 'Animação', shortName: 'AS', code: 'AS', active: true, ...audit })
  await db.teachingAssignments.add({ id: 'second-assignment', academicYearId: 'year', groupId: 'group', subjectId: 'second-subject', displayName: 'AS · 10.º A', active: true, ...audit })
  await db.modules.bulkAdd(['second-finished', 'second-current'].map((id, i) => ({ id, academicYearId: 'year', teachingAssignmentId: 'second-assignment', code: id, name: id, plannedPeriods: i === 0 ? 1 : 10, order: i + 1, active: true, ...audit })))
  await db.lessons.bulkAdd(['second-finished', 'second-current'].map(id => ({ ...lesson(`lesson-${id}`, id, '2026-09-15'), teachingAssignmentId: 'second-assignment' })))
  const secondGeneral = (await rt.assessmentCriteriaBatchRepository.createSubjectSchemes({ academicYearId: 'year', teachingAssignmentIds: ['second-assignment'], name: 'Gerais de AS', criteria: [{ name: 'Desempenho', weightPercent: 100 }] }))[0]
  const secondAcs = (await rt.assessmentCriteriaBatchRepository.createSubjectSchemes({ academicYearId: 'year', teachingAssignmentIds: ['second-assignment'], name: 'ACS de AS', profile: 'acs', criteria: [{ name: 'Empenho', weightPercent: 40 }, { name: 'Comunicação', weightPercent: 60 }] }))[0]
  await saveGrid('lesson-second-finished', { changing: scores(secondGeneral.criteria, [12]) })
  await saveGrid('lesson-second-current', { changing: scores(secondGeneral.criteria, [8]) })
  const secondWorkspace = moduleId => rt.assessmentWorkspaceRepository.getWorkspace('year', { teachingAssignmentId: 'second-assignment', moduleId })
  await activate()
  assert.equal((await secondWorkspace('second-finished')).studentRows.find(r => r.student.id === 'changing').gradeSummary.provisionalAverage, 12)
  assert.equal((await secondWorkspace('second-current')).studentRows.find(r => r.student.id === 'changing').gradeSummary.provisionalAverage, 8)
  assert.equal((await secondWorkspace('second-current')).studentRows.find(r => r.student.id === 'changing').assessmentProfile, 'general')
  await changeProfile('acs', 'second-assignment')
  assert.equal((await secondWorkspace('second-current')).studentRows.find(r => r.student.id === 'changing').gradeSummary.provisionalAverage, null)
  await saveGrid('first', { changing: scores(acs.criteria, [18, 10]) })
  await saveGrid('lesson-second-current', { changing: scores(secondAcs.criteria, [16, 20]) })
  assert.equal((await workspace('current')).studentRows.find(r => r.student.id === 'changing').gradeSummary.provisionalAverage, 15.6)
  const adapted = (await secondWorkspace('second-current')).studentRows.find(r => r.student.id === 'changing')
  assert.equal(adapted.gradeSummary.provisionalAverage, 18.4)
  assert.deepEqual(adapted.gradeSummary.criteria.map(c => c.criterionName), ['Empenho', 'Comunicação'])
})

test('a failed pupil save rolls the flag, deleted results and final grades back together', async () => {
  await saveGrid('first', { changing: scores(general.criteria, [16, 12, 10]) })
  const before = await Promise.all([db.students.toArray(), db.assessmentResults.toArray(), db.moduleFinalGrades.toArray()])
  const fail = () => { throw new Error('Falha de gravação simulada') }
  db.students.hook('updating', fail)
  try { await assert.rejects(activate(), /Falha de gravação simulada/) }
  finally { db.students.hook('updating').unsubscribe(fail) }
  assert.deepEqual(await Promise.all([db.students.toArray(), db.assessmentResults.toArray(), db.moduleFinalGrades.toArray()]), before)
})

test('both recovery profiles remain available and an old recovery can be assessed afresh with ACS', async () => {
  assert.deepEqual((await rt.recoveryAssessmentRepository.listCriteria('assignment', 'current')).map(c => c.id), general.criteria.map(c => c.id))
  assert.deepEqual((await rt.recoveryAssessmentRepository.listCriteria('assignment', 'current', 'acs')).map(c => c.id), acs.criteria.map(c => c.id))
  await saveGrid('first', { regular: scores(general.criteria, [16, 12, 10]), changing: scores(general.criteria, [16, 12, 10]) })
  await db.learningRecoveries.add({ id: 'recovery', academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: 'current', studentId: 'changing', status: 'completed', completedAt: audit.updatedAt, recoveryGrade: 9, assessmentRecordedAt: audit.updatedAt, assessmentScores: Object.fromEntries(general.criteria.map(c => [c.id, 10])), ...audit })
  await activate()
  const fresh = (await workspace('current')).studentRows.find(r => r.student.id === 'changing')
  assert.equal(fresh.gradeSummary.provisionalAverage, null)
  assert.equal(fresh.gradeSummary.confirmedFinalGrade, null)
  await assert.rejects(rt.recoveryAssessmentRepository.saveAssessment('recovery', Object.fromEntries(general.criteria.map(c => [c.id, 20]))))
  await rt.recoveryAssessmentRepository.saveAssessment('recovery', Object.fromEntries(acs.criteria.map((c, i) => [c.id, [18, 10][i]])))
  const adapted = (await workspace('current')).studentRows.find(r => r.student.id === 'changing')
  assert.equal(adapted.gradeSummary.provisionalAverage, 15.6)
  assert.equal(adapted.gradeSummary.suggestedGrade, null, 'an additional recovery alone does not replace a complete lesson assessment')
  await saveGrid('second', { changing: scores(acs.criteria, [18, 10]) })
  assert.equal((await workspace('current')).studentRows.find(r => r.student.id === 'changing').gradeSummary.suggestedGrade, 16)
})

test('correcting the pupil flag never carries a final grade across profiles in an unfinished unit', async () => {
  await activate()
  await saveGrid('first', { changing: scores(acs.criteria, [18, 10]) })
  await rt.assessmentWorkspaceRepository.saveModuleFinalGrade({ moduleId: 'current', studentId: 'changing', finalGrade: 16 })
  await changeProfile('general')
  const generalAgain = (await workspace('current')).studentRows.find(r => r.student.id === 'changing')
  assert.equal(generalAgain.assessmentProfile, 'general')
  assert.equal(generalAgain.gradeSummary.confirmedFinalGrade, null)
  assert.deepEqual(await db.assessmentResults.where('studentId').equals('changing').toArray(), [])
  await activate()
  assert.equal((await workspace('current')).studentRows.find(r => r.student.id === 'changing').gradeSummary.provisionalAverage, null)
})

test('both directions require confirmation and cancelling leaves all data intact', async () => {
  await saveGrid('first', { changing: scores(general.criteria, [16, 12, 10]) })
  for (const profile of ['acs', 'general']) {
    const student = await db.students.get('changing')
    const before = await rt.createMAProfessorDatabaseSnapshot()
    await assert.rejects(rt.groupsWorkspaceRepository.updateStudent('changing', {
      assessmentProfilesByAssignment: { assignment: profile }
    }), /Confirme novamente/)
    assert.deepEqual((await rt.createMAProfessorDatabaseSnapshot()).tables, before.tables)
    let message = ''
    window.confirm = text => { message = text; return false }
    assert.equal(await rt.confirmStudentAssessmentProfileUpdate(student, { assignment: profile }), null)
    assert.match(message, /Aluno 2/)
    assert.match(message, /AE · 10.º A/)
    assert.match(message, /UFCD\/UC\/módulo em curso/)
    assert.match(message, /As unidades concluídas anteriormente/)
    assert.match(message, /faltas e os vistos/)
    assert.deepEqual((await rt.createMAProfessorDatabaseSnapshot()).tables, before.tables)
    window.confirm = () => true
    const update = await rt.confirmStudentAssessmentProfileUpdate(student, { assignment: profile })
    await rt.groupsWorkspaceRepository.updateStudent('changing', update)
  }
})

test('a concurrent assessment or change of current unit invalidates an earlier confirmation', async () => {
  const requested = { assignment: 'acs' }
  for (const mutation of [
    () => saveGrid('first', { changing: scores(general.criteria, [16, 12, 10]) }),
    () => db.modules.update('current', { plannedPeriods: 2 })
  ]) {
    const preview = await rt.previewStudentAssessmentProfileChanges('changing', requested)
    await mutation()
    const before = await rt.createMAProfessorDatabaseSnapshot()
    await assert.rejects(rt.groupsWorkspaceRepository.updateStudent('changing', {
      assessmentProfilesByAssignment: requested, assessmentProfileChangeConfirmation: preview.confirmation
    }), /Confirme novamente/)
    assert.deepEqual((await rt.createMAProfessorDatabaseSnapshot()).tables, before.tables)
  }
})

test('future entered grades survive while newly created units inherit the chosen subject profile', async () => {
  await db.lessons.add(lesson('future-lesson', 'future', '2026-11-01'))
  await saveGrid('future-lesson', { changing: scores(general.criteria, [16, 12, 10]) })
  const before = await db.assessmentResults.toArray()
  await activate()
  assert.deepEqual(await db.assessmentResults.toArray(), before)
  const futureRow = (await workspace('future')).studentRows.find(row => row.student.id === 'changing')
  assert.equal(futureRow.assessmentProfile, 'general')
  assert.equal(futureRow.gradeSummary.provisionalAverage, 14)
  await db.modules.add({ ...(await db.modules.get('future')), id: 'new-unit', order: 4 })
  assert.equal((await workspace('new-unit')).studentRows.find(row => row.student.id === 'changing').assessmentProfile, 'acs')
})

test('removing ACS after a unit completes preserves its grades, profile and recovery history', async () => {
  await activate()
  await saveGrid('first', { changing: scores(acs.criteria, [18, 10]) })
  await db.learningRecoveries.add({ id: 'finished-recovery', academicYearId: 'year', teachingAssignmentId: 'assignment',
    moduleId: 'current', studentId: 'changing', status: 'completed', recoveryGrade: 17,
    assessmentScores: Object.fromEntries(acs.criteria.map(c => [c.id, 17])), ...audit })
  await db.modules.update('current', { plannedPeriods: 2 })
  const beforeResults = await db.assessmentResults.toArray()
  const beforeRecovery = await db.learningRecoveries.get('finished-recovery')
  await changeProfile('general')
  assert.deepEqual(await db.assessmentResults.toArray(), beforeResults)
  assert.deepEqual(await db.learningRecoveries.get('finished-recovery'), beforeRecovery)
  assert.equal((await workspace('current')).studentRows.find(row => row.student.id === 'changing').assessmentProfile, 'acs')
  assert.equal((await workspace('future')).studentRows.find(row => row.student.id === 'changing').assessmentProfile, 'general')
})

test('recovery grades reset both ways without changing previously removed absences', async () => {
  for (const profile of ['acs', 'general']) {
    const recovery = { id: 'current-recovery', academicYearId: 'year', teachingAssignmentId: 'assignment',
      moduleId: 'current', studentId: 'changing', status: 'completed', recoveryGrade: 18,
      removedAbsences: [{ attendanceId: 'absence', lessonId: 'first', date: '2026-09-14', periods: 1 }],
      assessmentScores: { test: 18 }, assessmentRecordedAt: audit.updatedAt, ...audit }
    await db.learningRecoveries.put(recovery)
    await changeProfile(profile)
    const saved = await db.learningRecoveries.get(recovery.id)
    assert.equal(saved.recoveryGrade, null)
    assert.equal(saved.assessmentScores, null)
    assert.deepEqual(saved.removedAbsences, recovery.removedAbsences)
    assert.equal(saved.status, recovery.status)
  }
})

test('legacy global profiles are preserved until a specific subject is changed', async () => {
  await db.students.update('changing', { usesAcs: true, acsEnabledAt: audit.createdAt })
  const legacy = await db.students.get('changing')
  assert.equal(rt.studentAssessmentProfile(legacy, 'current', 'assignment'), 'acs')
  await rt.maProfessorRepository.saveStudentsForGroup('year', 'group', [{ number: '2', name: 'Nome corrigido' }])
  assert.equal((await db.students.get('changing')).usesAcs, true)
  await changeProfile('general')
  const saved = await db.students.get('changing')
  assert.equal(rt.studentAssessmentProfile(saved, 'current', 'assignment'), 'general')
  assert.equal(rt.studentAssessmentProfile(saved, 'other-unit', 'other-assignment'), 'acs')
  assert.equal(saved.acsEnabledAt, audit.createdAt)
})

test('new pupils select individual subjects and cannot choose another group assignment', async () => {
  await rt.maProfessorRepository.saveStudentsForGroup('year', 'group', [{ number: '3', name: 'Aluno Novo',
    assessmentProfilesByAssignment: { assignment: 'acs' } }])
  const saved = (await db.students.toArray()).find(student => student.number === '3')
  assert.equal(rt.studentAssessmentProfile(saved, 'current', 'assignment'), 'acs')
  assert.equal(rt.studentAssessmentProfile(saved, 'other-unit', 'other-assignment'), 'general')
  await assert.rejects(rt.previewStudentAssessmentProfileChanges('changing', { 'foreign-assignment': 'acs' }), /não pertence/)
})

test('old drafts and an already open grid cannot restore marks after either profile reset', async () => {
  for (const profile of ['acs', 'general']) {
    const oldStudent = await db.students.get('changing')
    await changeProfile(profile)
    const saved = await db.students.get('changing')
    assert.equal(rt.canRestoreStudentAssessmentDraft(saved, 'current', audit.updatedAt), false)
    assert.equal(rt.canRestoreStudentAssessmentDraft(saved, 'finished', audit.updatedAt), true)
    assert.equal(rt.canRestoreStudentAssessmentDraft(saved, 'current', '2099-01-01T00:00:00.000Z'), true)
    await assert.rejects(rt.dailyCriteriaGridRepository.saveLessonGrid({ lesson: await db.lessons.get('first'),
      summary: 'Sumário', activity: '', rows: [{ studentId: 'changing', attendanceStatus: 'present',
        expectedAssessmentResetAt: oldStudent.assessmentResetAtByModule?.current ?? '',
        scores: scores(profile === 'acs' ? acs.criteria : general.criteria, [18, 10, 12]) }] }), /Reabra a aula/)
    assert.equal(await db.assessmentResults.count(), 0)
  }
})

after(async () => { await db.delete(); dom.window.close(); rmSync(output, { recursive: true, force: true }) })
