import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const lessonRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonRepositoryBase.ts',
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
  'planned lessons may keep saved attendance when a summary exists, while cancelled lessons reject related data',
  async () => {
    assert.ok(saveSafetySource)

    const safety = await import(
      transpile(saveSafetySource)
    )

    assert.doesNotThrow(() =>
      safety.assertCalendarLessonRelatedDataCompatibility(
        'taught',
        3,
        2,
        true
      )
    )

    assert.doesNotThrow(() =>
      safety.assertCalendarLessonRelatedDataCompatibility(
        'planned',
        0,
        2,
        false
      )
    )

    assert.doesNotThrow(() =>
      safety.assertCalendarLessonRelatedDataCompatibility(
        'planned',
        1,
        0,
        true
      )
    )

    assert.doesNotThrow(() =>
      safety.assertCalendarLessonRelatedDataCompatibility(
        'cancelled',
        0,
        0,
        false
      )
    )

    assert.throws(
      () =>
        safety.assertCalendarLessonRelatedDataCompatibility(
          'planned',
          1,
          0,
          false
        ),
      /faltas[\s\S]*sumário/i
    )

    assert.throws(
      () =>
        safety.assertCalendarLessonRelatedDataCompatibility(
          'cancelled',
          1,
          0,
          true
        ),
      /faltas[\s\S]*cancelar/i
    )

    assert.throws(
      () =>
        safety.assertCalendarLessonRelatedDataCompatibility(
          'cancelled',
          0,
          1,
          false
        ),
      /avaliações[\s\S]*cancelar/i
    )
  }
)

test(
  'calendar validates related records against the effective persisted status after future-date normalization',
  () => {
    const updateIndex = editorSource.indexOf(
      'let savedLesson = await lessonRepository.updateLesson('
    )
    const safetyIndex = editorSource.indexOf(
      'assertCalendarLessonRelatedDataCompatibility(',
      updateIndex
    )

    assert.ok(updateIndex >= 0)
    assert.ok(safetyIndex > updateIndex)
    assert.match(
      editorSource.slice(safetyIndex),
      /assertCalendarLessonRelatedDataCompatibility\(\s*savedLesson\.status,\s*attendanceCount,\s*assessmentCount,\s*Boolean\([\s\S]*savedLesson\.summary\.trim\(\)[\s\S]*\)\s*\)/s
    )
  }
)

test(
  'calendar saves attendance for non-cancelled lessons with a summary, including future lessons that remain planned',
  () => {
    assert.match(
      editorSource,
      /savedLesson\.status !== 'cancelled'[\s\S]*savedLesson\.summary\.trim\(\)[\s\S]*saveAttendanceWhenReady/s
    )
    assert.match(
      editorSource,
      /if \(savedLesson\.status !== 'cancelled'\)[\s\S]*assessmentSection\.saveAssessments\(savedLesson\)/s
    )
    assert.match(
      editorSource,
      /form\.status !== 'cancelled'[\s\S]*form\.summary\.trim\(\)[\s\S]*<LessonAttendanceSection/s
    )
    assert.match(
      editorSource,
      /form\.status !== 'cancelled'[\s\S]*<DailyLessonAssessmentSection/s
    )
    assert.match(
      editorSource,
      /Se guardar um sumário,[\s\S]*faltas assinaladas ficam[\s\S]*Numa aula futura,[\s\S]*só entram no cálculo[\s\S]*GIAE[\s\S]*submetida/i
    )
  }
)

test(
  'assessment section persists pending grades on planned lessons and still protects cancelled lessons',
  () => {
    assert.doesNotMatch(
      assessmentSectionSource,
      /if \(lesson\.status !== 'taught'\) \{\s*return\s*\}/
    )
    assert.match(
      assessmentSectionSource,
      /if \(lesson\.status === 'cancelled'\)[\s\S]*Não é possível guardar avaliações numa aula cancelada/s
    )
    assert.match(
      assessmentSectionSource,
      /changes\.status === 'cancelled'[\s\S]*Elimine primeiro as avaliações associadas antes de a cancelar/s
    )
    assert.match(
      assessmentSectionSource,
      /hasPendingAssessmentChanges[\s\S]*hasDraftAssessment[\s\S]*hasDirtyRegisters/s
    )
    assert.match(
      assessmentSectionSource,
      /se a data continuar no futuro,[\s\S]*a aula permanece planeada e a avaliação fica guardada/
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
