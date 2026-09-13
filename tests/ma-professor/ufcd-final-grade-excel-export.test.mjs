import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const modelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdFinalGradeExcelModel.ts',
    import.meta.url
  ),
  'utf8'
)

const exportSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdFinalGradeExcelExport.ts',
    import.meta.url
  ),
  'utf8'
)

const gridSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/UfcdFinalGradeGridBase.tsx',
    import.meta.url
  ),
  'utf8'
)

function dataUrl(value) {
  return `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`
}

const runtimeSource = ts.transpileModule(modelSource, {
  fileName: 'ufcdFinalGradeExcelModel.ts',
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022
  }
}).outputText

const modelModule = await import(dataUrl(runtimeSource))

const snapshot = {
  academicYear: {
    id: 'year-1',
    name: '2025-2026'
  },
  selectedGroup: {
    id: 'group-1',
    name: '12.º E',
    courseName: 'Técnico de Apoio Psicossocial (TAP)',
    gradeLevel: '3.º Ano'
  },
  selectedSubject: {
    id: 'subject-1',
    name: 'Área de Expressões'
  },
  selectedModule: {
    id: 'module-1',
    code: 'UFCD-10383',
    name: 'Laboratório de competências sociais'
  },
  criteria: [
    {
      id: 'criterion-1',
      name: 'Domínio 1',
      weightPercent: 60
    },
    {
      id: 'criterion-2',
      name: 'Domínio 2',
      weightPercent: 40
    }
  ],
  studentRows: [
    {
      student: {
        id: 'student-1',
        number: '2',
        name: 'Ana Claudia Miranda Peixoto'
      },
      gradeSummary: {
        provisionalAverage: 16.8,
        confirmedFinalGrade: 17,
        criteria: [
          {
            criterionId: 'criterion-1',
            average: 16.81
          },
          {
            criterionId: 'criterion-2',
            average: 16.8
          }
        ]
      },
      finalGradeRecord: {
        usesAcs: false,
        selfAssessmentGrade: 12,
        confirmedAt: '2026-02-25T10:00:00.000Z'
      }
    },
    {
      student: {
        id: 'student-2',
        number: '3',
        name: 'André Miguel Almeida Ferreira'
      },
      gradeSummary: {
        provisionalAverage: 9.8,
        confirmedFinalGrade: 10,
        criteria: [
          {
            criterionId: 'criterion-1',
            average: 9.67
          },
          {
            criterionId: 'criterion-2',
            average: 9.99
          }
        ]
      },
      finalGradeRecord: {
        usesAcs: true,
        selfAssessmentGrade: null,
        confirmedAt: '2026-02-25T11:00:00.000Z'
      }
    }
  ]
}

test(
  'Excel model follows the reference grid while using real dynamic criteria',
  () => {
    const model = modelModule.buildUfcdFinalGradeExcelModel(snapshot)

    assert.equal(model.rows[0][0], 'CÁLCULOS DE FINAL DE MÓDULO/UFCD')
    assert.equal(model.rows[2][3], 0.6)
    assert.equal(model.rows[2][4], 0.4)
    assert.equal(model.rows[2][5], 1)

    assert.deepEqual(
      model.rows[3],
      [
        'Nº Processo',
        'Nº',
        'Aluno / Domínio',
        'D1',
        'D2',
        'ACS',
        'Nível Automático',
        'Autoavaliação',
        'Nível Final',
        'Assinatura do Formando'
      ]
    )

    const ana = model.rows.find(row => row[2] === 'Ana Claudia Miranda Peixoto')
    assert.ok(ana)
    assert.equal(ana[0], '')
    assert.equal(ana[1], '2')
    assert.equal(ana[3], 16.81)
    assert.equal(ana[4], 16.8)
    assert.equal(ana[5], null)
    assert.equal(ana[6], 16.8)
    assert.equal(ana[7], 12)
    assert.equal(ana[8], 17)
    assert.equal(ana[9], '')

    const andre = model.rows.find(row => row[2] === 'André Miguel Almeida Ferreira')
    assert.ok(andre)
    assert.equal(andre[3], null)
    assert.equal(andre[4], null)
    assert.equal(andre[5], 9.8)
    assert.equal(andre[8], 10)

    assert.match(model.fileName, /^Grelha-Avaliacao-.*\.xlsx$/)
  }
)

test(
  'Excel model builds the global evaluation summary from confirmed grades',
  () => {
    const model = modelModule.buildUfcdFinalGradeExcelModel(snapshot)
    const summaryIndex = model.rows.findIndex(
      row => row[0] === 'AVALIAÇÃO GLOBAL'
    )

    assert.ok(summaryIndex > 0)
    assert.deepEqual(
      model.rows[summaryIndex].slice(0, 8),
      [
        'AVALIAÇÃO GLOBAL',
        '1 - 6',
        '7 - 9',
        '10 - 13',
        '14 - 17',
        '18 - 20',
        'NEGATIVO',
        'POSITIVO'
      ]
    )
    assert.deepEqual(
      model.rows[summaryIndex + 1].slice(0, 8),
      ['Nº', 0, 0, 1, 1, 0, 0, 2]
    )

    const details = model.rows.find(
      row => row[0] === 'Formandos Avaliados'
    )
    assert.ok(details)
    assert.equal(details[1], 2)
    assert.equal(details[3], 'Data de Conclusão do Módulo')
    assert.equal(details[4], '25/02/2026')
  }
)

test(
  'Excel download reuses the existing client download helper and lazy-loads xlsx',
  () => {
    assert.match(exportSource, /await import\('xlsx'\)/)
    assert.match(exportSource, /downloadBlob/)
    assert.match(exportSource, /bookType:\s*'xlsx'/)
    assert.match(exportSource, /compression:\s*true/)
  }
)

test(
  'final grid exports only persisted values and blocks export while drafts are dirty',
  () => {
    assert.match(gridSource, /exportUfcdFinalGradeExcel/)
    assert.match(gridSource, /const hasDirtyDrafts\s*=/)
    assert.match(gridSource, /Guarde as alterações antes de exportar\./)
    assert.match(gridSource, /Exportar Excel/)
    assert.match(gridSource, /hasDirtyDrafts\s*\|\|/)
  }
)
