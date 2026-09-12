import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/PlanificationPdfImportPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'normal planification import accepts PDF and DOCX through the same validated document reader',
  () => {
    assert.match(
      panelSource,
      /readModuleDocument/
    )
    assert.match(
      panelSource,
      /\.pdf\|\.docx|pdf\|docx|\.pdf.*\.docx/is
    )
    assert.match(
      panelSource,
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/
    )
    assert.doesNotMatch(
      panelSource,
      /extractPlanificationPdf/
    )
    assert.doesNotMatch(
      panelSource,
      /parsePlanificationPdfDocument\(/
    )
  }
)

test(
  'normal document import keeps the existing review and atomic commit contract',
  () => {
    assert.match(
      panelSource,
      /buildPlanificationPdfPreview\(/
    )
    assert.match(
      panelSource,
      /commitPlanificationPdfImport\(/
    )
    assert.match(
      panelSource,
      /Todas as secções deste documento são tratadas na mesma transação/
    )
    assert.match(
      panelSource,
      /PDF ou Word/
    )
    assert.doesNotMatch(
      panelSource,
      /multiple\s*(?:=|\})/
    )
  }
)
