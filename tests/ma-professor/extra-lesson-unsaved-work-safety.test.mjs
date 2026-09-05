import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/ExtraLessonDialog.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'extra lesson tracks user-made changes without treating async suggestion refreshes as edits',
  () => {
    assert.match(source, /hasUserChanges/)
    assert.match(source, /markUserChange/)
    assert.match(source, /onChangeCapture=\{markUserChange\}/)
    assert.match(
      source,
      /loadSelectionContext[\s\S]*setForm\(\(current\)[\s\S]*currentModuleStillExists/
    )
  }
)

test(
  'buttons that fill or alter the extra lesson explicitly mark user changes',
  () => {
    assert.match(
      source,
      /handleStatusChange[\s\S]*markUserChange\(\)/
    )
    assert.match(
      source,
      /applyScheduleSlot[\s\S]*markUserChange\(\)/
    )
    assert.match(
      source,
      /copyPreviousLesson[\s\S]*markUserChange\(\)/
    )
    assert.match(
      source,
      /usePlanificationItem[\s\S]*markUserChange\(\)/
    )
    assert.match(
      source,
      /disconnectPlanification[\s\S]*markUserChange\(\)/
    )
  }
)

test(
  'all destructive close paths use one shared confirmation',
  () => {
    assert.match(source, /confirmDiscardExtraLessonChanges/)
    assert.match(source, /requestClose/)
    assert.match(
      source,
      /event\.key === 'Escape'[\s\S]*requestClose\(\)/
    )
    assert.match(
      source,
      /event\.target === event\.currentTarget[\s\S]*requestClose\(\)/
    )
    assert.ok(
      (source.match(/onClick=\{requestClose\}/g) ?? []).length >= 2,
      'header close and footer Cancelar must both use requestClose'
    )
  }
)

test(
  'browser close and external navigation are protected while the extra lesson has user changes',
  () => {
    assert.match(source, /rootRef/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUserChanges/
    )
    assert.match(source, /ref=\{rootRef\}/)
  }
)
