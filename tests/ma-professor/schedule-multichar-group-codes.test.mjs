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

const extractorSource = await readFile(
  new URL(
    '../../src/lib/maPdf/extractPdfText.ts',
    import.meta.url
  ),
  'utf8'
)

function loadFunction(source, startMarker, endMarker, exportName) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)

  assert.ok(start >= 0, `${exportName} start must exist`)
  assert.ok(end > start, `${exportName} end must exist`)

  const javascript = ts.transpileModule(
    [
      source.slice(start, end),
      `export { ${exportName} }`
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
  return module.exports[exportName]
}

const extractGroupName = loadFunction(
  scheduleSource,
  'function extractGroupName(',
  '\nfunction stripLessonNoise(',
  'extractGroupName'
)

const extractCompactTimetableLesson = loadFunction(
  extractorSource,
  'function extractCompactTimetableLesson(',
  '\nfunction isWeekdayHeader(',
  'extractCompactTimetableLesson'
)

test('group parser accepts one to three alphanumeric characters starting with a letter', () => {
  assert.equal(extractGroupName('12.º D_AP . AEXP'), '12.º D')
  assert.equal(extractGroupName('11.º AB Matemática A'), '11.º AB')
  assert.equal(extractGroupName('10.º TI1_AP . AEXP'), '10.º TI1')
  assert.equal(extractGroupName('12.º CT2 Área de Expressões'), '12.º CT2')
})

test('group parser rejects unsafe or overlong codes instead of partially matching them', () => {
  assert.equal(extractGroupName('10.º 1A Matemática'), '')
  assert.equal(extractGroupName('10.º ABCD Matemática'), '')
  assert.equal(extractGroupName('10.º TI12 Matemática'), '')
})

test('shared PDF normalizer preserves the complete multi-character group code', () => {
  assert.equal(
    extractCompactTimetableLesson('12.ºD_AP . AEXP'),
    '12.º D_AP . AEXP'
  )
  assert.equal(
    extractCompactTimetableLesson('11.º AB Matemática A'),
    '11.º AB Matemática A'
  )
  assert.equal(
    extractCompactTimetableLesson('10.º TI1_AP . AEXP'),
    '10.º TI1_AP . AEXP'
  )
  assert.equal(
    extractCompactTimetableLesson('12.º CT2 Área de Expressões'),
    '12.º CT2 Área de Expressões'
  )
})

test('shared PDF normalizer does not truncate overlong group candidates', () => {
  assert.equal(extractCompactTimetableLesson('10.º ABCD Matemática'), null)
  assert.equal(extractCompactTimetableLesson('10.º TI12 Matemática'), null)
})
