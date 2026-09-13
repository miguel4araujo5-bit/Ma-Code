import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/attendanceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const dailyRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const dashboardRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/dashboard/dashboardRepositoryBase.ts',
    import.meta.url
  ),
  'utf8'
)

const attendanceWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/attendanceWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'module absence summaries reuse the period-weighted single-student contract',
  () => {
    assert.match(
      repositorySource,
      /override async listModuleAbsenceSummaries\([\s\S]*super\.listModuleAbsenceSummaries\([\s\S]*this\.getStudentModuleAbsenceSummary\(/
    )
  }
)

test(
  'absence overview reapplies warning filters only after period-weighted summaries are resolved',
  () => {
    assert.match(
      repositorySource,
      /override async listAbsenceOverview\([\s\S]*super\.listAbsenceOverview\(\{[\s\S]*warningLevel:\s*null[\s\S]*this\.getStudentModuleAbsenceSummary\([\s\S]*row\.summary\.warningLevel\s*===\s*filters\.warningLevel/
    )
  }
)

test(
  'Daily, Dashboard and attendance workspace consume the corrected aggregate APIs',
  () => {
    assert.match(
      dailyRepositorySource,
      /attendanceRepository\.listModuleAbsenceSummaries\(/
    )
    assert.match(
      dashboardRepositorySource,
      /attendanceRepository[\s\S]*\.listAbsenceOverview\(/
    )
    assert.match(
      attendanceWorkspaceSource,
      /attendanceRepository\.listAbsenceOverview\(/
    )
  }
)

test(
  'the consistency fix stays local and adds no cloud path',
  () => {
    assert.doesNotMatch(
      repositorySource,
      /fetch\(|Durable|wrangler|D1/i
    )
  }
)
