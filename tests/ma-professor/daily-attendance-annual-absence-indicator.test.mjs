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
  'daily attendance shows only persisted absence totals so the count changes after the lesson is saved',
  () => {
    assert.doesNotMatch(
      viewSource,
      /attendanceDelta/
    )

    assert.doesNotMatch(
      viewSource,
      /displayedAbsencePeriods/
    )

    assert.match(
      viewSource,
      /annualAbsencePeriods/
    )

    assert.match(
      viewSource,
      /absencePercent/
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


test(
  'annual warnings count persisted attendance only after the lesson is effectively taught, including future lessons submitted to GIAE',
  () => {
    assert.match(
      repositorySource,
      /lesson\.status ===[\s\S]*'taught'[\s\S]*attendanceByLesson\.has\([\s\S]*lesson\.id/s
    )

    assert.doesNotMatch(
      repositorySource,
      /lesson\.status !==[\s\S]*'cancelled'[\s\S]*attendanceByLesson\.has\([\s\S]*lesson\.id/s
    )
  }
)
