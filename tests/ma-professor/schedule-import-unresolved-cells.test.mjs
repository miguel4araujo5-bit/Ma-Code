import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const scheduleSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx',
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

function loadParser() {
  const start = scheduleSource.indexOf('const weekdayPatterns:')
  const end = scheduleSource.indexOf('\nfunction shortName(', start)

  assert.ok(start >= 0)
  assert.ok(end > start)

  const prelude = `
    type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
    type ScheduleImportTimeRow = {
      startTime: string
      endTime: string
    }
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
      dutyNameBackup?: string
    }
    type DutyDraft = {
      id: string
      included: boolean
      weekday: Weekday
      startTime: string
      endTime: string
      name: string
      lessonBackup?: {
        periodCount: number
        groupName: string
        courseName: string
        subjectName: string
        subjectConfirmed: boolean
      }
    }
    type UnresolvedDraft = {
      id: string
      weekday: Weekday
      startTime: string
      endTime: string
      periodCount: number
      rawText: string
      reason: string
    }
    type DayColumn = { weekday: Weekday; centerX: number }
    type ParsedProposal = {
      lessons: Draft[]
      duties: DutyDraft[]
      unresolved: UnresolvedDraft[]
      timeRows: ScheduleImportTimeRow[]
    }
    type ImportedSubjectResolution = {
      subjectName: string
      subjectConfirmed: boolean
    }
    type ImportedLessonResolution = ImportedSubjectResolution & {
      courseName: string
    }
    type ExtractedPdfCell = {
      text: string
      x: number
      width: number
      requiresReview?: boolean
    }
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

  const javascript = ts.transpileModule(
    [
      prelude,
      scheduleSource.slice(start, end),
      'export { parsePages }'
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
  return module.exports.parsePages
}

const parsePages = loadParser()

const header = [
  { text: 'Segunda', x: 100, width: 40 },
  { text: 'Terça', x: 270, width: 40 },
  { text: 'Quarta', x: 450, width: 40 },
  { text: 'Quinta', x: 630, width: 40 },
  { text: 'Sexta', x: 810, width: 40 }
]

test('an occupied cell that is neither a safe lesson nor a safe duty becomes unresolved instead of disappearing', () => {
  const proposal = parsePages(
    [
      {
        pageNumber: 1,
        lines: [
          {
            text: 'Segunda Terça Quarta Quinta Sexta',
            cells: header.map(cell => cell.text),
            positionedCells: header
          },
          {
            text: '07:35–08:25',
            cells: ['07:35–08:25'],
            positionedCells: [
              { text: '07:35–08:25', x: 10, width: 70 }
            ]
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

  assert.equal(proposal.lessons.length, 1)
  assert.equal(proposal.duties.length, 1)
  assert.equal(proposal.unresolved.length, 1)
  assert.deepEqual(
    {
      weekday: proposal.unresolved[0].weekday,
      startTime: proposal.unresolved[0].startTime,
      endTime: proposal.unresolved[0].endTime,
      periodCount: proposal.unresolved[0].periodCount,
      rawText: proposal.unresolved[0].rawText
    },
    {
      weekday: 5,
      startTime: '08:30',
      endTime: '09:20',
      periodCount: 1,
      rawText: 'Projeto Individual'
    }
  )

  assert.deepEqual(
    proposal.timeRows,
    [
      { startTime: '07:35', endTime: '08:25' },
      { startTime: '08:30', endTime: '09:20' }
    ]
  )
})

test('unresolved cells are reviewed in the weekly grid with Componente letiva, Cargo or explicit ignore', () => {
  assert.doesNotMatch(
    scheduleSource,
    /ScheduleImportUnresolvedReview/
  )
  assert.match(
    scheduleSource,
    /unresolved=\{unresolved\}/
  )
  assert.match(
    scheduleSource,
    /sourceTimeRows=\{sourceTimeRows\}/
  )
  assert.match(
    visualGridSource,
    /Componente letiva/
  )
  assert.match(
    visualGridSource,
    /Cargo/
  )
  assert.match(
    visualGridSource,
    /Ignorar este bloco/
  )
  assert.match(
    scheduleSource,
    /unresolved\.length > 0/
  )
  assert.match(
    scheduleSource,
    /id: block\.id/
  )
})
