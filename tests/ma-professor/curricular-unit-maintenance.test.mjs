import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'

const root = resolve(new URL('../..', import.meta.url).pathname)
const cache = join(root, 'node_modules/.cache')
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(join(cache, 'curricular-maintenance-'))
const runtimePath = join(output, 'runtime.cjs')
const base = './src/components/ma-professor/'
const bundle = await build({
  stdin: { contents: `
    export { maProfessorDb } from '${base}db';
    export { maProfessorRepository } from '${base}repository';
    export { planificationWorkspaceRepository } from '${base}planifications/planificationWorkspaceRepository';
    export { lessonRepository } from '${base}lessons/lessonRepository';
    export { readModuleImportState, commitModulePlanificationImport } from '${base}setup/modulePlanificationImportRepository';
    export { createMAProfessorBackup, validateMAProfessorBackup, restoreMAProfessorBackup } from '${base}settings/backupRepository';
    export { default as ModuleUnitActions } from '${base}setup/ModuleUnitActions';
  `, resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic'
})
writeFileSync(runtimePath, bundle.outputFiles[0].text)
const dom = new JSDOM('', { url: 'https://example.test' })
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'HTMLSelectElement', 'Node', 'CustomEvent']) globalThis[key] = key === 'window' ? dom.window : dom.window[key]
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
Object.defineProperty(window, 'indexedDB', { value: globalThis.indexedDB })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const runtime = createRequire(import.meta.url)(runtimePath)
const { maProfessorDb: db, maProfessorRepository: repository, planificationWorkspaceRepository: planning, lessonRepository: lessons } = runtime
after(async () => { await db.delete(); dom.window.close(); rmSync(output, { recursive: true, force: true }) })

const timestamp = '2026-09-01T09:00:00.000Z'
const audit = { createdAt: timestamp, updatedAt: timestamp }
const module = { id: 'unit', academicYearId: 'year', teachingAssignmentId: 'assignment', code: '0349', name: 'Unidade original', plannedPeriods: 30, order: 1, plannedStartDate: null, plannedEndDate: null, active: true, ...audit }
const lesson = { id: 'lesson', academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: 'unit', scheduleSlotId: 'slot', origin: 'scheduled', status: 'planned', date: '2026-09-14', startTime: '09:00', endTime: '09:50', periodCount: 1, countTowardProgress: true, plannedActivity: '', summary: '', summarySource: 'manual', planificationItemIds: [], giaeStatus: 'pending', giaeSubmittedAt: null, notes: '', ...audit }
const plan = { id: 'plan', academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: 'unit', title: 'Planificação original', description: '', active: true, ...audit }
const item = { id: 'item', planificationId: 'plan', order: 1, content: 'Conteúdo original', objectives: '', activity: '', suggestedSummary: '', status: 'planned', usedLessonId: null, usedAt: null, ...audit }
const importedDocument = { name: 'nova.docx', sha256: 'a'.repeat(64), periodMinutes: 50, sections: [{ code: '0349', name: 'Unidade original', contentsText: 'Conteúdo novo', objectivesText: 'Objetivo novo', methodologyText: '', resourcesText: '', evaluationText: '', periodLabel: '', sourcePages: [1] }] }

async function seed() {
  await db.delete(); await db.open()
  await db.academicYears.add({ id: 'year', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31', active: true, ...audit })
  await db.groups.add({ id: 'group', academicYearId: 'year', name: '10.º D', educationType: 'professional', grade: 10, courseName: 'TAP', active: true, ...audit })
  await db.subjects.add({ id: 'subject', academicYearId: 'year', name: 'Expressões', shortName: 'AE', code: 'AE', active: true, ...audit })
  await db.teachingAssignments.add({ id: 'assignment', academicYearId: 'year', groupId: 'group', subjectId: 'subject', displayName: 'AE · 10.º D', active: true, ...audit })
  await db.modules.bulkAdd([module, { ...module, id: 'other', code: '10385', name: 'Outra unidade', order: 2 }])
  await db.weeklyScheduleSlots.add({ id: 'slot', academicYearId: 'year', teachingAssignmentId: 'assignment', weekday: 1, startTime: '09:00', endTime: '09:50', periodCount: 1, validFrom: '2026-09-01', validUntil: '2027-07-31', room: '', active: true, ...audit })
  await db.planifications.add(plan); await db.planificationItems.add(item)
  await db.lessons.add(lesson)
  await db.assessmentSchemes.bulkAdd([
    { id: 'scheme', academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: 'unit', scope: 'module', name: 'Específicos', active: true, ...audit },
    { id: 'general', academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: null, scope: 'subject', name: 'Gerais', active: true, ...audit }
  ])
  await db.assessmentCriteria.bulkAdd([
    { id: 'criterion', schemeId: 'scheme', name: 'Específico', description: '', weightPercent: 100, order: 1, active: true, ...audit },
    { id: 'general-criterion', schemeId: 'general', name: 'Geral', description: '', weightPercent: 100, order: 1, active: true, ...audit }
  ])
}
async function allData() { return (await runtime.createMAProfessorBackup()).data }
async function importRequest(action = 'replace') {
  return { confirmed: true, academicYearId: 'year', assignmentIds: ['assignment'], expectedFingerprint: (await runtime.readModuleImportState()).fingerprint, document: importedDocument,
    selections: [{ sectionIndex: 0, code: '0349', name: 'Unidade original', plannedPeriods: 30, reviewed: true, existingPlanificationAction: action }] }
}

test('unit deletion removes only its unused configuration and untouched automatic lessons; changes survive reopening', async () => {
  await seed(); const before = await allData()
  await repository.deleteModule('unit', timestamp)
  db.close(); await db.open()
  const after = await allData()
  assert.equal(after.modules.length, 1)
  assert.equal(after.modules[0].id, 'other')
  assert.equal(after.planifications.length, 0)
  assert.equal(after.planificationItems.length, 0)
  assert.equal(after.lessons.length, 0)
  assert.deepEqual(after.assessmentSchemes.map(row => row.id), ['general'])
  assert.deepEqual(after.assessmentCriteria.map(row => row.id), ['general-criterion'])
  for (const key of ['groups', 'subjects', 'teachingAssignments', 'weeklyScheduleSlots']) assert.deepEqual(after[key], before[key])
})

test('UFCD, module and UC can replace an unused unit at the same position without inheriting old content', async () => {
  for (const code of ['10386', 'M1', 'UC04993']) {
    await seed()
    const next = await repository.replaceModule('unit', timestamp, { code, name: `Nova ${code}`, plannedPeriods: 60 })
    assert.notEqual(next.id, 'unit')
    assert.equal(next.order, 1)
    assert.equal(next.teachingAssignmentId, 'assignment')
    assert.equal(next.code, code)
    assert.equal(next.plannedPeriods, 60)
    assert.equal(await db.planifications.count(), 0)
    assert.equal(await db.modules.count(), 2)
  }
})

test('history, attendance, assessments, final grades, recoveries and future reservations each block whole-unit destruction atomically', async () => {
  const cases = [
    () => db.lessons.update('lesson', { status: 'taught', summary: 'Sumário guardado' }),
    () => db.lessons.update('lesson', { summary: 'Preparação futura', date: '2026-12-01' }),
    () => db.lessonAttendance.add({ id: 'attendance', lessonId: 'lesson', studentId: 'student', status: 'absent' }),
    () => db.lessonAssessments.add({ id: 'assessment', lessonId: 'lesson', moduleId: 'unit', criterionId: 'criterion' }),
    () => db.moduleFinalGrades.add({ id: 'grade', moduleId: 'unit' }),
    () => db.learningRecoveries.add({ id: 'recovery', moduleId: 'unit' }),
    () => db.summarySuggestions.add({ id: 'suggestion', lessonId: 'lesson', text: 'Trabalho guardado' }),
    () => db.lessons.update('lesson', { planificationItemIds: ['item'] }),
    () => db.planificationItems.update('item', { status: 'used', usedLessonId: 'lesson', usedAt: timestamp })
  ]
  for (const setup of cases) {
    await seed(); await setup(); const before = await allData()
    await assert.rejects(repository.deleteModule('unit', timestamp), /histórico/)
    await assert.rejects(repository.replaceModule('unit', timestamp, { code: 'UC04993', name: 'Nova UC', plannedPeriods: 20 }), /histórico/)
    assert.deepEqual(await allData(), before)
  }
})

test('invalid, duplicate and stale replacements leave all data untouched', async () => {
  await seed(); const before = await allData()
  await assert.rejects(repository.replaceModule('unit', timestamp, { code: '10385', name: 'Duplicada', plannedPeriods: 10 }), /Já existe/)
  await assert.rejects(repository.replaceModule('unit', timestamp, { code: 'UC04993', name: 'Nova UC', plannedPeriods: 0 }), /superior|positivo/i)
  await assert.rejects(repository.deleteModule('unit', 'outdated'), /alterada/)
  assert.deepEqual(await allData(), before)
})

test('failed replacement rolls back deletion of the old unit, planification, criteria and generated lessons', async () => {
  await seed(); const before = await allData()
  const fail = () => { throw new Error('simulated module write failure') }
  db.modules.hook('creating', fail)
  try {
    await assert.rejects(repository.replaceModule('unit', timestamp, { code: 'UC04993', name: 'Nova UC', plannedPeriods: 20 }), /simulated/)
  } finally { db.modules.hook('creating').unsubscribe(fail) }
  assert.deepEqual(await allData(), before)
})

test('guided import explicitly replaces a planification, keeps unit identity and lesson references; the old lesson remains editable', async () => {
  await seed()
  await db.lessons.update('lesson', { status: 'taught', summary: 'Sumário original', planificationItemIds: ['item'] })
  await db.planificationItems.update('item', { status: 'used', usedLessonId: 'lesson', usedAt: timestamp })
  const before = await allData()
  const result = await runtime.commitModulePlanificationImport(await importRequest())
  assert.equal(result.replaced, 1)
  assert.equal((await db.planifications.get('plan')).active, false)
  assert.deepEqual(await db.lessons.get('lesson'), before.lessons[0])
  assert.deepEqual(await db.planificationItems.get('item'), before.planificationItems[0])
  assert.deepEqual(await db.modules.get('unit'), module)
  assert.match((await lessons.getNextPlanificationItem('unit')).content, /Conteúdo novo/)
  await lessons.updateLesson('lesson', { summary: 'Sumário corrigido' })
  assert.equal((await db.lessons.get('lesson')).summary, 'Sumário corrigido')
  assert.deepEqual((await db.lessons.get('lesson')).planificationItemIds, ['item'])
  const backup = await runtime.createMAProfessorBackup()
  const validation = runtime.validateMAProfessorBackup(backup)
  assert.equal(validation.valid, true, JSON.stringify(validation.issues))
  await runtime.restoreMAProfessorBackup(backup)
  assert.equal((await db.planifications.get('plan')).active, false)
  assert.equal((await db.planificationItems.get('item')).usedLessonId, 'lesson')
})

test('deleting a planification preserves a future reservation but its archived content cannot be added to a different lesson', async () => {
  await seed(); await db.lessons.update('lesson', { date: '2026-12-01', planificationItemIds: ['item'] })
  await planning.deletePlanification('plan')
  assert.equal(await lessons.getNextPlanificationItem('unit'), null)
  await lessons.updateLesson('lesson', { summary: 'Preparação revista' })
  await db.lessons.add({ ...lesson, id: 'new-lesson', date: '2026-12-02' })
  await assert.rejects(lessons.updateLesson('new-lesson', { planificationItemIds: ['item'] }), /reservado|ativa|não pertence/)
  assert.deepEqual((await db.lessons.get('lesson')).planificationItemIds, ['item'])
})

test('guided import preserves by default and rolls back the old archive if writing the replacement fails', async () => {
  await seed()
  const preserved = await runtime.commitModulePlanificationImport(await importRequest('preserve'))
  assert.equal(preserved.skipped, 1)
  await db.lessons.update('lesson', { planificationItemIds: ['item'] })
  const before = await allData()
  const fail = () => { throw new Error('simulated planification write failure') }
  db.planifications.hook('creating', fail)
  try { await assert.rejects(runtime.commitModulePlanificationImport(await importRequest()), /simulated/) }
  finally { db.planifications.hook('creating').unsubscribe(fail) }
  assert.deepEqual(await allData(), before)
})

test('unit actions are available, cancellation is harmless and deletion requires the exact confirmation', async () => {
  await seed(); const container = document.createElement('div'); document.body.append(container)
  const reactRoot = createRoot(container); let changes = 0
  await act(async () => reactRoot.render(React.createElement(runtime.ModuleUnitActions, { module, onChanged: () => { changes++ } })))
  const click = async text => {
    const button = [...container.querySelectorAll('button')].find(node => node.textContent === text)
    assert.ok(button, text); await act(async () => button.click())
  }
  await click('Substituir unidade'); assert.ok(container.querySelector('[role="dialog"]'))
  await click('Cancelar'); assert.deepEqual(await db.modules.get('unit'), module)
  await click('Eliminar unidade')
  const dialog = container.querySelector('[role="dialog"]')
  assert.equal([...dialog.querySelectorAll('button')].find(node => node.textContent === 'Eliminar unidade').disabled, true)
  const input = dialog.querySelector('input')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'APAGAR')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  const confirmButton = [...dialog.querySelectorAll('button')].find(node => node.textContent === 'Eliminar unidade')
  assert.equal(confirmButton.disabled, false)
  await act(async () => {
    confirmButton.click()
    for (let attempt = 0; attempt < 40 && !changes; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
  })
  assert.equal(changes, 1)
  assert.equal(await db.modules.get('unit'), undefined)
  await act(async () => reactRoot.unmount()); container.remove()
})
