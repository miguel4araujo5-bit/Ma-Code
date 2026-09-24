import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const projectionSource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/ufcdCompletionProjection.ts',
    import.meta.url
  ),
  'utf8'
)

const progressRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/ufcdProgressRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const planificationRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const planificationViewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/PlanificationWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

function transpile(source) {
  const output = ts.transpileModule(
    source,
    {
      compilerOptions: {
        module:
          ts.ModuleKind.ESNext,
        target:
          ts.ScriptTarget.ES2022
      },
      reportDiagnostics:
        true
    }
  )

  const errors =
    (
      output.diagnostics ??
      []
    ).filter(
      item =>
        item.category ===
        ts.DiagnosticCategory.Error
    )

  assert.equal(
    errors.length,
    0
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

function moduleUnit({
  id,
  order,
  plannedPeriods
}) {
  return {
    id,
    name:
      id,
    order,
    plannedPeriods
  }
}

test(
  'UFCD completion dates consume future lessons sequentially in module order',
  async () => {
    const projection =
      await import(
        transpile(
          projectionSource
        )
      )

    const result =
      projection
        .projectSequentialUfcdCompletionDates({
          modules: [
            moduleUnit({
              id: 'ufcd-3',
              order: 3,
              plannedPeriods: 2
            }),
            moduleUnit({
              id: 'ufcd-1',
              order: 1,
              plannedPeriods: 2
            }),
            moduleUnit({
              id: 'ufcd-2',
              order: 2,
              plannedPeriods: 5
            })
          ],
          progress: [
            {
              moduleId:
                'ufcd-1',
              periodsTaught:
                2,
              periodsRemaining:
                0,
              completionPercent:
                100
            },
            {
              moduleId:
                'ufcd-2',
              periodsTaught:
                2,
              periodsRemaining:
                3,
              completionPercent:
                40
            },
            {
              moduleId:
                'ufcd-3',
              periodsTaught:
                0,
              periodsRemaining:
                2,
              completionPercent:
                0
            }
          ],
          actualCompletionDateByModuleId:
            new Map([
              [
                'ufcd-1',
                '2026-09-18'
              ]
            ]),
          futureLessons: [
            {
              date:
                '2026-09-24',
              startTime:
                '09:00',
              periodCount:
                2
            },
            {
              date:
                '2026-09-25',
              startTime:
                '09:00',
              periodCount:
                2
            },
            {
              date:
                '2026-09-28',
              startTime:
                '09:00',
              periodCount:
                1
            },
            {
              date:
                '2026-09-29',
              startTime:
                '09:00',
              periodCount:
                1
            }
          ]
        })

    assert.deepEqual(
      result.modules,
      [
        {
          moduleId:
            'ufcd-1',
          estimatedCompletionDate:
            '2026-09-18'
        },
        {
          moduleId:
            'ufcd-2',
          estimatedCompletionDate:
            '2026-09-25'
        },
        {
          moduleId:
            'ufcd-3',
          estimatedCompletionDate:
            '2026-09-29'
        }
      ]
    )

    assert.equal(
      result
        .disciplineCompletionDate,
      '2026-09-29'
    )
  }
)

test(
  'a lesson that finishes one UFCD does not spill surplus periods into the next UFCD',
  async () => {
    const projection =
      await import(
        transpile(
          projectionSource
        )
      )

    const result =
      projection
        .projectSequentialUfcdCompletionDates({
          modules: [
            moduleUnit({
              id: 'ufcd-1',
              order: 1,
              plannedPeriods: 3
            }),
            moduleUnit({
              id: 'ufcd-2',
              order: 2,
              plannedPeriods: 2
            })
          ],
          progress: [
            {
              moduleId:
                'ufcd-1',
              periodsTaught:
                2,
              periodsRemaining:
                1,
              completionPercent:
                66.67
            },
            {
              moduleId:
                'ufcd-2',
              periodsTaught:
                0,
              periodsRemaining:
                2,
              completionPercent:
                0
            }
          ],
          actualCompletionDateByModuleId:
            new Map(),
          futureLessons: [
            {
              date:
                '2026-09-24',
              startTime:
                '09:00',
              periodCount:
                2
            },
            {
              date:
                '2026-09-25',
              startTime:
                '09:00',
              periodCount:
                1
            }
          ]
        })

    assert.deepEqual(
      result.modules,
      [
        {
          moduleId:
            'ufcd-1',
          estimatedCompletionDate:
            '2026-09-24'
        },
        {
          moduleId:
            'ufcd-2',
          estimatedCompletionDate:
            null
        }
      ]
    )

    assert.equal(
      result
        .disciplineCompletionDate,
      null
    )
  }
)

test(
  'Planifications reuses the existing schedule reconciliation and calendar blocking rules',
  () => {
    assert.match(
      progressRepositorySource,
      /planScheduledLessonReconciliation\(/
    )
    assert.match(
      progressRepositorySource,
      /calendarEventBlocksAssignmentOnDate\(/
    )
    assert.match(
      progressRepositorySource,
      /lessonCountsTowardUfcdProgress\(/
    )
    assert.match(
      planificationRepositorySource,
      /getAssignmentCompletionProjection\(/
    )
    assert.match(
      planificationViewSource,
      /Conclusão prevista:/
    )
    assert.match(
      planificationViewSource,
      /Conclusão prevista da disciplina:/
    )
  }
)
