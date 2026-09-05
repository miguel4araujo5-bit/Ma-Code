import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dailySource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const calendarEditorSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/LessonEditorDialogBase.tsx',
    import.meta.url
  ),
  'utf8'
)

const giaeSource = await readFile(
  new URL(
    '../../src/components/ma-professor/giae/GIAEWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

function getFunctionBody(
  source,
  startMarker,
  endMarker
) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)

  assert.notEqual(
    start,
    -1,
    `Não foi encontrado ${startMarker}`
  )

  assert.notEqual(
    end,
    -1,
    `Não foi encontrado ${endMarker}`
  )

  return source.slice(start, end)
}

test(
  'copying a summary in Daily does not change its GIAE state',
  () => {
    const copyHandler =
      getFunctionBody(
        dailySource,
        'async function handleCopySummary()',
        'async function saveAll('
      )

    assert.equal(
      copyHandler.includes('giaeStatus'),
      false,
      'handleCopySummary não pode alterar giaeStatus.'
    )

    assert.equal(
      copyHandler.includes("'submitted'"),
      false,
      'Copiar não pode marcar o sumário como submetido.'
    )

    assert.match(
      copyHandler,
      /estado no GIAE mantém-se inalterado/i
    )
  }
)

test(
  'Daily invalidates a submitted GIAE state when relevant lesson data changes',
  () => {
    assert.match(
      dailySource,
      /GIAE_RELEVANT_DAILY_LESSON_KEYS/
    )

    for (const key of [
      'status',
      'startTime',
      'endTime',
      'periodCount',
      'summary'
    ]) {
      assert.match(
        dailySource,
        new RegExp(`['"]${key}['"]`),
        `O Diário deve tratar ${key} como alteração relevante para o GIAE.`
      )
    }

    const applyChanges =
      getFunctionBody(
        dailySource,
        'function applyDailyLessonFormChanges(',
        'function buildAssessmentForm('
      )

    assert.match(
      applyChanges,
      /current\.giaeStatus\s*===\s*'submitted'/
    )
    assert.match(
      applyChanges,
      /giaeStatus:\s*'pending'/
    )
    assert.match(
      applyChanges,
      /hasOwnProperty\.call\(\s*changes,\s*'giaeStatus'/
    )

    const updateLessonForm =
      getFunctionBody(
        dailySource,
        'function updateLessonForm<',
        'function updateStudent('
      )

    assert.match(
      updateLessonForm,
      /applyDailyLessonFormChanges/
    )

    const nextPlanification =
      getFunctionBody(
        dailySource,
        'function useNextPlanificationItem()',
        'function copyPreviousLesson()'
      )

    assert.match(
      nextPlanification,
      /applyDailyLessonFormChanges/
    )

    const previousLesson =
      getFunctionBody(
        dailySource,
        'function copyPreviousLesson()',
        'function markAllPresent()'
      )

    assert.match(
      previousLesson,
      /applyDailyLessonFormChanges/
    )

    assert.match(
      dailySource,
      /summary:\s*value,[\s\S]{0,500}applyDailyLessonFormChanges|applyDailyLessonFormChanges\([\s\S]{0,500}summary:\s*value/
    )
  }
)

test(
  'Daily keeps a separate explicit control for the GIAE submitted state',
  () => {
    assert.match(
      dailySource,
      /updateLessonForm\(\s*'giaeStatus'/
    )

    assert.match(
      dailySource,
      /Submetido no\s+GIAE/
    )
  }
)

test(
  'Calendar lesson editor invalidates submitted GIAE after relevant edits',
  () => {
    assert.match(
      calendarEditorSource,
      /GIAE_RELEVANT_CALENDAR_LESSON_KEYS/
    )

    for (const key of [
      'moduleId',
      'status',
      'date',
      'startTime',
      'endTime',
      'periodCount',
      'summary'
    ]) {
      assert.match(
        calendarEditorSource,
        new RegExp(`['"]${key}['"]`),
        `O editor do Calendário deve tratar ${key} como alteração relevante para o GIAE.`
      )
    }

    const applyChanges =
      getFunctionBody(
        calendarEditorSource,
        'function applyCalendarLessonFormChanges(',
        'function FieldLabel('
      )

    assert.match(
      applyChanges,
      /current\.giaeStatus\s*===\s*'submitted'/
    )
    assert.match(
      applyChanges,
      /giaeStatus:\s*'pending'/
    )
    assert.match(
      applyChanges,
      /hasOwnProperty\.call\(\s*changes,\s*'giaeStatus'/
    )

    const updateForm =
      getFunctionBody(
        calendarEditorSource,
        'function updateForm<',
        'function handleStatusChange('
      )

    assert.match(
      updateForm,
      /applyCalendarLessonFormChanges/
    )

    const statusChange =
      getFunctionBody(
        calendarEditorSource,
        'function handleStatusChange(',
        'function copyPreviousLesson()'
      )

    assert.match(
      statusChange,
      /applyCalendarLessonFormChanges/
    )

    const previousLesson =
      getFunctionBody(
        calendarEditorSource,
        'function copyPreviousLesson()',
        'function useNextPlanificationItem()'
      )

    assert.match(
      previousLesson,
      /applyCalendarLessonFormChanges/
    )

    const nextPlanification =
      getFunctionBody(
        calendarEditorSource,
        'function useNextPlanificationItem()',
        'function handleSummaryChange('
      )

    assert.match(
      nextPlanification,
      /applyCalendarLessonFormChanges/
    )

    const summaryChange =
      getFunctionBody(
        calendarEditorSource,
        'function handleSummaryChange(',
        'function disconnectPlanification()'
      )

    assert.match(
      summaryChange,
      /applyCalendarLessonFormChanges/
    )

    assert.match(
      calendarEditorSource,
      /moduleId,[\s\S]{0,500}applyCalendarLessonFormChanges|applyCalendarLessonFormChanges\([\s\S]{0,500}moduleId/
    )
  }
)

test(
  'the dedicated GIAE workspace keeps copy and submit as separate actions',
  () => {
    const copyHandler =
      getFunctionBody(
        giaeSource,
        'function handleCopy(',
        'function handleCopyVisible()'
      )

    assert.equal(
      copyHandler.includes('onMarkSubmitted'),
      false,
      'A ação Copiar do workspace GIAE não pode marcar como submetido.'
    )

    assert.match(
      giaeSource,
      /function handleMarkSubmitted\(/
    )
  }
)
