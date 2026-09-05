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
