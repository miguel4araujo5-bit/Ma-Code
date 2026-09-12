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
  'schedule review keeps the weekly grid as the single active review surface',
  () => {
    assert.match(
      mainSource,
      /scheduleImportReview\.css/
    )
    assert.match(
      importStepSource,
      /<div className="mt-5">\s*<ScheduleImportVisualGrid/
    )
    assert.doesNotMatch(
      importStepSource,
      /ScheduleImportUnresolvedReview/
    )
    assert.match(
      reviewCss,
      /div:has\(> section\[aria-label='Revisão visual do horário importado'\]\)/
    )
    assert.match(
      reviewCss,
      /display:\s*none/g
    )
  }
)

test(
  'the weekly grid keeps lesson and duty fields editable inside each cell and exposes direct type switching',
  () => {
    for (const field of [
      'lesson.weekday',
      'lesson.startTime',
      'lesson.endTime',
      'lesson.periodCount',
      'lesson.groupName',
      'lesson.courseName',
      'lesson.subjectName',
      'lesson.included',
      'duty.weekday',
      'duty.startTime',
      'duty.endTime',
      'duty.name',
      'duty.included'
    ]) {
      assert.match(
        visualGridSource,
        new RegExp(field.replace('.', '\\.'))
      )
    }

    assert.match(
      visualGridSource,
      /schedule-import-inline-editor/
    )
    assert.match(
      visualGridSource,
      /Componente letiva/
    )
    assert.match(
      visualGridSource,
      /Cargo/
    )
    assert.match(
      visualGridSource,
      /Confirmar como disciplina/
    )
    assert.match(
      importStepSource,
      /\+ Adicionar componente letiva/
    )
    assert.match(
      importStepSource,
      /\+ Adicionar cargo/
    )
  }
)

test(
  'source time rows and unresolved blocks are passed into the weekly grid instead of parallel review tables',
  () => {
    assert.match(
      importStepSource,
      /sourceTimeRows=\{sourceTimeRows\}/
    )
    assert.match(
      importStepSource,
      /unresolved=\{unresolved\}/
    )
    assert.match(
      importStepSource,
      /onLessonAsDuty=\{lessonAsDuty\}/
    )
    assert.match(
      importStepSource,
      /onDutyAsLesson=\{dutyAsLesson\}/
    )
    assert.match(
      visualGridSource,
      /data-schedule-cell/
    )
  }
)

test(
  'compact review CSS remains scoped to the schedule visual-grid wrapper and cannot hide unrelated tables',
  () => {
    const cssWithoutComments = reviewCss.replace(/\/\*[\s\S]*?\*\//g, '')
    const selectors = cssWithoutComments
      .split('{')
      .slice(0, -1)
      .map(part => part.split('}').at(-1)?.trim() ?? '')
      .filter(Boolean)

    assert.equal(selectors.length, 2)
    for (const selector of selectors) {
      assert.match(
        selector,
        /^div:has\(> section\[aria-label='Revisão visual do horário importado'\]\)/
      )
    }
  }
)
