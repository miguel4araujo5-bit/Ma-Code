import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/lib/maPdf/extractPdfText.ts',
    import.meta.url
  ),
  'utf8'
)

function loadRoomHeaderMatcher() {
  const normalizeStart = source.indexOf(
    'function normalizeComparableText('
  )
  const normalizeEnd = source.indexOf(
    '\nfunction toPositionedItem(',
    normalizeStart
  )
  const roomStart = source.indexOf(
    'function isRoomHeader('
  )
  const roomEnd = source.indexOf(
    '\nfunction getCellCenter(',
    roomStart
  )

  assert.ok(normalizeStart >= 0)
  assert.ok(normalizeEnd > normalizeStart)
  assert.ok(roomStart >= 0)
  assert.ok(roomEnd > roomStart)

  const javascript = ts.transpileModule(
    [
      source.slice(normalizeStart, normalizeEnd),
      source.slice(roomStart, roomEnd),
      'export { isRoomHeader }'
    ].join('\n\n'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }
  ).outputText

  const module = { exports: {} }
  new Function('module', 'exports', javascript)(module, module.exports)
  return module.exports.isRoomHeader
}

const isRoomHeader = loadRoomHeaderMatcher()

test('known room-column headers are recognised without requiring the literal word Sala', () => {
  for (const value of [
    'Sala',
    'Sala n.º',
    'Sala nº',
    'Sala n°',
    'Sl.',
    'Sl',
    'Espaço',
    'Local'
  ]) {
    assert.equal(isRoomHeader(value), true, value)
  }
})

test('subject and activity names are never swallowed by the room-header matcher', () => {
  for (const value of [
    'Laboratório',
    'Laboratório de Robótica',
    'Sala de Aula',
    'Espaço Cidadania',
    'Local de Trabalho'
  ]) {
    assert.equal(isRoomHeader(value), false, value)
  }
})
