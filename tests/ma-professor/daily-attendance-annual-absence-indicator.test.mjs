import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const viewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
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

test(
  'daily attendance shows the annual discipline absence count beside the UFCD average',
  () => {
    assert.match(
      viewSource,
      /Média UFCD/
    )

    assert.match(
      viewSource,
      /annualAbsencePeriods/
    )

    assert.match(
      viewSource,
      /Faltas/
    )

    assert.match(
      viewSource,
      /text-rose-300/
    )
  }
)

test(
  'daily attendance previews the count while the teacher changes the current lesson attendance',
  () => {
    assert.match(
      viewSource,
      /persistedAttendanceByStudent/
    )

    assert.match(
      viewSource,
      /attendanceDelta/
    )

    assert.match(
      viewSource,
      /displayedAbsencePeriods/
    )

    assert.match(
      viewSource,
      /displayedAbsencePercent/
    )
  }
)

test(
  'annual absence periods come from the full discipline workload calculation',
  () => {
    assert.match(
      repositorySource,
      /annualAbsencePeriods:\s*metrics\.absencePeriods/
    )

    assert.match(
      repositorySource,
      /annualPlannedPeriods:\s*metrics\.plannedPeriods/
    )
  }
)
