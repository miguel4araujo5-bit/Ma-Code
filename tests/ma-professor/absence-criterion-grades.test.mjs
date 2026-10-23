import assert from 'node:assert/strict'
import test, { after, beforeEach } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'

const root = resolve(new URL('../..', import.meta.url).pathname)
mkdirSync(join(root, 'node_modules/.cache'), { recursive: true })
const output = mkdtempSync(join(root, 'node_modules/.cache/absence-criteria-'))
const runtimePath = join(output, 'runtime.cjs')
const base = './src/components/ma-professor/'
const bundle = await build({ stdin: { contents: `
export { maProfessorDb } from '${base}db';
export { maProfessorRepository } from '${base}repository';
export { assessmentCriteriaBatchRepository } from '${base}assessmentCriteriaBatchRepository';
export { assessmentCriteriaManagementRepository } from '${base}assessments/assessmentCriteriaManagementRepository';
export { assessmentWorkspaceRepository } from '${base}assessments/assessmentWorkspaceRepository';
export { dailyCriteriaGridRepository } from '${base}daily/dailyCriteriaGridRepository';
export { loadAbsenceGradeSettings, saveAbsenceGradeSettings } from '${base}settings/absenceGradeSettingsRepository';
export { AbsenceGradeSettingsPanel } from '${base}settings/AbsenceGradeSettingsPanel';
export { createMAProfessorBackup, restoreMAProfessorBackup, validateMAProfessorBackup } from '${base}settings/backupRepository';
export { getUfcdEmissionFingerprint } from '${base}assessments/ufcdCfpModel';
`, resolveDir: root }, bundle: true, jsx: 'automatic', write: false, platform: 'node', format: 'cjs', packages: 'external' })
writeFileSync(runtimePath, bundle.outputFiles[0].text)
const dom = new JSDOM('', { url: 'https://absence.test' })
globalThis.window = dom.window
for (const key of ['document', 'CustomEvent', 'HTMLElement', 'Element', 'Node', 'HTMLSelectElement', 'HTMLInputElement']) globalThis[key] = window[key]
Object.defineProperty(window, 'indexedDB', { value: globalThis.indexedDB })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const require = createRequire(import.meta.url)
const rt = require(runtimePath)
const { createElement, act } = require('react')
const { createRoot } = require('react-dom/client')
const db = rt.maProfessorDb
const stamp = '2026-09-01T10:00:00.000Z'
const audit = { createdAt: stamp, updatedAt: stamp }
let general, acs
const stored = async () => Object.fromEntries(await Promise.all(db.tables.map(async table => [table.name, (await table.toArray()).sort((a, b) => String(a.id).localeCompare(String(b.id)))])))
const workspace = moduleId => rt.assessmentWorkspaceRepository.getWorkspace('year', { teachingAssignmentId: 'assignment', moduleId })
const scoreMap = (criteria, score) => Object.fromEntries(criteria.map(row => [row.id, String(score)]))
async function configure(profile, grades, assignmentId = 'assignment') {
  const { rows } = await rt.loadAbsenceGradeSettings('year')
  const selected = rows.filter(row => row.teachingAssignmentId === assignmentId && row.profile === profile)
  await rt.saveAbsenceGradeSettings('year', assignmentId, profile, selected.map((row, index) => ({ criterionId: row.criterion.id, grade: grades[index], expectedUpdatedAt: row.criterion.updatedAt })))
}
const studentRow = (snapshot, id) => snapshot.studentRows.find(row => row.student.id === id)

beforeEach(async () => {
  await db.delete(); await db.open(); window.localStorage.clear()
  await db.academicYears.add({ id: 'year', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-08-31', active: true, setupCompletedAt: stamp, ...audit })
  await db.groups.add({ id: 'group', academicYearId: 'year', name: '10.º D', educationType: 'professional', gradeLevel: '10', courseName: 'TAP', active: true, ...audit })
  await db.subjects.bulkAdd(['AE', 'AS'].map(id => ({ id, academicYearId: 'year', name: id, shortName: id, code: id, active: true, ...audit })))
  await db.teachingAssignments.bulkAdd([{ id: 'assignment', subjectId: 'AE' }, { id: 'other', subjectId: 'AS' }].map(row => ({ ...row, academicYearId: 'year', groupId: 'group', displayName: `${row.subjectId} · 10.º D`, active: true, ...audit })))
  await db.modules.bulkAdd(['old', 'current'].map((id, index) => ({ id, academicYearId: 'year', teachingAssignmentId: 'assignment', code: String(index + 1), name: `UFCD ${index + 1}`, plannedPeriods: 30, order: index + 1, plannedStartDate: null, plannedEndDate: null, active: true, ...audit })))
  await db.students.bulkAdd([{ id: 'normal', number: '1', usesAcs: false }, { id: 'adapted', number: '2', assessmentProfilesByAssignment: { assignment: 'acs' } }, { id: 'normal-peer', number: '3', usesAcs: false }, { id: 'acs-peer', number: '4', assessmentProfilesByAssignment: { assignment: 'acs' } }].map(row => ({ ...row, name: `Aluno fictício ${row.number}`, academicYearId: 'year', groupId: 'group', active: true, notes: '', ...audit })))
  general = (await rt.assessmentCriteriaBatchRepository.createSubjectSchemes({ academicYearId: 'year', teachingAssignmentIds: ['assignment'], name: 'Gerais', criteria: [{ name: 'Conhecimentos', weightPercent: 60 }, { name: 'Participação', weightPercent: 20 }, { name: 'Autonomia', weightPercent: 20 }] }))[0]
  acs = (await rt.assessmentCriteriaBatchRepository.createSubjectSchemes({ academicYearId: 'year', teachingAssignmentIds: ['assignment'], name: 'ACS', profile: 'acs', criteria: [{ name: 'Interação', weightPercent: 50 }, { name: 'Envolvimento', weightPercent: 30 }, { name: 'Autonomia ACS', weightPercent: 20 }] }))[0]
  await rt.assessmentCriteriaBatchRepository.createSubjectSchemes({ academicYearId: 'year', teachingAssignmentIds: ['other'], name: 'Outra disciplina', criteria: [{ name: 'Conhecimentos', weightPercent: 100 }] })
  for (const moduleId of ['old', 'current']) {
    for (const [index, absent] of [false, true].entries()) {
      const id = `${moduleId}-${index}`
      const lesson = { id, academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId, scheduleSlotId: null, origin: 'extra', status: 'taught', date: `2026-09-${moduleId === 'old' ? 10 + index : 20 + index}`, startTime: '09:00', endTime: '09:50', periodCount: 1, countTowardProgress: true, plannedActivity: 'Atividade preparada', summary: `Sumário ${id}`, summarySource: 'manual', planificationItemIds: [], giaeStatus: 'submitted', giaeSubmittedAt: stamp, notes: 'Nota privada', ...audit }
      await db.lessons.add(lesson)
      await rt.dailyCriteriaGridRepository.saveLessonGrid({ lesson, summary: lesson.summary, activity: 'Registo de teste', rows: [
        { studentId: 'normal', attendanceStatus: absent ? 'absent' : 'present', scores: absent ? {} : scoreMap(general.criteria, 16) },
        { studentId: 'adapted', attendanceStatus: absent ? 'absent' : 'present', scores: absent ? {} : scoreMap(acs.criteria, 18) },
        { studentId: 'normal-peer', attendanceStatus: 'present', scores: scoreMap(general.criteria, 16) },
        { studentId: 'acs-peer', attendanceStatus: 'present', scores: scoreMap(acs.criteria, 18) }
      ] })
      if (absent) await db.lessonAttendance.add({ id: `absence-${id}`, lessonId: id, studentId: 'normal', status: 'absent', code: 'F', note: 'Preservar falta', ...audit })
    }
  }
  await db.moduleFinalGrades.add({ id: 'manual-final', academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: 'old', studentId: 'normal', calculatedAverage: 16, suggestedGrade: 16, finalGrade: 18, selfAssessmentGrade: 15, note: 'Escolha manual', confirmedAt: stamp, ...audit })
})
after(async () => { db.close(); dom.window.close(); rmSync(output, { recursive: true, force: true }) })

test('disabled rules preserve the pre-feature emission fingerprint exactly', () => {
  const snapshot = { criteria: [{ id: 'criterion', weightPercent: 100 }], activities: [], studentRows: [] }
  assert.equal(rt.getUfcdEmissionFingerprint(snapshot), '7973a60b')
  assert.equal(rt.getUfcdEmissionFingerprint({ ...snapshot, criteria: [{ ...snapshot.criteria[0], absenceGrade: null }] }), '7973a60b')
  assert.notEqual(rt.getUfcdEmissionFingerprint({ ...snapshot, criteria: [{ ...snapshot.criteria[0], absenceGrade: 0 }] }), '7973a60b')
})

test('historic exempt results stay hidden from the daily input grid when no absence rule is enabled', async () => {
  const assessment = (await db.lessonAssessments.where('lessonId').equals('current-0').toArray()).find(row => row.criterionId === general.criteria[0].id)
  const result = (await db.assessmentResults.where('assessmentId').equals(assessment.id).toArray()).find(row => row.studentId === 'normal')
  await db.assessmentResults.update(result.id, { status: 'exempt', score: 4 })
  const grid = await rt.dailyCriteriaGridRepository.getLessonGrid('current-0')
  assert.equal(grid.scoresByStudentId.normal[general.criteria[0].id], undefined)
  assert.equal((await db.assessmentResults.get(result.id)).status, 'exempt')
})

test('legacy defaults do not activate absence grades; actual discipline criteria and profiles are reused', async () => {
  const config = await rt.loadAbsenceGradeSettings('year')
  assert.equal((await rt.maProfessorRepository.getSettings()).defaultAbsentAssessmentScore, 0)
  await rt.maProfessorRepository.updateSettings({ defaultAbsentAssessmentScore: 9 })
  assert.deepEqual(config.rows.filter(row => row.profile === 'general' && row.teachingAssignmentId === 'assignment').map(row => row.criterion.id), general.criteria.map(row => row.id))
  assert.deepEqual(config.rows.filter(row => row.profile === 'acs').map(row => row.criterion.id), acs.criteria.map(row => row.id))
  assert.ok(config.rows.every(row => row.criterion.absenceGrade == null))
  const normal = studentRow(await workspace('current'), 'normal')
  assert.equal(normal.gradeSummary.provisionalAverage, 16)
  assert.equal(normal.gradeSummary.suggestedGrade, null)
})

test('changing a criterion absence grade recalculates all existing UFCDs without rewriting evidence or manual finals', async () => {
  const before = await stored()
  await configure('general', [9, 8, 7])
  for (const id of ['old', 'current']) {
    const snapshot = await workspace(id)
    assert.equal(studentRow(snapshot, 'normal').gradeSummary.provisionalAverage, 12.2)
    assert.equal(studentRow(snapshot, 'normal').gradeSummary.suggestedGrade, 12)
    assert.equal(studentRow(snapshot, 'adapted').gradeSummary.provisionalAverage, 18)
    if (id === 'old') assert.equal(studentRow(snapshot, 'normal').gradeSummary.confirmedFinalGrade, 18)
  }
  const after = await stored()
  assert.deepEqual({ ...after, assessmentCriteria: before.assessmentCriteria }, before)
  await configure('general', [7, 7, 7])
  assert.equal(studentRow(await workspace('current'), 'normal').gradeSummary.provisionalAverage, 11.5)
  assert.deepEqual(await db.assessmentResults.toArray(), before.assessmentResults)
  db.close(); await db.open()
  assert.equal(studentRow(await workspace('old'), 'normal').gradeSummary.provisionalAverage, 11.5)
})

test('ACS values, genuine zero, disabling, daily cells and emission fingerprints follow the selected profile', async () => {
  const initial = await workspace('current')
  await configure('general', [0, 0, 0])
  await configure('acs', [4, 6, 8])
  const updated = await workspace('current')
  assert.equal(studentRow(updated, 'normal').gradeSummary.provisionalAverage, 8)
  assert.equal(studentRow(updated, 'adapted').gradeSummary.provisionalAverage, 11.7)
  assert.notEqual(rt.getUfcdEmissionFingerprint(updated), rt.getUfcdEmissionFingerprint(initial))
  const grid = await rt.dailyCriteriaGridRepository.getLessonGrid('current-1')
  assert.deepEqual(Object.values(grid.scoresByStudentId.normal), [0, 0, 0])
  assert.deepEqual(Object.values(grid.scoresByStudentId.adapted), [4, 6, 8])
  await configure('general', [null, null, null])
  const disabled = await workspace('current')
  assert.equal(studentRow(disabled, 'normal').gradeSummary.provisionalAverage, 16)
  assert.equal(studentRow(disabled, 'normal').gradeSummary.suggestedGrade, null)
  assert.equal(studentRow(disabled, 'adapted').gradeSummary.provisionalAverage, 11.7)
})

test('invalid, cross-profile and stale saves roll back every field; ordinary criteria edits preserve the setting', async () => {
  const before = await stored()
  const entries = general.criteria.map((criterion, i) => ({ criterionId: criterion.id, grade: i ? 99 : 9, expectedUpdatedAt: criterion.updatedAt }))
  await assert.rejects(rt.saveAbsenceGradeSettings('year', 'assignment', 'general', entries))
  await assert.rejects(rt.saveAbsenceGradeSettings('year', 'assignment', 'acs', [{ ...entries[0], grade: 9 }]))
  await assert.rejects(rt.saveAbsenceGradeSettings('year', 'assignment', 'general', [{ ...entries[0], grade: 9, expectedUpdatedAt: 'stale' }]))
  assert.deepEqual(await stored(), before)
  await configure('general', [9, 8, 7])
  await rt.assessmentCriteriaManagementRepository.updateSubjectSchemes({ academicYearId: 'year', subjectId: 'AE', referenceSchemeId: general.scheme.id, name: 'Critérios revistos', criteria: general.criteria.map(row => ({ id: row.id, name: row.name, description: row.description, weightPercent: row.weightPercent })) })
  assert.deepEqual((await db.assessmentCriteria.where('schemeId').equals(general.scheme.id).sortBy('order')).map(row => row.absenceGrade), [9, 8, 7])
})

test('local backup roundtrip preserves optional absence rules; old backups default off and invalid scores are rejected', async () => {
  await configure('general', [9, null, 0])
  const backup = await rt.createMAProfessorBackup()
  const before = await stored()
  await rt.restoreMAProfessorBackup(JSON.parse(JSON.stringify(backup)))
  assert.deepEqual(await stored(), before)
  const invalid = structuredClone(backup)
  invalid.data.assessmentCriteria[0].absenceGrade = 21
  assert.equal(rt.validateMAProfessorBackup(invalid).valid, false)
  const legacy = structuredClone(backup)
  for (const row of legacy.data.assessmentCriteria) delete row.absenceGrade
  await rt.restoreMAProfessorBackup(legacy)
  assert.ok((await rt.loadAbsenceGradeSettings('year')).rows.every(row => row.criterion.absenceGrade == null))
})

test('settings are collapsed by default and show the same configured names, weights and independent ACS fields', async () => {
  const host = document.createElement('div'); document.body.append(host)
  const view = createRoot(host)
  let updates = 0
  try {
    await act(async () => { view.render(createElement(rt.AbsenceGradeSettingsPanel, { academicYearId: 'year', onDataChanged: () => { updates++ } })); await new Promise(resolve => setTimeout(resolve, 30)) })
    for (let i = 0; i < 30 && host.querySelectorAll('input').length !== 3; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    assert.equal(host.querySelector('details').open, false)
    assert.equal(host.querySelectorAll('input').length, 3)
    assert.ok(host.textContent.includes('Conhecimentos · 60%'))
    assert.ok([...host.querySelectorAll('input')].every(input => input.value === '' && input.placeholder === 'Não contar na média'))
    host.querySelector('details').open = true
    async function enterAndSave(grades) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        ;[...host.querySelectorAll('input')].forEach((input, index) => { setter.call(input, String(grades[index])); input.dispatchEvent(new window.Event('input', { bubbles: true })) })
      })
      assert.equal(host.querySelector('button[type=submit]').disabled, false)
      await act(async () => { host.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })) })
      for (let i = 0; i < 50 && !host.textContent.includes('recalculadas automaticamente'); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
      assert.ok(host.textContent.includes('recalculadas automaticamente'), host.textContent)
    }
    await enterAndSave([9, 8, 7])
    assert.equal(studentRow(await workspace('current'), 'normal').gradeSummary.provisionalAverage, 12.2)
    await act(async () => { const select = host.querySelector('select[aria-label="Perfil para notas de falta"]'); select.value = 'acs'; select.dispatchEvent(new window.Event('change', { bubbles: true })) })
    assert.ok(host.textContent.includes('Interação · 50%'))
    assert.ok(!host.textContent.includes('Conhecimentos · 60%'))
    assert.ok([...host.querySelectorAll('input')].every(input => input.value === ''))
    await enterAndSave([4, 6, 8])
    assert.equal(studentRow(await workspace('current'), 'adapted').gradeSummary.provisionalAverage, 11.7)
    assert.equal(updates, 2)
  } finally { await act(async () => view.unmount()); host.remove() }
})
