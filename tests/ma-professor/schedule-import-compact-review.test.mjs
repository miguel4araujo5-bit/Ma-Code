import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const mainSource = await readFile(
  new URL('../../src/main.tsx', import.meta.url),
  'utf8'
)

const reviewCss = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleImportReview.css',
    import.meta.url
  ),
  'utf8'
)

const visualGridSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/ScheduleImportVisualGrid.tsx',
    import.meta.url
  ),
  'utf8'
)

const importStepSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'schedule review does not display the two legacy bulk tables underneath the visual grid',
  () => {
    assert.match(
      mainSource,
      /scheduleImportReview\.css/
    )
    assert.match(
      importStepSource,
      /<div className="mt-5">\s*<ScheduleImportVisualGrid/
    )
    assert.match(
      reviewCss,
      /div:has\(> section\[aria-label='Revisão visual do horário importado'\]\)/
    )
    assert.match(
      reviewCss,
      /min-w-\[1180px\]/
    )
    assert.match(
      reviewCss,
      /min-w-\[720px\]/
    )
    assert.match(
      reviewCss,
      /display:\s*none/g
    )
  }
)

test(
  'the visual grid preserves all fields that existed in the hidden lesson and duty tables',
  () => {
    for (const field of [
      'selectedLesson.weekday',
      'selectedLesson.startTime',
      'selectedLesson.endTime',
      'selectedLesson.periodCount',
      'selectedLesson.groupName',
      'selectedLesson.courseName',
      'selectedLesson.subjectName',
      'selectedLesson.included',
      'selectedDuty.weekday',
      'selectedDuty.startTime',
      'selectedDuty.endTime',
      'selectedDuty.name',
      'selectedDuty.included'
    ]) {
      assert.match(visualGridSource, new RegExp(field.replace('.', '\\.')))
    }

    assert.match(visualGridSource, /Confirmar como disciplina/)
    assert.match(importStepSource, /\+ Adicionar aula \/ hora/)
    assert.match(importStepSource, /\+ Adicionar cargo/)
  }
)

test(
  'compact review CSS is scoped to the schedule visual-grid wrapper and cannot hide unrelated tables',
  () => {
    const selectors = reviewCss
      .split('{')
      .slice(0, -1)
      .map(part => part.split('}').at(-1)?.trim() ?? '')
      .filter(Boolean)

    assert.ok(selectors.length >= 2)
    for (const selector of selectors) {
      assert.match(
        selector,
        /^div:has\(> section\[aria-label='Revisão visual do horário importado'\]\)/
      )
    }
  }
)
