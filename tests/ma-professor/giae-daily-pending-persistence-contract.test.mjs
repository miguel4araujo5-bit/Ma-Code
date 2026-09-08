import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/giaeDailyPersistenceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'Daily GIAE persistence saves the expected lesson version before any explicit submission',
  () => {
    const transactionIndex =
      source.indexOf('this.db.transaction(')
    const updateIndex =
      source.indexOf('updateLesson(')
    const pendingIndex =
      source.indexOf('markGIAEPending(')

    assert.notEqual(transactionIndex, -1)
    assert.notEqual(updateIndex, -1)
    assert.notEqual(pendingIndex, -1)
    assert.ok(updateIndex > transactionIndex)
    assert.ok(pendingIndex > updateIndex)
    assert.match(
      source,
      /expectedUpdatedAt:\s*input\.expectedUpdatedAt/
    )
  }
)

test(
  'Daily GIAE persistence never marks submitted itself',
  () => {
    assert.doesNotMatch(
      source,
      /markGIAESubmitted\s*\(/
    )
    assert.doesNotMatch(
      source,
      /giaeStatus:\s*['"]submitted['"]/
    )
  }
)

test(
  'Daily GIAE persistence forces an already-submitted saved version back to pending atomically',
  () => {
    assert.match(
      source,
      /persisted\.giaeStatus\s*===\s*['"]submitted['"]/s
    )
    assert.match(
      source,
      /markGIAEPending\(/s
    )
    assert.match(
      source,
      /this\.db\.tables/
    )
  }
)
