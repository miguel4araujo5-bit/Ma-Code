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
  'an immediate automatic re-submit is ignored after a relevant edit',
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
  'both Daily and Calendar pass through the central GIAE guard when saving',
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
