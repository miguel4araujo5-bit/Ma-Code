import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/PlanificationsSetupStep.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'planifications setup derives meaningful unsaved work from edited planification content',
  () => {
    assert.match(source, /hasUnsavedPlanificationDraft/)
    assert.match(source, /defaultPlanificationTitle/)
    assert.match(source, /form\.title\s*!==\s*defaultPlanificationTitle/)
    assert.match(source, /form\.description\.trim\(\)/)
    assert.match(source, /items\.length\s*!==\s*1/)
    assert.match(source, /meaningfulItems\.length\s*>\s*0/)
    assert.match(source, /importText\.trim\(\)/)
  }
)

test(
  'planifications setup protects browser close and navigation to another setup step',
  () => {
    assert.match(source, /rootRef/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedPlanificationDraft[\s\S]*rootRef/
    )
    assert.match(source, /ref=\{rootRef\}/)
  }
)

test(
  'planifications setup does not silently replace or clear a dirty draft',
  () => {
    assert.match(source, /confirmDiscardPlanificationDraft/)
    assert.match(source, /requestSelectAssignment/)
    assert.match(source, /requestSelectModule/)
    assert.match(source, /requestSelectModuleFromList/)
    assert.match(source, /requestResetForm/)
    assert.match(
      source,
      /function requestSelectAssignment\([\s\S]*confirmDiscardPlanificationDraft\(\)/
    )
    assert.match(
      source,
      /function requestSelectModule\([\s\S]*confirmDiscardPlanificationDraft\(\)/
    )
    assert.match(
      source,
      /function requestSelectModuleFromList\([\s\S]*confirmDiscardPlanificationDraft\(\)/
    )
    assert.match(
      source,
      /function requestResetForm\(\)[\s\S]*confirmDiscardPlanificationDraft\(\)/
    )
    assert.match(source, /onClick=\{\s*requestResetForm\s*\}/)
  }
)

test(
  'planifications setup refuses to continue while meaningful local work is still unsaved',
  () => {
    assert.match(
      source,
      /async function handleContinue\(\)[\s\S]*hasUnsavedPlanificationDraft[\s\S]*Existem alterações por guardar neste passo/
    )
    assert.match(
      source,
      /hasUnsavedPlanificationDraft[\s\S]*return[\s\S]*completeSetupStep/
    )
  }
)
