import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dbSource = await readFile(
  new URL(
    '../../src/components/ma-professor/db.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'MA-Professor requests persistent browser storage when opening the local database',
  () => {
    assert.match(
      dbSource,
      /navigator\.storage[\s\S]*?\.persist\(\)/
    )
    assert.match(
      dbSource,
      /navigator\.storage[\s\S]*?\.persisted\(\)/
    )
    assert.match(
      dbSource,
      /openMAProfessorDatabase\([\s\S]*?requestPersistentMAProfessorStorage\(\)/
    )
  }
)

test(
  'MA-Professor exposes storage usage and quota diagnostics when the browser supports StorageManager',
  () => {
    assert.match(
      dbSource,
      /getMAProfessorStorageStatus/
    )
    assert.match(
      dbSource,
      /navigator\.storage[\s\S]*?\.estimate\(\)/
    )
    assert.match(
      dbSource,
      /usage[\s\S]*?quota/
    )
  }
)

test(
  'QuotaExceeded errors, including wrapped Dexie errors, are recognized and converted to an actionable backup message',
  () => {
    assert.match(
      dbSource,
      /QuotaExceededError/
    )
    assert.match(
      dbSource,
      /readNestedError\([\s\S]*?'inner'/
    )
    assert.match(
      dbSource,
      /readNestedError\([\s\S]*?'cause'/
    )
    assert.match(
      dbSource,
      /Exporte uma cópia de segurança/
    )
  }
)
