import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/WeeklyScheduleSetupStep.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'weekly schedule keeps an explicit form baseline and derives unsaved work from the whole slot draft',
  () => {
    assert.match(source, /scheduleFormBaseline/)
    assert.match(source, /areScheduleFormsEqual/)
    assert.match(source, /hasUnsavedScheduleDraft/)
    assert.match(
      source,
      /!areScheduleFormsEqual\(\s*form,\s*scheduleFormBaseline\s*\)/
    )
  }
)

test(
  'weekly schedule protects browser close and navigation away while dirty or saving',
  () => {
    assert.match(source, /rootRef/)
    assert.match(source, /hasProtectedScheduleWork/)
    assert.match(
      source,
      /hasUnsavedScheduleDraft\s*\|\|\s*busy/
    )
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasProtectedScheduleWork[\s\S]*rootRef/
    )
    assert.match(source, /ref=\{rootRef\}/)
  }
)

test(
  'weekly schedule confirms before retargeting or clearing a dirty slot draft',
  () => {
    assert.match(source, /confirmRetargetScheduleDraft/)
    assert.match(source, /requestSelectAssignment/)
    assert.match(source, /requestSelectAssignmentFromList/)
    assert.match(source, /requestResetForm/)
    assert.match(
      source,
      /function requestSelectAssignment\([\s\S]*confirmRetargetScheduleDraft\(\)/
    )
    assert.match(
      source,
      /function requestResetForm\([\s\S]*hasUnsavedScheduleDraft[\s\S]*window\.confirm/
    )
  }
)

test(
  'weekly schedule refuses to continue while the current slot draft is unsaved',
  () => {
    assert.match(
      source,
      /async function handleContinue\(\)[\s\S]*hasUnsavedScheduleDraft[\s\S]*Existe um bloco de horário por guardar neste passo/
    )
    assert.match(
      source,
      /hasUnsavedScheduleDraft[\s\S]*return[\s\S]*completeSetupStep/
    )
  }
)

test(
  'successful slot creation establishes the prepared next form as the new clean baseline',
  () => {
    assert.match(source, /const nextForm:\s*ScheduleFormState/)
    assert.match(
      source,
      /setForm\(nextForm\)[\s\S]*setScheduleFormBaseline\(nextForm\)/
    )
  }
)

test(
  'slot controls are frozen while a schedule write is in flight',
  () => {
    const disabledBusyCount =
      (source.match(/disabled=\{\s*busy\s*\}/g) ?? []).length

    assert.ok(
      disabledBusyCount >= 8,
      `expected at least 8 busy-disabled slot controls, found ${disabledBusyCount}`
    )
  }
)
