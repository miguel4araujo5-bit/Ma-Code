import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const appSource = await readFile(
  new URL(
    '../../src/components/ma-professor/MAProfessorApp.tsx',
    import.meta.url
  ),
  'utf8'
)

const wizardSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SetupWizard.tsx',
    import.meta.url
  ),
  'utf8'
)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/repository.ts',
    import.meta.url
  ),
  'utf8'
)

const stepSources = new Map(
  await Promise.all(
    [
      ['groups', 'GroupsSetupStep.tsx'],
      ['subjects', 'SubjectsSetupStep.tsx'],
      ['modules', 'ModulesSetupStep.tsx'],
      ['weekly_schedule', 'WeeklyScheduleSetupStep.tsx'],
      ['assessment_criteria', 'AssessmentCriteriaSetupStep.tsx'],
      ['planifications', 'PlanificationsSetupStep.tsx'],
      ['students', 'StudentsSetupStep.tsx'],
      ['confirmation', 'SetupConfirmationStep.tsx']
    ].map(async ([id, fileName]) => [
      id,
      await readFile(
        new URL(
          `../../src/components/ma-professor/setup/${fileName}`,
          import.meta.url
        ),
        'utf8'
      )
    ])
  )
)

const expectedSequence = [
  ['groups', 2, 'Turmas'],
  ['subjects', 3, 'Disciplinas'],
  ['modules', 4, 'UFCD ou módulos'],
  ['weekly_schedule', 5, 'Horário semanal'],
  ['assessment_criteria', 6, 'Critérios de avaliação'],
  ['planifications', 7, 'Planificações'],
  ['students', 8, 'Alunos'],
  ['confirmation', 9, 'Confirmação']
]

test(
  'academic year remains the first step of the nine-step onboarding',
  () => {
    assert.match(appSource, /Passo 1 de 9/)
  }
)

test(
  'setup wizard navigation numbers match the full onboarding sequence',
  () => {
    for (const [id, number, title] of expectedSequence) {
      const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      assert.match(
        wizardSource,
        new RegExp(
          `id: '${id}',\\s*number: ${number},\\s*title: '${escapedTitle}'`
        )
      )
    }

    assert.match(
      wizardSource,
      /const totalSetupSteps =\s*setupSteps\.length \+ 1/
    )
    assert.match(
      wizardSource,
      /completedCount =\s*completedSetupSteps \+ 1/
    )
    assert.match(
      wizardSource,
      /completionPercent = Math\.round\(\(completedCount \/ totalSetupSteps\) \* 100\)/
    )
    assert.match(
      wizardSource,
      /Passo \{activeStepDefinition\.number\} de \{totalSetupSteps\}/
    )
  }
)

test(
  'repository setup progression follows the same sequence as the wizard',
  () => {
    const match = repositorySource.match(
      /const SETUP_STEPS: SetupStepId\[\] = \[([\s\S]*?)\n\]/
    )

    assert.ok(match, 'missing SETUP_STEPS in repository')

    const repositoryStepIds = Array.from(
      match[1].matchAll(/'([^']+)'/g),
      result => result[1]
    )

    assert.deepEqual(
      repositoryStepIds,
      [
        'academic_year',
        ...expectedSequence.map(([id]) => id)
      ]
    )
  }
)

test(
  'each setup screen presents the same step number as the wizard navigation',
  () => {
    for (const [id, number] of expectedSequence) {
      const source = stepSources.get(id)

      assert.ok(source, `missing setup source for ${id}`)
      assert.match(
        source,
        new RegExp(`Passo ${number} de 9`),
        `${id} should present Passo ${number} de 9`
      )
    }
  }
)

test(
  'UFCD completion announces the weekly schedule that the wizard actually opens next',
  () => {
    const modulesSource = stepSources.get('modules')

    assert.ok(modulesSource)
    assert.match(
      modulesSource,
      /Continuar para o horário semanal/
    )
    assert.doesNotMatch(
      modulesSource,
      /Continuar para critérios de avaliação/
    )
  }
)

test(
  'operational-ready guidance lists the remaining setup work in wizard order',
  () => {
    assert.match(
      wizardSource,
      /continuar critérios, planificações e alunos mais tarde/
    )
  }
)
