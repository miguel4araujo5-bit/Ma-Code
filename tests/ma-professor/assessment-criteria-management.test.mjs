import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/assessmentCriteriaManagementRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/AssessmentCriteriaManagementPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const managedGridSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/UfcdFinalGradeGrid.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'criteria management reuses the applied assessment scheme and preserves the 100-percent contract',
  () => {
    assert.match(
      repositorySource,
      /schemeId:\s*EntityId/
    )
    assert.match(
      repositorySource,
      /Math\.abs\(total - 100\)/
    )
    assert.match(
      repositorySource,
      /criterion\.weightPercent <= 0/
    )
    assert.match(
      repositorySource,
      /criterion\.weightPercent > 100/
    )
    assert.match(
      repositorySource,
      /bulkPut\(nextCriteria\)/
    )
    assert.match(
      repositorySource,
      /bulkDelete\(deletedIds\)/
    )
  }
)

test(
  'criteria edits are rejected once evaluation history exists and evidence is rechecked in the write transaction',
  () => {
    assert.match(
      repositorySource,
      /ASSESSMENT_CRITERIA_HISTORY_EXISTS/
    )
    assert.match(
      repositorySource,
      /maProfessorDb\.transaction/
    )
    assert.match(
      repositorySource,
      /maProfessorDb\.lessonAssessments/
    )
    assert.match(
      repositorySource,
      /maProfessorDb\.assessmentResults/
    )
    assert.match(
      repositorySource,
      /maProfessorDb\.moduleFinalGrades/
    )
    assert.match(
      repositorySource,
      /const evidence\s*=\s*await readEvidence/
    )
    assert.match(
      repositorySource,
      /if \(hasEvidence\(evidence\)\)/
    )
  }
)

test(
  'criteria manager exposes configurable weights with unsaved-work protection and a read-only history state',
  () => {
    assert.match(
      panelSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )
    assert.match(
      panelSource,
      /Editar critérios/
    )
    assert.match(
      panelSource,
      /Distribuir 100% igualmente/
    )
    assert.match(
      panelSource,
      /Histórico protegido/
    )
    assert.match(
      panelSource,
      /assessmentCriteriaManagementRepository\s*\.updateScheme/
    )
    assert.match(
      panelSource,
      /scheme\.scope === 'module'/
    )
  }
)

test(
  'final UFCD grid integrates criteria management without replacing the existing grade grid',
  () => {
    assert.match(
      managedGridSource,
      /AssessmentCriteriaManagementPanel/
    )
    assert.match(
      managedGridSource,
      /BaseUfcdFinalGradeGrid/
    )
    assert.match(
      managedGridSource,
      /criteriaOverride/
    )
    assert.match(
      managedGridSource,
      /hasDirtyGradeDrafts/
    )
    assert.match(
      managedGridSource,
      /onSaved=\{\s*setCriteriaOverride\s*\}/
    )
  }
)

test(
  'criteria management stays local-first and does not add Cloudflare or network infrastructure',
  () => {
    const implementation =
      `${repositorySource}\n${panelSource}\n${managedGridSource}`

    assert.doesNotMatch(
      implementation,
      /snapshotApi|Durable Object|wrangler|cloudflare|fetch\(|WebSocket|polling/i
    )
  }
)
