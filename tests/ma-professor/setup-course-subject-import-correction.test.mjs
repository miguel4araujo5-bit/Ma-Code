import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const scheduleSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx',
      import.meta.url
    ),
    'utf8'
  )

const subjectsSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/setup/SubjectsSetupStep.tsx',
      import.meta.url
    ),
    'utf8'
  )

const correctionSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/setup/subjectSetupCorrectionRepository.ts',
      import.meta.url
    ),
    'utf8'
  )

test(
  'schedule import never silently persists ambiguous short labels as subjects',
  () => {
    assert.match(
      scheduleSource,
      /subjectConfirmed:\s*boolean/
    )
    assert.match(
      scheduleSource,
      /ambiguousShortLabel/
    )
    assert.match(
      scheduleSource,
      /unconfirmedSubjects\.length\s*>\s*0/
    )
    assert.match(
      scheduleSource,
      /Confirmar como disciplina/
    )
    assert.match(
      scheduleSource,
      /siglas ambíguas sem confirmação/
    )
    assert.match(
      scheduleSource,
      /name:\s*'Área de Expressões'[\s\S]*aliases:\s*\['AE'\]/
    )
    assert.match(
      scheduleSource,
      /name:\s*'Animação Sociocultural'[\s\S]*aliases:\s*\['ASC'\]/
    )
  }
)

test(
  'saved subject-group associations can be corrected during setup',
  () => {
    assert.match(
      subjectsSource,
      /removeSubjectAssignmentsFromSetup/
    )
    assert.match(
      subjectsSource,
      /removeSubjectFromSetup/
    )
    assert.match(
      subjectsSource,
      /Eliminar disciplina/
    )
    assert.doesNotMatch(
      subjectsSource,
      /if\s*\(existingAssignments\.has\(groupId\)\)\s*\{\s*return/
    )
  }
)

test(
  'setup correction removes only setup schedule data and blocks pedagogical data deletion',
  () => {
    for (const protectedTable of [
      'modules',
      'assessmentSchemes',
      'planifications',
      'schoolCalendarEvents',
      'lessons',
      'lessonAssessments',
      'moduleFinalGrades',
      'learningRecoveries'
    ]) {
      assert.match(
        correctionSource,
        new RegExp(`maProfessorDb\\.${protectedTable}`)
      )
    }

    assert.match(
      correctionSource,
      /weeklyScheduleSlots[\s\S]*\.delete\(\)/
    )
    assert.match(
      correctionSource,
      /não os apaga automaticamente/
    )
  }
)
