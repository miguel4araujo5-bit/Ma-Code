import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const regularWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/RegularAssessmentWorkspaceView.tsx',
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

const managementPanelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/AssessmentCriteriaManagementPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

function assertTranspiles(
  source,
  fileName
) {
  const output = ts.transpileModule(
    source,
    {
      fileName,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        jsx: ts.JsxEmit.ReactJSX
      }
    }
  )

  const errors = (output.diagnostics || [])
    .filter(
      diagnostic =>
        diagnostic.category ===
          ts.DiagnosticCategory.Error
    )

  assert.equal(
    errors.length,
    0,
    errors
      .map(diagnostic =>
        ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        )
      )
      .join('\n')
  )
}

test(
  'criteria management compiles as a dedicated workspace and is no longer embedded in regular assessments',
  () => {
    assertTranspiles(
      regularWorkspaceSource,
      'RegularAssessmentWorkspaceView.tsx'
    )
    assertTranspiles(
      criteriaWorkspaceSource,
      'CriteriaWorkspaceView.tsx'
    )
    assertTranspiles(
      managementPanelSource,
      'AssessmentCriteriaManagementPanel.tsx'
    )

    assert.doesNotMatch(
      regularWorkspaceSource,
      /AssessmentCriteriaManagementPanel|criteriaOverride|Critérios e ponderações/
    )
  }
)

test(
  'dedicated criteria workspace reuses the protected criteria manager without duplicating persistence logic',
  () => {
    assert.match(
      criteriaWorkspaceSource,
      /AssessmentCriteriaManagementPanel/
    )
    assert.match(
      criteriaWorkspaceSource,
      /criteriaOverride/
    )
    assert.match(
      criteriaWorkspaceSource,
      /onSaved=\{[\s\S]*setCriteriaOverride[\s\S]*\}/
    )
    assert.match(
      criteriaWorkspaceSource,
      /onFiltersChange/
    )
    assert.match(
      criteriaWorkspaceSource,
      /Turma e disciplina/
    )
    assert.match(
      criteriaWorkspaceSource,
      /UFCD, módulo ou componente/
    )
    assert.doesNotMatch(
      criteriaWorkspaceSource,
      /assessmentCriteriaManagementRepository\s*\.updateScheme/
    )
  }
)

test(
  'shared criteria manager uses neutral explanatory copy while preserving the professional UFCD scope label',
  () => {
    assert.match(
      managementPanelSource,
      /Consulte e ajuste o conjunto de critérios selecionado\./
    )
    assert.doesNotMatch(
      managementPanelSource,
      /aplicado a esta UFCD/
    )
    assert.match(
      managementPanelSource,
      /Específicos desta UFCD/
    )
    assert.match(
      managementPanelSource,
      /Gerais da disciplina/
    )
  }
)

test(
  'criteria management remains local-first and adds no Cloudflare or remote path',
  () => {
    const combined = [
      criteriaWorkspaceSource,
      managementPanelSource
    ].join('\n')

    assert.doesNotMatch(
      combined,
      /fetch\(|snapshotApi|Durable Object|wrangler|cloudflare|workers ai/i
    )
  }
)
