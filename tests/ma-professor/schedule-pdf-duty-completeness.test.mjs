import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx',
    import.meta.url
  ),
  'utf8'
)

function loadDutyParser() {
  const start = source.indexOf('const weekdayPatterns:')
  const end = source.indexOf('\nfunction suggestedPeriods(', start)

  assert.ok(start >= 0, 'weekday parser constants must exist')
  assert.ok(end > start, 'duty parser helper range must exist')

  const typescriptSnippet = [
    source.slice(start, end),
    'export { extractDutyName }'
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

const { extractDutyName } = loadDutyParser()

test('schedule duty parser keeps all three real non-teaching duties from the S. Bento timetable', () => {
  assert.equal(extractDutyName('Eq Pedag'), 'Eq Pedag')
  assert.equal(extractDutyName('Co PCE'), 'Co PCE')
  assert.equal(extractDutyName('Clube Xadrez'), 'Clube Xadrez')
})

test('schedule duty parser accepts duty marker but rejects room and lesson noise', () => {
  assert.equal(extractDutyName('Co PCE SP'), 'Co PCE')
  assert.equal(extractDutyName('SP'), '')
  assert.equal(extractDutyName('REO'), '')
  assert.equal(extractDutyName('A2.14'), '')
  assert.equal(extractDutyName('Aud2'), '')
  assert.equal(extractDutyName('AS'), '')
  assert.equal(extractDutyName('AEXP'), '')
  assert.equal(extractDutyName('12.º D AP'), '')
})

test('multiword lesson names are not promoted to duties without positive duty evidence', () => {
  assert.equal(extractDutyName('Matemática A'), '')
  assert.equal(extractDutyName('Física e Química A'), '')
  assert.equal(extractDutyName('Técnicas de Expressão'), '')
  assert.equal(extractDutyName('Laboratório de Competências Sociais'), '')
})

test('schedule import preview exposes manual additions for missing lessons/hours and duties', () => {
  assert.match(source, /function addManualLesson\(/)
  assert.match(source, /function addManualDuty\(/)
  assert.match(source, /\+ Adicionar aula \/ hora/)
  assert.match(source, /\+ Adicionar cargo/)
  assert.match(source, /id:\s*manualId\(\s*'manual-slot'\s*\)/)
  assert.match(source, /id:\s*manualId\(\s*'manual-duty'\s*\)/)
})
