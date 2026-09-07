import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function readSetupSource(fileName) {
  return readFile(
    new URL(
      `../../src/components/ma-professor/setup/${fileName}`,
      import.meta.url
    ),
    'utf8'
  )
}

const progressionCases = [
  ['GroupsSetupStep.tsx', 'Continuar para as disciplinas'],
  ['SubjectsSetupStep.tsx', 'Continuar para UFCD / módulos'],
  ['ModulesSetupStep.tsx', 'Continuar para o horário semanal'],
  ['WeeklyScheduleSetupStep.tsx', 'Guardar horário e continuar'],
  ['AssessmentCriteriaSetupStep.tsx', 'Guardar critérios e continuar'],
  ['PlanificationsSetupStep.tsx', 'Guardar planificações e continuar'],
  ['StudentsSetupStep.tsx', 'Guardar alunos e continuar']
]

const progressionSources = new Map(
  await Promise.all(
    progressionCases.map(async ([fileName]) => [
      fileName,
      await readSetupSource(fileName)
    ])
  )
)

const confirmationSource = await readSetupSource(
  'SetupConfirmationStep.tsx'
)
const wizardSource = await readSetupSource(
  'SetupWizard.tsx'
)
const scheduleImportSource = await readSetupSource(
  'SchedulePdfImportStep.tsx'
)

test(
  'primary progression actions use the cyan setup CTA and expose focus-visible state',
  () => {
    for (const [fileName, label] of progressionCases) {
      const source = progressionSources.get(fileName)
      const buttonStart = source.lastIndexOf('<button', source.indexOf(label))
      const buttonEnd = source.indexOf('</button>', source.indexOf(label))
      const buttonSource = source.slice(buttonStart, buttonEnd)

      assert.match(buttonSource, /border-cyan-200\/45/)
      assert.match(buttonSource, /from-cyan-300/)
      assert.match(buttonSource, /focus-visible:ring-cyan-200\/30/)
      assert.doesNotMatch(buttonSource, /violet/)
    }
  }
)

test(
  'real setup completion is visually distinct in emerald',
  () => {
    const label = 'Concluir configuração e abrir o painel'
    const buttonStart = confirmationSource.lastIndexOf(
      '<button',
      confirmationSource.indexOf(label)
    )
    const buttonEnd = confirmationSource.indexOf(
      '</button>',
      confirmationSource.indexOf(label)
    )
    const buttonSource = confirmationSource.slice(
      buttonStart,
      buttonEnd
    )

    assert.match(buttonSource, /border-emerald-200\/45/)
    assert.match(buttonSource, /from-emerald-300/)
    assert.match(buttonSource, /focus-visible:ring-emerald-200\/30/)
  }
)

test(
  'secondary bypass and return-to-current-step actions remain neutral',
  () => {
    const bypassLabel = 'Continuar sem PDF'
    const bypassStart = scheduleImportSource.lastIndexOf(
      '<button',
      scheduleImportSource.indexOf(bypassLabel)
    )
    const bypassEnd = scheduleImportSource.indexOf(
      '</button>',
      scheduleImportSource.indexOf(bypassLabel)
    )
    const bypassSource = scheduleImportSource.slice(
      bypassStart,
      bypassEnd
    )

    assert.match(bypassSource, /border-white\/10/)
    assert.doesNotMatch(bypassSource, /bg-gradient-to-r/)

    const currentStepLabel = 'Ir para o passo atual'
    const currentStart = wizardSource.lastIndexOf(
      '<button',
      wizardSource.indexOf(currentStepLabel)
    )
    const currentEnd = wizardSource.indexOf(
      '</button>',
      wizardSource.indexOf(currentStepLabel)
    )
    const currentSource = wizardSource.slice(
      currentStart,
      currentEnd
    )

    assert.match(currentSource, /border-white\/10/)
    assert.doesNotMatch(currentSource, /violet/)
  }
)

test(
  'wizard progress bar uses cyan without introducing a competing violet progression gradient',
  () => {
    assert.match(
      wizardSource,
      /h-full rounded-full bg-cyan-300 transition-\[width\]/
    )
    assert.doesNotMatch(
      wizardSource,
      /bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 transition-\[width\]/
    )
  }
)
