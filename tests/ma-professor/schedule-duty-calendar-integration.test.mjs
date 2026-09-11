import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleImportAtomicRepository.ts',
    import.meta.url
  ),
  'utf8'
)

test('schedule import passes the current school calendar into duty date selection', () => {
  assert.match(
    source,
    /getDutyDatesForSchool\(\s*academicYear,\s*duty\.weekday,\s*schoolName,\s*eventRows\s*\)/s
  )
})
