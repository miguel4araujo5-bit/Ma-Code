import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/assessmentAtomicPersistenceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'quick-grade atomic API wraps assessment creation and results in one transaction',
  () => {
    const transactionIndex =
      source.indexOf('this.db.transaction(')
    const createIndex =
      source.indexOf('createLessonAssessment(')
    const resultsIndex =
      source.indexOf('saveAssessmentResults(')

    assert.notEqual(transactionIndex, -1)
    assert.notEqual(createIndex, -1)
    assert.notEqual(resultsIndex, -1)
    assert.ok(createIndex > transactionIndex)
    assert.ok(resultsIndex > createIndex)
    assert.match(source, /this\.db\.tables/)
  }
)

test(
  'quick-grade atomic API exposes no independent direct writes',
  () => {
    assert.doesNotMatch(
      source,
      /lessonAssessments\s*\.\s*(add|put|bulkAdd|bulkPut)\s*\(/
    )
    assert.doesNotMatch(
      source,
      /assessmentResults\s*\.\s*(add|put|bulkAdd|bulkPut)\s*\(/
    )
  }
)

test(
  'quick-grade atomic API preserves existing repository validation paths',
  () => {
    assert.match(
      source,
      /assessmentRepository/
    )
    assert.match(
      source,
      /createLessonAssessment/
    )
    assert.match(
      source,
      /saveAssessmentResults/
    )
  }
)
