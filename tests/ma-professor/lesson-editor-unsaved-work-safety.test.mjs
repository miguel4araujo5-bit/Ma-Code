import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const editorSource = await readFile(
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

const assessmentSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/DailyLessonAssessmentSection.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'lesson editor tracks dirty state across lesson, attendance and assessment drafts',
  () => {
    assert.match(editorSource, /formBaselineRef/)
    assert.match(editorSource, /attendanceDirty/)
    assert.match(editorSource, /assessmentDirty/)
    assert.match(editorSource, /hasUnsavedLessonChanges/)
    assert.match(
      editorSource,
      /JSON\.stringify\([\s\S]*form[\s\S]*formBaselineRef\.current/
    )
  }
)

test(
  'all lesson editor close paths require one shared discard confirmation and browser unload is protected',
  () => {
    assert.match(editorSource, /requestClose/)
    assert.match(editorSource, /confirmDiscardLessonChanges/)
    assert.match(
      editorSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )
    assert.match(
      editorSource,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedLessonChanges/
    )
    assert.match(
      editorSource,
      /event\.key === 'Escape'[\s\S]*requestClose\(\)/
    )
    assert.match(
      editorSource,
      /event\.target === event\.currentTarget[\s\S]*requestClose\(\)/
    )
    assert.ok(
      (editorSource.match(/onClick=\{requestClose\}/g) ?? []).length >= 2,
      'header and footer close buttons must both use requestClose'
    )
  }
)

test(
  'attendance reports dirty edits to the lesson editor and clears its baseline only after a successful save',
  () => {
    assert.match(attendanceSource, /onDirtyChange/)
    assert.match(attendanceSource, /attendanceBaselineRef/)
    assert.match(attendanceSource, /hasUnsavedAttendanceChanges/)
    assert.match(
      attendanceSource,
      /onDirtyChange\?\.\([\s\S]*hasUnsavedAttendanceChanges/
    )
    assert.match(
      attendanceSource,
      /saveLessonAttendance\([\s\S]*attendanceBaselineRef\.current/
    )
  }
)

test(
  'dirty attendance cannot be silently dropped by saving the lesson as non-taught',
  () => {
    assert.match(
      editorSource,
      /form\.status !== 'taught'[\s\S]*attendanceDirty[\s\S]*setError/
    )
    assert.match(
      editorSource,
      /alterações de assiduidade por guardar/i
    )
  }
)

test(
  'assessment edits report dirty state and removing a new assessment requires confirmation',
  () => {
    assert.match(assessmentSource, /onDirtyChange/)
    assert.match(assessmentSource, /hasUnsavedAssessmentChanges/)
    assert.match(
      assessmentSource,
      /Object\.values\(registers\)[\s\S]*state\.dirty/
    )
    assert.match(
      assessmentSource,
      /Boolean\(draft\?\.enabled\)/
    )
    assert.match(
      assessmentSource,
      /onDirtyChange\?\.\([\s\S]*hasUnsavedAssessmentChanges/
    )
    assert.match(
      assessmentSource,
      /cancelDraftAssessment[\s\S]*window\.confirm/
    )
  }
)
