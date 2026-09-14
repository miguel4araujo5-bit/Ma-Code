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
        name: 'Ana Exemplo'
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
        name: 'André Exemplo'
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
  'legacy Excel model still follows dynamic criteria for import/compatibility helpers',
  () => {
    const model =
      modelModule.buildUfcdFinalGradeExcelModel(
        snapshot
      )

    assert.equal(
      model.rows[2][3],
      0.6
    )
    assert.equal(
      model.rows[2][4],
      0.4
    )

    const regular =
      model.rows.find(
        row =>
          row[2] ===
          'Ana Exemplo'
      )

    assert.ok(regular)
    assert.equal(
      regular[3],
      16.81
    )
    assert.equal(
      regular[4],
      16.8
    )
  }
)

test(
  'Excel export delegates to the original-template exporter',
  () => {
    assert.match(
      exportSource,
      /export \{\s*exportUfcdFinalGradeExcel\s*\} from '\.\/ufcdOfficialTemplateExport'/
    )
    assert.doesNotMatch(
      exportSource,
      /bookType:\s*'xlsx'/
    )
  }
)

test(
  'final grid still blocks export while drafts are dirty',
  () => {
    assert.match(
      gridSource,
      /exportUfcdFinalGradeExcel/
    )
    assert.match(
      gridSource,
      /const hasDirtyDrafts\s*=/
    )
    assert.match(
      gridSource,
      /Guarde as alterações antes de exportar\./
    )
    assert.match(
      gridSource,
      /Exportar Excel/
    )
    assert.match(
      gridSource,
      /hasDirtyDrafts\s*\|\|/
    )
  }
)
