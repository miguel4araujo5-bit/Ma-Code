import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/planificationModuleDocument.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'readModuleDocument propagates the shared duration warning to every parsed section without duplicates',
  () => {
    assert.match(
      source,
      /function withDurationWarnings\(document: ModuleDocument\)/
    )
    assert.match(
      source,
      /durationWarning\(\s*section,\s*document\.periodMinutes\s*\)/
    )
    assert.match(
      source,
      /section\.warnings\.includes\(warning\)/
    )
    assert.match(
      source,
      /return withDurationWarnings\(\{[\s\S]*?parseModuleDocxXml/
    )
    assert.match(
      source,
      /return withDurationWarnings\(moduleDocument\)/
    )
    assert.match(
      source,
      /return withDurationWarnings\(\{[\s\S]*?name: file\.name, sha256/
    )
  }
)

test(
  'duration mismatch keeps the established hours-versus-lessons formula',
  () => {
    assert.match(
      source,
      /section\.durationHours \* 60 - section\.plannedLessons \* periodMinutes/
    )
    assert.match(
      source,
      /horas não correspondem a/
    )
  }
)
