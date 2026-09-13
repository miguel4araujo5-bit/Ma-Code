import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const parserSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdFinalGradeExcelImport.ts',
    import.meta.url
  ),
  'utf8'
)

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/UfcdFinalGradeExcelImportPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const gridSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/UfcdFinalGradeGrid.tsx',
    import.meta.url
  ),
  'utf8'
)

function transpile(
  source,
  fileName = 'ufcdFinalGradeExcelImport.ts'
) {
  const output =
    ts.transpileModule(
      source,
      {
        fileName,
        compilerOptions: {
          module:
            ts.ModuleKind.ESNext,
          target:
            ts.ScriptTarget.ES2022,
          jsx:
            ts.JsxEmit.ReactJSX
        },
        reportDiagnostics: true
      }
    )

  const errors =
    (output.diagnostics || [])
      .filter(
        item =>
          item.category ===
          ts.DiagnosticCategory.Error
      )

  assert.equal(
    errors.length,
    0,
    errors
      .map(item => item.messageText)
      .join('\n')
  )

  return output.outputText
}

const parser = await import(
  `data:text/javascript;base64,${Buffer.from(
    transpile(parserSource)
  ).toString('base64')}`
)

const referenceRows = [
  [
    'CÁLCULOS DE FINAL DE MÓDULO/UFCD',
    '',
    '',
    'CURSO: Curso de Teste',
    '',
    '',
    'MÓDULO/UFCD: UFCD-10383 Laboratório de teste'
  ],
  [
    'Disciplina: Área de Expressões',
    '',
    '',
    'Ano: 3.º Ano',
    '',
    'Turma: E',
    '',
    'Ano letivo: 2025-2026'
  ],
  [
    '',
    '',
    '',
    '60%',
    '40%',
    '100%'
  ],
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
  ],
  [
    '9001',
    '2',
    'Aluno Exemplo A',
    null,
    null,
    16.81,
    16.8,
    12,
    17,
    ''
  ],
  [
    '9002',
    '3',
    'Aluno Exemplo B',
    9.67,
    9.99,
    null,
    9.8,
    null,
    10,
    ''
  ],
  [
    'AVALIAÇÃO GLOBAL'
  ]
]

function snapshot(
  overrides = {}
) {
  return {
    academicYear: {
      id: 'year-1',
      name: '2025/2026'
    },
    selectedModule: {
      id: 'module-1',
      code: '10383',
      name: 'Laboratório de teste'
    },
    selectedGroup: {
      id: 'group-1',
      name: 'E'
    },
    studentRows: [
      {
        student: {
          id: 'student-a',
          number: '2',
          name: 'Aluno Exemplo A'
        }
      },
      {
        student: {
          id: 'student-b',
          number: '3',
          name: 'Aluno Exemplo B'
        }
      }
    ],
    ...overrides
  }
}

test(
  'reference-like final grid is detected without importing domains or automatic level',
  () => {
    const parsed =
      parser.parseUfcdFinalGradeSpreadsheetRows(
        referenceRows,
        'PRINTCFP'
      )

    assert.ok(parsed)
    assert.equal(
      parsed.sheetName,
      'PRINTCFP'
    )
    assert.equal(
      parsed.moduleCode,
      '10383'
    )
    assert.equal(
      parsed.academicYearLabel,
      '2025-2026'
    )
    assert.equal(
      parsed.rows.length,
      2
    )

    const preview =
      parser.buildUfcdFinalGradeImportPreview(
        snapshot(),
        parsed,
        'grelha.xlsm'
      )

    assert.deepEqual(
      preview.blockingErrors,
      []
    )
    assert.equal(
      preview.matchedCount,
      2
    )

    const acs =
      preview.rows[0]
    assert.equal(
      acs.studentId,
      'student-a'
    )
    assert.equal(
      acs.status,
      'matched'
    )
    assert.deepEqual(
      acs.draftChanges,
      {
        finalGrade: '17',
        selfAssessmentGrade:
          '12',
        usesAcs: true
      }
    )

    const normal =
      preview.rows[1]
    assert.equal(
      normal.studentId,
      'student-b'
    )
    assert.deepEqual(
      normal.draftChanges,
      {
        finalGrade: '10',
        usesAcs: false
      }
    )

    for (const row of preview.rows) {
      assert.equal(
        'automatic' in
          row.draftChanges,
        false
      )
      assert.equal(
        'd1' in row.draftChanges,
        false
      )
      assert.equal(
        'd2' in row.draftChanges,
        false
      )
    }

    assert.ok(
      preview.warnings.some(
        message =>
          /Nível Automático/.test(
            message
          )
      )
    )
  }
)

test(
  'module and academic-year mismatches block applying the imported grid',
  () => {
    const parsed =
      parser.parseUfcdFinalGradeSpreadsheetRows(
        referenceRows,
        'PRINTCFP'
      )

    assert.ok(parsed)

    const wrongModule =
      parser.buildUfcdFinalGradeImportPreview(
        snapshot({
          selectedModule: {
            id: 'module-2',
            code: '10390',
            name: 'Outra UFCD'
          }
        }),
        parsed,
        'grelha.xlsm'
      )

    assert.match(
      wrongModule.blockingErrors
        .join('\n'),
      /10383[\s\S]*10390/
    )

    const wrongYear =
      parser.buildUfcdFinalGradeImportPreview(
        snapshot({
          academicYear: {
            id: 'year-2',
            name: '2026/2027'
          }
        }),
        parsed,
        'grelha.xlsm'
      )

    assert.match(
      wrongYear.blockingErrors
        .join('\n'),
      /2025-2026[\s\S]*2026\/2027/
    )
  }
)

test(
  'student matching prefers consistent number/name and fails closed on conflicts and duplicates',
  () => {
    const parsed =
      parser.parseUfcdFinalGradeSpreadsheetRows(
        referenceRows,
        'PRINTCFP'
      )

    assert.ok(parsed)

    const conflictingRows = {
      ...parsed,
      rows: [
        {
          ...parsed.rows[0],
          studentNumber: '2',
          studentName:
            'Aluno Exemplo B'
        }
      ]
    }

    const conflictPreview =
      parser.buildUfcdFinalGradeImportPreview(
        snapshot(),
        conflictingRows,
        'grelha.xlsm'
      )

    assert.equal(
      conflictPreview.rows[0]
        .status,
      'ambiguous'
    )
    assert.equal(
      conflictPreview.matchedCount,
      0
    )

    const duplicatedRows = {
      ...parsed,
      rows: [
        parsed.rows[0],
        {
          ...parsed.rows[0],
          sourceRow: 99
        }
      ]
    }

    const duplicatePreview =
      parser.buildUfcdFinalGradeImportPreview(
        snapshot(),
        duplicatedRows,
        'grelha.xlsm'
      )

    assert.equal(
      duplicatePreview.matchedCount,
      0
    )
    assert.equal(
      duplicatePreview.ambiguousCount,
      2
    )
  }
)

test(
  'invalid grades are not silently repaired into final-grade drafts',
  () => {
    const rows =
      referenceRows.map(row =>
        [...row]
      )

    rows[4][8] = 21
    rows[4][7] = 12.5

    const parsed =
      parser.parseUfcdFinalGradeSpreadsheetRows(
        rows,
        'PRINTCFP'
      )

    assert.ok(parsed)

    const first =
      parsed.rows[0]

    assert.equal(
      first.finalGrade,
      undefined
    )
    assert.equal(
      first.selfAssessmentGrade,
      undefined
    )
    assert.ok(
      first.warnings.length >= 2
    )
  }
)

test(
  'PRINTCFP wins only as a safe tie-breaker after structural detection',
  () => {
    const base =
      parser.parseUfcdFinalGradeSpreadsheetRows(
        referenceRows,
        'Outra folha'
      )
    const print =
      parser.parseUfcdFinalGradeSpreadsheetRows(
        referenceRows,
        'PRINTCFP'
      )

    assert.ok(base)
    assert.ok(print)

    const chosen =
      parser.chooseUfcdFinalGradeSheet([
        base,
        print
      ])

    assert.equal(
      chosen.sheetName,
      'PRINTCFP'
    )

    const structurallyStronger = {
      ...base,
      sheetName:
        'Folha estrutural',
      headerScore:
        print.headerScore + 1
    }

    const strongerChosen =
      parser.chooseUfcdFinalGradeSheet([
        print,
        structurallyStronger
      ])

    assert.equal(
      strongerChosen.sheetName,
      'Folha estrutural'
    )
  }
)

test(
  'supported final-grid spreadsheet extensions include xlsx, xlsm and xls only',
  () => {
    for (const name of [
      'grelha.xlsx',
      'grelha.xlsm',
      'grelha.xls'
    ]) {
      assert.equal(
        parser
          .isSupportedUfcdFinalGradeExcelFileName(
            name
          ),
        true
      )
    }

    assert.equal(
      parser
        .isSupportedUfcdFinalGradeExcelFileName(
          'grelha.csv'
        ),
      false
    )
  }
)

test(
  'final-grid import remains local and read-only until teacher applies drafts',
  () => {
    assert.match(
      parserSource,
      /await import\('xlsx'\)/
    )
    assert.match(
      parserSource,
      /file\.arrayBuffer\(\)/
    )
    assert.doesNotMatch(
      parserSource,
      /XLSX\.write|writeFile|fetch\(|maProfessorDb|wrangler|cloudflare/i
    )

    assert.match(
      panelSource,
      /Aplicar ao rascunho/
    )
    assert.match(
      panelSource,
      /O ficheiro original nunca é alterado/
    )
    assert.match(
      panelSource,
      /não grava na base de dados/
    )
    assert.doesNotMatch(
      panelSource,
      /saveModuleFinalGrade|moduleFinalGrades|maProfessorDb/
    )
  }
)

test(
  'managed final grid wires imported values into the existing protected grade drafts',
  () => {
    transpile(
      panelSource,
      'UfcdFinalGradeExcelImportPanel.tsx'
    )
    transpile(
      gridSource,
      'UfcdFinalGradeGrid.tsx'
    )

    assert.match(
      gridSource,
      /UfcdFinalGradeExcelImportPanel/
    )
    assert.match(
      gridSource,
      /hasDirtyGradeDrafts/
    )
    assert.match(
      gridSource,
      /disabled=\{importerDisabled\}/
    )
    assert.match(
      gridSource,
      /props\.onDraftChange\([\s\S]*studentId,[\s\S]*changes/
    )
    assert.doesNotMatch(
      gridSource,
      /saveModuleFinalGrade|moduleFinalGrades/
    )
  }
)
