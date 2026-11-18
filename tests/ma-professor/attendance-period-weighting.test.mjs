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
  'a unit percentage uses its full planned workload instead of lessons taught so far',
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
  'two periods before the unit limit already produce a warning even below the generic 8 percent warning',
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
  'reaching exactly ten percent requires recovery without waiting for another absence',
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

test('recovery starts at the configured threshold, using unrounded periods and preserving warnings below it', () => {
  for (const [plannedPeriods, absencePeriods, recoveryThresholdPercent, expected] of [
    [60, 0, 10, 'regular'],
    [60, 4, 10, 'warning'],
    [60, 5, 10, 'warning'],
    [60, 6, 10, 'recovery_required'],
    [60, 7, 10, 'recovery_required'],
    [50, 5, 10, 'recovery_required'],
    [100, 10, 10, 'recovery_required'],
    [25, 2, 10, 'warning'],
    [25, 3, 10, 'recovery_required'],
    [60, 11, 20, 'warning'],
    [60, 12, 20, 'recovery_required'],
    [0, 6, 10, 'regular']
  ]) {
    assert.equal(metrics.getAttendanceWarningLevel({
      plannedPeriods, absencePeriods, recoveryThresholdPercent,
      nextLessonPeriods: 1, warningPercent: 8
    }), expected, `${absencePeriods}/${plannedPeriods} at ${recoveryThresholdPercent}%`)
  }
})

test(
  'when the attendance record is corrected by the class director the unit percentage can return to zero',
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
  'attendance repository scopes both absences and the planned workload to the selected curricular unit',
  () => {
    assert.match(
      repositorySource,
      /override async getStudentModuleAbsenceSummary/
    )
    assert.match(
      repositorySource,
      /lessons\.where\('moduleId'\)\.equals\(moduleId\)/
    )
    assert.match(
      repositorySource,
      /const annualPlannedPeriods = module\.plannedPeriods/
    )
    assert.match(
      repositorySource,
      /calculateAnnualAttendancePeriodMetrics\([\s\S]*annualPlannedPeriods[\s\S]*lesson\.periodCount[\s\S]*'absent'/
    )
  }
)

test(
  'the repository evaluates the unit threshold through the shared warning calculator',
  () => {
    assert.match(
      repositorySource,
      /getAttendanceWarningLevel\(\{[\s\S]*plannedPeriods:[\s\S]*annualPlannedPeriods[\s\S]*absencePeriods:[\s\S]*metrics\.absencePeriods[\s\S]*nextLessonPeriods:/
    )
    assert.match(
      repositorySource,
      /return 'Recuperação necessária'/
    )
  }
)

test(
  'automatic recovery synchronization preserves one active recovery per student and unit',
  () => {
    assert.match(
      repositorySource,
      /const activeRecovery = await getActiveRecovery\(moduleId, studentId\)/
    )
    assert.doesNotMatch(
      repositorySource,
      /getActiveRecoveryForAssignment|listRecoveryHistoryForAssignment/
    )
    assert.match(
      repositorySource,
      /synchronizeRecoveriesForModule[\s\S]*learningRecoveries[\s\S]*'teachingAssignmentId'[\s\S]*module\.teachingAssignmentId/
    )
  }
)

test(
  'historical recovery counters remain lesson-based while new percentages use the unit summary',
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
