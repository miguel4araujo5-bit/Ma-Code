import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const modelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdCfpModel.ts',
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

const pdfSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdCfpPdfExport.ts',
    import.meta.url
  ),
  'utf8'
)

const previewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/UfcdCfpPreview.tsx',
    import.meta.url
  ),
  'utf8'
)

const wrapperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/UfcdFinalGradeGrid.tsx',
    import.meta.url
  ),
  'utf8'
)

function dataUrl(value) {
  return `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`
}

const runtimeSource = ts.transpileModule(
  modelSource,
  {
    fileName: 'ufcdCfpModel.ts',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    }
  }
).outputText

const modelModule = await import(
  dataUrl(runtimeSource)
)

const snapshot = {
  academicYear: {
    name: '2026-2027'
  },
  selectedGroup: {
    name: '10.º D',
    courseName: 'Técnico de Apoio Psicossocial (TAP)',
    gradeLevel: '1.º Ano'
  },
  selectedSubject: {
    name: 'Área de Expressões'
  },
  selectedModule: {
    code: 'UFCD-10385',
    name: 'Expressão Dramática'
  },
  criteria: [
    {
      id: 'd1',
      name: 'Domínio 1',
      weightPercent: 60
    },
    {
      id: 'd2',
      name: 'Domínio 2',
      weightPercent: 20
    },
    {
      id: 'd3',
      name: 'Domínio 3',
      weightPercent: 20
    }
  ],
  studentRows: [
    {
      student: {
        number: '1',
        name: 'Aluno Regular'
      },
      gradeSummary: {
        provisionalAverage: 15.4,
        confirmedFinalGrade: 15,
        criteria: [
          { criterionId: 'd1', average: 16 },
          { criterionId: 'd2', average: 14 },
          { criterionId: 'd3', average: 14 }
        ]
      },
      finalGradeRecord: {
        usesAcs: false,
        selfAssessmentGrade: 15,
        confirmedAt: '2027-02-20T10:00:00.000Z'
      }
    },
    {
      student: {
        number: '2',
        name: 'Aluno ACS'
      },
      gradeSummary: {
        provisionalAverage: 17.2,
        confirmedFinalGrade: 17,
        criteria: [
          { criterionId: 'd1', average: 17 },
          { criterionId: 'd2', average: 18 },
          { criterionId: 'd3', average: 17 }
        ]
      },
      finalGradeRecord: {
        usesAcs: true,
        selfAssessmentGrade: 18,
        confirmedAt: '2027-02-21T10:00:00.000Z'
      }
    }
  ]
}

test(
  'CFP model uses the configured criteria and keeps ACS in the official dedicated column',
  () => {
    const model =
      modelModule.buildUfcdCfpModel(
        snapshot
      )

    assert.deepEqual(
      model.criteria.map(item => [item.label, item.weightPercent]),
      [
        ['D1', 60],
        ['D2', 20],
        ['D3', 20]
      ]
    )

    assert.deepEqual(
      model.rows[0].criterionScores,
      [16, 14, 14]
    )
    assert.equal(
      model.rows[0].acsScore,
      null
    )

    assert.deepEqual(
      model.rows[1].criterionScores,
      [null, null, null]
    )
    assert.equal(
      model.rows[1].acsScore,
      17.2
    )
    assert.equal(
      model.completionDate,
      '21/02/2027'
    )
  }
)

test(
  'Excel export builds the complete official workbook structure instead of one invented final sheet',
  () => {
    for (const sheetName of [
      'HOME',
      'P1I1',
      'P1I2',
      'P1I3',
      'P1I4',
      'P1I5',
      'P2I1',
      'P2I2',
      'P2I3',
      'P2I4',
      'P2I5',
      'P3I1',
      'P3I2',
      'P3I3',
      'P3I4',
      'P3I5',
      'PRINT',
      'CFP',
      'PRINTCFP',
      'AUTO'
    ]) {
      assert.match(
        excelSource,
        new RegExp(`['\"]${sheetName}['\"]`)
      )
    }

    assert.match(
      excelSource,
      /momentSheetName\(index\)/
    )
    assert.match(
      excelSource,
      /left\.lesson\.date\.localeCompare/
    )
    assert.match(
      excelSource,
      /assessmentResults[\s\S]*anyOf\(assessmentIds\)/
    )
    assert.match(
      excelSource,
      /-Completo\.xlsx/
    )
    assert.doesNotMatch(
      excelSource,
      /sheetName:\s*'Grelha Final'/
    )
  }
)

test(
  'PDF and preview are explicitly CFP-only while exposing both export choices',
  () => {
    assert.match(
      pdfSource,
      /buildUfcdCfpModel/
    )
    assert.match(
      pdfSource,
      /-CFP\.pdf/
    )
    assert.match(
      pdfSource,
      /O\/A Professor\(a\)/
    )
    assert.match(
      previewSource,
      /Pré-visualização da folha CFP/
    )
    assert.match(
      previewSource,
      /Exportar PDF · CFP/
    )
    assert.match(
      previewSource,
      /Exportar Excel completo/
    )
    assert.match(
      previewSource,
      /O PDF contém apenas a CFP/
    )
  }
)

test(
  'CFP preview and PDF preserve the six coloured domain slots from the reference sheet',
  () => {
    assert.match(
      previewSource,
      /5 - model\.criteria\.length/
    )
    assert.match(
      previewSource,
      /blankDomainSlots/
    )
    assert.match(
      previewSource,
      /criterionColor\(\s*model\.criteria\.length\s*\)/
    )

    assert.match(
      pdfSource,
      /5 - model\.criteria\.length/
    )
    assert.match(
      pdfSource,
      /blankDomainSlotCount/
    )
    assert.match(
      pdfSource,
      /criterionColor\(\s*model\.criteria\.length\s*\)/
    )
  }
)

test(
  'final-grade wrapper shows the CFP preview and hides the legacy duplicate export control',
  () => {
    assert.match(
      wrapperSource,
      /UfcdCfpPreview/
    )
    assert.match(
      wrapperSource,
      /ma-professor-cfp-editor/
    )
    assert.match(
      wrapperSource,
      /div:first-child button \{ display: none; \}/
    )
  }
)
