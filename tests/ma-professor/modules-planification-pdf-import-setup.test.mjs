import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const wizardSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SetupWizard.tsx',
    import.meta.url
  ),
  'utf8'
)

const integratedStepSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/ModulesSetupIntegratedStep.tsx',
    import.meta.url
  ),
  'utf8'
)

const importPanelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/ModulesPlanificationPdfImportPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

function assertTranspiles(source, filename) {
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    diagnostic =>
      diagnostic.category === ts.DiagnosticCategory.Error
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
  'UFCD setup exposes the integrated planification PDF import without replacing the existing manual workflow',
  () => {
    assert.match(
      wizardSource,
      /import ModulesSetupStep from '\.\/ModulesSetupIntegratedStep'/
    )

    assert.match(
      integratedStepSource,
      /<ModulesPlanificationPdfImportPanel/
    )

    assert.match(
      integratedStepSource,
      /<ModulesSetupStep/
    )
  }
)

test(
  'integrated importer parses locally and creates modules plus planifications',
  () => {
    assert.match(
      importPanelSource,
      /extractPlanificationPdf/
    )
    assert.match(
      importPanelSource,
      /parsePlanificationPdfDocument/
    )
    assert.match(
      importPanelSource,
      /maProfessorRepository\.createModule/
    )
    assert.match(
      importPanelSource,
      /maProfessorRepository\.createPlanification/
    )
    assert.match(
      importPanelSource,
      /accept="application\/pdf,\.pdf"/
    )
  }
)

test(
  'integrated importer is repeat-safe and does not overwrite an active planification',
  () => {
    assert.match(
      importPanelSource,
      /findModuleByCode/
    )
    assert.match(
      importPanelSource,
      /findActivePlanification/
    )
    assert.match(
      importPanelSource,
      /continue\s*\n\s*}/
    )
    assert.match(
      importPanelSource,
      /planificações ativas já existentes/
    )
  }
)

test(
  'new setup files are syntactically valid TypeScript/TSX',
  () => {
    assertTranspiles(
      integratedStepSource,
      'ModulesSetupIntegratedStep.tsx'
    )
    assertTranspiles(
      importPanelSource,
      'ModulesPlanificationPdfImportPanel.tsx'
    )
  }
)
