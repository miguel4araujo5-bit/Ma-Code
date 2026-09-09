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

const modulesGuardSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/setup/ModulesSetupCourseSubjectGuard.tsx',
      import.meta.url
    ),
    'utf8'
  )

const setupWizardSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/setup/SetupWizard.tsx',
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

test(
  'legacy TAP course aliases are excluded from the UFCD step without mutating persisted data',
  () => {
    assert.match(
      modulesGuardSource,
      /'ap'[\s\S]*'tap'[\s\S]*'apoio psicossocial'[\s\S]*'tecnico de apoio psicossocial'/
    )
    assert.match(
      modulesGuardSource,
      /subjects:[\s\S]*!legacySubjectIds\.has/
    )
    assert.match(
      modulesGuardSource,
      /teachingAssignments:[\s\S]*!legacySubjectIds\.has/
    )
    assert.match(
      modulesGuardSource,
      /modules:[\s\S]*!legacyAssignmentIds\.has/
    )
    assert.match(
      modulesGuardSource,
      /Nenhum dado foi apagado, convertido ou reassociado automaticamente/
    )
    assert.doesNotMatch(
      modulesGuardSource,
      /maProfessorDb|createSubject|updateSubject|removeSubjectFromSetup/
    )
  }
)

test(
  'the UFCD step uses the legacy course-subject guard and offers explicit correction in Subjects',
  () => {
    assert.match(
      setupWizardSource,
      /ModulesSetupCourseSubjectGuard/
    )
    assert.match(
      setupWizardSource,
      /case 'modules':[\s\S]*ModulesSetupCourseSubjectGuard[\s\S]*navigateToStep\('subjects'\)/
    )
    assert.doesNotMatch(
      setupWizardSource,
      /case 'modules':\s*return <ModulesSetupStep/
    )
  }
)
