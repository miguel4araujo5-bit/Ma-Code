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

const templateExporterSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdOfficialTemplateExport.ts',
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
        id: 'regular',
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
        id: 'acs',
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
  'CFP keeps D1 D2 D3 as regular criteria and routes ACS students outside those columns',
  () => {
    const model =
      modelModule.buildUfcdCfpModel(
        snapshot
      )

    assert.deepEqual(
      model.criteria.map(item => [
        item.label,
        item.weightPercent
      ]),
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
  }
)

test(
  'Excel export uses the original macro-enabled template and maps ACS to D4 rather than replacing D3',
  () => {
    assert.match(
      excelSource,
      /ufcdOfficialTemplateExport/
    )
    assert.match(
      templateExporterSource,
      /xl\/vbaProject\.bin/
    )
    assert.match(
      templateExporterSource,
      /-Completo\.xlsm/
    )
    assert.match(
      templateExporterSource,
      /GENERAL_COLUMNS = \[\s*'E',\s*'F',\s*'G'/
    )
    assert.match(
      templateExporterSource,
      /criterion\s*\?\s*`D\$\{index \+ 1\}`/
    )
    assert.match(
      templateExporterSource,
      /'E18',[\s\S]*'ACS'/
    )
    assert.match(
      templateExporterSource,
      /'F18',[\s\S]*100/
    )
    assert.match(
      templateExporterSource,
      /`\$\{column\}12`,[\s\S]*'D4'/
    )
    assert.match(
      templateExporterSource,
      /usesAcs/
    )
  }
)

test(
  'PDF and preview stay CFP-only while Excel remains a separate complete-workbook action',
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
