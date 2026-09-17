import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const previewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/UfcdCfpPreview.tsx',
    import.meta.url
  ),
  'utf8'
)

const pdfSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdCfpPdfExport.ts',
    import.meta.url
  ),
  'utf8'
)

const excelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdFinalGradeExcelExport.ts',
    import.meta.url
  ),
  'utf8'
)

const templateSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdOfficialXlsmTemplate.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'CFP preview keeps Nº and % as separate subcolumns for every global assessment band',
  () => {
    assert.match(
      previewSource,
      /rowSpan=\{3\}/
    )
    assert.match(
      previewSource,
      /colSpan=\{2\}/
    )
    assert.match(
      previewSource,
      /summary-label-/
    )
    assert.match(
      previewSource,
      /summary-value-/
    )
  }
)

test(
  'CFP PDF draws a dedicated Nº/% label row before the global assessment values',
  () => {
    assert.match(
      pdfSource,
      /summarySubheaderHeight/
    )
    assert.match(
      pdfSource,
      /summaryBlockHeight/
    )
    assert.match(
      pdfSource,
      /'Nº'/
    )
    assert.match(
      pdfSource,
      /'%',/
    )
  }
)

test(
  'CFP footer keeps evaluated trainees separate and uses non-overlapping PDF geometry',
  () => {
    assert.match(
      previewSource,
      /Formandos Avaliados[\s\S]*\{model\.evaluatedCount\}/
    )
    assert.doesNotMatch(
      previewSource,
      /Formandos Avaliados:\s*\{model\.evaluatedCount\}/
    )

    assert.match(
      pdfSource,
      /const footerStartX/
    )
    assert.match(
      pdfSource,
      /const evaluatedX/
    )
    assert.match(
      pdfSource,
      /const rightX/
    )
    assert.match(
      pdfSource,
      /'Formandos Avaliados'[\s\S]*String\(model\.evaluatedCount\)/
    )
    assert.doesNotMatch(
      pdfSource,
      /MARGIN \+ 500/
    )
    assert.doesNotMatch(
      pdfSource,
      /MARGIN \+ 640/
    )
  }
)

test(
  'CFP Excel preserves the summary layout from the official XLSM instead of rebuilding it',
  () => {
    assert.match(
      excelSource,
      /loadOfficialUfcdXlsmTemplate/
    )
    assert.match(
      excelSource,
      /const CFP_SHEET =\s*\n\s*'xl\/worksheets\/sheet14\.xml'/
    )
    assert.match(
      templateSource,
      /Grelha_Avaliacao_UFCD_UC_Modelo\.xlsm/
    )
    assert.doesNotMatch(
      excelSource,
      /rows\.push\(\[/
    )
  }
)
