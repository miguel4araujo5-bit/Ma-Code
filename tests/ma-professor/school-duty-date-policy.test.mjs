import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/schoolDutyDatePolicy.ts',
    import.meta.url
  ),
  'utf8'
)

const output = ts.transpileModule(
  source,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  }
)

const errors =
  (output.diagnostics || []).filter(
    diagnostic =>
      diagnostic.category ===
        ts.DiagnosticCategory.Error
  )

assert.equal(
  errors.length,
  0,
  errors.map(
    diagnostic =>
      ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      )
  ).join('\n')
)

const moduleUrl =
  `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`

const {
  getDutyDatesForSchool,
  isSBentoSchoolName
} = await import(moduleUrl)

const academicYear = {
  id: 'year-2026-2027',
  name: '2026/2027',
  startDate: '2026-09-01',
  endDate: '2027-06-30'
}

test(
  'recognizes the S. Bento school without treating unrelated schools as the preset',
  () => {
    assert.equal(
      isSBentoSchoolName(
        'Agrupamento de Escolas de S. Bento, Vizela'
      ),
      true
    )

    assert.equal(
      isSBentoSchoolName(
        'EBS S. Bento'
      ),
      true
    )

    assert.equal(
      isSBentoSchoolName(
        'Escola Secundária de Vizela'
      ),
      false
    )

    assert.equal(
      isSBentoSchoolName(
        'Outra Escola de S. Bento, Porto'
      ),
      false
    )
  }
)

test(
  'keeps the S. Bento 2026/2027 ranges and closed dates',
  () => {
    const mondays =
      getDutyDatesForSchool(
        academicYear,
        1,
        'Agrupamento de Escolas de S. Bento, Vizela'
      )

    assert.equal(
      mondays.includes('2026-09-21'),
      true
    )

    assert.equal(
      mondays.includes('2026-09-14'),
      false
    )

    assert.equal(
      mondays.includes('2026-10-05'),
      false
    )

    assert.equal(
      mondays.includes('2027-06-14'),
      false
    )
  }
)

test(
  'does not apply S. Bento dates to another school in the same academic year',
  () => {
    const mondays =
      getDutyDatesForSchool(
        academicYear,
        1,
        'Escola Secundária Exemplo'
      )

    assert.equal(
      mondays.includes('2026-09-14'),
      true
    )

    assert.equal(
      mondays.includes('2026-10-05'),
      true
    )

    assert.equal(
      mondays.includes('2027-06-14'),
      true
    )
  }
)
