import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const calculationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/lessonGradeCalculation.ts',
    import.meta.url
  ),
  'utf8'
)

const wrapperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/assessmentWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )

  assert.equal(
    errors.length,
    0,
    errors.map(item => item.messageText).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const calculation = await import(
  transpile(calculationSource)
)

const criteria = [
  {
    id: 'c1',
    name: 'D1',
    weightPercent: 60
  },
  {
    id: 'c2',
    name: 'D2',
    weightPercent: 20
  },
  {
    id: 'c3',
    name: 'D3',
    weightPercent: 20
  }
]

function assessment(
  id,
  lessonId,
  criterionId
) {
  return {
    id,
    lessonId,
    criterionId
  }
}

function result(
  assessmentId,
  score
) {
  return {
    id: `result-${assessmentId}-${score}`,
    assessmentId,
    studentId: 'student-1',
    status: 'evaluated',
    score,
    note: ''
  }
}

test(
  'UFCD average is the arithmetic mean of complete lesson grades',
  () => {
    const assessments = [
      assessment('l1-c1', 'lesson-1', 'c1'),
      assessment('l1-c2', 'lesson-1', 'c2'),
      assessment('l1-c3', 'lesson-1', 'c3'),
      assessment('l2-c1', 'lesson-2', 'c1'),
      assessment('l2-c2', 'lesson-2', 'c2'),
      assessment('l2-c3', 'lesson-2', 'c3')
    ]

    const results = [
      result('l1-c1', 10),
      result('l1-c2', 20),
      result('l1-c3', 20),
      result('l2-c1', 20),
      result('l2-c2', 10),
      result('l2-c3', 10)
    ]

    const summary =
      calculation.calculateStudentLessonGradeSummary(
        criteria,
        assessments,
        results,
        'student-1'
      )

    assert.deepEqual(
      summary.lessons.map(item => item.grade),
      [14, 16]
    )
    assert.equal(
      summary.provisionalAverage,
      15
    )
    assert.equal(
      summary.allEvaluatedLessonsComplete,
      true
    )
    assert.equal(
      summary.suggestedGrade,
      15
    )
  }
)

test(
  'an incomplete evaluated lesson is not mixed into the UFCD average and blocks final suggestion',
  () => {
    const assessments = [
      assessment('l1-c1', 'lesson-1', 'c1'),
      assessment('l1-c2', 'lesson-1', 'c2'),
      assessment('l1-c3', 'lesson-1', 'c3'),
      assessment('l2-c1', 'lesson-2', 'c1')
    ]

    const results = [
      result('l1-c1', 10),
      result('l1-c2', 20),
      result('l1-c3', 20),
      result('l2-c1', 20)
    ]

    const summary =
      calculation.calculateStudentLessonGradeSummary(
        criteria,
        assessments,
        results,
        'student-1'
      )

    assert.deepEqual(
      summary.lessons.map(item => item.grade),
      [14, null]
    )
    assert.equal(
      summary.provisionalAverage,
      14
    )
    assert.equal(
      summary.allEvaluatedLessonsComplete,
      false
    )
    assert.equal(
      summary.suggestedGrade,
      null
    )
  }
)

test(
  'multiple records for the same criterion in one lesson are averaged before applying criterion weight',
  () => {
    const assessments = [
      assessment('l1-c1-a', 'lesson-1', 'c1'),
      assessment('l1-c1-b', 'lesson-1', 'c1'),
      assessment('l1-c2', 'lesson-1', 'c2'),
      assessment('l1-c3', 'lesson-1', 'c3')
    ]

    const results = [
      result('l1-c1-a', 10),
      result('l1-c1-b', 14),
      result('l1-c2', 20),
      result('l1-c3', 20)
    ]

    const summary =
      calculation.calculateStudentLessonGradeSummary(
        criteria,
        assessments,
        results,
        'student-1'
      )

    assert.equal(
      summary.lessons[0].criteria[0].average,
      12
    )
    assert.equal(
      summary.lessons[0].grade,
      15.2
    )
    assert.equal(
      summary.provisionalAverage,
      15.2
    )
  }
)

test(
  'workspace wrapper replaces criterion-first provisional grade with lesson-first result',
  () => {
    assert.match(
      wrapperSource,
      /calculateStudentLessonGradeSummary/
    )
    assert.match(
      wrapperSource,
      /provisionalAverage:\s*\n\s*calculation\.provisionalAverage/
    )
    assert.match(
      wrapperSource,
      /allActiveCriteriaAssessed:\s*\n\s*calculation\.allEvaluatedLessonsComplete/
    )
    assert.match(
      wrapperSource,
      /suggestedGrade:\s*\n\s*calculation\.suggestedGrade/
    )
  }
)
