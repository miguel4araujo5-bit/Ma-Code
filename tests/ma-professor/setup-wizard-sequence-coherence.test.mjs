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
  ['modules', 4, 'Organização curricular'],
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
  'setup areas stay navigable even when earlier areas are incomplete',
  () => {
    assert.match(
      wizardSource,
      /function isStepUnlocked\(_stepId: SetupStepId\) \{\s*return true\s*\}/
    )
    assert.match(
      wizardSource,
      /Pode abrir qualquer área, saltar o que ainda não tem e voltar mais tarde\./
    )
    assert.doesNotMatch(
      wizardSource,
      /(?:^|\s)disabled=\{!unlocked\}/m
    )
    assert.doesNotMatch(
      wizardSource,
      /cursor-not-allowed border-white\/\[0\.06\]/
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

test(
  'guided setup places students after criteria and before ready',
  () => {
    assert.match(
      wizardSource,
      /type GuidedStage =[\s\S]*\| 'criteria'[\s\S]*\| 'students'[\s\S]*\| 'ready'/
    )
    assert.match(
      wizardSource,
      /setGuidedStage\('students'\)[\s\S]*Continuar para alunos/
    )
    assert.match(
      wizardSource,
      /guidedStage === 'students'[\s\S]*<StudentsSetupStep[\s\S]*onCompleted=\{handleGuidedStudentsCompleted\}/
    )
    assert.match(
      wizardSource,
      /function handleGuidedStudentsCompleted\([\s\S]*setGuidedStage\('ready'\)/
    )
    assert.match(
      wizardSource,
      /\{ id: 'students', number: 4, label: 'Alunos', done: studentsReady \}/
    )
  }
)

test(
  'guided setup can safely reach final confirmation after students',
  () => {
    assert.match(
      wizardSource,
      /async function reconcileGuidedSetupProgress\([\s\S]*completeSetupStep/
    )
    assert.match(
      wizardSource,
      /async function openGuidedConfirmation\([\s\S]*reconcileGuidedSetupProgress[\s\S]*setGuidedStage\('confirmation'\)/
    )
    assert.match(
      wizardSource,
      /hasGuidedSetupCoverage\(nextSnapshot\)[\s\S]*openGuidedConfirmation\(nextSnapshot\)/
    )
    assert.match(
      wizardSource,
      /guidedStage === 'confirmation'[\s\S]*<SetupConfirmationStep[\s\S]*onCompleted=\{onCompleted\}/
    )
    assert.match(
      wizardSource,
      /Concluir configuração/
    )
  }
)

test(
  'completed setup can reopen directly in advanced correction mode',
  () => {
    assert.match(
      wizardSource,
      /initialMode\?: 'guided' \| 'advanced'/,
      'O assistente deve poder ser aberto explicitamente em modo avançado.'
    )
    assert.match(
      wizardSource,
      /initialMode = 'guided'/,
      'O primeiro onboarding deve continuar a abrir no percurso simples por defeito.'
    )
    assert.match(
      wizardSource,
      /const setupAlreadyCompleted = Boolean\([\s\S]*setupCompletedAt[\s\S]*completedAt/,
      'A reabertura deve distinguir um ano já concluído sem limpar o seu estado.'
    )
    assert.match(
      wizardSource,
      /initialMode === 'advanced'[\s\S]*setupAlreadyCompleted[\s\S]*\? 'weekly_schedule'[\s\S]*: getFirstIncompleteStep\(snapshot\)/,
      'Uma correção avançada de configuração concluída deve abrir numa área editável, não ficar presa na confirmação.'
    )
    assert.match(
      wizardSource,
      /function isStepUnlocked\(_stepId: SetupStepId\) \{\s*return true\s*\}/,
      'No modo avançado o professor deve continuar a poder abrir qualquer passo anterior.'
    )
  }
)

test(
  'setup scrolls to the top after the newly selected screen has rendered',
  () => {
    assert.match(
      wizardSource,
      /useEffect\(\(\) => \{[\s\S]*requestAnimationFrame[\s\S]*window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/
    )
    assert.match(
      wizardSource,
      /\}, \[advancedMode, guidedStage, activeStep\]\)/
    )
  }
)


test(
  'guided students can be left pending without marking the advanced students step as complete',
  () => {
    assert.match(
      wizardSource,
      /<StudentsSetupStep[\s\S]*allowIncompleteContinue/
    )
    assert.match(
      stepSources.get('students'),
      /allowIncompleteContinue\?: boolean/
    )
    assert.match(
      stepSources.get('students'),
      /studentsIncomplete[\s\S]*allowIncompleteContinue[\s\S]*onCompleted\(\s*snapshot\s*\)/
    )
    assert.match(
      stepSources.get('students'),
      /Continuar e completar alunos mais tarde/
    )
  }
)

test(
  'guided numbering is explicitly distinct from the nine-step advanced sequence',
  () => {
    assert.match(
      wizardSource,
      /Configuração rápida · Etapa 2 de 4/
    )
    assert.match(
      wizardSource,
      /Configuração rápida · Etapa 3 de 4/
    )
    assert.match(
      wizardSource,
      /Configuração rápida · Etapa 4 de 4/
    )
    assert.match(
      wizardSource,
      /Passo \{activeStepDefinition\.number\} de \{totalSetupSteps\}/
    )
  }
)

test(
  'advanced completion indicators are recomputed from current setup data',
  () => {
    assert.match(
      wizardSource,
      /function getCurrentCompletedSteps\(snapshot: SetupSnapshot\)/
    )
    assert.match(
      wizardSource,
      /hasModuleCoverage\(snapshot\)/
    )
    assert.match(
      wizardSource,
      /hasCompleteScheduleCoverage\(snapshot\)/
    )
    assert.match(
      wizardSource,
      /hasCriteriaCoverage\(snapshot\)/
    )
    assert.match(
      wizardSource,
      /hasPlanificationCoverage\(snapshot\)/
    )
    assert.match(
      wizardSource,
      /hasStudentCoverage\(snapshot\)/
    )
    assert.match(
      wizardSource,
      /getFirstIncompleteStep[\s\S]*getCurrentCompletedSteps\(snapshot\)/
    )
  }
)
