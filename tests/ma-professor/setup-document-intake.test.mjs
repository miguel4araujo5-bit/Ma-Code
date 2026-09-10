import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const intakeSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SetupDocumentIntakePanel.tsx',
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

const planificationPanelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/ModulePlanificationImportPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'the former multi-document classifier remains isolated and is no longer the default onboarding UI',
  () => {
    assert.match(
      intakeSource,
      /type="file"[\s\S]*?multiple[\s\S]*?accept="application\/pdf,\.pdf,\.docx/
    )
    assert.doesNotMatch(
      wizardSource,
      /SetupDocumentIntakePanel/
    )
    assert.doesNotMatch(
      wizardSource,
      /Dê ao MA-Professor os documentos que já utiliza/
    )
  }
)

test(
  'initial onboarding asks for schedule then planifications then criteria instead of exposing nine tasks at once',
  () => {
    assert.match(
      wizardSource,
      /type GuidedStage =[\s\S]*?'schedule'[\s\S]*?'planifications'[\s\S]*?'criteria'[\s\S]*?'ready'/
    )
    assert.match(wizardSource, /number: 1, label: 'Horário'/)
    assert.match(wizardSource, /number: 2, label: 'Planificações'/)
    assert.match(wizardSource, /number: 3, label: 'Critérios'/)
    assert.match(wizardSource, /Vamos preparar o essencial, um passo de cada vez\./)
    assert.match(wizardSource, /Configuração avançada \/ editar manualmente/)
  }
)

test(
  'guided onboarding uses the specialist importers directly and no longer hands files through the DOM',
  () => {
    assert.match(
      wizardSource,
      /guidedStage === 'schedule'[\s\S]*?<SchedulePdfImportStep/
    )
    assert.match(
      wizardSource,
      /guidedStage === 'planifications'[\s\S]*?<ModulePlanificationImportPanel[\s\S]*?guided/
    )
    assert.match(
      wizardSource,
      /guidedStage === 'criteria'[\s\S]*?<AssessmentCriteriaPdfImportPanel/
    )
    assert.doesNotMatch(
      wizardSource,
      /new DataTransfer\(\)|querySelector<HTMLInputElement>|attachFileToInput|queuedDocument|findButtonByText/
    )
  }
)

test(
  'guided planification review shows a compact proposal and expands only pending rows or explicit details',
  () => {
    assert.match(planificationPanelSource, /guided = false/)
    assert.match(planificationPanelSource, /readyRows\.length} prontas/)
    assert.match(planificationPanelSource, /pendingRows\.length} por rever/)
    assert.match(
      planificationPanelSource,
      /const expanded = showAllDetails \|\| \(row\.selected && !row\.reviewed\)/
    )
    assert.match(planificationPanelSource, /Editar detalhes/)
    assert.match(planificationPanelSource, /Confirmar esta correção/)
  }
)

test(
  'each confirmed stage refreshes the persisted setup snapshot before the next document family is resolved',
  () => {
    assert.match(
      wizardSource,
      /async function refreshSnapshot\([\s\S]*?maProfessorRepository\.getSetupSnapshot/
    )
    assert.match(
      wizardSource,
      /handleGuidedScheduleImported[\s\S]*?reconcileImportedScheduleProgress[\s\S]*?setGuidedStage\('planifications'\)/
    )
    assert.match(wizardSource, /onImported=\{refreshSnapshot\}/)
    assert.match(wizardSource, /onImported=\{onSnapshotChange\}/)
  }
)

test(
  'manual nine-step setup remains available only as an explicit advanced path',
  () => {
    assert.match(wizardSource, /if \(!advancedMode\)/)
    assert.match(wizardSource, /Configuração avançada · Ensino profissional \/ secundário/)
    assert.match(wizardSource, /ModulesSetupCourseSubjectGuard/)
    assert.match(wizardSource, /AssessmentCriteriaSetupStep/)
    assert.match(wizardSource, /StudentsSetupStep/)
    assert.match(wizardSource, /SetupConfirmationStep/)
  }
)
