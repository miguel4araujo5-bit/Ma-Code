import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)

const legacySource = await readFile(
  new URL(
    'src/components/ma-professor/setup/ModulePlanificationImportPanelLegacy.tsx',
    root
  ),
  'utf8'
)

const workspaceSource = await readFile(
  new URL(
    'src/components/ma-professor/planifications/PlanificationPdfImportPanel.tsx',
    root
  ),
  'utf8'
)

test('legacy planification selectors expose every format already supported by the shared document reader', () => {
  assert.match(
    legacySource,
    /PDF\/Word\/Excel/
  )
  assert.match(
    legacySource,
    /PDF, Word ou Excel/
  )

  const accepts = [
    ...legacySource.matchAll(/accept="([^"]+)"/g)
  ].map(match => match[1])

  assert.ok(accepts.length >= 2)
  for (const accept of accepts) {
    for (const extension of [
      '.pdf',
      '.docx',
      '.xlsx',
      '.xlsm',
      '.xls'
    ]) {
      assert.ok(
        accept.includes(extension),
        `${accept} should include ${extension}`
      )
    }
  }

  assert.match(
    legacySource,
    /readModuleDocument\(file\)/
  )
})

test('workspace planification import accepts PDF, Word and Excel before delegating to the shared reader', () => {
  for (const extension of [
    "'.pdf'",
    "'.docx'",
    "'.xlsx'",
    "'.xlsm'",
    "'.xls'"
  ]) {
    assert.ok(
      workspaceSource.includes(extension),
      `supported extension list should include ${extension}`
    )
  }

  assert.match(
    workspaceSource,
    /SUPPORTED_PLANIFICATION_EXTENSIONS\.some/
  )
  assert.match(
    workspaceSource,
    /readModuleDocument\(nextFile\)/
  )
  assert.match(
    workspaceSource,
    /\.xlsx,\.xlsm,\.xls/
  )
  assert.match(
    workspaceSource,
    /PDF, Word ou Excel/
  )
  assert.doesNotMatch(
    workspaceSource,
    /Selecione um ficheiro PDF ou Word \(\.docx\) válido\./
  )
})
