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

const baseSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/LessonEditorDialogBase.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'lesson editor tracks dirty state across lesson, attendance and assessment drafts',
  () => {
    assert.match(editorSource, /formDirty/)
    assert.match(editorSource, /attendanceDirty/)
    assert.match(editorSource, /assessmentDirty/)
    assert.match(editorSource, /hasUnsavedLessonChanges/)
    assert.match(
      editorSource,
      /formDirty\s*\|\|[\s\S]*attendanceDirty\s*\|\|[\s\S]*assessmentDirty/
    )
  }
)

test(
  'all original lesson editor close paths are routed through one protected onClose callback and browser unload is protected',
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
      /onClose=\{requestClose\}/
    )

    assert.match(
      baseSource,
      /event\.key === 'Escape'[\s\S]*onClose\(\)/
    )
    assert.match(
      baseSource,
      /event\.target === event\.currentTarget[\s\S]*onClose\(\)/
    )
    assert.ok(
      (baseSource.match(/onClick=\{onClose\}/g) ?? []).length >= 2,
      'header and footer close buttons must both route through the protected onClose prop'
    )
  }
)

test(
  'attendance interactions are tracked and cannot be silently dropped by saving the lesson as non-taught',
  () => {
    assert.match(editorSource, /handleAttendanceClickCapture/)
    assert.match(editorSource, /Assiduidade/)
    assert.match(editorSource, /Marcar todos presentes/)
    assert.match(editorSource, /label === 'Presente'/)
    assert.match(editorSource, /label === 'Falta'/)
    assert.match(
      editorSource,
      /currentStatus !== 'taught'[\s\S]*attendanceDirty[\s\S]*event\.preventDefault\(\)/
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
    assert.match(editorSource, /Avaliações da aula/)
    assert.match(editorSource, /label === '\+ Nova avaliação'/)
    assert.match(editorSource, /label !== 'Remover nova avaliação'/)
    assert.match(
      editorSource,
      /window\.confirm\([\s\S]*ASSESSMENT_REMOVE_MESSAGE/
    )
    assert.match(editorSource, /event\.preventDefault\(\)/)
    assert.match(editorSource, /event\.stopPropagation\(\)/)
    assert.match(
      editorSource,
      /event\.nativeEvent\.stopImmediatePropagation\(\)/
    )
  }
)

test(
  'successful full save clears the wrapper dirty flags before handing control back to the application',
  () => {
    assert.match(
      editorSource,
      /async function handleSaved[\s\S]*setFormDirty\(false\)[\s\S]*setAttendanceDirty\(false\)[\s\S]*setAssessmentDirty\(false\)[\s\S]*props\.onSaved/
    )
  }
)
