import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const scheduleSource = await readFile(
  new URL(
    '../../src/components/ma-professor/schedule/ScheduleWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'open schedule and event drafts survive unrelated snapshot refreshes',
  () => {
    assert.match(
      scheduleSource,
      /snapshot\.generatedAt/
    )
    assert.match(
      scheduleSource,
      /!showSlotForm[\s\S]{0,120}!editingSlotId/
    )
    assert.match(
      scheduleSource,
      /!showEventForm[\s\S]{0,120}!editingEventId/
    )
  }
)

test(
  'schedule tracks separate baselines and dirty state for both forms',
  () => {
    assert.match(scheduleSource, /slotBaselineRef/)
    assert.match(scheduleSource, /eventBaselineRef/)
    assert.match(scheduleSource, /hasSlotUnsavedChanges/)
    assert.match(scheduleSource, /hasEventUnsavedChanges/)
    assert.match(scheduleSource, /hasScheduleUnsavedChanges/)
  }
)

test(
  'closing or cancelling either form requires confirmation only when that form is dirty',
  () => {
    assert.match(scheduleSource, /confirmDiscardSlotChanges/)
    assert.match(scheduleSource, /confirmDiscardEventChanges/)
    assert.match(
      scheduleSource,
      /handleSlotFormToggle[\s\S]*confirmDiscardSlotChanges/
    )
    assert.match(
      scheduleSource,
      /handleEventFormToggle[\s\S]*confirmDiscardEventChanges/
    )
    assert.match(
      scheduleSource,
      /handleCancelSlotEditing[\s\S]*confirmDiscardSlotChanges/
    )
    assert.match(
      scheduleSource,
      /handleCancelEventEditing[\s\S]*confirmDiscardEventChanges/
    )
  }
)

test(
  'opening another row cannot silently replace a dirty schedule or event draft',
  () => {
    assert.match(
      scheduleSource,
      /function editSlot[\s\S]*confirmDiscardSlotChanges/
    )
    assert.match(
      scheduleSource,
      /function editEvent[\s\S]*confirmDiscardEventChanges/
    )
  }
)

test(
  'schedule unsaved work is protected when leaving the workspace or closing the browser',
  () => {
    assert.match(
      scheduleSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )
    assert.match(scheduleSource, /rootRef/)
    assert.match(
      scheduleSource,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasScheduleUnsavedChanges/
    )
    assert.match(scheduleSource, /ref=\{rootRef\}/)
  }
)
