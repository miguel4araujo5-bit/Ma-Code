import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/assessmentCriteriaBatchRepository.ts',
    import.meta.url
  ),
  'utf8'
)

function getMethodBody(
  sourceText,
  startMarker
) {
  const start = sourceText.indexOf(
    startMarker
  )

  assert.notEqual(
    start,
    -1,
    `Não foi encontrado ${startMarker}`
  )

  return sourceText.slice(
    start
  )
}

test(
  'subject criteria batch validates the whole selection before any write',
  () => {
    const method =
      getMethodBody(
        source,
        'async createSubjectSchemes('
      )

    const transactionIndex =
      method.indexOf(
        'maProfessorDb.transaction('
      )

    const bulkAddIndex =
      method.indexOf(
        '.bulkAdd('
      )

    assert.notEqual(
      transactionIndex,
      -1
    )
    assert.notEqual(
      bulkAddIndex,
      -1
    )
    assert.ok(
      bulkAddIndex >
        transactionIndex,
      'Nenhum bulkAdd pode ocorrer antes da transação atómica.'
    )

    assert.ok(
      method.indexOf(
        'assertAssignmentIds('
      ) <
        transactionIndex
    )
    assert.ok(
      method.indexOf(
        'validateCriteria('
      ) <
        transactionIndex
    )
    assert.ok(
      method.indexOf(
        'assertAssignments('
      ) <
        transactionIndex
    )
    assert.ok(
      method.indexOf(
        'assertNoExistingSubjectSchemes('
      ) <
        transactionIndex
    )
  }
)

test(
  'subject criteria batch revalidates stale selection inside the transaction',
  () => {
    const method =
      getMethodBody(
        source,
        'async createSubjectSchemes('
      )

    const transactionIndex =
      method.indexOf(
        'maProfessorDb.transaction('
      )

    const transactionBody =
      method.slice(
        transactionIndex
      )

    assert.match(
      transactionBody,
      /teachingAssignments[\s\S]*assessmentSchemes[\s\S]*assessmentCriteria/
    )
    assert.match(
      transactionBody,
      /assertAssignments\(/
    )
    assert.match(
      transactionBody,
      /assertNoExistingSubjectSchemes\(/
    )
    assert.match(
      transactionBody,
      /assessmentSchemes[\s\S]*bulkAdd\(/
    )
    assert.match(
      transactionBody,
      /assessmentCriteria[\s\S]*bulkAdd\(/
    )
  }
)

test(
  'subject criteria batch keeps subject scope and no module binding',
  () => {
    assert.match(
      source,
      /moduleId:\s*null/
    )
    assert.match(
      source,
      /scope:\s*'subject'/
    )
  }
)

test(
  'subject criteria batch rejects duplicate assignment selection and existing active subject schemes',
  () => {
    assert.match(
      source,
      /A mesma turma e disciplina não pode ser selecionada mais do que uma vez\./
    )
    assert.match(
      source,
      /scheme\.active\s*&&[\s\S]*scheme\.scope\s*===\s*'subject'/
    )
    assert.match(
      source,
      /já possuem critérios gerais\./
    )
  }
)
