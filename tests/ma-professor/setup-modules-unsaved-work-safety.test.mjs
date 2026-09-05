import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/ModulesSetupStep.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'modules setup treats both single-entry and bulk-entry content as unsaved work',
  () => {
    assert.match(source, /hasUnsavedSingleModuleDraft/)
    assert.match(source, /code\.trim\(\)/)
    assert.match(source, /name\.trim\(\)/)
    assert.match(source, /plannedPeriods\.trim\(\)/)
    assert.match(source, /hasUnsavedBulkModuleDraft/)
    assert.match(source, /bulkText\.trim\(\)/)
    assert.match(source, /hasUnsavedModuleDraft/)
  }
)

test(
  'modules setup protects browser close and navigation away from the setup step',
  () => {
    assert.match(source, /rootRef/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedModuleDraft[\s\S]*rootRef/
    )
    assert.match(source, /ref=\{rootRef\}/)
  }
)

test(
  'switching subject with a pending module draft requires explicit confirmation without silently clearing it',
  () => {
    assert.match(source, /confirmRetargetModuleDraft/)
    assert.match(source, /requestSelectSubject/)
    assert.match(
      source,
      /function requestSelectSubject\([\s\S]*confirmRetargetModuleDraft\(\)/
    )
    assert.match(
      source,
      /function requestSelectSubject\([\s\S]*setSelectedSubjectId\(subjectId\)/
    )
    assert.match(source, /onClick=\{\(\) =>\s*requestSelectSubject\(\s*subject\.id\s*\)\s*\}/)
  }
)

test(
  'saving one entry mode clears only that mode and preserves a draft in the other mode',
  () => {
    assert.match(
      source,
      /if \(\s*entryMode ===\s*'bulk'\s*\) \{\s*setBulkText\(''\)\s*\} else \{[\s\S]*setCode\(''\)[\s\S]*setName\(''\)[\s\S]*setPlannedPeriods\(''\)[\s\S]*\}/
    )
  }
)

test(
  'modules setup refuses to continue while either module-entry mode still contains unsaved work',
  () => {
    assert.match(
      source,
      /async function handleContinue\(\)[\s\S]*hasUnsavedModuleDraft[\s\S]*Existem UFCD ou módulos por guardar neste passo/
    )
    assert.match(
      source,
      /hasUnsavedModuleDraft[\s\S]*return[\s\S]*completeSetupStep/
    )
  }
)
