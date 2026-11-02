import assert from 'node:assert/strict'
import test, { after, beforeEach } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import * as XLSX from 'xlsx'
import 'fake-indexeddb/auto'

const root = resolve(new URL('../..', import.meta.url).pathname)
mkdirSync(join(root, 'node_modules/.cache'), { recursive: true })
const output = mkdtempSync(join(root, 'node_modules/.cache/giae-csv-'))
const runtimePath = join(output, 'runtime.cjs')
const base = './src/components/ma-professor/'
const bundle = await build({ stdin: { contents: `
export { maProfessorDb } from '${base}db';
export { maProfessorRepository } from '${base}repository';
export { groupsWorkspaceRepository } from '${base}groups/groupsWorkspaceRepository';
export { default as GroupsWorkspaceView } from '${base}groups/GroupsWorkspaceView';
export { assessmentWorkspaceRepository } from '${base}assessments/assessmentWorkspaceRepository';
export { buildGIAEGradeCsvExport } from '${base}assessments/giaeGradeCsvModel';
export { default as GIAEGradeCsvExport } from '${base}assessments/GIAEGradeCsvExport';
export { buildUfcdCfpModel } from '${base}assessments/ufcdCfpModel';
export { createMAProfessorBackup, restoreMAProfessorBackup, validateMAProfessorBackup } from '${base}settings/backupRepository';
`, resolveDir: root }, bundle: true, jsx: 'automatic', write: false, platform: 'node', format: 'cjs', packages: 'external' })
writeFileSync(runtimePath, bundle.outputFiles[0].text)
const dom = new JSDOM('', { url: 'https://giae.test' })
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
const workspace = () => rt.assessmentWorkspaceRepository.getWorkspace('year', { teachingAssignmentId: 'assignment', moduleId: 'unit' })
const canonical = value => JSON.parse(JSON.stringify(value))
const stored = async () => canonical(Object.fromEntries(await Promise.all(db.tables.map(async table => [table.name, (await table.toArray()).sort((a, b) => String(a.id).localeCompare(String(b.id)))]))))

beforeEach(async () => {
  await db.delete(); await db.open(); window.localStorage.clear()
  await db.academicYears.add({ id: 'year', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-08-31', active: true, setupCompletedAt: stamp, ...audit })
  await db.groups.add({ id: 'group', academicYearId: 'year', name: '10.º D', educationType: 'professional', gradeLevel: '10', courseName: 'TAP', active: true, ...audit })
  await db.subjects.add({ id: 'subject', academicYearId: 'year', name: 'Animação Sociocultural', shortName: 'AS', code: 'AS', active: true, ...audit })
  await db.teachingAssignments.add({ id: 'assignment', academicYearId: 'year', groupId: 'group', subjectId: 'subject', displayName: 'AS · 10.º D', active: true, ...audit })
  await db.modules.add({ id: 'unit', academicYearId: 'year', teachingAssignmentId: 'assignment', code: '10385', name: 'UFCD de teste', plannedPeriods: 30, order: 1, plannedStartDate: null, plannedEndDate: null, active: true, ...audit })
  await db.students.bulkAdd([{ id: 'student-1', number: '1', name: 'Aluno fictício A', notes: 'Nota privada' }, { id: 'student-2', number: '2', name: 'Aluno fictício B', notes: '' }].map(row => ({ ...row, academicYearId: 'year', groupId: 'group', active: true, ...audit })))
  await db.moduleFinalGrades.add({ id: 'grade', academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: 'unit', studentId: 'student-1', calculatedAverage: 12.4, suggestedGrade: 12, finalGrade: 18, selfAssessmentGrade: 15, note: 'Observação privada', confirmedAt: stamp, ...audit })
})
after(async () => { db.close(); dom.window.close(); rmSync(output, { recursive: true, force: true }) })

test('adding, editing, clearing and reimporting a process number preserves other student data and final grades', async () => {
  const before = await stored()
  await rt.groupsWorkspaceRepository.updateStudent('student-1', { processNumber: ' 0012345 ' })
  const updated = await db.students.get('student-1')
  assert.equal(updated.processNumber, '0012345')
  assert.deepEqual(canonical({ ...updated, processNumber: undefined, updatedAt: before.students[0].updatedAt }), before.students[0])
  const afterSave = await stored()
  assert.deepEqual({ ...afterSave, students: before.students }, before)
  db.close(); await db.open()
  assert.equal((await db.students.get('student-1')).processNumber, '0012345')
  await rt.groupsWorkspaceRepository.updateStudent('student-1', { notes: 'Revisão da observação' })
  assert.equal((await db.students.get('student-1')).processNumber, '0012345')
  await rt.maProfessorRepository.saveStudentsForGroup('year', 'group', [{ number: '1', name: updated.name }])
  assert.equal((await db.students.get('student-1')).processNumber, '0012345')
  await rt.maProfessorRepository.saveStudentsForGroup('year', 'group', [{ number: '1', name: updated.name, processNumber: '0098765' }, { number: '3', name: 'Aluno fictício C', processNumber: '0003333' }])
  assert.equal((await db.students.get('student-1')).processNumber, '0098765')
  assert.equal((await db.students.toArray()).find(student => student.number === '3').processNumber, '0003333')
  await rt.groupsWorkspaceRepository.updateStudent('student-1', { processNumber: '' })
  assert.equal((await db.students.get('student-1')).processNumber, '')
  assert.deepEqual(await db.moduleFinalGrades.toArray(), before.moduleFinalGrades)
})

test('CSV uses the saved final grade, preserves leading zeros and has exactly the four GIAE columns', async () => {
  await rt.groupsWorkspaceRepository.updateStudent('student-1', { processNumber: '0012345' })
  const before = await stored()
  const snapshot = await workspace()
  const result = rt.buildGIAEGradeCsvExport(snapshot)
  assert.equal(result.csv, 'N_PROCESSO,AVALIACAO,ALINEA,SINTESE\r\n0012345,18,,""\r\n')
  const parsed = XLSX.utils.sheet_to_json(XLSX.read(result.csv, { type: 'string', raw: true }).Sheets.Sheet1, { header: 1, defval: '', blankrows: false })
  assert.deepEqual(parsed, [['N_PROCESSO', 'AVALIACAO', 'ALINEA', 'SINTESE'], ['0012345', '18', '', '']])
  assert.match(result.fileName, /Notas-GIAE-10.º-D-AS-10385\.csv$/)
  assert.ok(!result.csv.includes('privada'))
  assert.deepEqual(await stored(), before)
  assert.equal(rt.buildUfcdCfpModel(snapshot).rows[0].processNumber, '0012345')
  assert.equal(result.omittedRows[0].studentId, 'student-2')
})

test('missing or invalid identifiers, duplicate processes, unsaved suggestions and pending recovery are listed without exporting wrong grades', async () => {
  let snapshot = await workspace()
  assert.equal(rt.buildGIAEGradeCsvExport(snapshot).rows.length, 0)
  assert.match(rt.buildGIAEGradeCsvExport(snapshot).omittedRows[0].reason, /Sem n.º de processo/)
  snapshot.studentRows[0].student.processNumber = '=1+1'
  assert.match(rt.buildGIAEGradeCsvExport(snapshot).omittedRows[0].reason, /apenas algarismos/)
  snapshot.studentRows[0].student.processNumber = '0012345'
  snapshot.studentRows[1].student.processNumber = '12345'
  assert.match(rt.buildGIAEGradeCsvExport(snapshot).omittedRows[0].reason, /repetido/)
  snapshot.studentRows[1].student.processNumber = '54321'
  snapshot.studentRows[0].recoveryPending = true
  assert.match(rt.buildGIAEGradeCsvExport(snapshot).omittedRows[0].reason, /recuperação/)
  delete snapshot.studentRows[0].recoveryPending
  snapshot.studentRows[1].gradeSummary.suggestedGrade = 20
  assert.equal(rt.buildGIAEGradeCsvExport(snapshot).rows.length, 1)
  snapshot.studentRows[0].gradeSummary.confirmedFinalGrade = 0
  assert.match(rt.buildGIAEGradeCsvExport(snapshot).csv, /0012345,0,,""/)
  snapshot.studentRows[0].gradeSummary.confirmedFinalGrade = 18.5
  assert.equal(rt.buildGIAEGradeCsvExport(snapshot).rows.length, 0)
  assert.throws(() => rt.buildGIAEGradeCsvExport({ ...snapshot, selectedModule: null }), /Selecione/)
})

test('new process numbers survive local backup/restore; old copies without the optional field still restore', async () => {
  await rt.groupsWorkspaceRepository.updateStudent('student-1', { processNumber: '0012345' })
  const backup = await rt.createMAProfessorBackup()
  const before = await stored()
  await rt.restoreMAProfessorBackup(JSON.parse(JSON.stringify(backup)))
  db.close(); await db.open()
  assert.deepEqual(await stored(), before)
  const legacy = structuredClone(backup)
  for (const student of legacy.data.students) delete student.processNumber
  assert.equal(rt.validateMAProfessorBackup(legacy).valid, true)
  await rt.restoreMAProfessorBackup(legacy)
  db.close(); await db.open()
  assert.equal((await db.students.get('student-1')).processNumber, undefined)
  assert.equal(rt.buildGIAEGradeCsvExport(await workspace()).rows.length, 0)
  assert.equal(rt.buildUfcdCfpModel(await workspace()).rows[0].processNumber, '')
})

test('the student editor exposes an optional text field and saves the process number without changing the class number', async () => {
  const host = document.createElement('div'); document.body.append(host)
  const view = createRoot(host)
  let saved, savePromise
  try {
    const snapshot = await rt.groupsWorkspaceRepository.getWorkspace('year', { groupId: 'group' })
    await act(async () => view.render(createElement(rt.GroupsWorkspaceView, {
      snapshot, onFiltersChange() {}, onCreateGroup() {}, onUpdateGroup() {}, onSaveStudents() {},
      onUpdateStudent: (id, changes) => { saved = { id, changes }; savePromise = rt.groupsWorkspaceRepository.updateStudent(id, changes); return savePromise },
      onDeleteStudent() {}, onSetStudentActive() {}
    })))
    const article = [...host.querySelectorAll('article')].find(element => element.textContent.includes('Aluno fictício A'))
    const edit = [...article.querySelectorAll('button')].find(button => button.textContent.trim() === 'Editar')
    await act(async () => edit.click())
    const label = [...host.querySelectorAll('label')].find(element => element.textContent.includes('N.º de processo'))
    const field = label.querySelector('input')
    assert.equal(field.type, 'text'); assert.equal(field.inputMode, 'numeric'); assert.equal(field.required, false)
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(field, '0012345')
      field.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
    const save = [...article.querySelectorAll('button')].find(button => button.textContent.trim() === 'Guardar')
    assert.equal(save.disabled, false)
    await act(async () => save.click())
    for (let i = 0; i < 30 && !saved; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    await act(async () => { await savePromise })
    assert.equal(saved.id, 'student-1'); assert.equal(saved.changes.processNumber, '0012345'); assert.equal(saved.changes.number, '1')
    assert.equal((await db.students.get('student-1')).processNumber, '0012345')
  } finally { await act(async () => view.unmount()); host.remove() }
})

test('export preview discloses omissions and saved values before downloading the actual CSV without writing records', async t => {
  await rt.groupsWorkspaceRepository.updateStudent('student-1', { processNumber: '0012345' })
  const host = document.createElement('div'); document.body.append(host)
  const view = createRoot(host)
  let blob, filename
  const before = await stored()
  t.mock.method(URL, 'createObjectURL', value => { blob = value; return 'blob:test' })
  t.mock.method(URL, 'revokeObjectURL', () => {})
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', function () { filename = this.download })
  try {
    await act(async () => view.render(createElement(rt.GIAEGradeCsvExport, { snapshot: await workspace(), disabled: false, hasUnsavedChanges: true })))
    assert.match(host.textContent, /classificações finais já guardadas/)
    assert.match(host.textContent, /Aluno fictício B: Sem classificação final guardada/)
    assert.match(host.querySelector('tbody').textContent, /0012345/)
    assert.equal(host.querySelector('button').disabled, false)
    await act(async () => host.querySelector('button').click())
    assert.equal(blob.type, 'text/csv;charset=utf-8')
    assert.equal(await blob.text(), 'N_PROCESSO,AVALIACAO,ALINEA,SINTESE\r\n0012345,18,,""\r\n')
    assert.match(filename, /10385\.csv$/)
    assert.deepEqual(await stored(), before)
    await act(async () => view.render(createElement(rt.GIAEGradeCsvExport, { snapshot: await workspace(), disabled: true, hasUnsavedChanges: false })))
    assert.equal(host.querySelector('button').disabled, true)
  } finally { await act(async () => view.unmount()); host.remove() }
})
