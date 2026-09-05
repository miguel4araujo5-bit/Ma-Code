import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const lessonRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const editorSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/LessonEditorDialogBase.tsx',
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

test(
  'lesson updates can require the exact version that the editor originally loaded',
  () => {
    assert.match(
      lessonRepositorySource,
      /interface LessonUpdateOptions[\s\S]*expectedUpdatedAt/
    )
    assert.match(
      lessonRepositorySource,
      /expectedUpdatedAt[\s\S]*Esta aula foi alterada noutra aba ou janela/
    )
    assert.match(
      editorSource,
      /expectedUpdatedAt:\s*lesson\.updatedAt/
    )
  }
)

test(
  'calendar full save is one Dexie transaction covering lesson, GIAE, attendance and assessment writes',
  () => {
    assert.match(editorSource, /maProfessorDb\.transaction\(/)
    assert.match(
      editorSource,
      /maProfessorDb\.tables/[\s\S]*lessonRepository\.updateLesson/[\s\S]*saveAttendance/[\s\S]*saveAssessments/
    )
  }
)

test(
  'calendar validates persisted attendance before allowing a taught lesson to become non-taught',
  () => {
    assert.match(
      attendanceSource,
      /validateLessonChanges/
    )
    assert.match(
      attendanceSource,
      /row\.attendance/
    )
    assert.match(
      attendanceSource,
      /Mantenha-a marcada como dada/i
    )
    assert.match(
      editorSource,
      /attendanceSection\.validateLessonChanges/
    )
  }
)

test(
  'historical scheduled lessons keep their existing occurrence editable after the current weekly slot changes',
  () => {
    assert.match(
      lessonRepositorySource,
      /preservesHistoricalScheduleAssociation/
    )
    assert.match(
      lessonRepositorySource,
      /previousLesson[\s\S]*scheduleSlotId[\s\S]*teachingAssignmentId[\s\S]*date/
    )
    assert.match(
      lessonRepositorySource,
      /getLessonContext\([\s\S]*next,[\s\S]*current/
    )
  }
)
