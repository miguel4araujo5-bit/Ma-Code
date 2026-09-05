import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const membershipSource = await readFile(
  new URL(
    '../../src/components/ma-professor/students/studentMembership.ts',
    import.meta.url
  ),
  'utf8'
)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/repository.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )

  assert.equal(errors.length, 0)

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

test(
  'reactivating a legacy student starts an explicit membership period on the reactivation date',
  async () => {
    const membership = await import(
      transpile(membershipSource)
    )

    assert.deepEqual(
      membership.reopenStudentMembership(
        undefined,
        '2026-11-10'
      ),
      [
        {
          startDate: '2026-11-10',
          endDate: null
        }
      ]
    )

    assert.deepEqual(
      membership.reopenStudentMembership(
        [],
        '2026-11-10'
      ),
      [
        {
          startDate: '2026-11-10',
          endDate: null
        }
      ]
    )
  }
)

test(
  'reimporting an inactive existing student reopens membership instead of only flipping active',
  () => {
    assert.match(
      repositorySource,
      /reopenStudentMembership/
    )

    assert.match(
      repositorySource,
      /if\s*\(\s*current\s*\)[\s\S]{0,1200}current\.active[\s\S]{0,1200}reopenStudentMembership\([\s\S]{0,250}membershipStartDate/
    )
  }
)
