import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdFinalGradeExcelImport.ts',
    import.meta.url
  ),
  'utf8'
)

const javascript = ts.transpileModule(
  source,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText

const parser = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
)

function rows(moduleLabel) {
  return [
    [moduleLabel, '', '', 'Ano letivo: 2025-2026'],
    [
      'Nº Processo',
      'Nº',
      'Aluno / Domínio',
      'ACS',
      'Autoavaliação',
      'Nível Final'
    ],
    ['9001', '2', 'Aluno Exemplo', '', 15, 16],
    ['AVALIAÇÃO GLOBAL']
  ]
}

function snapshot() {
  return {
    academicYear: {
      id: 'year-1',
      name: '2025/2026'
    },
    selectedModule: {
      id: 'uc-33',
      code: 'UC00033',
      name: 'Comunicar e interagir em contexto profissional'
    },
    selectedGroup: {
      id: 'group-1',
      name: '10.º D'
    },
    studentRows: [
      {
        student: {
          id: 'student-1',
          number: '2',
          name: 'Aluno Exemplo'
        }
      }
    ]
  }
}

test(
  'final-grade Excel recognises an explicit UC-prefixed code',
  () => {
    const parsed = parser.parseUfcdFinalGradeSpreadsheetRows(
      rows('UC: UC00033'),
      'PRINTCFP'
    )

    assert.ok(parsed)
    assert.equal(parsed.moduleCode, 'UC00033')

    const preview = parser.buildUfcdFinalGradeImportPreview(
      snapshot(),
      parsed,
      'grelha-uc.xlsx'
    )

    assert.deepEqual(preview.blockingErrors, [])
  }
)

test(
  'final-grade Excel prefixes a bare numeric code when the heading identifies a UC',
  () => {
    const parsed = parser.parseUfcdFinalGradeSpreadsheetRows(
      rows('UC: 00033'),
      'PRINTCFP'
    )

    assert.ok(parsed)
    assert.equal(parsed.moduleCode, 'UC00033')

    const preview = parser.buildUfcdFinalGradeImportPreview(
      snapshot(),
      parsed,
      'grelha-uc.xlsx'
    )

    assert.deepEqual(preview.blockingErrors, [])
  }
)
