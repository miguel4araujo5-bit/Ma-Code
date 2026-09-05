import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/GroupsSetupStep.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'groups setup derives unsaved work from pending group selections and edited persisted values',
  () => {
    assert.match(source, /hasPendingGroupSelection/)
    assert.match(source, /selectedGroupNames\.length\s*>\s*0/)
    assert.match(source, /hasDirtyGroupEdit/)
    assert.match(source, /editForm\.name\s*!==\s*editingGroup\.name/)
    assert.match(source, /editForm\.courseName\s*!==\s*editingGroup\.courseName/)
    assert.match(source, /editForm\.gradeLevel\s*!==\s*editingGroup\.gradeLevel/)
    assert.match(source, /hasUnsavedGroupSetupChanges/)
  }
)

test(
  'groups setup protects browser close and navigation to another setup step',
  () => {
    assert.match(source, /rootRef/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedGroupSetupChanges[\s\S]*rootRef/
    )
    assert.match(source, /ref=\{rootRef\}/)
  }
)

test(
  'groups setup does not silently replace or cancel a dirty edit',
  () => {
    assert.match(source, /confirmDiscardDirtyGroupEdit/)
    assert.match(source, /requestStartEditing/)
    assert.match(source, /requestCancelEditing/)
    assert.match(
      source,
      /function requestStartEditing\([\s\S]*confirmDiscardDirtyGroupEdit\(\)/
    )
    assert.match(
      source,
      /function requestCancelEditing\(\)[\s\S]*confirmDiscardDirtyGroupEdit\(\)/
    )
    assert.match(source, /onClick=\{requestCancelEditing\}/)
    assert.match(source, /onClick=\{\(\) => requestStartEditing\(group\)\}/)
  }
)

test(
  'groups setup refuses to continue while meaningful local work is still unsaved',
  () => {
    assert.match(
      source,
      /async function handleContinue\(\)[\s\S]*hasUnsavedGroupSetupChanges[\s\S]*Existem alterações por guardar neste passo/
    )
    assert.match(
      source,
      /hasUnsavedGroupSetupChanges[\s\S]*return[\s\S]*completeSetupStep/
    )
  }
)
