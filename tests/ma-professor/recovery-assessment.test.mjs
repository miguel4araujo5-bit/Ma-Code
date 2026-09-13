import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const recoverySource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/recoveryAssessmentRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const calculationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/lessonGradeCalculation.ts',
    import.meta.url
  ),
  'utf8'
)

const workspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/assessmentWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/RecoveryAttemptsPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const productSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/AttendanceProductWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

const dbSource = await readFile(
  new URL(
    '../../src/components/ma-professor/db.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(source) {
  const output = ts.transpileModule(
    source,
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022
      },
      reportDiagnostics: true
    }
  )

  const errors =
    (output.diagnostics || [])
      .filter(
        item =>
          item.category ===
          ts.DiagnosticCategory.Error
      )

  assert.equal(
    errors.length,
    0,
    errors
      .map(item => item.messageText)
      .join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const calculation = await import(
  transpile(calculationSource)
)

const recoveryPureStart =
  recoverySource.indexOf(
    'function roundScore('
  )
const recoveryPureEnd =
  recoverySource.indexOf(
    'async function readRecoveryAssessmentContext('
  )

assert.notEqual(recoveryPureStart, -1)
assert.notEqual(recoveryPureEnd, -1)

const recoveryCalculation = await import(
  transpile(
    recoverySource.slice(
      recoveryPureStart,
      recoveryPureEnd
    )
  )
)

const criteria = [
  {
    id: 'c1',
    schemeId: 'scheme',
    name: 'D1',
    description: '',
    weightPercent: 60,
    order: 1,
    active: true
  },
  {
    id: 'c2',
    schemeId: 'scheme',
    name: 'D2',
    description: '',
    weightPercent: 40,
    order: 2,
    active: true
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
    id: `r-${assessmentId}`,
    assessmentId,
    studentId: 'student-1',
    status: 'evaluated',
    score,
    note: ''
  }
}

function recovery(overrides = {}) {
  return {
    id: 'recovery-1',
    academicYearId: 'year',
    teachingAssignmentId: 'assignment',
    moduleId: 'module',
    studentId: 'student-1',
    triggeredAt: '2026-09-01T10:00:00.000Z',
    lessonCountAtTrigger: 5,
    absenceCountAtTrigger: 1,
    absencePercentAtTrigger: 20,
    contents: '',
    activity: 'Ficha',
    plannedDate: '2026-09-10',
    status: 'completed',
    result: 'Concluída',
    completedAt: '2026-09-10T10:00:00.000Z',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-10T10:00:00.000Z',
    ...overrides
  }
}

test(
  'a recovery is grade-bearing only after an explicit complete 0-20 assessment',
  () => {
    assert.equal(
      recoveryCalculation
        .calculateRecoveryAssessmentGrade(
          criteria,
          null
        ),
      null
    )

    assert.equal(
      recoveryCalculation
        .calculateRecoveryAssessmentGrade(
          criteria,
          {
            c1: 10,
            c2: 20
          }
        ),
      14
    )

    assert.equal(
      recoveryCalculation
        .calculateRecoveryAssessmentGrade(
          criteria,
          {
            c1: 10
          }
        ),
      null
    )

    assert.throws(
      () =>
        recoveryCalculation
          .normalizeRecoveryAssessmentScores(
            criteria,
            {
              c1: 10,
              c2: 21
            }
          ),
      /0 e 20/
    )
  }
)

test(
  'reopening and completing again makes an older recovery assessment stale',
  () => {
    const current =
      recovery({
        assessmentScores: {
          c1: 10,
          c2: 20
        },
        assessmentRecordedAt:
          '2026-09-10T11:00:00.000Z'
      })

    assert.deepEqual(
      recoveryCalculation
        .listStudentRecoveryAssessmentGrades(
          [current],
          criteria,
          'student-1'
        ),
      [14]
    )

    const completedAgain = {
      ...current,
      completedAt:
        '2026-09-12T10:00:00.000Z'
    }

    assert.deepEqual(
      recoveryCalculation
        .listStudentRecoveryAssessmentGrades(
          [completedAgain],
          criteria,
          'student-1'
        ),
      []
    )
  }
)

test(
  'an explicit recovery grade is averaged as one additional complete activity without repairing incomplete lessons',
  () => {
    const assessments = [
      assessment('a1', 'lesson-1', 'c1'),
      assessment('a2', 'lesson-1', 'c2')
    ]
    const results = [
      result('a1', 10),
      result('a2', 10)
    ]

    const baseline =
      calculation
        .calculateStudentLessonGradeSummary(
          criteria,
          assessments,
          results,
          'student-1'
        )

    const withRecovery =
      calculation
        .calculateStudentLessonGradeSummary(
          criteria,
          assessments,
          results,
          'student-1',
          [20]
        )

    assert.equal(
      baseline.provisionalAverage,
      10
    )
    assert.equal(
      withRecovery.provisionalAverage,
      15
    )
    assert.equal(
      withRecovery.suggestedGrade,
      15
    )

    const breakdown =
      calculation
        .calculateStudentCriterionGradeBreakdown(
          criteria,
          assessments,
          results,
          'student-1',
          [
            {
              criterionId: 'c1',
              score: 20
            },
            {
              criterionId: 'c2',
              score: 20
            }
          ]
        )

    assert.deepEqual(
      breakdown.map(
        item => item.average
      ),
      [15, 15]
    )
    assert.deepEqual(
      breakdown.map(
        item => item.assessmentCount
      ),
      [2, 2]
    )
  }
)

test(
  'assessment workspace consumes recovery evidence without inventing lessons or lesson assessments',
  () => {
    assert.match(
      workspaceSource,
      /maProfessorDb\s*\.learningRecoveries/
    )
    assert.match(
      workspaceSource,
      /listStudentRecoveryAssessmentGrades/
    )
    assert.match(
      workspaceSource,
      /listStudentRecoveryCriterionScores/
    )
    assert.match(
      workspaceSource,
      /calculateStudentLessonGradeSummary\([\s\S]*recoveryGrades/
    )
    assert.match(
      workspaceSource,
      /calculateStudentCriterionGradeBreakdown\([\s\S]*recoveryCriterionScores/
    )

    assert.doesNotMatch(
      recoverySource,
      /lessonAssessments\.(add|put|bulkAdd|bulkPut)/
    )
    assert.doesNotMatch(
      recoverySource,
      /lessons\.(add|put|bulkAdd|bulkPut)/
    )
  }
)

test(
  'teacher must explicitly opt in from the recovery UI and can remove the assessment without deleting history',
  () => {
    assert.match(
      panelSource,
      /Uma recuperação concluída não altera notas automaticamente/
    )
    assert.match(
      panelSource,
      /Usar como avaliação adicional/
    )
    assert.match(
      panelSource,
      /todos os critérios/
    )
    assert.match(
      panelSource,
      /Retirar a tentativa[\s\S]*histórico serão preservados/
    )
    assert.match(
      productSource,
      /recoveryAssessmentRepository\.saveAssessment/
    )
    assert.match(
      productSource,
      /recoveryAssessmentRepository\.clearAssessment/
    )
  }
)

test(
  'recovery assessment remains in the existing local record and needs no Dexie or Cloudflare migration',
  () => {
    assert.match(
      recoverySource,
      /maProfessorDb\s*\.learningRecoveries\s*\.put\(updated\)/
    )
    assert.doesNotMatch(
      recoverySource,
      /fetch\(|snapshotApi|wrangler|Durable Object|cloudflare/i
    )
    assert.doesNotMatch(
      recoverySource,
      /\.version\(/
    )
    assert.match(
      dbSource,
      /learningRecoveries:\s*\n\s*'&id, academicYearId, teachingAssignmentId, moduleId, studentId, status, plannedDate, \[moduleId\+studentId\], \[studentId\+status\]'/
    )
  }
)
