import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const safetySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonHistoricalEditSafety.ts',
    import.meta.url
  ),
  'utf8'
).catch(() => '')

const lessonRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonRepository.ts',
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
  'a normal lesson save cannot move the date when attendance already exists',
  async () => {
    assert.ok(
      safetySource,
      'lessonHistoricalEditSafety.ts must exist'
    )

    const safety = await import(
      transpile(safetySource)
    )

    assert.doesNotThrow(() =>
      safety.assertLessonHistoricalDateChangeAllowed(
        '2026-10-10',
        '2026-10-10',
        2,
        0
      )
    )

    assert.doesNotThrow(() =>
      safety.assertLessonHistoricalDateChangeAllowed(
        '2026-10-10',
        '2026-10-20',
        0,
        0
      )
    )

    assert.throws(
      () =>
        safety.assertLessonHistoricalDateChangeAllowed(
          '2026-10-10',
          '2026-10-20',
          1,
          0
        ),
      /faltas ou avaliações[\s\S]*data/i
    )
  }
)

test(
  'a normal lesson save cannot move the date when assessments already exist',
  async () => {
    assert.ok(
      safetySource,
      'lessonHistoricalEditSafety.ts must exist'
    )

    const safety = await import(
      transpile(safetySource)
    )

    assert.throws(
      () =>
        safety.assertLessonHistoricalDateChangeAllowed(
          '2026-10-10',
          '2026-10-20',
          0,
          1
        ),
      /faltas ou avaliações[\s\S]*data/i
    )
  }
)

test(
  'lessonRepository enforces historical date integrity at persistence level',
  () => {
    assert.match(
      lessonRepositorySource,
      /assertLessonHistoricalDateChangeAllowed/
    )

    assert.match(
      lessonRepositorySource,
      /lessonAttendance[\s\S]*lessonAssessments[\s\S]*count\(\)[\s\S]*assertLessonHistoricalDateChangeAllowed/
    )

    assert.match(
      lessonRepositorySource,
      /latest[\s\S]*assertLessonHistoricalDateChangeAllowed/
    )
  }
)
