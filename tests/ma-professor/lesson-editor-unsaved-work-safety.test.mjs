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
  'attendance interactions are tracked and cannot be silently dropped by saving the lesson as non-taught',
  () => {
    assert.match(editorSource, /handleAttendanceClickCapture/)
    assert.match(editorSource, /onChangeCapture=\{handleAttendanceChangeCapture\}/)
    assert.match(editorSource, /onClickCapture=\{handleAttendanceClickCapture\}/)
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
  'assessment interactions are tracked and removing a new assessment requires confirmation',
  () => {
    assert.match(editorSource, /handleAssessmentClickCapture/)
    assert.match(editorSource, /onChangeCapture=\{handleAssessmentChangeCapture\}/)
    assert.match(editorSource, /onClickCapture=\{handleAssessmentClickCapture\}/)
    assert.match(editorSource, /Remover nova avaliação/)
    assert.match(
      editorSource,
      /Remover nova avaliação[\s\S]*window\.confirm|window\.confirm[\s\S]*Remover nova avaliação/
    )
    assert.match(editorSource, /event\.preventDefault\(\)/)
    assert.match(editorSource, /event\.stopPropagation\(\)/)
    assert.match(
      editorSource,
      /event\.nativeEvent\.stopImmediatePropagation\(\)/
    )
  }
)
