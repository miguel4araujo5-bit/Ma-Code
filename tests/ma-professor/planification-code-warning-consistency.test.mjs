import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const previewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfPreview.ts',
    import.meta.url
  ),
  'utf8'
)
const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/PlanificationPdfImportPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

function dataUrl(value) {
  return `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`
}

const runtimeSource = ts.transpileModule(previewSource, {
  fileName: 'planificationPdfPreview.ts',
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022
  }
}).outputText

const preview = await import(dataUrl(runtimeSource))

test('module code equality ignores only case and harmless surrounding/repeated whitespace', () => {
  assert.equal(preview.samePlanificationModuleCode('M1', 'm1'), true)
  assert.equal(preview.samePlanificationModuleCode('  M1  ', 'm1'), true)
  assert.equal(preview.samePlanificationModuleCode('M1', 'M-1'), false)
  assert.equal(preview.samePlanificationModuleCode('M1', 'M/1'), false)
  assert.equal(preview.samePlanificationModuleCode('', ''), false)
})

test('normal import panel reuses preview code equality before warning about a manual correction', () => {
  assert.match(
    panelSource,
    /samePlanificationModuleCode\(\s*destination\.code,\s*row\.section\.code\s*\)/
  )
  assert.doesNotMatch(
    panelSource,
    /destination\.code\.trim\(\)\s*!==\s*row\.section\.code/
  )
})
