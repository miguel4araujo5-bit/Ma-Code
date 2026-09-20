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

const criteriaWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/CriteriaWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const appSource = await readFile(
  new URL(
    '../../src/components/ma-professor/MAProfessorApp.tsx',
    import.meta.url
  ),
  'utf8'
)

const productMenuSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/ProductMenuWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

const navigationModelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/productNavigationModel.ts',
    import.meta.url
  ),
  'utf8'
)

const backupSettingsSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/BackupSettingsPanel.tsx',
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
  'existing evaluation history warns but no longer blocks names descriptions or weights',
  () => {
    assert.match(
      repositorySource,
      /editable:\s*true/
    )
    assert.match(
      repositorySource,
      /maProfessorDb\.transaction/
    )
    assert.match(
      repositorySource,
      /await readEvidence\([\s\S]*scheme,[\s\S]*existingCriteria/
    )
    assert.doesNotMatch(
      repositorySource,
      /ASSESSMENT_CRITERIA_HISTORY_EXISTS/
    )
    assert.doesNotMatch(
      panelSource,
      /Histórico protegido/
    )
    assert.match(
      panelSource,
      /Pode continuar a editar/
    )
    assert.match(
      panelSource,
      /Alterar apenas o nome ou a descrição não muda os cálculos/
    )
  }
)

test(
  'calculation-impacting changes require confirmation and preserve confirmed final grades',
  () => {
    assert.match(
      panelSource,
      /calculationImpactingChange/
    )
    assert.match(
      panelSource,
      /window\.confirm/
    )
    assert.match(
      panelSource,
      /pode recalcular as médias provisórias e as classificações sugeridas/
    )
    assert.match(
      panelSource,
      /classificações finais já confirmadas pelo professor não serão alteradas automaticamente/
    )
    assert.doesNotMatch(
      repositorySource,
      /moduleFinalGrades\.(?:delete|bulkDelete|clear|put|bulkPut)/
    )
  }
)

test(
  'a criterion already referenced by lesson assessments cannot be deleted from history',
  () => {
    assert.match(
      repositorySource,
      /assertDeletedCriteriaHaveNoAssessments/
    )
    assert.match(
      repositorySource,
      /lessonAssessments[\s\S]*anyOf\(deletedIds\)[\s\S]*\.first\(\)/
    )
    assert.match(
      repositorySource,
      /Não é possível remover um critério que já tenha avaliações associadas/
    )
  }
)

test(
  'criteria manager exposes configurable weights with unsaved-work protection and a direct navigation anchor',
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
      /id="ma-professor-criteria-management"/
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
  'criteria management lives in its own workspace while the UFCD grade flow remains intact',
  () => {
    assert.match(
      criteriaWorkspaceSource,
      /AssessmentCriteriaManagementPanel/
    )
    assert.match(
      criteriaWorkspaceSource,
      /onSaved=\{[\s\S]*setCriteriaOverride[\s\S]*\}/
    )
    assert.doesNotMatch(
      managedGridSource,
      /AssessmentCriteriaManagementPanel|criteriaOverride/
    )
    assert.match(
      managedGridSource,
      /BaseUfcdFinalGradeGrid/
    )
    assert.match(
      managedGridSource,
      /UfcdFinalGradeExcelImportPanel/
    )
    assert.match(
      managedGridSource,
      /UfcdCfpPreview/
    )
    assert.match(
      managedGridSource,
      /hasDirtyGradeDrafts/
    )
  }
)

test(
  'criteria management stays local-first and does not add Cloudflare or network infrastructure',
  () => {
    const implementation =
      `${repositorySource}\n${panelSource}\n${criteriaWorkspaceSource}\n${managedGridSource}`

    assert.doesNotMatch(
      implementation,
      /snapshotApi|Durable Object|wrangler|cloudflare|fetch\(|WebSocket|polling/i
    )
  }
)


test(
  'general criteria are managed by subject while preserving the advanced class and module path',
  () => {
    assert.match(
      criteriaWorkspaceSource,
      /getSubjectContext/
    )
    assert.match(
      criteriaWorkspaceSource,
      />\s*Disciplina\s*</
    )
    assert.match(
      criteriaWorkspaceSource,
      /Gestão avançada por turma \/ UFCD/
    )
    assert.match(
      criteriaWorkspaceSource,
      /Turma e disciplina/
    )
    assert.match(
      criteriaWorkspaceSource,
      /UFCD, módulo ou componente/
    )
  }
)

test(
  'subject-wide updates preserve existing criterion identities and update schemes in one local transaction',
  () => {
    assert.match(
      repositorySource,
      /updateSubjectSchemes/
    )
    assert.match(
      repositorySource,
      /sameCriterionIdentity/
    )
    assert.match(
      repositorySource,
      /existingByIdentity/
    )
    assert.match(
      repositorySource,
      /assessmentSchemes[\s\S]*bulkPut\([\s\S]*updatedSchemes/
    )
    assert.match(
      repositorySource,
      /assessmentCriteria[\s\S]*bulkPut/
    )
    assert.doesNotMatch(
      repositorySource,
      /moduleFinalGrades\s*\.\s*(?:put|bulkPut|delete|bulkDelete|clear)/
    )
  }
)

test(
  'deleting a criterion with history offers the existing full reset path without deleting directly',
  () => {
    assert.match(
      repositorySource,
      /AssessmentCriteriaDeletionBlockedError/
    )
    assert.match(
      panelSource,
      /apagar tudo e começar de novo/
    )
    assert.match(
      panelSource,
      /onOpenDataReset/
    )
    assert.match(
      appSource,
      /onOpenDataReset/
    )
    assert.match(
      productMenuSource,
      /onNavigate\('reset'\)/
    )
    assert.match(
      navigationModelSource,
      /'reset'/
    )
    assert.match(
      backupSettingsSource,
      /ma-professor-security-reset/
    )
    assert.match(
      backupSettingsSource,
      /Escreva APAGAR/
    )
    assert.doesNotMatch(
      panelSource,
      /resetMAProfessorDatabase/
    )
  }
)

test(
  'criteria history distinguishes final-grade records from grades already confirmed by the teacher',
  () => {
    assert.match(
      repositorySource,
      /confirmedFinalGradeCount/
    )
    assert.match(
      repositorySource,
      /grade\.confirmedAt !== null/
    )
    assert.match(
      panelSource,
      /confirmado\(s\)/
    )
  }
)
