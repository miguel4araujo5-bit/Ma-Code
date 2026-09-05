import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/groups/GroupsWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'groups preserve dirty student and group drafts across non-destructive snapshot refreshes',
  () => {
    assert.match(source, /reconcileMAProfessorDraftRecord/)
    assert.match(source, /previousPersistedStudentFormsRef/)
    assert.match(source, /previousPersistedGroupFormRef/)
    assert.match(source, /hasMAProfessorDirtyDraftRecord/)
  }
)

test(
  'groups protect destructive refresh and group changes when work is unsaved',
  () => {
    assert.match(source, /hasGroupsUnsavedChanges/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /handleGroupFilterChange[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onFiltersChange/
    )
    assert.match(
      source,
      /handleRefresh[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onRefresh/
    )
  }
)

test(
  'snapshot refresh does not silently erase pending student import text',
  () => {
    const refreshEffectStart = source.indexOf('snapshot.generatedAt')
    assert.ok(refreshEffectStart >= 0)

    const refreshEffect = source.slice(
      Math.max(0, refreshEffectStart - 1500),
      refreshEffectStart + 1500
    )

    assert.doesNotMatch(
      refreshEffect,
      /setImportText\(\s*['"]{2}\s*\)/
    )
  }
)
