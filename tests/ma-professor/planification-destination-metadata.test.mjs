import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/planificationModuleDocument.ts',
    import.meta.url
  ),
  'utf8'
)

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS
  }
}).outputText

const dom = new JSDOM('')
const previousDOMParser = globalThis.DOMParser
globalThis.DOMParser = dom.window.DOMParser

const moduleRecord = { exports: {} }
const dummySection = {
  sourceDocumentName: 'fixture.docx',
  sourcePages: [],
  code: '10385',
  name: 'Teste',
  durationHours: 25,
  plannedLessons: 30,
  periodLabel: '',
  contentsText: 'Conteúdo',
  objectivesText: '',
  methodologyText: '',
  resourcesText: '',
  evaluationText: '',
  warnings: []
}

const localRequire = request => {
  if (request === 'fflate') {
    return {
      strFromU8: () => '',
      unzipSync: () => ({})
    }
  }

  if (request.includes('planificationPdfParser')) {
    return {
      parsePlanificationPdfDocument: () => ({
        sections: [dummySection],
        warnings: []
      })
    }
  }

  throw new Error(`Unexpected dependency: ${request}`)
}

Function('require', 'module', 'exports', transpiled)(
  localRequire,
  moduleRecord,
  moduleRecord.exports
)

const { parseModuleDocxXml } = moduleRecord.exports

const cell = value => `<w:tc><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:tc>`
const row = values => `<w:tr>${values.map(cell).join('')}</w:tr>`

function fixture(extraParagraphs = '') {
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:p><w:r><w:t>PLANIFICAÇÃO DE Área de Expressões</w:t></w:r></w:p>
    <w:p><w:r><w:t>Curso Profissional – Técnico de Apoio Psicossocial 11º ANO</w:t></w:r></w:p>
    ${extraParagraphs}
    <w:tbl>${row(['1º Período', 'UFCD 10385 (25h)', 'Conteúdo', 'Objetivo', 'Método', '30'])}</w:tbl>
  </w:body></w:document>`
}

test('planification metadata uses an exact class marker in the filename only as destination context', () => {
  const parsed = parseModuleDocxXml(
    fixture(),
    'planificação AE 11d 2223.docx'
  )

  assert.equal(parsed.subjectLabel, 'Área de Expressões')
  assert.equal(parsed.courseLabel, 'Técnico de Apoio Psicossocial')
  assert.equal(parsed.gradeLabel, '11.º ano')
  assert.equal(parsed.groupLabel, '11.º D')
})

test('an explicit Turma field takes precedence over a generic grade heading', () => {
  const parsed = parseModuleDocxXml(
    fixture('<w:p><w:r><w:t>Turma: 10 D</w:t></w:r></w:p>'),
    'planificacao.docx'
  )

  assert.equal(parsed.groupLabel, '10.º D')
  assert.equal(parsed.gradeLabel, '10.º ano')
})

test('a grade heading by itself never invents a class letter', () => {
  const parsed = parseModuleDocxXml(
    fixture(),
    'planificacao.docx'
  )

  assert.equal(parsed.gradeLabel, '11.º ano')
  assert.equal(parsed.groupLabel, '')
})

test.after(() => {
  if (previousDOMParser) {
    globalThis.DOMParser = previousDOMParser
  } else {
    delete globalThis.DOMParser
  }
  dom.window.close()
})
