import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/AssessmentCriteriaSetupStep.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'assessment criteria setup derives meaningful unsaved work from the multi-discipline draft',
  () => {
    assert.match(source, /hasUnsavedCriteriaDraft/)
    assert.match(source, /form\.scope\s*!==\s*emptyForm\.scope/)
    assert.match(source, /form\.teachingAssignmentIds\.length/)
    assert.match(source, /form\.moduleTeachingAssignmentId/)
    assert.match(source, /form\.moduleId/)
    assert.match(source, /form\.schemeName\s*!==\s*emptyForm\.schemeName/)
    assert.match(source, /criteria\.length\s*!==\s*1/)
    assert.match(source, /criterion\.name\.trim\(\)/)
    assert.match(source, /criterion\.description\.trim\(\)/)
    assert.match(source, /criterion\.weightPercent/)
  }
)

test(
  'assessment criteria setup protects browser close and setup navigation',
  () => {
    assert.match(source, /rootRef/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedCriteriaDraft[\s\S]*rootRef/
    )
    assert.match(source, /ref=\{rootRef\}/)
  }
)

test(
  'assessment criteria setup does not silently clear a dirty draft',
  () => {
    assert.match(source, /confirmDiscardCriteriaDraft/)
    assert.match(source, /requestResetForm/)
    assert.match(
      source,
      /function requestResetForm\(\)[\s\S]*confirmDiscardCriteriaDraft\(\)/
    )
    assert.match(source, /onClick=\{\s*requestResetForm\s*\}/)
  }
)

test(
  'normal criteria flow applies one draft to explicit associations through the atomic batch API',
  () => {
    assert.match(source, /assessmentCriteriaBatchRepository/)
    assert.match(
      source,
      /await\s+assessmentCriteriaBatchRepository\.createSubjectSchemes\(\{/
    )
    assert.match(
      source,
      /teachingAssignmentIds:\s*form\.teachingAssignmentIds/
    )
    assert.match(source, /type="checkbox"/)
    assert.match(
      source,
      /Este conjunto será aplicado a todas as UFCD das\s+disciplinas selecionadas\./
    )
  }
)

test(
  'UFCD customization is secondary and consumes the evidence-guarded core API',
  () => {
    assert.match(source, /Personalizar uma UFCD/)
    assert.match(
      source,
      /Estes critérios substituem os critérios gerais apenas\s+na UFCD selecionada\./
    )
    assert.match(
      source,
      /assessmentCriteriaModuleRepository\.createModuleScheme\(/
    )
    assert.doesNotMatch(
      source,
      /maProfessorRepository\.createAssessmentScheme\(/
    )
    assert.match(
      source,
      /Se esta UFCD já tiver avaliações ou classificações\s+registadas, a personalização será bloqueada para\s+preservar o histórico\./
    )
    assert.doesNotMatch(source, /name="criteria-scope"/)
    assert.doesNotMatch(source, />\s*Apenas uma UFCD\s*</)
  }
)

test(
  'assessment criteria setup refuses to continue while meaningful local work is still unsaved',
  () => {
    assert.match(
      source,
      /async function handleContinue\(\)[\s\S]*hasUnsavedCriteriaDraft[\s\S]*Existem alterações por guardar neste passo/
    )
    assert.match(
      source,
      /hasUnsavedCriteriaDraft[\s\S]*return[\s\S]*completeSetupStep/
    )
    assert.match(source, /uncoveredAssignments\.length/)
  }
)
