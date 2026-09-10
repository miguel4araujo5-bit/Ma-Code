import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const geometrySource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleGridGeometry.ts',
    import.meta.url
  ),
  'utf8'
)

const preservationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleGridCellPreservation.ts',
    import.meta.url
  ),
  'utf8'
)

function withoutTypeImport(source) {
  return source.replace(
    /^import type \{[\s\S]*?\} from '\.\/scheduleGridGeometry'\n/m,
    ''
  )
}

function loadFunctions() {
  const typescriptSnippet = [
    geometrySource,
    withoutTypeImport(preservationSource),
    'export { reconstructScheduleGridDocument, preserveScheduleGridCells }'
  ].join('\n\n')
  const javascript = ts.transpileModule(
    typescriptSnippet,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }
  ).outputText
  const module = { exports: {} }

  new Function('module', 'exports', javascript)(
    module,
    module.exports
  )

  return module.exports
}

const {
  reconstructScheduleGridDocument,
  preserveScheduleGridCells
} = loadFunctions()

function item(text, x, y, width, height = 10) {
  return { text, x, y, width, height }
}

const columns = {
  segunda: { day: 100, room: 180 },
  terca: { day: 270, room: 360 },
  quarta: { day: 450, room: 540 },
  quinta: { day: 630, room: 720 },
  sexta: { day: 810, room: 900 }
}

const header = [
  item('Segunda', columns.segunda.day - 20, 760, 40),
  item('Sala', columns.segunda.room - 15, 760, 30),
  item('Terça', columns.terca.day - 20, 760, 40),
  item('Sala', columns.terca.room - 15, 760, 30),
  item('Quarta', columns.quarta.day - 20, 760, 40),
  item('Sala', columns.quarta.room - 15, 760, 30),
  item('Quinta', columns.quinta.day - 20, 760, 40),
  item('Sala', columns.quinta.room - 15, 760, 30),
  item('Sexta', columns.sexta.day - 20, 760, 40),
  item('Sala', columns.sexta.room - 15, 760, 30)
]

const timeRows = [
  ['08:30 - 09:20', 700],
  ['09:25 - 10:15', 650],
  ['10:30 - 11:20', 600],
  ['11:25 - 12:15', 550],
  ['12:20 - 13:10', 500],
  ['13:20 - 14:10', 450],
  ['14:15 - 15:05', 400],
  ['15:15 - 16:05', 350],
  ['16:10 - 17:00', 300]
].map(([text, y]) => item(text, 10, y, 70))

function occupiedCell(day, y, activity, room = 'REO') {
  const anchor = columns[day]

  return [
    // Deliberately wide: the text crosses the activity/room boundary.
    // The capture must use the cell pair and the text origin, not assign
    // the whole fragment to whichever subcolumn receives the most overlap.
    item(activity, anchor.day - 15, y, 120),
    item(room, anchor.room - 10, y, 24)
  ]
}

const occupied = [
  ...occupiedCell('terca', 650, '11.ºE_AP . AS'),
  ...occupiedCell('quarta', 650, '12.ºD_AP . AEXP'),
  ...occupiedCell('quinta', 650, 'Eq Pedag', 'SP'),

  ...occupiedCell('terca', 600, '12.ºD_AP . AS'),
  ...occupiedCell('quarta', 600, '12.ºD_AP . AEXP'),
  ...occupiedCell('quinta', 600, 'Co PCE', 'SP'),

  ...occupiedCell('terca', 550, '12.ºD_AP . PAP'),
  ...occupiedCell('quarta', 550, '12.ºD_AP . AEXP'),
  ...occupiedCell('quinta', 550, '12.ºD_AP . AEXP', 'A2.10'),

  ...occupiedCell('terca', 450, '12.ºD_AP . AEXP'),
  ...occupiedCell('quarta', 450, '10.ºD_AIS . AEXP'),
  ...occupiedCell('quinta', 450, 'Clube Xadrez', 'SP'),
  ...occupiedCell('sexta', 450, '10.ºD_AIS . AEXP', 'B2.10'),

  ...occupiedCell('terca', 400, '12.ºD_AP . AEXP'),
  ...occupiedCell('quarta', 400, '10.ºD_AIS . AS'),
  ...occupiedCell('quinta', 400, '11.ºE_AP . AS', 'A2.17'),
  ...occupiedCell('sexta', 400, '12.ºD_AP . AEXP', 'Aud2'),

  ...occupiedCell('terca', 350, '11.ºE_AP . AS', 'A2.14'),
  ...occupiedCell('quarta', 350, '10.ºD_AIS . AS'),
  ...occupiedCell('quinta', 350, '10.ºD_AIS . AEXP'),
  ...occupiedCell('sexta', 350, '12.ºD_AP . AEXP', 'Aud2'),

  ...occupiedCell('terca', 300, '11.ºE_AP . AS', 'A2.14'),
  ...occupiedCell('quarta', 300, '10.ºD_AIS . AEXP'),
  ...occupiedCell('quinta', 300, '12.ºD_AP . AS', 'B2.09'),
  ...occupiedCell('sexta', 300, '12.ºD_AP . AEXP', 'Aud2')
]

test(
  'full professional timetable regression preserves all 25 occupied cells before semantic interpretation',
  () => {
    const sourcePages = [
      {
        pageNumber: 1,
        items: [
          ...header,
          ...timeRows,
          ...occupied
        ]
      }
    ]
    const reconstructed =
      reconstructScheduleGridDocument(sourcePages)
    const preserved =
      preserveScheduleGridCells(
        reconstructed,
        sourcePages
      )

    assert.equal(preserved.timeRows.length, 9)
    assert.equal(preserved.blocks.length, 25)

    const activities = preserved.blocks.map(
      block => block.rawActivityText
    )

    assert.equal(
      activities.filter(value => value.includes('AEXP')).length,
      13
    )
    assert.equal(
      activities.filter(value => /\. AS$/.test(value)).length,
      8
    )
    assert.equal(
      activities.filter(value => /\. PAP$/.test(value)).length,
      1
    )
    assert.ok(activities.includes('Eq Pedag'))
    assert.ok(activities.includes('Co PCE'))
    assert.ok(activities.includes('Clube Xadrez'))

    for (const block of preserved.blocks) {
      assert.ok(
        block.rawActivityText || block.rawRoomText,
        'an occupied cell must never disappear because its semantic meaning is uncertain'
      )
      assert.equal(block.type, 'unknown')
    }
  }
)

test(
  'room-only evidence is preserved as unknown instead of being dropped',
  () => {
    const sourcePages = [
      {
        pageNumber: 1,
        items: [
          ...header,
          item('09:25 - 10:15', 10, 650, 70),
          item('REO', columns.terca.room - 10, 650, 24)
        ]
      }
    ]
    const reconstructed =
      reconstructScheduleGridDocument(sourcePages)
    const preserved =
      preserveScheduleGridCells(
        reconstructed,
        sourcePages
      )
    const block = preserved.blocks.find(
      value => value.weekday === 2
    )

    assert.ok(block)
    assert.equal(block.rawActivityText, '')
    assert.equal(block.rawRoomText, 'REO')
    assert.equal(block.type, 'unknown')
    assert.ok(block.warnings.length > 0)
  }
)
