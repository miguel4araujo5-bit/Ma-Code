import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const helperSource = await readFile(
  new URL('../../src/components/ma-professor/daily/dailyPreviousScores.ts', import.meta.url), 'utf8'
)
const gridSource = await readFile(
  new URL('../../src/components/ma-professor/daily/DailyWorkspaceView.tsx', import.meta.url), 'utf8'
)
const repositorySource = await readFile(
  new URL('../../src/components/ma-professor/daily/dailyCriteriaGridRepository.ts', import.meta.url), 'utf8'
)

const start = helperSource.indexOf('function criterionKey(')
const end = helperSource.indexOf('export async function loadDailyPreviousScores(')
assert.ok(start >= 0 && end > start, 'Função de seleção encontrada')
const pureSource = helperSource.slice(start, end)
const compiled = ts.transpileModule(pureSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true
})
assert.equal((compiled.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0)
const { chooseDailyPreviousScores } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64')
)

function fixtures() {
  const currentLesson = {
    id: 'current', academicYearId: 'year', teachingAssignmentId: 'ae',
    moduleId: 'm2', date: '2026-10-09', startTime: '10:00',
    status: 'planned'
  }
  const earlierLessons = [
    { id: 'older', academicYearId: 'year', teachingAssignmentId: 'ae', moduleId: 'm1',
      date: '2026-10-01', startTime: '10:00', status: 'taught' },
    { id: 'previous', academicYearId: 'year', teachingAssignmentId: 'ae', moduleId: 'm1',
      date: '2026-10-08', startTime: '10:00', status: 'taught' }
  ]
  const sourceCriteria = [
    { id: 'source-g', schemeId: 'scheme-g', name: 'Participação' },
    { id: 'source-acs', schemeId: 'scheme-acs', name: 'Participação' }
  ]
  const sourceSchemes = [
    { id: 'scheme-g', profile: 'general' },
    { id: 'scheme-acs', profile: 'acs' }
  ]
  const assessments = [
    { id: 'older-a', lessonId: 'older', criterionId: 'source-g', academicYearId: 'year',
      teachingAssignmentId: 'ae', activityType: 'other',
      title: 'Sumário · Registo diário · Participação', updatedAt: '2026-10-01T12:00:00Z' },
    { id: 'previous-a', lessonId: 'previous', criterionId: 'source-g', academicYearId: 'year',
      teachingAssignmentId: 'ae', activityType: 'other',
      title: 'Sumário · Registo diário · Participação', updatedAt: '2026-10-08T12:00:00Z' },
    { id: 'previous-acs', lessonId: 'previous', criterionId: 'source-acs', academicYearId: 'year',
      teachingAssignmentId: 'ae', activityType: 'other',
      title: 'Sumário · Registo diário · Participação', updatedAt: '2026-10-08T12:00:00Z' }
  ]
  const results = [
    { assessmentId: 'older-a', studentId: 'student-a', status: 'evaluated',
      score: 12, updatedAt: '2026-10-01T12:00:00Z' },
    { assessmentId: 'previous-a', studentId: 'student-a', status: 'evaluated',
      score: 17, updatedAt: '2026-10-08T12:00:00Z' },
    { assessmentId: 'previous-acs', studentId: 'student-b', status: 'evaluated',
      score: 14, updatedAt: '2026-10-08T12:00:00Z' }
  ]
  return {
    currentLesson,
    students: [{ id: 'student-a' }, { id: 'student-b' }],
    targetCriteria: [
      { id: 'target-g', name: 'Participação' },
      { id: 'target-acs', name: 'Participação' }
    ],
    targetAcsCriterionIds: ['target-acs'],
    applicableCriterionIdsByStudent: {
      'student-a': ['target-g'],
      'student-b': ['target-acs']
    },
    earlierLessons, assessments, results, sourceCriteria, sourceSchemes
  }
}

test('daily history uses the newest existing score across modules, by criterion and student', () => {
  const f = fixtures()
  const actual = chooseDailyPreviousScores(f)
  assert.deepEqual(actual, {
    'student-a': { 'target-g': 17 },
    'student-b': { 'target-acs': 14 }
  })
  assert.equal(f.results[1].score, 17, 'Histórico não deve ser alterado')
})

test('daily history ignores other disciplines, future lessons, cancelled and non-daily activities', () => {
  const f = fixtures()
  f.earlierLessons.push(
    { id: 'other', academicYearId: 'year', teachingAssignmentId: 'other-subject',
      moduleId: 'm1', date: '2026-10-08', startTime: '09:00', status: 'taught' },
    { id: 'future', academicYearId: 'year', teachingAssignmentId: 'ae',
      moduleId: 'm2', date: '2026-10-20', startTime: '09:00', status: 'taught' },
    { id: 'cancel', academicYearId: 'year', teachingAssignmentId: 'ae',
      moduleId: 'm1', date: '2026-10-08', startTime: '11:00', status: 'cancelled' }
  )
  for (const [id, lessonId, type] of [
    ['other-a','other','other'], ['future-a','future','other'],
    ['cancel-a','cancel','other'], ['exam-a','previous','test']
  ]) {
    f.assessments.push({ id, lessonId, criterionId: 'source-g', activityType: type,
      title: 'Sumário · Registo diário · Participação', updatedAt: '2026-10-10T12:00:00Z' })
    f.results.push({ assessmentId: id, studentId: 'student-a',
      status: 'evaluated', score: 20, updatedAt: '2026-10-10T12:00:00Z' })
  }
  assert.equal(chooseDailyPreviousScores(f)['student-a']['target-g'],17)
})

test('daily history skips absences, invalid scores and ambiguous or unmatched criteria', () => {
  const f = fixtures()
  f.results[1].status = 'absent'
  assert.equal(chooseDailyPreviousScores(f)['student-a']['target-g'],12,
    'Usar a última nota efetiva, não copiar falta como nota')
  f.targetCriteria.push({ id: 'duplicate-g', name: 'Participação' })
  const ambiguous = chooseDailyPreviousScores(f)
  assert.equal(ambiguous['student-a'], undefined)
  assert.equal(ambiguous['student-b']['target-acs'],14)
  f.targetCriteria = [{ id: 'unmatched', name: 'Outra competência' }]
  f.targetAcsCriterionIds = []
  assert.deepEqual(chooseDailyPreviousScores(f),{})
})

test('daily history respects ACS reset and does not cross profile boundaries', () => {
  const f = fixtures()
  f.students[1].assessmentResetAtByModule = { m2: '2026-10-09T08:00:00Z' }
  const actual = chooseDailyPreviousScores(f)
  assert.equal(actual['student-b'], undefined)
  assert.equal(actual['student-a']['target-g'],17)
})

test('Daily UI uses yellow for suggestions and removes highlight on manual change or save', () => {
  assert.match(repositorySource, /loadDailyPreviousScores\(/)
  assert.match(gridSource, /criterionPreviousScores\[criterion\.id\]/)
  assert.match(gridSource, /criterionScoreInherited:\s*\{/)
  assert.match(gridSource, /\[criterionId\]: false/)
  assert.match(gridSource, /border-amber-300\/50 bg-amber-300\/10/)
  assert.match(gridSource, /criterionScorePersisted\[criterion\.id\]/)
})

test('new daily code transpiles', () => {
  for (const [fileName, source] of [
    ['dailyPreviousScores.ts', helperSource],
    ['DailyWorkspaceView.tsx', gridSource],
    ['dailyCriteriaGridRepository.ts', repositorySource]
  ]) {
    const result = ts.transpileModule(source, {
      fileName, reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX
      }
    })
    assert.equal((result.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length,
      0, fileName)
  }
})
