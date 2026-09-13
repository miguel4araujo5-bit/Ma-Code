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
  'regular assessment workspace compiles after reusing the protected criteria manager',
  () => {
    assertTranspiles(
      regularWorkspaceSource,
      'RegularAssessmentWorkspaceView.tsx'
    )
    assertTranspiles(
      managementPanelSource,
      'AssessmentCriteriaManagementPanel.tsx'
    )
  }
)

test(
  'regular assessment exposes the same post-setup criteria manager without duplicating its persistence logic',
  () => {
    assert.match(
      regularWorkspaceSource,
      /AssessmentCriteriaManagementPanel/
    )
    assert.match(
      regularWorkspaceSource,
      /criteriaOverride/
    )
    assert.match(
      regularWorkspaceSource,
      /onSaved=\{setCriteriaOverride\}/
    )
    assert.match(
      regularWorkspaceSource,
      /disabled=\{[\s\S]*loading[\s\S]*savingStudentId\s*!==\s*null[\s\S]*hasUnsavedChanges[\s\S]*\}/
    )
    assert.match(
      regularWorkspaceSource,
      /criteriaSnapshot\.criteria\.length\s*===\s*0/
    )
    assert.doesNotMatch(
      regularWorkspaceSource,
      /snapshot\.criteria\.map/
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
  'regular criteria management remains local-first and adds no Cloudflare or remote path',
  () => {
    const combined = [
      regularWorkspaceSource,
      managementPanelSource
    ].join('\n')

    assert.doesNotMatch(
      combined,
      /fetch\(|snapshotApi|Durable Object|wrangler|cloudflare|workers ai/i
    )
  }
)
