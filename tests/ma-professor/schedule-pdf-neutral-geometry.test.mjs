import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleGridGeometry.ts',
    import.meta.url
  ),
  'utf8'
)

function loadGeometryModule() {
  const javascript = ts.transpileModule(
    source,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }
  ).outputText
  const module = { exports: {} }

  new Function(
    'module',
    'exports',
    javascript
  )(
    module,
    module.exports
  )

  return module.exports
}

const {
  reconstructScheduleGridDocument
} = loadGeometryModule()

function item(
  text,
  x,
  y,
  width,
  height = 10
) {
  return {
    text,
    x,
    y,
    width,
    height
  }
}

function headerItems() {
  return [
    item('Segunda', 100, 700, 40),
    item('Sala', 180, 700, 30),
    item('Terça', 270, 700, 40),
    item('Sala', 360, 700, 30),
    item('Quarta', 450, 700, 40),
    item('Sala', 540, 700, 30),
    item('Quinta', 630, 700, 40),
    item('Sala', 720, 700, 30),
    item('Sexta', 810, 700, 40),
    item('Sala', 900, 700, 30)
  ]
}

test(
  'neutral geometry preserves empty time rows and keeps room text separate from activity text',
  () => {
    const document = reconstructScheduleGridDocument([
      {
        pageNumber: 1,
        items: [
          ...headerItems(),
          item('08:30–09:20', 10, 650, 70),
          item('10.ºD_AP . AEXP', 100, 650, 52),
          item('SP', 184, 650, 18),
          item('Co PCE', 270, 650, 46),
          item('A2.14', 364, 650, 25),
          item('09:20–10:10', 10, 600, 70),
          item('10:20–11:10', 10, 550, 70),
          item('12.ºD_AP', 270, 554, 48),
          item('. AEXP', 274, 544, 34),
          item('REO', 364, 550, 24)
        ]
      }
    ])

    assert.equal(document.pages.length, 1)
    assert.equal(document.timeRows.length, 3)
    assert.deepEqual(
      document.timeRows.map(row => [row.startTime, row.endTime]),
      [
        ['08:30', '09:20'],
        ['09:20', '10:10'],
        ['10:20', '11:10']
      ]
    )

    const emptyRow = document.timeRows[1]
    assert.equal(
      document.blocks.some(block => block.timeRowId === emptyRow.id),
      false,
      'the empty row remains part of the grid even though it creates no block'
    )

    const monday = document.blocks.find(
      block => block.weekday === 1 && block.startTime === '08:30'
    )
    assert.ok(monday)
    assert.equal(monday.rawActivityText, '10.ºD_AP . AEXP')
    assert.equal(monday.rawRoomText, 'SP')
    assert.doesNotMatch(monday.rawActivityText, /\bSP\b/)
    assert.deepEqual(
      monday.sourceItems.map(sourceItem => sourceItem.text),
      ['10.ºD_AP . AEXP', 'SP']
    )

    const tuesdayLater = document.blocks.find(
      block => block.weekday === 2 && block.startTime === '10:20'
    )
    assert.ok(tuesdayLater)
    assert.match(tuesdayLater.rawActivityText, /12\.ºD_AP/)
    assert.match(tuesdayLater.rawActivityText, /AEXP/)
    assert.equal(tuesdayLater.rawRoomText, 'REO')
    assert.doesNotMatch(tuesdayLater.rawActivityText, /\bREO\b/)
    assert.deepEqual(
      tuesdayLater.sourceItems.map(sourceItem => sourceItem.text),
      ['12.ºD_AP', '. AEXP', 'REO']
    )
  }
)

test(
  'every occupied activity cell starts neutral and preserves field-level confidence instead of inventing semantics',
  () => {
    const document = reconstructScheduleGridDocument([
      {
        pageNumber: 1,
        items: [
          ...headerItems(),
          item('08:30–09:20', 10, 650, 70),
          item('12.ºD_AP . AEXP', 270, 650, 70),
          item('REO', 364, 650, 24),
          item('Projeto Individual', 450, 650, 80)
        ]
      }
    ])

    assert.equal(document.blocks.length, 2)

    for (const block of document.blocks) {
      assert.equal(block.type, 'unknown')
      assert.equal(block.included, true)
      assert.equal(block.confidence.weekday, 'high')
      assert.equal(block.confidence.time, 'high')
      assert.equal(block.confidence.classification, 'low')
      assert.equal(block.rawGroupToken, '')
      assert.equal(block.rawActivityToken, '')
      assert.equal(block.groupName, undefined)
      assert.equal(block.subjectName, undefined)
      assert.ok(block.sourceItems.length > 0)
    }
  }
)

test(
  'current professional timetable shape keeps all nine time rows and representative occupied cells without interpreting their codes',
  () => {
    const times = [
      ['08:30–09:20', 650],
      ['09:25–10:15', 600],
      ['10:30–11:20', 550],
      ['11:25–12:15', 500],
      ['12:20–13:10', 450],
      ['13:20–14:10', 400],
      ['14:15–15:05', 350],
      ['15:15–16:05', 300],
      ['16:10–17:00', 250]
    ]

    const document = reconstructScheduleGridDocument([
      {
        pageNumber: 1,
        items: [
          ...headerItems(),
          ...times.map(([time, y]) => item(time, 10, y, 70)),
          item('11.ºE_AP . AS', 100, 650, 58),
          item('REO', 184, 650, 22),
          item('12.ºD_AP . PAP', 270, 600, 66),
          item('REO', 364, 600, 22),
          item('12.ºD_AP . AEXP', 450, 550, 72),
          item('A2.10', 544, 550, 28),
          item('10.ºD_AIS . AEXP', 630, 500, 74),
          item('REO', 724, 500, 22),
          item('Eq Pedag', 810, 400, 54),
          item('SP', 904, 400, 18),
          item('Co PCE', 270, 300, 46),
          item('SP', 364, 300, 18)
        ]
      }
    ])

    assert.equal(document.timeRows.length, 9)
    assert.equal(document.blocks.length, 6)
    assert.deepEqual(
      document.blocks.map(block => block.rawActivityText),
      [
        '11.ºE_AP . AS',
        '12.ºD_AP . PAP',
        '12.ºD_AP . AEXP',
        '10.ºD_AIS . AEXP',
        'Eq Pedag',
        'Co PCE'
      ]
    )
    assert.deepEqual(
      document.blocks.map(block => block.rawRoomText),
      ['REO', 'REO', 'A2.10', 'REO', 'SP', 'SP']
    )
    assert.ok(
      document.blocks.every(block => block.type === 'unknown')
    )
    assert.ok(
      document.blocks.every(block =>
        !block.rawActivityText.includes(block.rawRoomText) ||
        !block.rawRoomText
      )
    )
  }
)

test(
  'geometry reports uncertainty instead of fabricating columns when a timetable header cannot be established',
  () => {
    const document = reconstructScheduleGridDocument([
      {
        pageNumber: 1,
        items: [
          item('08:30–09:20', 10, 650, 70),
          item('12.ºD_AP . AEXP', 100, 650, 70)
        ]
      }
    ])

    assert.equal(document.timeRows.length, 1)
    assert.equal(document.columns.length, 0)
    assert.equal(document.blocks.length, 0)
    assert.ok(
      document.warnings.some(warning =>
        warning.includes('não foi possível reconstruir com segurança as colunas')
      )
    )
  }
)
