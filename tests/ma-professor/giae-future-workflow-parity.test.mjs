import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/giae/giaeWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const viewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/giae/GIAEWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const appSource = await readFile(
  new URL(
    '../../src/components/ma-professor/MAProfessorApp.tsx',
    import.meta.url
  ),
  'utf8'
)

function getBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)

  assert.notEqual(start, -1, `Não foi encontrado ${startMarker}`)
  assert.notEqual(end, -1, `Não foi encontrado ${endMarker}`)

  return source.slice(start, end)
}

test(
  '01 Sumários/GIAE keeps a future planned lesson with summary visible as pending',
  () => {
    const futureReady = getBlock(
      repositorySource,
      'function isFuturePlannedReadyForGIAE(',
      'function getRowState('
    )
    const rowState = getBlock(
      repositorySource,
      'function getRowState(',
      'function buildRow('
    )
    const buildRow = getBlock(
      repositorySource,
      'function buildRow(',
      'function sortRows('
    )

    assert.match(
      futureReady,
      /lesson\.status\s*===\s*['"]planned['"]/
    )
    assert.match(
      futureReady,
      /lesson\.date\s*>\s*referenceDate/
    )
    assert.match(
      futureReady,
      /lesson\.summary\.trim\(\)/
    )
    assert.match(
      rowState,
      /isFuturePlannedReadyForGIAE\([\s\S]*lesson[\s\S]*referenceDate/
    )
    assert.match(
      rowState,
      /['"]pending['"]/
    )
    assert.match(
      buildRow,
      /canMarkSubmitted:[\s\S]*state\s*===\s*['"]pending['"][\s\S]*canCopy/
    )
    assert.doesNotMatch(
      buildRow.match(/canMarkSubmitted:[\s\S]*?canMarkPending:/)?.[0] ?? '',
      /lesson\.status\s*===\s*['"]taught['"]/
    )
  }
)

test(
  '01 separates manual GIAE confirmation from automatic submission after copy',
  () => {
    const copyHandler = getBlock(
      viewSource,
      'function handleCopy(',
      'function handleCopyVisible()'
    )
    const copyVisibleHandler = getBlock(
      viewSource,
      'function handleCopyVisible()',
      'function handleMarkSubmitted('
    )
    const manualHandler = getBlock(
      viewSource,
      'function handleMarkSubmitted(',
      'function handleMarkPending('
    )
    const manualBulkHandler = getBlock(
      viewSource,
      'function handleMarkSelectedSubmitted()',
      'return ('
    )

    assert.match(copyHandler, /onMarkCopiedSubmitted/)
    assert.doesNotMatch(copyHandler, /await onMarkSubmitted!\(/)
    assert.match(copyVisibleHandler, /onMarkManyCopiedSubmitted/)
    assert.doesNotMatch(copyVisibleHandler, /await onMarkManySubmitted!\(/)

    assert.match(manualHandler, /onMarkSubmitted\(/)
    assert.doesNotMatch(manualHandler, /recordCopiedLesson/)
    assert.match(manualBulkHandler, /onMarkManySubmitted\(/)
    assert.doesNotMatch(manualBulkHandler, /recordCopiedLessons/)
  }
)

test(
  'MAProfessorApp wires both manual and copied GIAE contracts into 01',
  () => {
    assert.match(
      appSource,
      /giaeWorkspaceRepository\.markSubmitted\(/
    )
    assert.match(
      appSource,
      /giaeWorkspaceRepository\.markCopiedSubmitted\(/
    )
    assert.match(
      appSource,
      /giaeWorkspaceRepository\.markManySubmitted\(/
    )
    assert.match(
      appSource,
      /giaeWorkspaceRepository\.markManyCopiedSubmitted\(/
    )
    assert.match(
      appSource,
      /onMarkCopiedSubmitted=\{handleGIAEMarkCopiedSubmitted\}/
    )
    assert.match(
      appSource,
      /onMarkManyCopiedSubmitted=\{handleGIAEMarkManyCopiedSubmitted\}/
    )
  }
)
