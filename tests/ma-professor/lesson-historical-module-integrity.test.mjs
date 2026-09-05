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
)

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
  'a normal lesson save keeps the same module even when related records exist',
  async () => {
    const safety = await import(
      transpile(safetySource)
    )

    assert.doesNotThrow(() =>
      safety.assertLessonHistoricalModuleChangeAllowed(
        'module-a',
        'module-a',
        2,
        1
      )
    )
  }
)

test(
  'a normal lesson save may correct the module before attendance or assessments exist',
  async () => {
    const safety = await import(
      transpile(safetySource)
    )

    assert.doesNotThrow(() =>
      safety.assertLessonHistoricalModuleChangeAllowed(
        'module-a',
        'module-b',
        0,
        0
      )
    )
  }
)

test(
  'a normal lesson save cannot move attendance or assessments to another module implicitly',
  async () => {
    const safety = await import(
      transpile(safetySource)
    )

    assert.throws(
      () =>
        safety.assertLessonHistoricalModuleChangeAllowed(
          'module-a',
          'module-b',
          1,
          0
        ),
      /faltas ou avaliações[\s\S]*UFCD|UFCD[\s\S]*faltas ou avaliações/i
    )

    assert.throws(
      () =>
        safety.assertLessonHistoricalModuleChangeAllowed(
          'module-a',
          'module-b',
          0,
          1
        ),
      /faltas ou avaliações[\s\S]*UFCD|UFCD[\s\S]*faltas ou avaliações/i
    )
  }
)

test(
  'lessonRepository enforces historical module integrity in the same transaction as the lesson update',
  () => {
    assert.match(
      lessonRepositorySource,
      /assertLessonHistoricalModuleChangeAllowed/
    )

    assert.match(
      lessonRepositorySource,
      /nextModuleId[\s\S]*lessonAttendance[\s\S]*lessonAssessments/
    )

    assert.match(
      lessonRepositorySource,
      /latest\.moduleId[\s\S]*nextModuleId[\s\S]*attendanceCount[\s\S]*assessmentCount[\s\S]*assertLessonHistoricalModuleChangeAllowed/
    )

    assert.match(
      lessonRepositorySource,
      /maProfessorDb\.transaction\([\s\S]*assertLessonHistoricalModuleChangeAllowed[\s\S]*super\.updateLesson/
    )
  }
)
