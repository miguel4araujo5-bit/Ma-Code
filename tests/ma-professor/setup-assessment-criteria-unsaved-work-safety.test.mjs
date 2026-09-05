import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/AssessmentCriteriaSetupStep.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'assessment criteria setup derives meaningful unsaved work from the local draft',
  () => {
    assert.match(source, /hasUnsavedCriteriaDraft/)
    assert.match(source, /form\.scope\s*!==\s*emptyForm\.scope/)
    assert.match(source, /form\.moduleId\s*!==\s*emptyForm\.moduleId/)
    assert.match(source, /form\.schemeName\s*!==\s*emptyForm\.schemeName/)
    assert.match(source, /criteria\.length\s*!==\s*1/)
    assert.match(source, /criterion\.name\.trim\(\)/)
    assert.match(source, /criterion\.description\.trim\(\)/)
    assert.match(source, /criterion\.weightPercent/)
  }
)

test(
  'assessment criteria setup protects browser close and navigation to another setup step',
  () => {
    assert.match(source, /rootRef/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedCriteriaDraft[\s\S]*rootRef/
    )
    assert.match(source, /ref=\{rootRef\}/)
  }
)

test(
  'assessment criteria setup does not silently replace or clear a dirty draft',
  () => {
    assert.match(source, /confirmDiscardCriteriaDraft/)
    assert.match(source, /requestSelectAssignment/)
    assert.match(source, /requestResetForm/)
    assert.match(
      source,
      /function requestSelectAssignment\([\s\S]*confirmDiscardCriteriaDraft\(\)/
    )
    assert.match(
      source,
      /function requestResetForm\(\)[\s\S]*confirmDiscardCriteriaDraft\(\)/
    )
    assert.match(source, /requestSelectAssignment\(\s*event\.target\.value\s*\)/)
    assert.match(source, /onClick=\{\s*requestResetForm\s*\}/)
  }
)

test(
  'assessment criteria setup refuses to continue while meaningful local work is still unsaved',
  () => {
    assert.match(
      source,
      /async function handleContinue\(\)[\s\S]*hasUnsavedCriteriaDraft[\s\S]*Existem alterações por guardar neste passo/
    )
    assert.match(
      source,
      /hasUnsavedCriteriaDraft[\s\S]*return[\s\S]*completeSetupStep/
    )
  }
)
