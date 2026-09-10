import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const geometrySource = await readFile(
  new URL('../../src/components/ma-professor/setup/scheduleGridGeometry.ts', import.meta.url),
  'utf8'
)
const preservationSource = await readFile(
  new URL('../../src/components/ma-professor/setup/scheduleGridCellPreservation.ts', import.meta.url),
  'utf8'
)
const semanticSource = await readFile(
  new URL('../../src/components/ma-professor/setup/scheduleGridSemanticInterpretation.ts', import.meta.url),
  'utf8'
)

function stripTypeImport(source, moduleName) {
  return source.replace(
    new RegExp(`^import type \\{[\\s\\S]*?\\} from '${moduleName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}'\\n`, 'm'),
    ''
  )
}

function loadFunctions() {
  const source = [
    geometrySource,
    stripTypeImport(preservationSource, './scheduleGridGeometry'),
    stripTypeImport(semanticSource, './scheduleGridGeometry'),
    'export { reconstructScheduleGridDocument, preserveScheduleGridCells, interpretScheduleGridDocument }'
  ].join('\n\n')

  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText
  const module = { exports: {} }
  new Function('module', 'exports', javascript)(module, module.exports)
  return module.exports
}

const {
  reconstructScheduleGridDocument,
  preserveScheduleGridCells,
  interpretScheduleGridDocument
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
  item('Segunda', 80, 760, 40), item('Sala', 165, 760, 30),
  item('Terça', 250, 760, 40), item('Sala', 345, 760, 30),
  item('Quarta', 430, 760, 40), item('Sala', 525, 760, 30),
  item('Quinta', 610, 760, 40), item('Sala', 705, 760, 30),
  item('Sexta', 790, 760, 40), item('Sala', 885, 760, 30)
]

const rows = [
  ['08:30 - 09:20', 700], ['09:25 - 10:15', 650], ['10:30 - 11:20', 600],
  ['11:25 - 12:15', 550], ['12:20 - 13:10', 500], ['13:20 - 14:10', 450],
  ['14:15 - 15:05', 400], ['15:15 - 16:05', 350], ['16:10 - 17:00', 300]
].map(([text, y]) => item(text, 10, y, 70))

function centeredCell(day, y, activity, room = 'REO') {
  const anchor = columns[day]
  const activityWidth = Math.max(74, activity.length * 7.2)
  const activityX = anchor.day - activityWidth / 2
  const roomWidth = Math.max(20, room.length * 6)
  const roomX = anchor.room - roomWidth / 2
  return [item(activity, activityX, y, activityWidth), item(room, roomX, y, roomWidth)]
}

const occupied = [
  ...centeredCell('terca', 650, '11.ºE_AP . AS'), ...centeredCell('quarta', 650, '12.ºD_AP . AEXP'), ...centeredCell('quinta', 650, 'Eq Pedag', 'SP'),
  ...centeredCell('terca', 600, '12.ºD_AP . AS'), ...centeredCell('quarta', 600, '12.ºD_AP . AEXP'), ...centeredCell('quinta', 600, 'Co PCE', 'SP'),
  ...centeredCell('terca', 550, '12.ºD_AP . PAP'), ...centeredCell('quarta', 550, '12.ºD_AP . AEXP'), ...centeredCell('quinta', 550, '12.ºD_AP . AEXP', 'A2.10'),
  ...centeredCell('terca', 450, '12.ºD_AP . AEXP'), ...centeredCell('quarta', 450, '10.ºD_AIS . AEXP'), ...centeredCell('quinta', 450, 'Clube Xadrez', 'SP'), ...centeredCell('sexta', 450, '10.ºD_AIS . AEXP', 'B2.10'),
  ...centeredCell('terca', 400, '12.ºD_AP . AEXP'), ...centeredCell('quarta', 400, '10.ºD_AIS . AS'), ...centeredCell('quinta', 400, '11.ºE_AP . AS', 'A2.17'), ...centeredCell('sexta', 400, '12.ºD_AP . AEXP', 'Aud2'),
  ...centeredCell('terca', 350, '11.ºE_AP . AS', 'A2.14'), ...centeredCell('quarta', 350, '10.ºD_AIS . AS'), ...centeredCell('quinta', 350, '10.ºD_AIS . AEXP'), ...centeredCell('sexta', 350, '12.ºD_AP . AEXP', 'Aud2'),
  ...centeredCell('terca', 300, '11.ºE_AP . AS', 'A2.14'), ...centeredCell('quarta', 300, '10.ºD_AIS . AEXP'), ...centeredCell('quinta', 300, '12.ºD_AP . AS', 'B2.09'), ...centeredCell('sexta', 300, '12.ºD_AP . AEXP', 'Aud2')
]

const legend = [
  item('Atividades do professor', 20, 180, 120), item('AEXP-Área de Expressões', 20, 160, 150),
  item('AS-Animação Sociocultural', 20, 145, 160), item('PAP-Prova de Aptidão Profissional', 20, 130, 200),
  item('Clube Xadrez', 20, 115, 80), item('Co PCE-Coordenadora do Projeto Cultural de Escola', 20, 100, 260),
  item('Eq Pedag-Equipa Pedagógica', 20, 85, 170), item('O diretor', 20, 65, 60)
]

test('centred long timetable strings remain in the intended day and all 25 cells survive', () => {
  const sourcePages = [{ pageNumber: 1, items: [...header, ...rows, ...occupied, ...legend] }]
  const reconstructed = reconstructScheduleGridDocument(sourcePages)
  const preserved = preserveScheduleGridCells(reconstructed, sourcePages)
  const interpreted = interpretScheduleGridDocument(preserved, sourcePages, 50)

  assert.equal(preserved.blocks.length, 25)
  assert.equal(interpreted.lessons.length, 22)
  assert.equal(interpreted.duties.length, 3)
  assert.equal(interpreted.unknownBlocks.length, 0)

  const wed0925 = interpreted.lessons.find(lesson => lesson.weekday === 3 && lesson.startTime === '09:25')
  assert.ok(wed0925)
  assert.equal(wed0925.groupName, '12.º D')
  assert.equal(wed0925.subjectName, 'Área de Expressões')
})
