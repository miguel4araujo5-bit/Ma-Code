import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/assessmentCriteriaModuleRepository.ts',
    import.meta.url
  ),
  'utf8'
)

function getBody(
  marker
) {
  const start =
    source.indexOf(
      marker
    )

  assert.notEqual(
    start,
    -1,
    `Não foi encontrado ${marker}`
  )

  return source.slice(
    start
  )
}

test(
  'module override validates persisted evidence before any write',
  () => {
    const method =
      getBody(
        'async createModuleScheme('
      )

    const transactionIndex =
      method.indexOf(
        'maProfessorDb.transaction('
      )
    const evidenceIndex =
      method.indexOf(
        'assertNoModuleAssessmentEvidence('
      )
    const firstWriteIndex =
      method.indexOf(
        '.assessmentSchemes\n          .add('
      )

    assert.ok(
      evidenceIndex >= 0 &&
      evidenceIndex < transactionIndex
    )
    assert.ok(
      firstWriteIndex >
        transactionIndex
    )
    assert.equal(
      method.slice(
        0,
        transactionIndex
      ).includes(
        '.assessmentSchemes\n          .add('
      ),
      false
    )
  }
)

test(
  'module override revalidates stale evidence inside the same transaction before writes',
  () => {
    const method =
      getBody(
        'async createModuleScheme('
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
      /teachingAssignments[\s\S]*modules[\s\S]*lessonAssessments[\s\S]*assessmentResults[\s\S]*moduleFinalGrades[\s\S]*assessmentSchemes[\s\S]*assessmentCriteria/
    )
    assert.match(
      transactionBody,
      /assertModuleContext\(/
    )
    assert.match(
      transactionBody,
      /assertNoExistingModuleScheme\(/
    )
    assert.match(
      transactionBody,
      /assertNoModuleAssessmentEvidence\(/
    )

    const evidenceIndex =
      transactionBody.indexOf(
        'assertNoModuleAssessmentEvidence('
      )
    const writeIndex =
      transactionBody.indexOf(
        '.assessmentSchemes\n          .add('
      )

    assert.ok(
      evidenceIndex >= 0 &&
      writeIndex > evidenceIndex
    )
  }
)

test(
  'evidence guard covers assessment rows, results and module final grades',
  () => {
    const helper =
      getBody(
        'async function readModuleAssessmentEvidence('
      )

    assert.match(
      helper,
      /lessonAssessments[\s\S]*where\([\s\S]*'moduleId'[\s\S]*equals\([\s\S]*moduleId/
    )
    assert.match(
      helper,
      /assessmentResults[\s\S]*where\([\s\S]*'assessmentId'[\s\S]*anyOf\([\s\S]*lessonAssessments\.map/
    )
    assert.match(
      helper,
      /moduleFinalGrades[\s\S]*where\([\s\S]*'moduleId'[\s\S]*equals\([\s\S]*moduleId[\s\S]*count\(\)/
    )
    assert.match(
      source,
      /MODULE_ASSESSMENT_EVIDENCE_EXISTS/
    )
    assert.match(
      source,
      /new ModuleAssessmentEvidenceError\(/
    )
  }
)

test(
  'guarded write creates only a module scheme and criteria without migrating historical evidence',
  () => {
    const method =
      getBody(
        'async createModuleScheme('
      )

    assert.match(
      source,
      /scope:\s*'module'/
    )
    assert.match(
      source,
      /moduleId:\s*\n\s*input\.moduleId/
    )
    assert.match(
      method,
      /assertNoExistingModuleScheme\(/
    )
    assert.doesNotMatch(
      method,
      /assessmentResults[\s\S]*\.(?:put|update|delete|bulkPut|bulkDelete)\(/
    )
    assert.doesNotMatch(
      method,
      /moduleFinalGrades[\s\S]*\.(?:put|update|delete|bulkPut|bulkDelete)\(/
    )
  }
)
