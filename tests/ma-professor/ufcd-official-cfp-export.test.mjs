import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as fflate from 'fflate'
import ts from 'typescript'

const modelSource = await readFile(
  new URL('../../src/components/ma-professor/assessments/ufcdCfpModel.ts', import.meta.url),
  'utf8'
)
const excelSource = await readFile(
  new URL('../../src/components/ma-professor/assessments/ufcdFinalGradeExcelExport.ts', import.meta.url),
  'utf8'
)
const dynamicMomentSource = await readFile(
  new URL('../../src/components/ma-professor/assessments/ufcdDynamicMomentSheets.ts', import.meta.url),
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

async function loadExecutableTemplateModule() {
  const executableSource =
    templateSource.replace(
      /import\s*\{[\s\S]*?\}\s*from 'fflate'/,
      'const { strFromU8, strToU8, unzipSync, zipSync } = globalThis.__maProfessorFflate'
    )

  const compiled =
    ts.transpileModule(
      executableSource,
      {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022
        }
      }
    ).outputText

  globalThis.__maProfessorFflate = fflate

  return import(
    `data:text/javascript;base64,${Buffer
      .from(compiled)
      .toString('base64')}`
  )
}

test('CFP model preserves configured criteria, ACS and defensive module-name cleanup', () => {
  assert.match(modelSource, /slice\(0, 6\)/)
  assert.match(modelSource, /usesAcs[\s\S]*criterionScores/)
  assert.match(modelSource, /acsScore:[\s\S]*usesAcs/)
  assert.match(modelSource, /fichas\?\\s\+de\\s\+avalia/)
  assert.match(modelSource, /processNumber:\s*''/)
})

test('official Excel export uses the supplied macro-enabled workbook and dynamic evaluation sheets', () => {
  assert.match(excelSource, /loadOfficialUfcdXlsmTemplate/)
  assert.match(excelSource, /prepareOfficialEvaluationMomentSheets/)
  assert.match(excelSource, /materializeMomentSheets/)
  assert.match(excelSource, /moments\.length/)
  assert.match(excelSource, /writeOfficialUfcdXlsm/)
  assert.match(excelSource, /macroEnabled\.12/)
  assert.match(excelSource, /-Completo\.xlsm/)
  assert.doesNotMatch(excelSource, /moments\.length\s*>\s*OFFICIAL_MOMENT_SHEETS\.length/)
  assert.doesNotMatch(excelSource, /até 15 instrumentos de avaliação/)
  assert.doesNotMatch(excelSource, /book_new/)
})

test('dynamic moment builder reuses the official pages then clones more moments without duplicating VBA codenames', () => {
  for (const sheetName of [
    'P1I1', 'P1I2', 'P1I3', 'P1I4', 'P1I5',
    'P2I1', 'P2I2', 'P2I3', 'P2I4', 'P2I5',
    'P3I1', 'P3I2', 'P3I3', 'P3I4', 'P3I5'
  ]) {
    assert.match(dynamicMomentSource, new RegExp(`['\"]${sheetName}['\"]`))
  }
  assert.match(dynamicMomentSource, /prepareOfficialEvaluationMomentSheets/)
  assert.match(dynamicMomentSource, /extraCount/)
  assert.match(dynamicMomentSource, /`AV\$\{momentNumber\}`/)
  assert.match(dynamicMomentSource, /stripWorksheetCodeName/)
  assert.match(dynamicMomentSource, /WORKSHEET_RELATIONSHIP_TYPE/)
  assert.match(dynamicMomentSource, /WORKSHEET_CONTENT_TYPE/)
  assert.match(dynamicMomentSource, /DRAWING_CONTENT_TYPE/)
  assert.match(dynamicMomentSource, /setSheetVisibility/)
})

test('instrument layouts preserve P1 versus P2/P3 offsets and ACS rows', () => {
  assert.match(excelSource, /P1_LAYOUT[\s\S]*titleCell:\s*'G2'[\s\S]*firstItemColumn:\s*4[\s\S]*lastItemColumn:\s*49/)
  assert.match(excelSource, /P23_LAYOUT[\s\S]*titleCell:\s*'F2'[\s\S]*firstItemColumn:\s*3[\s\S]*lastItemColumn:\s*48/)
  assert.match(excelSource, /adaptationStartColumn/)
  assert.match(excelSource, /usesAcs[\s\S]*adaptationColumn[\s\S]*generalColumn/)
  assert.match(excelSource, /studentRows\.length > 30/)
})

test('one lesson can keep several separately titled evaluation moments', () => {
  assert.match(excelSource, /const key =\s*\n\s*`\$\{activity\.lesson\.id\}::\$\{title\}`/)
  assert.match(excelSource, /new Map<string, EvaluationMoment>/)
  assert.match(excelSource, /existing\.resultsByCriterion\.set/)
})

test('CFP values are populated directly from the aggregate model so extra moments are included', () => {
  assert.match(excelSource, /CFP_DOMAIN_COLUMNS/)
  assert.match(excelSource, /student\.criterionScores\.forEach/)
  assert.match(excelSource, /student\.acsScore/)
  assert.match(excelSource, /student\.automaticLevel/)
  assert.match(excelSource, /`AA\$\{row\}`/)
  assert.match(excelSource, /ROUNDUP\(AA\$\{row\},0\)/)
})

test('official XLSM writer tolerates omitted cells and rows from the real template', async () => {
  const module =
    await loadExecutableTemplateModule()
  const templateBytes =
    await readFile(
      new URL(
        '../../public/ma-professor/templates/Grelha_Avaliacao_UFCD_UC_Modelo.xlsm',
        import.meta.url
      )
    )
  const previousFetch =
    globalThis.fetch

  globalThis.fetch = async () => ({
    ok: true,
    arrayBuffer: async () =>
      templateBytes.buffer.slice(
        templateBytes.byteOffset,
        templateBytes.byteOffset +
          templateBytes.byteLength
      )
  })

  try {
    const files =
      await module.loadOfficialUfcdXlsmTemplate()
    const homePath =
      'xl/worksheets/sheet1.xml'

    assert.doesNotThrow(() => {
      module.clearWorksheetCell(
        files,
        homePath,
        'I6'
      )
    })

    module.setWorksheetString(
      files,
      homePath,
      'I6',
      '1'
    )

    const withoutRowSeven =
      fflate.strFromU8(
        files[homePath]
      ).replace(
        /<row\b[^>]*\br="7"[^>]*(?:\s*\/>|>[\s\S]*?<\/row>)/,
        ''
      )

    files[homePath] =
      fflate.strToU8(
        withoutRowSeven
      )

    assert.doesNotThrow(() => {
      module.setWorksheetString(
        files,
        homePath,
        'I7',
        '2'
      )
    })

    const after =
      fflate.strFromU8(
        files[homePath]
      )

    assert.match(
      after,
      /<c\b[^>]*\br="I6"[^>]*>/
    )
    assert.match(
      after,
      /<row\b[^>]*\br="7"[^>]*>[\s\S]*?<c\b[^>]*\br="I7"[^>]*>/
    )
  } finally {
    globalThis.fetch = previousFetch
    delete globalThis.__maProfessorFflate
  }
})

test('official XLSM loader normalizes sheet paths and repairs student references without rewriting the legacy CFP matrix', () => {
  assert.match(templateSource, /Grelha_Avaliacao_UFCD_UC_Modelo\.xlsm/)
  assert.match(templateSource, /arrayBuffer\(\)/)
  assert.match(templateSource, /unzipSync/)
  assert.match(templateSource, /vbaProject\.bin/)
  assert.match(templateSource, /CANONICAL_WORKSHEET_PATHS/)
  assert.match(templateSource, /P1I2:\s*'xl\/worksheets\/sheet17\.xml'/)
  assert.match(templateSource, /CFP:\s*'xl\/worksheets\/sheet14\.xml'/)
  assert.match(templateSource, /AUTO:\s*'xl\/worksheets\/sheet16\.xml'/)
  assert.match(templateSource, /resolveWorksheetLocations/)
  assert.match(templateSource, /normalizeWorksheetPaths/)
  assert.match(templateSource, /WORKBOOK_RELS_PATH/)
  assert.match(templateSource, /worksheetRelsPath/)
  assert.match(templateSource, /length:\s*20/)
  assert.match(templateSource, /repairP2P3StudentReferences/)
  assert.match(templateSource, /repairAutoStudentReferences/)
  assert.doesNotMatch(templateSource, /repairCfpInstrumentReferences/)
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

test('PDF and final assessment sheet expose the official CFP and both export choices', () => {
  assert.match(pdfSource, /buildUfcdCfpModel/)
  assert.match(pdfSource, /-CFP\.pdf/)
  assert.match(pdfSource, /O\/A Professor\(a\)/)
  assert.match(previewSource, /Folha de avaliação final/)
  assert.match(previewSource, /Avaliação final · UFCD\/UC/)
  assert.match(previewSource, /Exportar PDF · CFP/)
  assert.match(previewSource, /Exportar Excel completo/)
  assert.match(previewSource, /O PDF contém apenas a CFP/)
})

test('final assessment sheet edits ACS, self-assessment and final grade in the CFP', () => {
  assert.match(previewSource, /type="checkbox"/)
  assert.match(previewSource, /ACS de \$\{sourceRow\.student\.name\}/)
  assert.match(previewSource, /Autoavaliação de \$\{sourceRow\.student\.name\}/)
  assert.match(previewSource, /Nível final de \$\{sourceRow\.student\.name\}/)
  assert.match(previewSource, /onDraftChange/)
  assert.match(previewSource, /pendingRows/)
  assert.match(previewSource, /Guardar \/ confirmar/)
  assert.match(previewSource, /finalGrades\.length/)
})

test('CFP preview and PDF preserve six coloured domain slots', () => {
  assert.match(previewSource, /5 - model\.criteria\.length/)
  assert.match(previewSource, /blankDomainSlots/)
  assert.match(previewSource, /criterionColor\(\s*model\.criteria\.length\s*\)/)
  assert.match(pdfSource, /5 - model\.criteria\.length/)
  assert.match(pdfSource, /blankDomainSlotCount/)
  assert.match(pdfSource, /criterionColor\(\s*model\.criteria\.length\s*\)/)
})

test('final-grade wrapper uses the CFP as the only final-grade sheet', () => {
  assert.match(wrapperSource, /UfcdCfpPreview/)
  assert.match(wrapperSource, /gradeDrafts=\{props\.gradeDrafts\}/)
  assert.match(wrapperSource, /onSaveStudent=\{[\s\S]*props\.onSaveStudent/)
  assert.doesNotMatch(wrapperSource, /ma-professor-cfp-editor/)
  assert.doesNotMatch(wrapperSource, /<BaseUfcdFinalGradeGrid/)
})
