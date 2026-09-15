import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const modelSource = await readFile(
  new URL('../../src/components/ma-professor/assessments/ufcdCfpModel.ts', import.meta.url),
  'utf8'
)
const excelSource = await readFile(
  new URL('../../src/components/ma-professor/assessments/ufcdFinalGradeExcelExport.ts', import.meta.url),
  'utf8'
)
const templateSource = await readFile(
  new URL('../../src/components/ma-professor/assessments/ufcdOfficialXlsmTemplate.ts', import.meta.url),
  'utf8'
)
const completionSource = await readFile(
  new URL('../../src/components/ma-professor/assessments/ufcdCompletionDate.ts', import.meta.url),
  'utf8'
)
const pdfSource = await readFile(
  new URL('../../src/components/ma-professor/assessments/ufcdCfpPdfExport.ts', import.meta.url),
  'utf8'
)
const previewSource = await readFile(
  new URL('../../src/components/ma-professor/assessments/UfcdCfpPreview.tsx', import.meta.url),
  'utf8'
)
const wrapperSource = await readFile(
  new URL('../../src/components/ma-professor/assessments/UfcdFinalGradeGrid.tsx', import.meta.url),
  'utf8'
)

test('CFP model preserves configured criteria, ACS and defensive module-name cleanup', () => {
  assert.match(modelSource, /slice\(0, 6\)/)
  assert.match(modelSource, /usesAcs[\s\S]*criterionScores/)
  assert.match(modelSource, /acsScore:[\s\S]*usesAcs/)
  assert.match(modelSource, /fichas\?\\s\+de\\s\+avalia/)
  assert.match(modelSource, /processNumber:\s*''/)
})

test('official Excel export uses the supplied macro-enabled workbook', () => {
  for (const sheetName of [
    'P1I1', 'P1I2', 'P1I3', 'P1I4', 'P1I5',
    'P2I1', 'P2I2', 'P2I3', 'P2I4', 'P2I5',
    'P3I1', 'P3I2', 'P3I3', 'P3I4', 'P3I5'
  ]) {
    assert.match(excelSource, new RegExp(`['\"]${sheetName}['\"]`))
  }
  assert.match(excelSource, /loadOfficialUfcdXlsmTemplate/)
  assert.match(excelSource, /writeOfficialUfcdXlsm/)
  assert.match(excelSource, /macroEnabled\.12/)
  assert.match(excelSource, /-Completo\.xlsm/)
  assert.doesNotMatch(excelSource, /book_new/)
})

test('instrument layouts preserve P1 versus P2/P3 offsets and ACS rows', () => {
  assert.match(excelSource, /P1_LAYOUT[\s\S]*titleCell:\s*'G2'[\s\S]*firstItemColumn:\s*4[\s\S]*lastItemColumn:\s*49/)
  assert.match(excelSource, /P23_LAYOUT[\s\S]*titleCell:\s*'F2'[\s\S]*firstItemColumn:\s*3[\s\S]*lastItemColumn:\s*48/)
  assert.match(excelSource, /adaptationStartColumn/)
  assert.match(excelSource, /usesAcs[\s\S]*adaptationColumn[\s\S]*generalColumn/)
  assert.match(excelSource, /studentRows\.length > 30/)
})

test('official XLSM loader uses the canonical template and repairs references', () => {
  assert.match(templateSource, /Grelha_Avaliacao_UFCD_UC_Modelo\.xlsm/)
  assert.match(templateSource, /arrayBuffer\(\)/)
  assert.match(templateSource, /unzipSync/)
  assert.match(templateSource, /vbaProject\.bin/)
  assert.match(templateSource, /length:\s*20/)
  assert.match(templateSource, /repairP2P3StudentReferences/)
  assert.match(templateSource, /repairAutoStudentReferences/)
  assert.match(templateSource, /'J', 'L', 'N', 'P', 'R', 'T'/)
  assert.match(templateSource, /'I', 'K', 'M', 'O', 'Q', 'S'/)
  assert.match(templateSource, /calcMode=\"auto\"/)
  assert.doesNotMatch(templateSource, /gunzipSync|TEMPLATE_PART_COUNT|cloneP1/)
})

test('module completion date comes from taught periods that count toward progress', () => {
  assert.match(completionSource, /lesson\.status !== 'taught'/)
  assert.match(completionSource, /!lesson\.countTowardProgress/)
  assert.match(completionSource, /completedPeriods \+=\s*lesson\.periodCount/)
  assert.match(completionSource, /completedPeriods >= plannedPeriods/)
  assert.doesNotMatch(completionSource, /confirmedAt/)
  assert.match(wrapperSource, /resolveModuleCompletionDate/)
  assert.match(wrapperSource, /completionDateReady/)
})

test('PDF and preview are CFP-only while exposing both export choices', () => {
  assert.match(pdfSource, /buildUfcdCfpModel/)
  assert.match(pdfSource, /-CFP\.pdf/)
  assert.match(pdfSource, /O\/A Professor\(a\)/)
  assert.match(previewSource, /Pré-visualização da folha CFP/)
  assert.match(previewSource, /Exportar PDF · CFP/)
  assert.match(previewSource, /Exportar Excel completo/)
  assert.match(previewSource, /O PDF contém apenas a CFP/)
})

test('CFP preview and PDF preserve six coloured domain slots', () => {
  assert.match(previewSource, /5 - model\.criteria\.length/)
  assert.match(previewSource, /blankDomainSlots/)
  assert.match(previewSource, /criterionColor\(\s*model\.criteria\.length\s*\)/)
  assert.match(pdfSource, /5 - model\.criteria\.length/)
  assert.match(pdfSource, /blankDomainSlotCount/)
  assert.match(pdfSource, /criterionColor\(\s*model\.criteria\.length\s*\)/)
})

test('final-grade wrapper shows CFP preview and hides legacy duplicate export control', () => {
  assert.match(wrapperSource, /UfcdCfpPreview/)
  assert.match(wrapperSource, /ma-professor-cfp-editor/)
  assert.match(wrapperSource, /div:first-child button \{ display: none; \}/)
})
