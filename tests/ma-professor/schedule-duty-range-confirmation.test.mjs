import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const policySource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/schoolDutyDatePolicy.ts',
    import.meta.url
  ),
  'utf8'
)

const atomicSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleImportAtomicRepository.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(source, filename) {
  const output = ts.transpileModule(
    source,
    {
      fileName: filename,
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

  return output.outputText
}

const policyOutput = transpile(
  policySource,
  'schoolDutyDatePolicy.ts'
)

transpile(
  atomicSource,
  'scheduleImportAtomicRepository.ts'
)

const policy = await import(
  `data:text/javascript;base64,${Buffer.from(
    policyOutput
  ).toString('base64')}`
)

const academicYear = {
  id: 'year-2026-2027',
  name: '2026/2027',
  startDate: '2026-09-01',
  endDate: '2027-06-30'
}

function compact(source) {
  return source
    .replace(/\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const atomic = compact(atomicSource)

test(
  'known S. Bento 2026/2027 duty policy stays automatic while generic ranges require confirmation',
  () => {
    assert.equal(
      policy.requiresDutyDateRangeConfirmation(
        academicYear,
        'Agrupamento de Escolas de S. Bento, Vizela'
      ),
      false
    )

    assert.equal(
      policy.requiresDutyDateRangeConfirmation(
        academicYear,
        'Escola Secundária Exemplo'
      ),
      true
    )

    assert.equal(
      policy.requiresDutyDateRangeConfirmation(
        {
          ...academicYear,
          name: '2027/2028'
        },
        'Agrupamento de Escolas de S. Bento, Vizela'
      ),
      true
    )
  }
)

test(
  'generic duty range confirmation happens before any atomic write transaction',
  () => {
    assert.match(
      atomic,
      /requiresDutyDateRangeConfirmation/
    )
    assert.match(
      atomic,
      /typeof globalThis\.confirm !== 'function'/
    )
    assert.match(
      atomic,
      /não tem períodos letivos oficiais pré-configurados/
    )
    assert.match(
      atomic,
      /excluindo os dias já marcados no Calendário como interrupções ou feriados que bloqueiam aulas/
    )

    const confirmation = atomic.indexOf(
      'await confirmGenericDutyDateRange( input.academicYearId )'
    )
    const writeTransaction = atomic.indexOf(
      "maProfessorDb.transaction( 'rw'"
    )

    assert.ok(confirmation >= 0)
    assert.ok(writeTransaction > confirmation)
  }
)

test(
  'cancelling generic duty range confirmation explicitly promises no saved changes',
  () => {
    assert.match(
      atomic,
      /A programação dos cargos foi cancelada\. Nenhuma alteração foi guardada\./
    )
  }
)
