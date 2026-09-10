import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/modulePlanificationImportRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const moduleParserSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/moduleStylePlanificationPdfParser.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'module-style parser and persistence agree on alphanumeric curricular unit codes',
  () => {
    assert.match(
      moduleParserSource,
      /normalizeModuleCode/
    )
    assert.match(
      moduleParserSource,
      /M\$\{compact\}/
    )
    assert.match(
      repositorySource,
      /validModuleCode = \(value: string\) => \/\^\[A-Za-z0-9\]/
    )
    assert.doesNotMatch(
      repositorySource,
      /!\/\^\\d\{3,6\}\$\/\.test\(row\.code\)/
    )
  }
)

test(
  'planification titles distinguish numeric UFCD codes from other module codes',
  () => {
    assert.match(
      repositorySource,
      /moduleKindLabel = \(code: string\) => \/\^\\d\{3,6\}\$\/\.test\(clean\(code\)\) \? 'UFCD' : 'Módulo'/
    )
    assert.match(
      repositorySource,
      /title: `Planificação — \$\{kind\} \$\{row\.code\} · \$\{row\.name\.trim\(\)\}`/
    )
  }
)

test(
  'module code validation remains bounded and rejects arbitrary free text',
  () => {
    const match = repositorySource.match(
      /validModuleCode = \(value: string\) => (\/\^[^\n]+\/)[.]test\(clean\(value\)\)/
    )

    assert.ok(match, 'missing module code validation expression')
    const pattern = Function(`return ${match[1]}`)()

    for (const value of ['10385', 'M1', 'P1', 'P2', 'OP5', 'OP8', 'M1.2']) {
      assert.equal(pattern.test(value), true, value)
    }

    for (const value of ['', 'P 1', 'Módulo 1', 'abc def', 'A'.repeat(17), '<script>']) {
      assert.equal(pattern.test(value), false, value)
    }
  }
)
