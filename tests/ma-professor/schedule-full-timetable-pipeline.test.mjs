import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const baseUrl = '../../src/components/ma-professor/setup/'
const geometrySource = await readFile(
  new URL(`${baseUrl}scheduleGridGeometry.ts`, import.meta.url),
  'utf8'
)
const preservationSource = await readFile(
  new URL(`${baseUrl}scheduleGridCellPreservation.ts`, import.meta.url),
  'utf8'
)
const semanticSource = await readFile(
  new URL(`${baseUrl}scheduleGridSemanticInterpretation.ts`, import.meta.url),
  'utf8'
)

function stripLocalImports(source) {
  return source.replace(
    /^import(?: type)? \{[\s\S]*?\} from '\.\/[^']+'\n/gm,
    ''
  )
}

function loadPipeline() {
  const javascript = ts.transpileModule(
    [
      geometrySource,
      stripLocalImports(preservationSource),
      stripLocalImports(semanticSource)
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
  return module.exports
}

const {
  reconstructScheduleGridDocument,
  preserveScheduleGridCells,
  interpretScheduleGridDocument
} = loadPipeline()

function item(text, x, y, width, height = 10) {
  return { text, x, y, width, height }
}

const x = {
  segunda: [100, 180],
  terca: [270, 360],
  quarta: [450, 540],
  quinta: [630, 720],
  sexta: [810, 900]
}

const header = Object.entries(x).flatMap(([day, [dayX, roomX]]) => [
  item(
    {
      segunda: 'Segunda',
      terca: 'Terça',
      quarta: 'Quarta',
      quinta: 'Quinta',
      sexta: 'Sexta'
    }[day],
    dayX - 20,
    760,
    40
  ),
  item('Sala', roomX - 15, 760, 30)
])

const times = [
  ['08:30 - 09:20', 700],
  ['09:25 - 10:15', 650],
  ['10:30 - 11:20', 600],
  ['11:25 - 12:15', 550],
  ['12:20 - 13:10', 500],
  ['13:20 - 14:10', 450],
  ['14:15 - 15:05', 400],
  ['15:15 - 16:05', 350],
  ['16:10 - 17:00', 300]
].map(([label, y]) => item(label, 10, y, 70))

const entries = [
  ['terca', 650, '11.ºE_AP . AS', 'REO'],
  ['quarta', 650, '12.ºD_AP . AEXP', 'REO'],
  ['quinta', 650, 'Eq Pedag', 'SP'],
  ['terca', 600, '12.ºD_AP . AS', 'REO'],
  ['quarta', 600, '12.ºD_AP . AEXP', 'REO'],
  ['quinta', 600, 'Co PCE', 'SP'],
  ['terca', 550, '12.ºD_AP . PAP', 'REO'],
  ['quarta', 550, '12.ºD_AP . AEXP', 'REO'],
  ['quinta', 550, '12.ºD_AP . AEXP', 'A2.10'],
  ['terca', 450, '12.ºD_AP . AEXP', 'REO'],
  ['quarta', 450, '10.ºD_AIS . AEXP', 'REO'],
  ['quinta', 450, 'Clube Xadrez', 'SP'],
  ['sexta', 450, '10.ºD_AIS . AEXP', 'B2.10'],
  ['terca', 400, '12.ºD_AP . AEXP', 'REO'],
  ['quarta', 400, '10.ºD_AIS . AS', 'REO'],
  ['quinta', 400, '11.ºE_AP . AS', 'A2.17'],
  ['sexta', 400, '12.ºD_AP . AEXP', 'Aud2'],
  ['terca', 350, '11.ºE_AP . AS', 'A2.14'],
  ['quarta', 350, '10.ºD_AIS . AS', 'REO'],
  ['quinta', 350, '10.ºD_AIS . AEXP', 'REO'],
  ['sexta', 350, '12.ºD_AP . AEXP', 'Aud2'],
  ['terca', 300, '11.ºE_AP . AS', 'A2.14'],
  ['quarta', 300, '10.ºD_AIS . AEXP', 'REO'],
  ['quinta', 300, '12.ºD_AP . AS', 'B2.09'],
  ['sexta', 300, '12.ºD_AP . AEXP', 'Aud2']
]

function cellItems([day, y, activity, room]) {
  const [dayX, roomX] = x[day]
  return [
    item(activity, dayX - 15, y, 120),
    item(room, roomX - 10, y, 24)
  ]
}

test(
  'complete professional timetable structure becomes 22 lessons and 3 duties without losing occupied cells',
  () => {
    const sourcePages = [
      {
        pageNumber: 1,
        items: [
          ...header,
          ...times,
          ...entries.flatMap(cellItems)
        ]
      }
    ]
    const rawGrid = reconstructScheduleGridDocument(sourcePages)
    const grid = preserveScheduleGridCells(rawGrid, sourcePages)
    const interpreted = interpretScheduleGridDocument(
      grid,
      sourcePages,
      50
    )

    assert.equal(grid.timeRows.length, 9)
    assert.equal(grid.blocks.length, 25)
    assert.equal(interpreted.lessons.length, 22)
    assert.equal(interpreted.duties.length, 3)
    assert.equal(interpreted.unknownBlocks.length, 0)

    assert.equal(
      interpreted.lessons.filter(
        lesson => lesson.subjectName === 'Área de Expressões'
      ).length,
      13
    )
    assert.equal(
      interpreted.lessons.filter(
        lesson => lesson.subjectName === 'Animação Sociocultural'
      ).length,
      8
    )
    assert.equal(
      interpreted.lessons.filter(
        lesson => lesson.subjectName === 'Prova de Aptidão Profissional'
      ).length,
      1
    )
    assert.deepEqual(
      interpreted.duties.map(duty => duty.name).sort(),
      ['Clube Xadrez', 'Co PCE', 'Eq Pedag'].sort()
    )
  }
)
