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

const dailyRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyWorkspaceRepository.ts',
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

const lessonRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonRepositoryBase.ts',
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
  'copying the current Daily summary submits only after clipboard success through the explicit version guard',
  () => {
    const copyHandler =
      getFunctionBody(
        dailySource,
        'async function handleCopySummary()',
        'async function saveAll('
      )

    const clipboardIndex =
      copyHandler.indexOf('await copyTextToClipboard(')
    const explicitSubmitIndex =
      copyHandler.indexOf(
        'giaeExplicitSubmissionRepository.markSubmitted('
      )

    assert.notEqual(clipboardIndex, -1)
    assert.notEqual(explicitSubmitIndex, -1)
    assert.ok(
      clipboardIndex < explicitSubmitIndex,
      'A submissão explícita só pode acontecer depois de a cópia para o clipboard ter sucesso.'
    )

    assert.match(
      copyHandler,
      /currentLesson\.summary\s*!==\s*summary/
    )
    assert.match(
      copyHandler,
      /expectedUpdatedAt:\s*currentLesson\.updatedAt/
    )
    assert.match(
      copyHandler,
      /submitted\.giaeStatus\s*!==\s*['"]submitted['"]/i
    )
    assert.match(
      copyHandler,
      /Sumário copiado e assinalado automaticamente como submetido no GIAE\./
    )
  }
)

test(
  'lesson repository records a GIAE invalidation caused by relevant edits',
  () => {
    assert.match(
      lessonRepositorySource,
      /giaeInvalidatedAt/
    )

    const updateLesson =
      getFunctionBody(
        lessonRepositorySource,
        'async updateLesson(',
        'async markLessonTaught('
      )

    assert.match(
      updateLesson,
      /current\.giaeStatus\s*===\s*['"]submitted['"]/i
    )
    assert.match(
      updateLesson,
      /hasGIAERelevantChanges/
    )
    assert.match(
      updateLesson,
      /giaeStatus:\s*['"]pending['"]/i
    )
    assert.match(
      updateLesson,
      /giaeInvalidatedAt\.set\(/i
    )
  }
)

test(
  'an immediate legacy automatic re-submit is ignored after a relevant edit',
  () => {
    const markSubmitted =
      getFunctionBody(
        lessonRepositorySource,
        'async markGIAESubmitted(',
        'async markGIAEPending('
      )

    assert.match(
      markSubmitted,
      /giaeInvalidatedAt\.get\(/i
    )
    assert.match(
      markSubmitted,
      /lesson\.updatedAt/i
    )
    assert.match(
      markSubmitted,
      /return lesson/i
    )
    assert.match(
      markSubmitted,
      /giaeInvalidatedAt\.delete\(/i
    )
  }
)

test(
  'Daily and Calendar legacy save paths continue through the central GIAE guard',
  () => {
    assert.match(
      dailyRepositorySource,
      /lessonRepository\.updateLesson\(/
    )
    assert.match(
      dailyRepositorySource,
      /lessonRepository\.markGIAESubmitted\(/
    )

    assert.match(
      calendarEditorSource,
      /lessonRepository\.updateLesson\(/
    )
    assert.match(
      calendarEditorSource,
      /lessonRepository\.markGIAESubmitted\(/
    )
  }
)

test(
  'Daily no longer exposes a manual bypass for the GIAE submitted state',
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
    assert.match(
      dailySource,
      /Submetido no\s+GIAE/
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
      'A ação Copiar do workspace GIAE continua separada da submissão explícita nesse workspace.'
    )

    assert.match(
      giaeSource,
      /function handleMarkSubmitted\(/
    )
  }
)
