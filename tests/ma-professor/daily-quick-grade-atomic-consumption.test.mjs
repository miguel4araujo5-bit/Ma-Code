import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sectionSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/DailyLessonAssessmentSection.tsx',
    import.meta.url
  ),
  'utf8'
)

const atomicRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessmentAtomicPersistenceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)

  assert.notEqual(start, -1, `Não foi encontrado ${startMarker}`)
  assert.notEqual(end, -1, `Não foi encontrado ${endMarker}`)

  return source.slice(start, end)
}

test(
  'new Daily quick-grade assessment persists assessment and results through the atomic API',
  () => {
    assert.match(
      sectionSource,
      /assessmentAtomicPersistenceRepository/
    )

    const draftSave = sliceBetween(
      sectionSource,
      'if (draft?.enabled)',
      'draftCreatedAssessmentIdRef.current = null'
    )

    assert.match(
      draftSave,
      /assessmentAtomicPersistenceRepository[\s\S]*createLessonAssessmentWithResults\(\s*assessmentDraft,\s*entries\s*\)/
    )

    assert.doesNotMatch(
      draftSave,
      /assessmentRepository\.createLessonAssessment\(/
    )
  }
)

test(
  'editing an already-created assessment keeps the existing result-update path without creating another assessment',
  () => {
    const draftSave = sliceBetween(
      sectionSource,
      'if (draft?.enabled)',
      'draftCreatedAssessmentIdRef.current = null'
    )

    assert.match(
      draftSave,
      /existingAssessmentId[\s\S]*assessmentRepository\.saveAssessmentResults\(\s*existingAssessmentId,\s*entries\s*\)/
    )
  }
)

test(
  'atomic assessment persistence encloses creation and result writes in one transaction',
  () => {
    const transactionBody = sliceBetween(
      atomicRepositorySource,
      'return this.db.transaction(',
      'export const assessmentAtomicPersistenceRepository'
    )

    assert.match(
      transactionBody,
      /this\.db\.tables/
    )
    assert.match(
      transactionBody,
      /await this\.repository\.createLessonAssessment\(/[
        Symbol.replace
      ] ? /never/ : /await this\.repository\.createLessonAssessment\(/
    )
    assert.match(
      transactionBody,
      /await this\.repository\.saveAssessmentResults\(/
    )

    const createIndex = transactionBody.indexOf(
      'await this.repository.createLessonAssessment('
    )
    const resultsIndex = transactionBody.indexOf(
      'await this.repository.saveAssessmentResults('
    )

    assert.ok(createIndex >= 0)
    assert.ok(resultsIndex > createIndex)
  }
)
