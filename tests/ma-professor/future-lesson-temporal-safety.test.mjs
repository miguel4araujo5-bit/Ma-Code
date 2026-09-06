import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

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

  assert.equal(
    errors.length,
    0,
    errors.map(item =>
      ts.flattenDiagnosticMessageText(
        item.messageText,
        '\n'
      )
    ).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const temporalSafetySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonTemporalSafety.ts',
    import.meta.url
  ),
  'utf8'
)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonRepositoryBase.ts',
    import.meta.url
  ),
  'utf8'
)

const dailyViewSource = await readFile(
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

const temporalSafetyModule = await import(
  transpile(temporalSafetySource)
)

const {
  assertLessonNotTaughtInFuture,
  isFutureLessonDate
} = temporalSafetyModule

test(
  'future lesson dates are distinguished from today and past dates',
  () => {
    const referenceDate = '2026-09-06'

    assert.equal(
      isFutureLessonDate(
        '2026-09-07',
        referenceDate
      ),
      true
    )
    assert.equal(
      isFutureLessonDate(
        '2026-09-06',
        referenceDate
      ),
      false
    )
    assert.equal(
      isFutureLessonDate(
        '2026-09-05',
        referenceDate
      ),
      false
    )
  }
)

test(
  'domain guard rejects taught future lessons but preserves planned preparation',
  () => {
    const referenceDate = '2026-09-06'

    assert.doesNotThrow(() =>
      assertLessonNotTaughtInFuture(
        '2026-09-07',
        'planned',
        referenceDate
      )
    )

    assert.doesNotThrow(() =>
      assertLessonNotTaughtInFuture(
        '2026-09-06',
        'taught',
        referenceDate
      )
    )

    assert.throws(
      () =>
        assertLessonNotTaughtInFuture(
          '2026-09-07',
          'taught',
          referenceDate
        ),
      /aula futura não pode ser marcada como dada/i
    )
  }
)

test(
  'lesson repository enforces the temporal guard for saves and GIAE submission paths',
  () => {
    assert.match(
      repositorySource,
      /assertLessonNotTaughtInFuture\(\s*lesson\.date,\s*lesson\.status\s*\)/s
    )

    const markSubmittedStart =
      repositorySource.indexOf(
        'async markGIAESubmitted('
      )
    const markPendingStart =
      repositorySource.indexOf(
        'async markGIAEPending(',
        markSubmittedStart
      )
    const markSubmittedBody =
      repositorySource.slice(
        markSubmittedStart,
        markPendingStart
      )

    assert.match(
      markSubmittedBody,
      /assertLessonNotTaughtInFuture\(\s*lesson\.date,\s*lesson\.status\s*\)/s
    )

    const markManyStart =
      repositorySource.indexOf(
        'async markManyGIAESubmitted('
      )
    const previousTemplateStart =
      repositorySource.indexOf(
        'async getPreviousLessonTemplate(',
        markManyStart
      )
    const markManyBody =
      repositorySource.slice(
        markManyStart,
        previousTemplateStart
      )

    assert.match(
      markManyBody,
      /assertLessonNotTaughtInFuture\(\s*lesson\.date,\s*lesson\.status\s*\)/s
    )
  }
)

test(
  'Daily keeps future preparation planned and blocks attendance assessment and GIAE actions',
  () => {
    assert.match(
      dailyViewSource,
      /const isFutureLesson =\s*Boolean\([\s\S]*isFutureLessonDate\([\s\S]*lessonRow\.lesson\.date/s
    )

    const saveStart =
      dailyViewSource.indexOf(
        'async function saveAll('
      )
    const navigationStart =
      dailyViewSource.indexOf(
        'async function saveBeforeNavigation()',
        saveStart
      )
    const saveBody =
      dailyViewSource.slice(
        saveStart,
        navigationStart
      )

    assert.match(
      saveBody,
      /const effectiveStatus:[\s\S]*isFutureLesson\s*\?\s*'planned'/s
    )

    const nextPlanificationStart =
      dailyViewSource.indexOf(
        'function useNextPlanificationItem()'
      )
    const previousLessonStart =
      dailyViewSource.indexOf(
        'function copyPreviousLesson()',
        nextPlanificationStart
      )
    const attendanceStart =
      dailyViewSource.indexOf(
        'function markAllPresent()',
        previousLessonStart
      )

    assert.match(
      dailyViewSource.slice(
        nextPlanificationStart,
        previousLessonStart
      ),
      /isFutureLesson[\s\S]*\?\s*'planned'/s
    )

    assert.match(
      dailyViewSource.slice(
        previousLessonStart,
        attendanceStart
      ),
      /isFutureLesson[\s\S]*\?\s*'planned'/s
    )

    assert.match(
      dailyViewSource,
      /lessonForm\.giaeStatus ===[\s\S]*disabled=\{[\s\S]*isFutureLesson/s
    )
    assert.match(
      dailyViewSource,
      /onClick=\{\s*markAllPresent\s*\}[\s\S]*disabled=\{[\s\S]*isFutureLesson/s
    )
    assert.match(
      dailyViewSource,
      /onClick=\{\(\) =>[\s\S]*changeAssessment\([\s\S]*'new'[\s\S]*disabled=\{[\s\S]*isFutureLesson/s
    )
  }
)

test(
  'Calendar editor prevents a future lesson from being marked taught or submitted',
  () => {
    assert.match(
      calendarEditorSource,
      /const isFutureLesson =\s*isFutureLessonDate\(\s*form\.date\s*\)/s
    )
    assert.match(
      calendarEditorSource,
      /taughtDisabled=\{isFutureLesson\}/s
    )
    assert.match(
      calendarEditorSource,
      /const canSubmitToGIAE =\s*!isFutureLesson\s*&&/s
    )
    assert.match(
      calendarEditorSource,
      /Marcar como dada[\s\S]*disabled=\{\s*saving\s*\|\|\s*isFutureLesson\s*\}/s
    )
    assert.match(
      calendarEditorSource,
      /form\.status === 'taught'\s*&&\s*!isFutureLesson/s
    )
  }
)
