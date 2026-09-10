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

const scheduleSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx',
    import.meta.url
  ),
  'utf8'
)

function evaluateCommonJs(source) {
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

function loadLegacyParser() {
  const start = scheduleSource.indexOf(
    'const weekdayPatterns:'
  )
  const end = scheduleSource.indexOf(
    '\nfunction shortName(',
    start
  )

  assert.ok(start >= 0)
  assert.ok(end > start)

  const prelude = `
    type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
    type Draft = {
      id: string
      included: boolean
      weekday: Weekday
      startTime: string
      endTime: string
      periodCount: number
      groupName: string
      courseName: string
      subjectName: string
      subjectConfirmed: boolean
    }
    type DutyDraft = {
      id: string
      included: boolean
      weekday: Weekday
      startTime: string
      endTime: string
      name: string
    }
    type DayColumn = { weekday: Weekday; centerX: number }
    type ParsedProposal = { lessons: Draft[]; duties: DutyDraft[] }
    type ImportedSubjectResolution = {
      subjectName: string
      subjectConfirmed: boolean
    }
    type ImportedLessonResolution = ImportedSubjectResolution & {
      courseName: string
    }
    type ExtractedPdfCell = { text: string; x: number; width: number }
    type ExtractedPdfLine = {
      text: string
      cells: string[]
      positionedCells?: ExtractedPdfCell[]
    }
    type ExtractedPdfPage = {
      pageNumber: number
      lines: ExtractedPdfLine[]
    }
  `

  return evaluateCommonJs([
    prelude,
    scheduleSource.slice(start, end),
    'export { parsePages }'
  ].join('\n\n')).parsePages
}

const geometry = evaluateCommonJs(geometrySource)
const parseLegacyPages = loadLegacyParser()

function rawItem(text, x, y, width, height = 10) {
  return { text, x, y, width, height }
}

const rawHeader = [
  rawItem('Segunda', 100, 700, 40),
  rawItem('Sala', 180, 700, 30),
  rawItem('Terça', 270, 700, 40),
  rawItem('Sala', 360, 700, 30),
  rawItem('Quarta', 450, 700, 40),
  rawItem('Sala', 540, 700, 30),
  rawItem('Quinta', 630, 700, 40),
  rawItem('Sala', 720, 700, 30),
  rawItem('Sexta', 810, 700, 40),
  rawItem('Sala', 900, 700, 30)
]

const legacyHeaderCells = rawHeader.map(({ text, x, width }) => ({
  text,
  x,
  width
}))

function slotKey(value) {
  return `${value.weekday}|${value.startTime}|${value.endTime}`
}

test(
  'geometry contains every slot already recognised by the legacy parser and keeps additional uncertain cells instead of dropping them',
  () => {
    const legacy = parseLegacyPages(
      [
        {
          pageNumber: 1,
          lines: [
            {
              text: 'Segunda Sala Terça Sala Quarta Sala Quinta Sala Sexta Sala',
              cells: legacyHeaderCells.map(cell => cell.text),
              positionedCells: legacyHeaderCells
            },
            {
              text: '08:30–09:20 10.º D AE Co PCE Projeto Individual',
              cells: [
                '08:30–09:20',
                '10.º D AE',
                'Co PCE',
                'Projeto Individual'
              ],
              positionedCells: [
                { text: '08:30–09:20', x: 10, width: 70 },
                { text: '10.º D AE', x: 100, width: 45 },
                { text: 'Co PCE', x: 270, width: 46 },
                { text: 'Projeto Individual', x: 810, width: 80 }
              ]
            }
          ]
        }
      ],
      50
    )

    const captured = geometry.reconstructScheduleGridDocument([
      {
        pageNumber: 1,
        items: [
          ...rawHeader,
          rawItem('08:30–09:20', 10, 650, 70),
          rawItem('10.º D AE', 100, 650, 45),
          rawItem('SP', 184, 650, 18),
          rawItem('Co PCE', 270, 650, 46),
          rawItem('A2.14', 364, 650, 25),
          rawItem('AEXP', 450, 650, 38),
          rawItem('Lab1', 544, 650, 25),
          rawItem('Projeto Individual', 810, 650, 80),
          rawItem('REO', 904, 650, 24)
        ]
      }
    ])

    const legacyItems = [
      ...legacy.lessons,
      ...legacy.duties
    ]
    const capturedSlots = new Set(
      captured.blocks.map(slotKey)
    )

    assert.equal(legacyItems.length, 3)

    for (const item of legacyItems) {
      assert.ok(
        capturedSlots.has(slotKey(item)),
        `neutral capture lost legacy slot ${slotKey(item)}`
      )
    }

    assert.equal(captured.blocks.length, 4)

    const additional = captured.blocks.find(
      block => block.weekday === 3
    )
    assert.ok(additional)
    assert.equal(additional.rawActivityText, 'AEXP')
    assert.equal(additional.rawRoomText, 'Lab1')
    assert.equal(additional.type, 'unknown')
  }
)

test(
  'geometry is now the primary import path while the legacy parser remains a compatibility fallback',
  () => {
    assert.match(
      scheduleSource,
      /extractScheduleGridAnalysisFromPdf/
    )
    assert.match(
      scheduleSource,
      /interpretScheduleGridDocument/
    )
    assert.match(
      scheduleSource,
      /if \(!proposal && !geometryCapturedBlocks\) \{[\s\S]*parsePages\(/
    )
    assert.match(
      scheduleSource,
      /geometryCapturedBlocks\s*=\s*analysis\.grid\.blocks\.length > 0/
    )
  }
)
