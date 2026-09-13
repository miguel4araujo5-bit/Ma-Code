import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routerSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/AssessmentWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const wrapperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/RegularAssessmentWorkspaceManagedView.tsx',
    import.meta.url
  ),
  'utf8'
)

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/RegularAssessmentCriteriaManagementPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const professionalGridSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/UfcdFinalGradeGrid.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'regular assessment routes through an additive criteria-management wrapper without replacing the established workspace',
  () => {
    assert.match(
      routerSource,
      /RegularAssessmentWorkspaceView\s+from\s+['"]\.\/RegularAssessmentWorkspaceManagedView['"]/
    )
    assert.match(
      wrapperSource,
      /RegularAssessmentWorkspaceView/
    )
    assert.match(
      wrapperSource,
      /RegularAssessmentCriteriaManagementPanel/
    )
    assert.match(
      wrapperSource,
      /criteriaOverride/
    )
    assert.match(
      wrapperSource,
      /criteria:\s*criteriaOverride\.criteria/
    )
  }
)

test(
  'regular criteria reuse the protected persistence repository and the 100-percent contract',
  () => {
    assert.match(
      panelSource,
      /assessmentCriteriaManagementRepository[\s\S]*?getEditability\(schemeId\)/
    )
    assert.match(
      panelSource,
      /assessmentCriteriaManagementRepository[\s\S]*?updateScheme/
    )
    assert.match(
      panelSource,
      /ASSESSMENT_CRITERIA_HISTORY_EXISTS/
    )
    assert.match(
      panelSource,
      /Math\.abs\(weightTotal - 100\) >= 0\.001/
    )
    assert.match(
      panelSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )
    assert.match(
      panelSource,
      /Específicos desta componente anual/
    )
    assert.match(
      panelSource,
      /Gerais da disciplina/
    )
  }
)

test(
  'professional criteria management remains on the existing UFCD grid path',
  () => {
    assert.match(
      professionalGridSource,
      /AssessmentCriteriaManagementPanel/
    )
    assert.match(
      professionalGridSource,
      /BaseUfcdFinalGradeGrid/
    )
  }
)

test(
  'regular criteria management remains local-first and adds no Cloudflare path',
  () => {
    const combined = [
      wrapperSource,
      panelSource
    ].join('\n')

    assert.doesNotMatch(
      combined,
      /fetch\(|snapshotApi|Durable Object|wrangler|cloudflare|workers ai|D1Database/i
    )
  }
)
