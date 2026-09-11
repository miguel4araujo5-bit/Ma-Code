import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const helperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyGIAEAuto.ts',
    import.meta.url
  ),
  'utf8'
)

const dailySource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

function transpile(source, jsx = false) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      ...(jsx
        ? { jsx: ts.JsxEmit.ReactJSX }
        : {})
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )

  assert.equal(
    errors.length,
    0,
    errors.map(item => item.messageText).join('\n')
  )

  return output.outputText
}

const helperUrl = `data:text/javascript;base64,${Buffer.from(
  transpile(helperSource)
).toString('base64')}`

const giaeAuto = await import(helperUrl)

test(
  'editing a submitted summary invalidates the visible GIAE state immediately',
  () => {
    assert.equal(
      giaeAuto.resolveGIAEStatusAfterSummaryChange(
        'submitted',
        'Sumário S0',
        'Sumário S1'
      ),
      'pending'
    )

    assert.equal(
      giaeAuto.resolveGIAEStatusAfterSummaryChange(
        'submitted',
        'Sumário S0',
        'Sumário S0'
      ),
      'submitted'
    )

    assert.equal(
      giaeAuto.resolveGIAEStatusAfterSummaryChange(
        'pending',
        'Sumário S0',
        'Sumário S1'
      ),
      'pending'
    )
  }
)

test(
  'future lesson dates no longer suppress GIAE submission after copy',
  () => {
    assert.equal(
      giaeAuto.isFutureGIAECopyDate(
        '2026-09-09',
        '2026-09-08'
      ),
      false
    )
    assert.equal(
      giaeAuto.isFutureGIAECopyDate(
        '2026-09-08',
        '2026-09-08'
      ),
      false
    )
    assert.equal(
      giaeAuto.isFutureGIAECopyDate(
        '2026-09-07',
        '2026-09-08'
      ),
      false
    )
  }
)

test(
  'Daily TSX parses after the automatic GIAE changes',
  () => {
    const output = transpile(
      dailySource,
      true
    )

    assert.match(
      output,
      /giaeExplicitSubmissionRepository/
    )
  }
)

test(
  'copy saves unsaved work before entering clipboard/submission flow',
  () => {
    const handler = dailySource.slice(
      dailySource.indexOf(
        'async function handleCopySummary()'
      ),
      dailySource.indexOf(
        'async function saveAll('
      )
    )

    const saveIndex = handler.indexOf(
      "await saveAll({"
    )
    const clipboardIndex = handler.indexOf(
      'await copyTextToClipboard('
    )
    const submitIndex = handler.indexOf(
      'giaeExplicitSubmissionRepository.markSubmitted('
    )

    assert.ok(saveIndex >= 0)
    assert.ok(clipboardIndex > saveIndex)
    assert.ok(submitIndex > clipboardIndex)
  }
)

test(
  'copy revalidates persisted summary and exact updatedAt before explicit submission',
  () => {
    const handler = dailySource.slice(
      dailySource.indexOf(
        'async function handleCopySummary()'
      ),
      dailySource.indexOf(
        'async function saveAll('
      )
    )

    assert.match(
      handler,
      /getLessonWorkspace\(/
    )
    assert.match(
      handler,
      /currentLesson\.summary\s*!==\s*summary/
    )
    assert.match(
      handler,
      /expectedUpdatedAt:\s*currentLesson\.updatedAt/
    )
    assert.match(
      handler,
      /submitted\.giaeStatus\s*!==\s*['"]submitted['"]/i
    )
  }
)

test(
  'clipboard or submit failure reloads persisted state and cannot leave a false success tick',
  () => {
    const handler = dailySource.slice(
      dailySource.indexOf(
        'async function handleCopySummary()'
      ),
      dailySource.indexOf(
        'async function saveAll('
      )
    )

    assert.match(
      handler,
      /catch \(copyError\)[\s\S]*await loadDate\(/
    )
    assert.match(
      handler,
      /O sumário foi copiado, mas não foi assinalado como submetido no GIAE/
    )
    assert.match(
      handler,
      /Não foi possível copiar o sumário/
    )
  }
)

test(
  'future dates cannot bypass the explicit GIAE submission path after copy',
  () => {
    const handler = dailySource.slice(
      dailySource.indexOf(
        'async function handleCopySummary()'
      ),
      dailySource.indexOf(
        'async function saveAll('
      )
    )

    const futureIndex = handler.indexOf(
      'isFutureGIAECopyDate('
    )
    const submitIndex = handler.indexOf(
      'giaeExplicitSubmissionRepository.markSubmitted('
    )

    assert.ok(futureIndex >= 0)
    assert.ok(submitIndex > futureIndex)
    assert.equal(
      giaeAuto.isFutureGIAECopyDate(
        '2099-01-01',
        '2026-09-10'
      ),
      false
    )
  }
)

test(
  'all Daily summary mutation paths invalidate submitted state when text changes',
  () => {
    const occurrences =
      dailySource.match(
        /resolveGIAEStatusAfterSummaryChange\(/g
      ) ?? []

    assert.ok(
      occurrences.length >= 3,
      'Textarea, planificação e cópia da aula anterior devem invalidar a submissão.'
    )
  }
)

test(
  'GIAE status control is display-only and cannot manually bypass copy authorization',
  () => {
    assert.doesNotMatch(
      dailySource,
      /updateLessonForm\(\s*['"]giaeStatus['"]/
    )

    const statusMarker =
      'aria-label="Estado de submissão no GIAE"'
    const markerIndex =
      dailySource.indexOf(statusMarker)
    const inputStart =
      dailySource.lastIndexOf('<input', markerIndex)
    const inputEnd =
      dailySource.indexOf('/>', markerIndex)

    assert.ok(markerIndex >= 0)
    assert.ok(inputStart >= 0)
    assert.ok(inputEnd > markerIndex)

    const statusControl =
      dailySource.slice(inputStart, inputEnd)

    assert.match(statusControl, /\bdisabled\b/)
    assert.match(statusControl, /\breadOnly\b/)
  }
)

test(
  'criterion grading remains present in the same Daily workspace',
  () => {
    assert.match(
      dailySource,
      /data-daily-quick-grade-input="true"/
    )
    assert.match(
      dailySource,
      /data-criterion-id=/
    )
    assert.match(
      dailySource,
      /focusNextQuickGrade/
    )
  }
)
