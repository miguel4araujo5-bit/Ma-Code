import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/product/CalendarProductWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'calendar event editor derives dirty state from the persisted event description',
  () => {
    assert.match(source, /hasUnsavedEventText/)
    assert.match(
      source,
      /eventText\s*!==\s*selectedEvent\.description/
    )
  }
)

test(
  'calendar event editor protects browser close and external navigation',
  () => {
    assert.match(source, /eventEditorRef/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedEventText[\s\S]*eventEditorRef/
    )
    assert.match(source, /ref=\{eventEditorRef\}/)
  }
)

test(
  'calendar event editor confirms before destructive close paths',
  () => {
    assert.match(source, /confirmDiscardEventTextChanges/)
    assert.match(source, /requestCloseEventEditor/)
    assert.match(
      source,
      /function requestCloseEventEditor\(\)[\s\S]*confirmDiscardEventTextChanges\(\)/
    )
    assert.ok(
      (source.match(/onClick=\{requestCloseEventEditor\}/g) ?? []).length >= 2,
      'header close and Cancelar must both use requestCloseEventEditor'
    )
  }
)

test(
  'saving keeps the existing explicit save flow and closes only after update succeeds',
  () => {
    assert.match(
      source,
      /await calendarRepository\.updateEvent\([\s\S]*setSelectedEvent\(updated\)[\s\S]*setEventText\(updated\.description\)[\s\S]*setSelectedEvent\(null\)/
    )
  }
)
