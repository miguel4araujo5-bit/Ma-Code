import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

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

const assessmentSectionSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/DailyLessonAssessmentSection.tsx',
    import.meta.url
  ),
  'utf8'
)

const saveSafetySource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/calendarLessonSaveSafety.ts',
    import.meta.url
  ),
  'utf8'
).catch(() => '')

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )

  assert.equal(errors.length, 0)

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

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
      /maProfessorDb\.tables[\s\S]*lessonRepository\.updateLesson[\s\S]*saveAttendance[\s\S]*saveAssessments/
    )
  }
)

test(
  'non-taught lesson states reject persisted attendance or assessments',
  async () => {
    assert.ok(saveSafetySource)

    const safety = await import(
      transpile(saveSafetySource)
    )

    assert.doesNotThrow(() =>
      safety.assertCalendarLessonRelatedDataCompatibility(
        'taught',
        3,
        2
      )
    )

    assert.throws(
      () =>
        safety.assertCalendarLessonRelatedDataCompatibility(
          'planned',
          1,
          0
        ),
      /Mantenha-a marcada como dada/i
    )

    assert.throws(
      () =>
        safety.assertCalendarLessonRelatedDataCompatibility(
          'cancelled',
          0,
          1
        ),
      /Mantenha-a marcada como dada/i
    )

    assert.match(
      editorSource,
      /assertCalendarLessonRelatedDataCompatibility/
    )
    assert.match(
      editorSource,
      /lessonAttendance[\s\S]*lessonAssessments/
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

test(
  'a rolled-back full save clears only the transient new-assessment id so the draft can be retried safely',
  () => {
    assert.match(
      assessmentSectionSource,
      /resetTransientSaveState:\s*\(\)\s*=>\s*void/
    )
    assert.match(
      assessmentSectionSource,
      /resetTransientSaveState\(\)[\s\S]*draftCreatedAssessmentIdRef\.current\s*=\s*null/
    )
    assert.match(
      editorSource,
      /catch \(saveError\)[\s\S]*assessmentSectionRef\.current\?\.resetTransientSaveState\(\)/
    )
  }
)
