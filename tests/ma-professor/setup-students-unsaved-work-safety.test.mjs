import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/StudentsSetupStep.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'students setup derives meaningful unsaved work from new rows, persisted edits and pending import text',
  () => {
    assert.match(source, /hasUnsavedNewStudentRows/)
    assert.match(source, /hasDirtyPersistedStudentRows/)
    assert.match(source, /hasPendingStudentImport/)
    assert.match(source, /hasUnsavedStudentsSetupChanges/)
    assert.match(source, /!row\.persisted\s*&&\s*isMeaningfulRow\(row\)/)
    assert.match(source, /row\.name\s*!==\s*persistedStudent\.name/)
    assert.match(source, /row\.notes\s*!==\s*persistedStudent\.notes/)
    assert.match(source, /Boolean\(\s*importText\.trim\(\)\s*\)/)
  }
)

test(
  'students setup protects browser close and navigation to another setup step',
  () => {
    assert.match(source, /rootRef/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedStudentsSetupChanges[\s\S]*rootRef/
    )
    assert.match(source, /ref=\{rootRef\}/)
  }
)

test(
  'students setup does not silently replace a dirty class draft',
  () => {
    assert.match(source, /confirmDiscardStudentDraft/)
    assert.match(source, /requestSelectGroup/)
    assert.match(
      source,
      /function requestSelectGroup\([\s\S]*confirmDiscardStudentDraft\(\)/
    )
    assert.match(source, /requestSelectGroup\(\s*event\.target\.value\s*\)/)
    assert.match(source, /requestSelectGroup\(\s*group\.id\s*\)/)
  }
)

test(
  'students setup only confirms Limpar novos when that action will discard new work or pending import text',
  () => {
    assert.match(source, /hasDiscardableNewStudentWork/)
    assert.match(source, /requestClearUnsavedRows/)
    assert.match(source, /confirmDiscardNewStudentWork/)
    assert.match(
      source,
      /function requestClearUnsavedRows\(\)[\s\S]*confirmDiscardNewStudentWork\(\)/
    )
    assert.match(source, /onClick=\{\s*requestClearUnsavedRows\s*\}/)
  }
)

test(
  'students setup refuses to continue while meaningful local work is still unsaved',
  () => {
    assert.match(
      source,
      /async function handleContinue\(\)[\s\S]*hasUnsavedStudentsSetupChanges[\s\S]*Existem alterações por guardar neste passo/
    )
    assert.match(
      source,
      /hasUnsavedStudentsSetupChanges[\s\S]*return[\s\S]*completeSetupStep/
    )
  }
)
