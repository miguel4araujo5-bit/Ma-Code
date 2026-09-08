import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const productSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/ScheduleProductWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

const dutyViewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/schedule/RecurringDutyQuickAdd.tsx',
    import.meta.url
  ),
  'utf8'
)

const dutyRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/schedule/recurringDutySchedule.ts',
    import.meta.url
  ),
  'utf8'
)

test('normal schedule workspace exposes a dedicated post-import duty action', () => {
  assert.match(
    productSource,
    /import RecurringDutyQuickAdd/
  )
  assert.match(
    productSource,
    /<RecurringDutyQuickAdd/
  )
  assert.match(
    dutyViewSource,
    /\+ Cargo \/ componente não letiva/
  )
  assert.match(
    dutyViewSource,
    /Adicionar cargo ao horário/
  )
  assert.match(
    dutyViewSource,
    /«\+ Bloco de horário»/
  )
})

test('post-import duty uses the same recurring calendar-event contract as PDF import', () => {
  assert.match(
    dutyViewSource,
    /maProfessorRepository\.getTeacherProfile\(\)/
  )
  assert.match(
    dutyViewSource,
    /createRecurringDutySchedule\(/
  )
  assert.match(
    dutyRepositorySource,
    /getDutyDatesForSchool\(/
  )
  assert.match(
    dutyRepositorySource,
    /`Cargo · \$\{clean\(name\)\} · \$\{startTime\}–\$\{endTime\}`/
  )
  assert.match(
    dutyRepositorySource,
    /type:\s*'school_activity'/
  )
  assert.match(
    dutyRepositorySource,
    /scope:\s*'all'/
  )
  assert.match(
    dutyRepositorySource,
    /blocksLessons: false/
  )
})

test('post-import duty scheduling is retry-safe for already-created occurrences', () => {
  assert.match(
    dutyRepositorySource,
    /existingKeys\.has\(key\)/
  )
  assert.match(
    dutyRepositorySource,
    /existingKeys\.add\(key\)/
  )
  assert.match(
    dutyViewSource,
    /Este cargo já estava programado nas datas aplicáveis\./
  )
})

test('unsaved recurring duty editing remains protected', () => {
  assert.match(
    dutyViewSource,
    /useMAProfessorUnsavedWorkspaceProtection\(/
  )
  assert.match(
    dutyViewSource,
    /Existe um cargo por guardar\./
  )
  assert.match(
    dutyViewSource,
    /window\.confirm\(/
  )
})
