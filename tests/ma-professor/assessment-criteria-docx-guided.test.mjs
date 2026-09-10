import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

const readerSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/assessmentCriteriaDocumentReader.ts',
    import.meta.url
  ),
  'utf8'
)

function loadReaderModule() {
  const javascript = ts.transpileModule(readerSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText
  const module = { exports: {} }

  const localRequire = request => {
    if (request === 'fflate') {
      return {
        strFromU8: () => '',
        unzipSync: () => ({})
      }
    }
    if (request.includes('planificationPdfExtractor')) {
      return {
        extractPlanificationPdf: async () => ({
          pages: [],
          pageCount: 0,
          characterCount: 0
        })
      }
    }
    throw new Error(`Unexpected dependency: ${request}`)
  }

  Function('require', 'module', 'exports', javascript)(
    localRequire,
    module,
    module.exports
  )

  return module.exports
}

const dom = new JSDOM('')
const previousDOMParser = globalThis.DOMParser
globalThis.DOMParser = dom.window.DOMParser
const { parseAssessmentCriteriaDocxXml } = loadReaderModule()

const paragraph = value => `<w:p><w:r><w:t>${value}</w:t></w:r></w:p>`
const cell = value => `<w:tc>${paragraph(value)}</w:tc>`
const row = values => `<w:tr>${values.map(cell).join('')}</w:tr>`

function criteriaFixture() {
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    ${paragraph('CRITÉRIOS DE AVALIAÇÃO DA DISCIPLINA DE ANIMAÇÃO SOCIOCULTURAL - PROFISSIONAIS')}
    ${paragraph('Curso Profissional: Técnico de Apoio Psicossocial')}
    <w:tbl>
      ${row(['DOMÍNIOS', 'PONDERAÇÃO', 'OPERACIONALIZAÇÃO', 'INDICADORES', 'INSTRUMENTOS'])}
      ${row(['Desempenho nas aprendizagens', '60%', 'Aplicação dos conhecimentos', 'Realiza as tarefas', 'Trabalhos'])}
      ${row(['Raciocínio, informação e comunicação', '20%', 'Mobilização de informação', 'Comunica com rigor', 'Apresentações'])}
      ${row(['Competências Transversais e Atitudinais', '20%', 'Responsabilidade e autonomia', 'Cumpre compromissos', 'Observação'])}
    </w:tbl>
  </w:body></w:document>`
}

test('Word criteria reader preserves title, course and the weighted matrix as criteria-parser input', () => {
  const document = parseAssessmentCriteriaDocxXml(criteriaFixture())

  assert.equal(document.pageCount, 1)
  assert.ok(document.characterCount > 0)
  assert.match(document.pages[0].lines[0].text, /CRITÉRIOS DE AVALIAÇÃO DA DISCIPLINA DE ANIMAÇÃO SOCIOCULTURAL/i)
  assert.match(document.pages[0].lines[1].text, /Técnico de Apoio Psicossocial/)

  const header = document.pages[0].lines.find(line =>
    line.cells.includes('DOMÍNIOS')
  )
  assert.ok(header)
  assert.deepEqual(
    header.cells,
    ['DOMÍNIOS', 'PONDERAÇÃO', 'OPERACIONALIZAÇÃO', 'INDICADORES', 'INSTRUMENTOS']
  )
  assert.equal(header.positionedCells.length, 5)

  const weights = document.pages[0].lines
    .flatMap(line => line.cells)
    .filter(value => /^(?:60|20)%$/.test(value))
  assert.deepEqual(weights, ['60%', '20%', '20%'])
})

test('Word criteria reader rejects unsafe XML instead of trying to repair it', () => {
  assert.throws(
    () => parseAssessmentCriteriaDocxXml('<!DOCTYPE x [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><x>&xxe;</x>'),
    /estrutura não suportada/
  )
})

test.after(() => {
  if (previousDOMParser) {
    globalThis.DOMParser = previousDOMParser
  } else {
    delete globalThis.DOMParser
  }
  dom.window.close()
})
