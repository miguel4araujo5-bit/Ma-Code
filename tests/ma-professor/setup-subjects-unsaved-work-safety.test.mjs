import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SubjectsSetupStep.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'subjects setup derives unsaved work for new drafts and real edits against persisted subject data',
  () => {
    assert.match(source, /hasUnsavedNewSubject/)
    assert.match(source, /hasDirtySubjectEdit/)
    assert.match(source, /editingSubject/)
    assert.match(source, /form\.name\s*!==\s*editingSubject\.name/)
    assert.match(source, /form\.shortName\s*!==\s*editingSubject\.shortName/)
    assert.match(source, /form\.code\s*!==\s*editingSubject\.code/)
    assert.match(source, /hasNewGroupAssignments/)
    assert.match(source, /hasUnsavedSubjectSetupChanges/)
  }
)

test(
  'subjects setup protects browser close and navigation to another setup step',
  () => {
    assert.match(source, /rootRef/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedSubjectSetupChanges[\s\S]*rootRef/
    )
    assert.match(source, /ref=\{rootRef\}/)
  }
)

test(
  'subjects setup confirms before replacing or clearing an unsaved draft',
  () => {
    assert.match(source, /confirmDiscardSubjectDraft/)
    assert.match(source, /requestChooseSuggestion/)
    assert.match(source, /requestChooseCustomSubject/)
    assert.match(source, /requestStartEditing/)
    assert.match(source, /requestResetForm/)
    assert.match(
      source,
      /function requestResetForm\(\)[\s\S]*confirmDiscardSubjectDraft\(\)/
    )
    assert.match(source, /onClick=\{requestResetForm\}/)
    assert.match(source, /onClick=\{\(\) => requestStartEditing\(subject\)\}/)
  }
)

test(
  'subjects setup refuses to continue while a local subject draft is unsaved',
  () => {
    assert.match(
      source,
      /async function handleContinue\(\)[\s\S]*hasUnsavedSubjectSetupChanges[\s\S]*Existem alterações por guardar neste passo/
    )
    assert.match(
      source,
      /hasUnsavedSubjectSetupChanges[\s\S]*return[\s\S]*completeSetupStep/
    )
  }
)
