import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// Real PDF.js text positions from two timetable layouts, with identifying
// headers/signatures omitted. Tests exercise the extractor used by the button,
// not the experimental geometry/semantic pipeline.
const extractorSource = await readFile(new URL('../../src/lib/maPdf/extractPdfText.ts', import.meta.url), 'utf8')
const stepSource = await readFile(new URL('../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx', import.meta.url), 'utf8')
const fixtures = await Promise.all(['2026', '2025'].map(async year =>
  JSON.parse(await readFile(new URL(`./fixtures/schedule-text-items-${year}.json`, import.meta.url), 'utf8'))
))

function load(source, dependencies = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  new Function('module', 'exports', 'require', compiled)(module, module.exports, name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
    return dependencies[name]
  })
  return module.exports
}

const parser = load(
  stepSource.slice(stepSource.indexOf('const weekdayPatterns:'), stepSource.indexOf('\nfunction shortName(')) +
  '\nexport { parsePages, resolveImportedLessonContext }'
)

async function importItems(items) {
  let cleaned = false
  const extractor = load(extractorSource, {
    'pdfjs-dist/build/pdf.worker.min.mjs?url': { default: 'test-worker.mjs' },
    'pdfjs-dist': {
      GlobalWorkerOptions: {},
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            streamTextContent: () => new ReadableStream({
              start(controller) { controller.enqueue({ items }); controller.close() }
            }),
            cleanup() { cleaned = true }
          })
        }),
        destroy: async () => {}
      })
    }
  })
  const extracted = await extractor.extractTextFromPdf({ file: new File([''], 'timetable.pdf') }, () => {})
  assert.equal(cleaned, true)
  return { extracted, proposal: parser.parsePages(extracted.pages, 50) }
}

function countSubjects(lessons) {
  return Object.fromEntries([...new Set(lessons.map(lesson => lesson.subjectName))].map(name =>
    [name, lessons.filter(lesson => lesson.subjectName === name).length]
  ))
}

test('real 2026 PDF text produces 22 lessons, 3 duties and no room-derived subjects', async () => {
  const { proposal, extracted } = await importItems(fixtures[0])
  assert.equal(proposal.lessons.length, 22)
  assert.equal(proposal.duties.length, 3)
  assert.equal(proposal.unresolved.length, 0)
  assert.deepEqual(countSubjects(proposal.lessons), {
    'Animação Sociocultural': 8,
    'Área de Expressões': 13,
    'Prova de Aptidão Profissional': 1
  })
  assert.ok(proposal.lessons.every(lesson => lesson.subjectConfirmed))
  assert.deepEqual(proposal.duties.map(duty => duty.name).sort(), ['Clube Xadrez', 'Co PCE', 'Eq Pedag'])
  const lesson = proposal.lessons.find(lesson => lesson.weekday === 3 && lesson.startTime === '09:25')
  assert.equal(lesson.groupName, '12.º D')
  assert.equal(lesson.courseName, 'Técnico de Apoio Psicossocial')
  assert.equal(lesson.subjectName, 'Área de Expressões')
  assert.ok(proposal.lessons.some(lesson => lesson.courseName === 'AIS'))
  const row = extracted.pages[0].lines.find(line => line.text.startsWith('09:25'))
  assert.match(row.text, /AEXP REO/)
  assert.ok(row.cells.some(cell => cell.includes('AEXP REO')), 'MA-PDF exports retain the original room text')
  assert.doesNotMatch(JSON.stringify(row.positionedCells), /\bREO\b|\bSP\b/)
})

test('room names, including another subject code, never change the teaching proposal', async () => {
  const baseline = (await importItems(fixtures[0])).proposal
  for (const room of ['REO', 'A.2.16', 'A2.16', 'Aud2', 'XYZ', 'PAP']) {
    const items = fixtures[0].map(item => /^(?:REO|A2\.|B2\.|Aud2)/.test(item.str)
      ? { ...item, str: room }
      : item)
    assert.deepEqual((await importItems(items)).proposal, baseline, room)
  }
})

test('real 2025 layout splits merged headers and repeated teaching/room text without guessing A or P', async () => {
  const { proposal, extracted } = await importItems(fixtures[1])
  assert.equal(proposal.lessons.length, 21)
  assert.equal(proposal.duties.length, 4)
  assert.equal(proposal.unresolved.length, 0)
  assert.deepEqual([...new Set(proposal.lessons.map(lesson => lesson.subjectName))].sort(), ['A', 'P'])
  assert.ok(proposal.lessons.every(lesson => !lesson.subjectConfirmed))
  const header = extracted.pages[0].lines.find(line => line.text.startsWith('Tempos'))
  assert.equal(header.positionedCells.filter(cell => cell.text === 'Sala').length, 5)
  assert.ok(header.cells.includes('Segunda Sala'), 'original Excel cells are preserved')
})

test('unknown courses and multiword subjects survive without a closed dictionary', async () => {
  const items = fixtures[0].map(item => ({ ...item, str: item.str.replace('12.ºD_AP . AEXP', '12.ºD_QZX . Robótica Aplicada') }))
  const { proposal } = await importItems(items)
  const lessons = proposal.lessons.filter(lesson => lesson.courseName === 'QZX')
  assert.equal(lessons.length, 9)
  assert.ok(lessons.every(lesson => lesson.subjectName === 'Robótica Aplicada'))
  assert.deepEqual(parser.resolveImportedLessonContext('_QZX . ABCXYZ'), {
    courseName: 'QZX', subjectName: 'ABCXYZ', subjectConfirmed: false
  })
})

test('a combined fragment with no separately observed activity remains unconfirmed', async () => {
  const items = fixtures[1].map(item => ({ ...item, str: item.str.replace('11.ºD_AP . A Pav_D', '11.ºD_AP . Nova Atividade Local') }))
  const { proposal } = await importItems(items)
  const ambiguous = proposal.lessons.filter(lesson => lesson.subjectName === 'Nova Atividade Local')
  assert.equal(ambiguous.length, 2)
  assert.ok(ambiguous.every(lesson => !lesson.subjectConfirmed))
})

test('non-timetable extraction preserves complete unknown names and text cells', async () => {
  const items = [{ str: 'Robótica Aplicada e Programação', transform: [10, 0, 0, 10, 50, 400], width: 150, height: 10, hasEOL: true }]
  const { extracted } = await importItems(items)
  assert.equal(extracted.pages[0].lines[0].text, items[0].str)
  assert.deepEqual(extracted.pages[0].lines[0].cells, [items[0].str])
})

test('Laboratório remains part of a full subject name after the room column is removed', async () => {
  const items = fixtures[0].map(item => ({ ...item, str: item.str.replace('12.ºD_AP . AEXP', '12.ºD_AP . Laboratório de Robótica') }))
  const { proposal } = await importItems(items)
  const lessons = proposal.lessons.filter(lesson => lesson.subjectName === 'Laboratório de Robótica')
  assert.equal(lessons.length, 9)
})

test('conflicting legend definitions require confirmation instead of guessing an alias', async () => {
  // Test conflicting definitions on separate pages so line reconstruction is
  // not expected to interpret overlapping text as independent legend entries.
  const { extracted } = await importItems(fixtures[0])
  const secondPage = { pageNumber: 2, lines: [
    { text: 'Atividades do professor', cells: [] },
    { text: 'AEXP-Outra disciplina', cells: [] }
  ] }
  const result = parser.parsePages([...extracted.pages, secondPage], 50)
  const affected = result.lessons.filter(lesson => lesson.subjectName === 'AEXP')
  assert.equal(affected.length, 13)
  assert.ok(affected.every(lesson => !lesson.subjectConfirmed))
})

test('a subject resolved by repetition from a merged PDF item still requires confirmation', async () => {
  const activity = fixtures[0].find(item => item.str === '12.ºD_AP . AEXP' && item.transform[4] > 280 && item.transform[5] > 600)
  const room = fixtures[0].find(item => item.str === 'REO' && item.transform[5] === activity.transform[5] && item.transform[4] > activity.transform[4])
  const items = fixtures[0].filter(item => item !== room).map(item => item === activity
    ? { ...item, str: `${item.str} ${room.str}`, width: room.transform[4] + room.width - item.transform[4] }
    : item)
  const { proposal } = await importItems(items)
  assert.equal(proposal.lessons.length, 22)
  const lesson = proposal.lessons.find(lesson => lesson.weekday === 3 && lesson.startTime === '09:25')
  assert.equal(lesson.subjectName, 'Área de Expressões')
  assert.equal(lesson.subjectConfirmed, false)
})
