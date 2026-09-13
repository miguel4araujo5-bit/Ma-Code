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
  'absence percentage is weighted by teaching periods instead of lesson rows',
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
  'single-period lessons preserve the former percentage result',
  () => {
    const result =
      metrics.calculateAttendancePeriodMetrics([
        {
          periodCount: 1,
          absent: true
        },
        {
          periodCount: 1,
          absent: false
        }
      ])

    assert.equal(
      result.absencePercent,
      50
    )
  }
)

test(
  'attendance repository applies period weighting only to the percentage and warning threshold',
  () => {
    assert.match(
      repositorySource,
      /override async getStudentModuleAbsenceSummary/
    )
    assert.match(
      repositorySource,
      /calculateAttendancePeriodMetrics\([\s\S]*lesson\.periodCount[\s\S]*attendanceByLesson\.get\([\s\S]*'absent'/
    )
    assert.match(
      repositorySource,
      /absencePercent:\s*metrics\.absencePercent/
    )
    assert.match(
      repositorySource,
      /metrics\.absencePercent\s*>\s*settings\.learningRecoveryThresholdPercent[\s\S]*metrics\.absencePercent\s*>=\s*settings\.absenceWarningPercent/
    )
  }
)

test(
  'historical recovery counters remain lesson-based while the stored percentage uses the corrected summary',
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
