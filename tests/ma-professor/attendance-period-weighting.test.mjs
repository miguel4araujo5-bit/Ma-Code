import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const metricsSource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/attendancePeriodMetrics.ts',
    import.meta.url
  ),
  'utf8'
)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/attendanceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const baseRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/attendanceRepositoryBase.ts',
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

  assert.equal(errors.length, 0)

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const metrics = await import(
  transpile(metricsSource)
)

test(
  'absence periods remain weighted by the number of teaching periods in each lesson',
  () => {
    const result =
      metrics.calculateAttendancePeriodMetrics([
        {
          periodCount: 1,
          absent: false
        },
        {
          periodCount: 2,
          absent: true
        }
      ])

    assert.deepEqual(
      result,
      {
        periodsTaught: 3,
        absencePeriods: 2,
        absencePercent: 66.67
      }
    )
  }
)

test(
  'annual discipline percentage uses the planned annual workload instead of lessons taught so far',
  () => {
    const result =
      metrics.calculateAnnualAttendancePeriodMetrics(
        100,
        [
          {
            periodCount: 1,
            absent: true
          },
          {
            periodCount: 2,
            absent: false
          }
        ]
      )

    assert.deepEqual(
      result,
      {
        periodsTaught: 3,
        absencePeriods: 1,
        absencePercent: 1,
        plannedPeriods: 100
      }
    )
  }
)

test(
  'ten absence periods out of one hundred planned periods produce exactly the 10 percent threshold',
  () => {
    const result =
      metrics.calculateAnnualAttendancePeriodMetrics(
        100,
        [
          {
            periodCount: 10,
            absent: true
          }
        ]
      )

    assert.equal(
      result.absencePercent,
      10
    )
  }
)

test(
  'one lesson before the annual 10 percent limit already produces a warning even below the generic 8 percent warning',
  () => {
    const warningLevel =
      metrics.getAttendanceWarningLevel({
        plannedPeriods: 60,
        absencePeriods: 4,
        nextLessonPeriods: 2,
        warningPercent: 8,
        recoveryThresholdPercent: 10
      })

    assert.equal(
      warningLevel,
      'warning'
    )
  }
)

test(
  'reaching the annual 10 percent limit produces recovery required',
  () => {
    const warningLevel =
      metrics.getAttendanceWarningLevel({
        plannedPeriods: 60,
        absencePeriods: 6,
        nextLessonPeriods: 2,
        warningPercent: 8,
        recoveryThresholdPercent: 10
      })

    assert.equal(
      warningLevel,
      'recovery_required'
    )
  }
)

test(
  'when the attendance record is corrected by the class director the annual percentage can return to zero',
  () => {
    const result =
      metrics.calculateAnnualAttendancePeriodMetrics(
        100,
        [
          {
            periodCount: 10,
            absent: false
          }
        ]
      )

    assert.equal(
      result.absencePeriods,
      0
    )
    assert.equal(
      result.absencePercent,
      0
    )
  }
)

test(
  'attendance repository aggregates the whole teaching assignment and all active module planned periods',
  () => {
    assert.match(
      repositorySource,
      /override async getStudentModuleAbsenceSummary/
    )
    assert.match(
      repositorySource,
      /lessons[\s\S]*\.where\([\s\S]*'teachingAssignmentId'[\s\S]*module\.teachingAssignmentId/
    )
    assert.match(
      repositorySource,
      /assignmentModules[\s\S]*assignmentModule\.active[\s\S]*assignmentModule\.plannedPeriods/
    )
    assert.match(
      repositorySource,
      /calculateAnnualAttendancePeriodMetrics\([\s\S]*annualPlannedPeriods[\s\S]*lesson\.periodCount[\s\S]*'absent'/
    )
  }
)

test(
  'the repository evaluates the annual threshold and the one-lesson warning through the shared warning calculator',
  () => {
    assert.match(
      repositorySource,
      /getAttendanceWarningLevel\(\{[\s\S]*plannedPeriods:[\s\S]*annualPlannedPeriods[\s\S]*absencePeriods:[\s\S]*metrics\.absencePeriods[\s\S]*nextLessonPeriods:/
    )
    assert.match(
      repositorySource,
      /return '🚨 Recuperação necessária'/
    )
  }
)

test(
  'automatic recovery synchronization is discipline-aware and avoids parallel recoveries across UFCDs',
  () => {
    assert.match(
      repositorySource,
      /getActiveRecoveryForAssignment\([\s\S]*teachingAssignmentId[\s\S]*studentId/
    )
    assert.match(
      repositorySource,
      /listRecoveryHistoryForAssignment\([\s\S]*'teachingAssignmentId'/
    )
    assert.match(
      repositorySource,
      /synchronizeRecoveriesForModule[\s\S]*learningRecoveries[\s\S]*'teachingAssignmentId'[\s\S]*module\.teachingAssignmentId/
    )
  }
)

test(
  'historical recovery counters remain lesson-based while the stored percentage uses the corrected annual summary',
  () => {
    assert.match(
      baseRepositorySource,
      /lessonCountAtTrigger:\s*summary\.lessonsTaught/
    )
    assert.match(
      baseRepositorySource,
      /absenceCountAtTrigger:\s*summary\.absences/
    )
    assert.match(
      baseRepositorySource,
      /absencePercentAtTrigger:\s*summary\.absencePercent/
    )
  }
)

test(
  'the change stays local and introduces no cloud or schema path',
  () => {
    assert.doesNotMatch(
      metricsSource,
      /fetch\(|Worker|Durable|D1|wrangler/i
    )
    assert.doesNotMatch(
      repositorySource,
      /fetch\(|Durable|wrangler/i
    )
  }
)
