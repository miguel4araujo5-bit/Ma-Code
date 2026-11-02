import assert from 'node:assert/strict'
import test, { after, beforeEach } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { strFromU8, unzipSync } from 'fflate'
import 'fake-indexeddb/auto'

const root = resolve(new URL('../..', import.meta.url).pathname)
mkdirSync(join(root, 'node_modules/.cache'), { recursive: true })
const output = mkdtempSync(join(root, 'node_modules/.cache/sao-bento-rounding-'))
const runtimePath = join(output, 'runtime.cjs')
const base = './src/components/ma-professor/'
const bundle = await build({ stdin: { contents: `
export { maProfessorDb } from '${base}db';
export { assessmentWorkspaceRepository } from '${base}assessments/assessmentWorkspaceRepository';
export { buildGIAEGradeCsvExport } from '${base}assessments/giaeGradeCsvModel';
export { buildUfcdCfpModel } from '${base}assessments/ufcdCfpModel';
export { exportUfcdFinalGradeExcel } from '${base}assessments/ufcdFinalGradeExcelExport';
export { loadFinalGradeRounding, saveFinalGradeRounding } from '${base}settings/absenceGradeSettingsRepository';
export { AbsenceGradeSettingsPanel } from '${base}settings/AbsenceGradeSettingsPanel';
export { createMAProfessorBackup, restoreMAProfessorBackup, validateMAProfessorBackup } from '${base}settings/backupRepository';
export { encryptMAProfessorBackupV3Data, decryptMAProfessorBackupV3Data } from '${base}sync/cloudBackupV3Crypto';
`, resolveDir: root }, bundle: true, jsx: 'automatic', write: false, platform: 'node', format: 'cjs', packages: 'external' })
writeFileSync(runtimePath, bundle.outputFiles[0].text)
const dom = new JSDOM('', { url: 'https://rounding.test' })
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
const stored = async () => Object.fromEntries(await Promise.all(db.tables.map(async table => [table.name, (await table.toArray()).sort((a, b) => String(a.id).localeCompare(String(b.id)))])))
const setScore = score => db.assessmentResults.toCollection().modify({ score })

beforeEach(async () => {
  await db.delete(); await db.open(); window.localStorage.clear()
  await db.teacherProfiles.put({ id: 'local-profile', displayName: 'Professor de teste', schoolName: 'Agrupamento de Escolas de S. Bento, Vizela', ...audit })
  await db.academicYears.add({ id: 'year', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-08-31', active: true, setupCompletedAt: stamp, ...audit })
  await db.groups.add({ id: 'group', academicYearId: 'year', name: '10.º D', educationType: 'professional', gradeLevel: '10', courseName: 'TAP', active: true, ...audit })
  await db.subjects.add({ id: 'subject', academicYearId: 'year', name: 'Animação Sociocultural', shortName: 'AS', code: 'AS', active: true, ...audit })
  await db.teachingAssignments.add({ id: 'assignment', academicYearId: 'year', groupId: 'group', subjectId: 'subject', displayName: 'AS · 10.º D', active: true, ...audit })
  await db.modules.add({ id: 'unit', academicYearId: 'year', teachingAssignmentId: 'assignment', code: '10385', name: 'UFCD de teste', plannedPeriods: 1, order: 1, plannedStartDate: null, plannedEndDate: null, active: true, ...audit })
  await db.lessons.add({ id: 'lesson', academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: 'unit', scheduleSlotId: null, origin: 'extra', status: 'taught', date: '2026-09-15', startTime: '09:00', endTime: '09:50', periodCount: 1, countTowardProgress: true, plannedActivity: '', summary: 'Aula de teste', summarySource: 'manual', planificationItemIds: [], giaeStatus: 'submitted', giaeSubmittedAt: stamp, notes: '', ...audit })
  for (const profile of ['general', 'acs']) {
    await db.assessmentSchemes.add({ id: `scheme-${profile}`, academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: null, scope: 'subject', name: profile, profile, active: true, ...audit })
    await db.assessmentCriteria.add({ id: profile, schemeId: `scheme-${profile}`, name: profile, description: '', weightPercent: 100, order: 1, active: true, ...audit })
    await db.students.add({ id: profile, academicYearId: 'year', groupId: 'group', number: profile === 'general' ? '1' : '2', processNumber: profile === 'general' ? '000123' : '000456', name: `Aluno fictício ${profile}`, active: true, notes: '', usesAcs: profile === 'acs', ...audit })
    await db.lessonAssessments.add({ id: `assessment-${profile}`, academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: 'unit', lessonId: 'lesson', criterionId: profile, title: 'Avaliação de teste', description: '', activityType: 'other', absentScore: 0, exemptScore: 10, date: '2026-09-15', ...audit })
    await db.assessmentResults.add({ id: profile, assessmentId: `assessment-${profile}`, studentId: profile, status: 'evaluated', score: 9.1, note: '', ...audit })
  }
})
after(async () => { db.close(); dom.window.close(); rmSync(output, { recursive: true, force: true }) })

test('São Bento professional suggestions round every decimal upward for general and ACS, preserving averages and data', async () => {
  for (const [score, expected] of [[0, 0], [0.01, 1], [0.1, 1], [1.1, 2], [1.9, 2], [9, 9], [9.1, 10], [14.5, 15], [16.1, 17], [17.5, 18], [19.1, 20], [20, 20]]) {
    await setScore(score)
    const before = await stored()
    const snapshot = await workspace()
    for (const row of snapshot.studentRows) {
      assert.equal(row.gradeSummary.provisionalAverage, score)
      assert.equal(row.gradeSummary.suggestedGrade, expected, `${row.assessmentProfile}: ${score}`)
      assert.equal(row.gradeSummary.confirmedFinalGrade, null)
    }
    assert.deepEqual(await stored(), before)
  }
})

test('other schools, empty or missing profiles retain ordinary rounding', async () => {
  for (const schoolName of ['Outra escola', '', 'Escola de São Bento, Porto']) {
    await db.teacherProfiles.update('local-profile', { schoolName })
    for (const [score, expected] of [[0.1, 0], [1.1, 1], [1.9, 2], [9.1, 9], [14.5, 15]]) {
      await setScore(score)
      for (const row of (await workspace()).studentRows) assert.equal(row.gradeSummary.suggestedGrade, expected)
    }
  }
  await db.teacherProfiles.delete('local-profile')
  await setScore(9.1)
  assert.equal((await workspace()).studentRows[0].gradeSummary.suggestedGrade, 9)
})

test('São Bento regular education retains ordinary rounding; legacy professional groups use the school rule', async () => {
  await db.groups.update('group', { educationType: 'regular' })
  assert.equal((await workspace()).studentRows[0].gradeSummary.suggestedGrade, 9)
  await db.groups.update('group', { educationType: undefined })
  assert.equal((await workspace()).studentRows[0].gradeSummary.suggestedGrade, 10)
  await db.teacherProfiles.update('local-profile', { schoolName: 'Agrupamento de Escolas de São Bento' })
  assert.equal((await workspace()).studentRows[0].gradeSummary.suggestedGrade, 10)
})

test('incomplete or empty assessments keep the existing absence of a final suggestion', async () => {
  await db.assessmentResults.update('general', { status: 'absent', score: null })
  let row = (await workspace()).studentRows.find(row => row.student.id === 'general')
  assert.equal(row.gradeSummary.suggestedGrade, null)
  await db.assessmentResults.clear()
  row = (await workspace()).studentRows[0]
  assert.equal(row.gradeSummary.provisionalAverage, null)
  assert.equal(row.gradeSummary.suggestedGrade, null)
})

test('the explicit setting overrides the school default, persists after reopening and never changes regular education', async () => {
  await saveAndCheck('nearest', 9)
  await saveAndCheck('up', 10)
  await db.teacherProfiles.update('local-profile', { schoolName: 'Outra escola' })
  assert.equal((await workspace()).studentRows[0].gradeSummary.suggestedGrade, 10)
  await db.groups.update('group', { educationType: 'regular' })
  assert.equal((await workspace()).studentRows[0].gradeSummary.suggestedGrade, 9)
  const before = await stored()
  for (const invalid of ['unknown', null, 1]) await assert.rejects(rt.saveFinalGradeRounding(invalid), /arredondamento/)
  assert.deepEqual(await stored(), before)

  async function saveAndCheck(rounding, expected) {
    await rt.saveFinalGradeRounding(rounding)
    db.close(); await db.open()
    assert.equal(await rt.loadFinalGradeRounding(), rounding)
    for (const row of (await workspace()).studentRows) assert.equal(row.gradeSummary.suggestedGrade, expected)
  }
})

test('the same collapsed rules panel edits and saves rounding through real controls', async () => {
  const host = document.createElement('div'); document.body.append(host)
  const view = createRoot(host)
  let updates = 0
  try {
    await act(async () => {
      view.render(createElement(rt.AbsenceGradeSettingsPanel, { academicYearId: 'year', onDataChanged: () => { updates++ } }))
      await new Promise(resolve => setTimeout(resolve, 30))
    })
    const select = host.querySelector('select[aria-label="Arredondamento da nota final"]')
    for (let i = 0; i < 50 && select.disabled; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    assert.equal(host.querySelector('details').open, false)
    assert.match(host.querySelector('summary').textContent, /notas de falta e arredondamento/)
    assert.equal(select.value, 'up')
    const button = [...host.querySelectorAll('button')].find(button => button.textContent === 'Guardar arredondamento')
    assert.equal(button.disabled, true)
    await act(async () => {
      select.value = 'nearest'; select.dispatchEvent(new window.Event('change', { bubbles: true }))
    })
    assert.equal(button.disabled, false)
    await act(async () => { button.click() })
    for (let i = 0; i < 50 && updates === 0; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    assert.equal(updates, 1)
    assert.equal(button.disabled, true)
    assert.equal(await rt.loadFinalGradeRounding(), 'nearest')
    assert.equal((await workspace()).studentRows[0].gradeSummary.suggestedGrade, 9)
  } finally { await act(async () => view.unmount()); host.remove() }
})

test('V3 encryption and restore preserve the setting; older backups without it retain the school defaults', async () => {
  await rt.saveFinalGradeRounding('nearest')
  const backup = await rt.createMAProfessorBackup()
  const validation = rt.validateMAProfessorBackup(backup)
  assert.equal(validation.valid, true, JSON.stringify(validation))
  const before = await stored()
  const masterKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const encrypted = await rt.encryptMAProfessorBackupV3Data(masterKey, new TextEncoder().encode(JSON.stringify(backup)), 'database-v1')
  const decrypted = await rt.decryptMAProfessorBackupV3Data(masterKey, encrypted, 'database-v1')
  await rt.restoreMAProfessorBackup(JSON.parse(new TextDecoder().decode(decrypted)))
  db.close(); await db.open()
  assert.deepEqual(await stored(), before)
  assert.equal(await rt.loadFinalGradeRounding(), 'nearest')
  const invalid = structuredClone(backup)
  invalid.data.settings[0].professionalFinalGradeRounding = 'unknown'
  assert.equal(rt.validateMAProfessorBackup(invalid).valid, false)
  const legacy = structuredClone(backup)
  for (const settings of legacy.data.settings) delete settings.professionalFinalGradeRounding
  assert.equal(rt.validateMAProfessorBackup(legacy).valid, true)
  await rt.restoreMAProfessorBackup(legacy)
  db.close(); await db.open()
  assert.equal(await rt.loadFinalGradeRounding(), 'up')
  assert.equal((await workspace()).studentRows[0].gradeSummary.suggestedGrade, 10)
  assert.deepEqual(await db.assessmentResults.toArray(), before.assessmentResults)
})

test('confirmed grades stay intact until explicitly saved; corrected suggestions persist and feed CFP and GIAE', async () => {
  await db.moduleFinalGrades.add({ id: 'old-grade', academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: 'unit', studentId: 'general', calculatedAverage: 9.1, suggestedGrade: 9, finalGrade: 9, selfAssessmentGrade: 12, usesAcs: false, note: 'Decisão do professor', confirmedAt: stamp, ...audit })
  const before = await stored()
  let snapshot = await workspace()
  let row = snapshot.studentRows.find(row => row.student.id === 'general')
  assert.equal(row.gradeSummary.suggestedGrade, 10)
  assert.equal(row.gradeSummary.confirmedFinalGrade, 9)
  assert.deepEqual(await stored(), before)
  await rt.assessmentWorkspaceRepository.saveModuleFinalGrade({ moduleId: 'unit', studentId: 'general', finalGrade: row.gradeSummary.suggestedGrade })
  db.close(); await db.open()
  snapshot = await workspace()
  row = snapshot.studentRows.find(row => row.student.id === 'general')
  assert.equal(row.finalGradeRecord.finalGrade, 10)
  assert.equal(row.finalGradeRecord.suggestedGrade, 10)
  assert.equal(row.finalGradeRecord.calculatedAverage, 9.1)
  assert.equal(row.finalGradeRecord.selfAssessmentGrade, 12)
  assert.equal(row.finalGradeRecord.note, 'Decisão do professor')
  assert.equal(rt.buildUfcdCfpModel(snapshot).rows[0].finalGrade, 10)
  assert.match(rt.buildGIAEGradeCsvExport(snapshot).csv, /000123,10,,""/)
})

test('the actual Excel download contains the corrected confirmed grade and the unchanged decimal average', async () => {
  const snapshot = await workspace()
  await rt.assessmentWorkspaceRepository.saveModuleFinalGrade({ moduleId: 'unit', studentId: 'general', finalGrade: snapshot.studentRows[0].gradeSummary.suggestedGrade })
  const template = readFileSync(join(root, 'public/ma-professor/templates/Grelha_Avaliacao_UFCD_UC_Modelo.xlsm'))
  const oldFetch = globalThis.fetch
  const oldCreate = URL.createObjectURL
  const oldRevoke = URL.revokeObjectURL
  const oldClick = window.HTMLAnchorElement.prototype.click
  let downloaded
  globalThis.fetch = async url => {
    assert.equal(url, '/ma-professor/templates/Grelha_Avaliacao_UFCD_UC_Modelo.xlsm')
    return { ok: true, arrayBuffer: async () => Uint8Array.from(template).buffer }
  }
  URL.createObjectURL = blob => { downloaded = blob; return 'blob:test-download' }
  URL.revokeObjectURL = () => {}
  window.HTMLAnchorElement.prototype.click = () => {}
  try {
    await rt.exportUfcdFinalGradeExcel(await workspace())
    const files = unzipSync(new Uint8Array(await downloaded.arrayBuffer()))
    const xml = new window.DOMParser().parseFromString(strFromU8(files['xl/worksheets/sheet14.xml']), 'application/xml')
    assert.equal(xml.querySelector('c[r="AA12"] v').textContent, '9.1')
    assert.equal(xml.querySelector('c[r="BW12"] v').textContent, '10')
    assert.match(xml.querySelector('c[r="BW13"] f').textContent, /ROUNDUP\(AA13,0\)/)
    assert.deepEqual(files['xl/vbaProject.bin'], unzipSync(new Uint8Array(template))['xl/vbaProject.bin'])
    await rt.saveFinalGradeRounding('nearest')
    await rt.exportUfcdFinalGradeExcel(await workspace())
    const nearestFiles = unzipSync(new Uint8Array(await downloaded.arrayBuffer()))
    const nearestXml = new window.DOMParser().parseFromString(strFromU8(nearestFiles['xl/worksheets/sheet14.xml']), 'application/xml')
    assert.equal(nearestXml.querySelector('c[r="BW12"] v').textContent, '10')
    assert.match(nearestXml.querySelector('c[r="BW13"] f').textContent, /ROUND\(AA13,0\)/)
  } finally {
    globalThis.fetch = oldFetch; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke
    window.HTMLAnchorElement.prototype.click = oldClick
  }
})
