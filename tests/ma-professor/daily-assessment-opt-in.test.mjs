import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const viewSource = await readFile(
  new URL('../../src/components/ma-professor/daily/DailyWorkspaceView.tsx', import.meta.url),
  'utf8'
)
const repositorySource = await readFile(
  new URL('../../src/components/ma-professor/daily/dailyCriteriaGridRepository.ts', import.meta.url),
  'utf8'
)

function compile(source, imports = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })
  assert.deepEqual(
    (output.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error),
    []
  )
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output.outputText)(
    name => {
      assert.ok(name in imports, 'Unexpected import: ' + name)
      return imports[name]
    },
    module,
    module.exports
  )
  return module.exports
}

const sourceFile = ts.createSourceFile('DailyWorkspaceView.tsx', viewSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function functionSource(name) {
  let found
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  assert.ok(found, 'Missing function: ' + name)
  return found.getText(sourceFile)
}

const helpers = compile([
  'buildStudentRows',
  'isDailyAssessmentEnabled',
  'buildActivatedStudentRows'
].map(name => 'export ' + functionSource(name)).join('\n'))

const criteria = [
  { id: 'learning', name: 'Aprendizagens', weightPercent: 60 },
  { id: 'reasoning', name: 'Raciocínio', weightPercent: 20 },
  { id: 'attitudes', name: 'Atitudes', weightPercent: 20 }
]
const rows = [
  { student: { id: 'ana', name: 'Ana' }, attendanceStatus: 'present' },
  { student: { id: 'bruno', name: 'Bruno' }, attendanceStatus: 'absent' }
]
function buildRows(scoresByStudentId = {}) {
  return helpers.buildStudentRows(structuredClone(rows), { criteria, scoresByStudentId, activity: '' })
}

const runSave = compile(
  'export async function runSave(students, criteria, status = "taught") {\n' +
  'const calls = { lessons: [], grids: [], errors: [] };\n' +
  'const assessmentEnabled = isDailyAssessmentEnabled(students);\n' +
  'const lesson = { id: "lesson", date: "2026-09-14", status };\n' +
  'const selectedLesson = { context: { lessonRow: { lesson } } };\n' +
  'const lessonForm = { ...lesson, periodCount: "1", summary: "Sumário da aula", startTime: "09:00", endTime: "10:00", planificationItemIds: [] };\n' +
  'const assessmentForm = { description: "" };\n' +
  'const absentCount = students.filter(row => row.attendanceStatus === "absent").length;\n' +
  'const savingRef = { current: false }, draftWriteEpochRef = { current: 0 };\n' +
  'const academicYearId = "year", accountEmail = "test@example.invalid", date = lesson.date, currentEditorSignature = "draft";\n' +
  'const setSaving = () => {}, setSuccess = () => {}, setSavedSignature = () => {}, setAssessmentIdToDelete = () => {};\n' +
  'const setError = value => { if (value) calls.errors.push(value) };\n' +
  'const setStudents = value => { calls.students = value };\n' +
  'const notifySaved = async () => {}, deleteMAProfessorDailyDraft = async () => {};\n' +
  'const dailyWorkspaceRepository = { async saveLesson(input) { calls.lessons.push(input); return { lesson: { ...lesson, status: input.status } } }, async getLessonWorkspace() {}, describeError: error => error.message };\n' +
  'const dailyCriteriaGridRepository = { async saveLessonGrid(input) { calls.grids.push(input) } };\n' +
  'const parseDailyCriterionScore = value => { const score = Number(value); if (!value.trim() || !Number.isFinite(score) || score < 0 || score > 20) throw new Error("Invalid score"); return score };\n' +
  functionSource('isDailyAssessmentEnabled') + '\n' +
  functionSource('saveAll') + '\n' +
  'return { saved: await saveAll({ reload: false, announce: false }), calls };\n}'
).runSave

test('opening a lesson leaves every unassessed pupil blank and saving attendance creates no evaluation', async () => {
  const students = buildRows()
  assert.equal(helpers.isDailyAssessmentEnabled(students), false)
  for (const row of students) {
    assert.deepEqual(Object.values(row.criterionScores), ['', '', ''])
  }
  const result = await runSave(students, criteria)
  assert.equal(result.saved, true)
  assert.equal(result.calls.lessons.length, 1)
  assert.equal(result.calls.lessons[0].assessment.mode, 'none')
  assert.equal(result.calls.grids.length, 0)
  assert.deepEqual(result.calls.errors, [])
})

test('Avaliação explicitly prepares tens and saving passes those scores with the lesson summary', async () => {
  const original = buildRows()
  const students = helpers.buildActivatedStudentRows(original, criteria)
  assert.equal(helpers.isDailyAssessmentEnabled(students), true)
  assert.equal(helpers.isDailyAssessmentEnabled(original), false)
  assert.deepEqual(Object.values(students[0].criterionScores), ['10', '10', '10'])
  students[0].criterionScores.learning = '18'
  const result = await runSave(students, criteria)
  assert.equal(result.saved, true)
  assert.equal(result.calls.grids.length, 1)
  assert.equal(result.calls.grids[0].rows[0].scores.learning, '18')
  assert.equal(result.calls.grids[0].summary, 'Sumário da aula')
  assert.equal(result.calls.grids[0].activity, '')
  assert.equal(result.calls.grids[0].rows[1].attendanceStatus, 'absent')
})

test('existing scores including zero and decimals survive reopening without inventing scores for other pupils', async () => {
  const students = buildRows({ ana: { learning: 0, reasoning: 17.5, attitudes: 20 } })
  assert.equal(helpers.isDailyAssessmentEnabled(students), true)
  assert.deepEqual(students[0].criterionScores, { learning: '0', reasoning: '17.5', attitudes: '20' })
  assert.deepEqual(Object.values(students[1].criterionScores), ['', '', ''])
  students[1].attendanceStatus = 'present'
  const result = await runSave(students, criteria)
  assert.equal(result.saved, true)
  assert.deepEqual(Object.values(result.calls.grids[0].rows[1].scores), ['', '', ''])
  assert.equal(helpers.isDailyAssessmentEnabled(buildRows()), false, 'A different lesson must start without evaluation')
})

test('cancelled lessons do not save grades even if the editor contains scores', async () => {
  const students = helpers.buildActivatedStudentRows(buildRows(), criteria)
  students[1].attendanceStatus = 'present'
  const result = await runSave(students, criteria, 'cancelled')
  assert.equal(result.saved, true)
  assert.equal(result.calls.grids.length, 0)
})

function repositoryHarness() {
  const state = { assessments: [], results: new Map(), created: 0 }
  const assessmentRepository = {
    async getLessonAssessmentWorkspace() {
      return { criteria, students: rows.map(row => row.student), assessments: state.assessments }
    },
    async getAssessmentRegister(id) {
      return { rows: rows.map(row => ({ student: row.student, result: state.results.get(id)?.find(result => result.studentId === row.student.id) })) }
    },
    async saveAssessmentResults(id, entries) { state.results.set(id, structuredClone(entries)) },
    async updateLessonAssessment(id, changes) { Object.assign(state.assessments.find(item => item.assessment.id === id).assessment, changes) },
    async deleteLessonAssessment(id) {
      state.assessments = state.assessments.filter(item => item.assessment.id !== id)
      state.results.delete(id)
    }
  }
  const runtime = compile(repositorySource, {
    '../assessments/assessmentRepository': { assessmentRepository },
    '../assessmentAtomicPersistenceRepository': {
      assessmentAtomicPersistenceRepository: {
        async createLessonAssessmentWithResults(input, entries) {
          const id = 'assessment-' + (++state.created)
          state.assessments.push({ assessment: { ...input, id } })
          state.results.set(id, structuredClone(entries))
        }
      }
    }
  })
  return { state, repository: new runtime.DailyCriteriaGridRepository(), runtime }
}

test('blank and absent-only grid submissions create no assessment records or average', async () => {
  const { repository, state, runtime } = repositoryHarness()
  const result = await repository.saveLessonGrid({
    lesson: { id: 'lesson', status: 'taught' }, summary: 'Sumário', activity: '',
    rows: [{ studentId: 'ana', attendanceStatus: 'present', scores: {} }, { studentId: 'bruno', attendanceStatus: 'absent', scores: {} }]
  })
  assert.equal(state.created, 0)
  assert.deepEqual(result.scoresByStudentId, { ana: {}, bruno: {} })
  assert.equal(runtime.calculateDailyCriteriaAverage({}, criteria), null)
})

test('explicit future evaluation persists real scores and blanks stay not evaluated', async () => {
  const { repository, state, runtime } = repositoryHarness()
  const input = {
    lesson: { id: 'future-lesson', date: '2099-09-14', status: 'planned' }, summary: 'Sumário futuro', activity: '',
    rows: [{ studentId: 'ana', attendanceStatus: 'present', scores: { learning: '18', reasoning: '10', attitudes: '10' } }, { studentId: 'bruno', attendanceStatus: 'present', scores: {} }]
  }
  const result = await repository.saveLessonGrid(input)
  assert.equal(state.created, 3)
  assert.equal(runtime.calculateDailyCriteriaAverage(input.rows[0].scores, criteria), 14.8)
  assert.deepEqual(result.scoresByStudentId.bruno, {})
  for (const entries of state.results.values()) {
    assert.deepEqual(entries[1], { studentId: 'bruno', status: 'not_evaluated', score: null, note: '' })
  }
  assert.ok(state.assessments.every(item => item.assessment.title.startsWith('Sumário futuro · ')))
  input.rows[0].scores = {}
  const cleared = await repository.saveLessonGrid(input)
  assert.deepEqual(cleared.scoresByStudentId.ana, {})
  assert.equal(state.created, 3, 'Clearing or saving again must not duplicate assessments')
})
