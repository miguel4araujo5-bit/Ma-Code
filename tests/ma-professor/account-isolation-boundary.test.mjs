import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const productSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/MAProfessorProduct.tsx',
    import.meta.url
  ),
  'utf8'
)

const pageSource = await readFile(
  new URL(
    '../../src/pages/MAProfessorPage.tsx',
    import.meta.url
  ),
  'utf8'
)

const isolationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/access/AccountIsolationGate.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'pedagogical database consumers mount only after account isolation succeeds',
  () => {
    const accessGate =
      productSource.indexOf(
        '<AccessGate>'
      )

    const isolationGate =
      productSource.indexOf(
        '<AccountIsolationGate>',
        accessGate
      )

    const readinessReporter =
      productSource.indexOf(
        '<OperationalReadinessReporter />',
        isolationGate
      )

    const schoolBootstrap =
      productSource.indexOf(
        '<InitialSchoolCalendarBootstrap>',
        isolationGate
      )

    const productContent =
      productSource.indexOf(
        '<ProductContent />',
        schoolBootstrap
      )

    const isolationClose =
      productSource.indexOf(
        '</AccountIsolationGate>',
        productContent
      )

    assert.ok(accessGate >= 0)
    assert.ok(isolationGate > accessGate)
    assert.ok(readinessReporter > isolationGate)
    assert.ok(schoolBootstrap > isolationGate)
    assert.ok(productContent > schoolBootstrap)
    assert.ok(isolationClose > productContent)
  }
)

test(
  'page shell does not mount pedagogical database consumers before the product isolation boundary',
  () => {
    assert.doesNotMatch(
      pageSource,
      /OperationalReadinessReporter/
    )

    assert.doesNotMatch(
      pageSource,
      /InitialSchoolCalendarBootstrap/
    )

    assert.match(
      pageSource,
      /<MAProfessorProduct\s*\/>/
    )
  }
)

test(
  'different account with meaningful local data is blocked instead of receiving children',
  () => {
    const differentOwnerCheck =
      isolationSource.indexOf(
        'const sameOwner ='
      )

    const localDataCheck =
      isolationSource.indexOf(
        'await hasMeaningfulLocalData()',
        differentOwnerCheck
      )

    const conflictStage =
      isolationSource.indexOf(
        "setStage(\n                'conflict'",
        localDataCheck
      )

    const readyChildren =
      isolationSource.indexOf(
        "stage ===\n    'ready'"
      )

    assert.ok(differentOwnerCheck >= 0)
    assert.ok(localDataCheck > differentOwnerCheck)
    assert.ok(conflictStage > localDataCheck)
    assert.ok(readyChildren > conflictStage)

    assert.match(
      isolationSource,
      /esta conta não pode abrir, alterar ou sincronizar esses dados/i
    )
  }
)
