import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const typesSource = await readFile(
  new URL(
    '../../src/components/ma-professor/types.ts',
    import.meta.url
  ),
  'utf8'
)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/assessmentWorkspaceRepositoryBase.ts',
    import.meta.url
  ),
  'utf8'
)

const workspaceRouterSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/AssessmentWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const professionalWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ProfessionalAssessmentWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const regularWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/RegularAssessmentWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const gridSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/UfcdFinalGradeGridBase.tsx',
    import.meta.url
  ),
  'utf8'
)

const csvSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/csvExport.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'module final grade keeps ACS and self-assessment as backward-compatible optional metadata',
  () => {
    assert.match(
      typesSource,
      /selfAssessmentGrade\?:\s*Score\s*\|\s*null/
    )
    assert.match(
      typesSource,
      /usesAcs\?:\s*boolean/
    )
  }
)

test(
  'final-grade persistence accepts and validates self-assessment while preserving legacy callers',
  () => {
    assert.match(
      repositorySource,
      /selfAssessmentGrade\?:\s*Score\s*\|\s*null/
    )
    assert.match(
      repositorySource,
      /usesAcs\?:\s*boolean/
    )
    assert.match(
      repositorySource,
      /validateSelfAssessmentGrade/
    )
    assert.match(
      repositorySource,
      /input\.selfAssessmentGrade\s*===\s*undefined/
    )
    assert.match(
      repositorySource,
      /input\.usesAcs\s*===\s*undefined/
    )
    assert.match(
      repositorySource,
      /existing\s*\?\.usesAcs\s*\?\?\s*false/
    )
  }
)

test(
  'professional assessment workspace preserves the final grid, dirty drafts and save flow after the regular split',
  () => {
    assert.match(
      professionalWorkspaceSource,
      /UfcdFinalGradeGrid/
    )
    assert.match(
      professionalWorkspaceSource,
      /const selfAssessmentGrade\s*=/
    )
    assert.match(
      professionalWorkspaceSource,
      /selfAssessmentGrade,\s*usesAcs:/
    )
    assert.match(
      professionalWorkspaceSource,
      /usesAcs:\s*draft\.usesAcs/
    )
    assert.match(
      professionalWorkspaceSource,
      /hasMAProfessorDirtyDraftRecord/
    )
    assert.match(
      professionalWorkspaceSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )
  }
)

test(
  'assessment workspace routes only explicit regular groups away from the preserved professional workspace',
  () => {
    assert.match(
      workspaceRouterSource,
      /selectedGroup[\s\S]*educationType\s*===\s*['"]regular['"]/
    )
    assert.match(
      workspaceRouterSource,
      /RegularAssessmentWorkspaceView/
    )
    assert.match(
      workspaceRouterSource,
      /ProfessionalAssessmentWorkspaceView/
    )
    assert.match(
      regularWorkspaceSource,
      /Avaliações · Ensino regular/
    )
  }
)

test(
  'final grid follows the configured criterion weights instead of hardcoding the current 60-20-20 scheme',
  () => {
    assert.match(
      gridSource,
      /snapshot\.criteria\.map/
    )
    assert.match(
      gridSource,
      /criterion\.weightPercent/
    )
    assert.match(
      gridSource,
      /provisionalAverage/
    )
    assert.match(
      gridSource,
      /Nível automático/
    )
    assert.match(
      gridSource,
      /Autoavaliação/
    )
    assert.match(
      gridSource,
      /Aluno com medidas · ACS/
    )
    assert.doesNotMatch(
      gridSource,
      />\s*60%\s*</
    )
    assert.doesNotMatch(
      gridSource,
      />\s*20%\s*</
    )
  }
)

test(
  'grade CSV keeps the new final-grid metadata portable',
  () => {
    assert.match(
      csvSource,
      /'ACS'/
    )
    assert.match(
      csvSource,
      /'Autoavaliação'/
    )
    assert.match(
      csvSource,
      /grade\.usesAcs/
    )
    assert.match(
      csvSource,
      /grade\.selfAssessmentGrade/
    )
  }
)
