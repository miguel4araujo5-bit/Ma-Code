import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const groupsSource = await readFile(
  new URL(
    '../../src/components/ma-professor/groups/GroupsWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const scheduleSource = await readFile(
  new URL(
    '../../src/components/ma-professor/schedule/ScheduleWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const lessonEditorSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/LessonEditorDialog.tsx',
    import.meta.url
  ),
  'utf8'
)

const attendanceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/LessonAttendanceSection.tsx',
    import.meta.url
  ),
  'utf8'
)

const assessmentSectionSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/DailyLessonAssessmentSection.tsx',
    import.meta.url
  ),
  'utf8'
)

const extraLessonSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/ExtraLessonDialog.tsx',
    import.meta.url
  ),
  'utf8'
)

const calendarProductSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/CalendarProductWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'groups reconcile student drafts and protect destructive refresh/filter navigation',
  () => {
    assert.match(
      groupsSource,
      /reconcileMAProfessorDraftRecord/
    )
    assert.match(
      groupsSource,
      /previousPersistedStudentFormsRef/
    )
    assert.match(
      groupsSource,
      /hasGroupsUnsavedChanges/
    )
    assert.match(
      groupsSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )
    assert.match(
      groupsSource,
      /handleGroupFilterChange[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onFiltersChange/
    )
    assert.match(
      groupsSource,
      /handleRefresh[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onRefresh/
    )

    const refreshEffectStart =
      groupsSource.indexOf('snapshot.generatedAt')

    assert.ok(refreshEffectStart >= 0)

    const refreshEffect =
      groupsSource.slice(
        Math.max(0, refreshEffectStart - 1200),
        refreshEffectStart + 600
      )

    assert.doesNotMatch(
      refreshEffect,
      /setImportText\(\s*['"]{2}\s*\)/,
      'Um refresh não pode apagar silenciosamente a lista de alunos ainda não importada.'
    )
  }
)

test(
  'schedule keeps the other open draft across mutations and guards discard actions',
  () => {
    assert.match(
      scheduleSource,
      /slotBaselineRef/
    )
    assert.match(
      scheduleSource,
      /eventBaselineRef/
    )
    assert.match(
      scheduleSource,
      /hasScheduleUnsavedChanges/
    )
    assert.match(
      scheduleSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )
    assert.match(
      scheduleSource,
      /handleFiltersChange[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onFiltersChange/
    )
    assert.match(
      scheduleSource,
      /handleRefresh[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onRefresh/
    )
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
      /snapshot\.generatedAt[\s\S]*showSlotForm[\s\S]*showEventForm/
    )
  }
)

test(
  'lesson editor asks child attendance and assessment sections whether they are dirty before closing',
  () => {
    assert.match(
      attendanceSource,
      /hasUnsavedChanges:\s*\(\)\s*=>\s*boolean/
    )
    assert.match(
      assessmentSectionSource,
      /hasUnsavedChanges:\s*\(\)\s*=>\s*boolean/
    )
    assert.match(
      attendanceSource,
      /hasUnsavedChanges\(\)/
    )
    assert.match(
      assessmentSectionSource,
      /hasUnsavedChanges\(\)/
    )

    assert.match(
      lessonEditorSource,
      /hasUnsavedLessonChanges/
    )
    assert.match(
      lessonEditorSource,
      /attendanceSectionRef\.current\?\.hasUnsavedChanges/
    )
    assert.match(
      lessonEditorSource,
      /assessmentSectionRef\.current\?\.hasUnsavedChanges/
    )
    assert.match(
      lessonEditorSource,
      /requestClose/
    )
    assert.match(
      lessonEditorSource,
      /beforeunload/
    )

    assert.doesNotMatch(
      lessonEditorSource,
      /event\.key === ['"]Escape['"][\s\S]{0,120}onClose\(\)/,
      'Escape não pode contornar a proteção de alterações por guardar.'
    )
  }
)

test(
  'extra lesson dialog protects edited form data on Escape, backdrop and explicit cancel',
  () => {
    assert.match(
      extraLessonSource,
      /hasUserChanges/
    )
    assert.match(
      extraLessonSource,
      /requestClose/
    )
    assert.match(
      extraLessonSource,
      /beforeunload/
    )
    assert.match(
      extraLessonSource,
      /event\.key === ['"]Escape['"][\s\S]{0,180}requestClose\(\)/
    )
    assert.match(
      extraLessonSource,
      /event\.target === event\.currentTarget[\s\S]{0,180}requestClose\(\)/
    )
  }
)

test(
  'calendar quick event editor protects unsaved description or duty summary',
  () => {
    assert.match(
      calendarProductSource,
      /hasUnsavedEventText/
    )
    assert.match(
      calendarProductSource,
      /requestCloseEventEditor/
    )
    assert.match(
      calendarProductSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )
    assert.match(
      calendarProductSource,
      /eventText\s*!==\s*selectedEvent\.description/
    )
  }
)
