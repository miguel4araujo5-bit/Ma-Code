import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const extractorSource = await readFile(
  new URL(
    '../../src/lib/maPdf/extractPdfText.ts',
    import.meta.url
  ),
  'utf8'
)

const scheduleSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx',
    import.meta.url
  ),
  'utf8'
)

const atomicImportSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleImportAtomicRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const visualGridSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/ScheduleImportVisualGrid.tsx',
    import.meta.url
  ),
  'utf8'
)

function loadGeometryFunctions() {
  const normalizeStart = extractorSource.indexOf(
    'function normalizeComparableText('
  )
  const normalizeEnd = extractorSource.indexOf(
    '\nfunction toPositionedItem(',
    normalizeStart
  )
  const scheduleStart = extractorSource.indexOf(
    'function hasTimeRange('
  )
  const scheduleEnd = extractorSource.indexOf(
    '\nfunction prepareSchedulePositionedCells(',
    scheduleStart
  )

  assert.ok(normalizeStart >= 0)
  assert.ok(normalizeEnd > normalizeStart)
  assert.ok(scheduleStart >= 0)
  assert.ok(scheduleEnd > scheduleStart)

  const typescriptSnippet = [
    extractorSource.slice(normalizeStart, normalizeEnd),
    extractorSource.slice(scheduleStart, scheduleEnd),
    'export { getScheduleColumnAnchorForCell, discardTimetableRoomColumns }'
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

function loadLessonContextFunction() {
  const start = scheduleSource.indexOf(
    'const knownSubjectAliases:'
  )
  const end = scheduleSource.indexOf(
    '\nfunction detectWeekday(',
    start
  )

  assert.ok(start >= 0)
  assert.ok(end > start)

  const typescriptSnippet = [
    'type ImportedSubjectResolution = { subjectName: string; subjectConfirmed: boolean }',
    'type ImportedLessonResolution = ImportedSubjectResolution & { courseName: string }',
    scheduleSource.slice(start, end),
    'export { resolveImportedLessonContext }'
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

  new Function(
    'module',
    'exports',
    javascript
  )(
    module,
    module.exports
  )

  return module.exports.resolveImportedLessonContext
}

const {
  getScheduleColumnAnchorForCell,
  discardTimetableRoomColumns
} = loadGeometryFunctions()

const resolveImportedLessonContext =
  loadLessonContextFunction()

const anchors = [
  { kind: 'day', centerX: 100 },
  { kind: 'room', centerX: 140 },
  { kind: 'day', centerX: 200 },
  { kind: 'room', centerX: 240 },
  { kind: 'day', centerX: 300 },
  { kind: 'room', centerX: 340 },
  { kind: 'day', centerX: 400 },
  { kind: 'room', centerX: 440 },
  { kind: 'day', centerX: 500 },
  { kind: 'room', centerX: 540 }
]

function headerCell(text, centerX) {
  return {
    text,
    x: centerX - 10,
    width: 20
  }
}

const header = {
  text: 'Segunda Sala Terça Sala Quarta Sala Quinta Sala Sexta Sala',
  cells: [],
  positionedCells: [
    headerCell('Segunda', 100),
    headerCell('Sala', 140),
    headerCell('Terça', 200),
    headerCell('Sala', 240),
    headerCell('Quarta', 300),
    headerCell('Sala', 340),
    headerCell('Quinta', 400),
    headerCell('Sala', 440),
    headerCell('Sexta', 500),
    headerCell('Sala', 540)
  ]
}

function timetableRow(
  time,
  activity,
  activityX,
  activityWidth,
  roomX,
  roomWidth = 25
) {
  return {
    text: `${time} ${activity} SP`,
    cells: [],
    positionedCells: [
      { text: time, x: 10, width: 70 },
      {
        text: activity,
        x: activityX,
        width: activityWidth
      },
      { text: 'SP', x: roomX, width: roomWidth }
    ]
  }
}

test(
  'schedule geometry assigns a long Tuesday activity by column overlap instead of its left edge',
  () => {
    const clubXadrez = {
      text: 'Clube Xadrez',
      x: 150,
      width: 80
    }

    // The legacy probe would be around x=155 and therefore closer to
    // the preceding room centre (140) than to Tuesday (200).
    assert.equal(
      getScheduleColumnAnchorForCell(
        clubXadrez,
        anchors
      ),
      anchors[2]
    )
  }
)

test(
  'room-column filtering preserves Xadrez and other duties without leaking SP',
  () => {
    const lines = [
      header,
      timetableRow(
        '15:20–16:10',
        'Clube Xadrez',
        150,
        80,
        225,
        30
      ),
      timetableRow(
        '13:25–14:15',
        'Eq Pedag',
        350,
        70,
        425
      ),
      timetableRow(
        '14:20–15:10',
        'Eq PCE',
        355,
        60,
        425
      ),
      timetableRow(
        '09:20–10:10',
        '10.º D AE',
        175,
        35,
        225
      )
    ]

    const result = discardTimetableRoomColumns(lines)
    const activityTexts = result
      .slice(1)
      .map(line =>
        line.positionedCells
          .filter(cell => !cell.text.includes('–'))
          .map(cell => cell.text)
      )

    assert.deepEqual(
      activityTexts,
      [
        ['Clube Xadrez'],
        ['Eq Pedag'],
        ['Eq PCE'],
        ['10.º D AE']
      ]
    )

    assert.equal(
      result[1].positionedCells[1].x,
      150
    )
    assert.equal(
      result[4].positionedCells[1].x,
      175
    )
    assert.doesNotMatch(
      JSON.stringify(
        result.slice(1).map(line => line.positionedCells)
      ),
      /\bSP\b/
    )
  }
)

test(
  'schedule parser continues to recognise Clube activities as duties',
  () => {
    assert.ok(
      scheduleSource.includes('Clube\\s+')
    )
    assert.match(
      scheduleSource,
      /function extractDutyName\(value: string\)/
    )
  }
)

test(
  'AP and TAP are course aliases and stay separate from the imported subject',
  () => {
    assert.deepEqual(
      resolveImportedLessonContext('AP AE'),
      {
        courseName: 'Técnico de Apoio Psicossocial',
        subjectName: 'Área de Expressões',
        subjectConfirmed: true
      }
    )

    assert.deepEqual(
      resolveImportedLessonContext('ASC TAP'),
      {
        courseName: 'Técnico de Apoio Psicossocial',
        subjectName: 'Animação Sociocultural',
        subjectConfirmed: true
      }
    )

    assert.deepEqual(
      resolveImportedLessonContext('AP'),
      {
        courseName: 'Técnico de Apoio Psicossocial',
        subjectName: '',
        subjectConfirmed: false
      }
    )

    assert.deepEqual(
      resolveImportedLessonContext('AI'),
      {
        courseName: '',
        subjectName: 'Área de Integração',
        subjectConfirmed: true
      }
    )

    assert.match(
      scheduleSource,
      /commitScheduleImportAtomically\(/
    )
    assert.match(
      atomicImportSource,
      /courseName/
    )
    assert.match(
      atomicImportSource,
      /existingCourse/
    )
    assert.match(
      visualGridSource,
      />\s*Curso\s*</
    )
    assert.match(
      visualGridSource,
      /courseName/
    )
  }
)
