import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

const root = resolve(new URL('../..', import.meta.url).pathname)
const cache = join(root, 'node_modules', '.cache')
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(join(cache, 'planification-evaluation-'))
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}')
const require = createRequire(import.meta.url)

const parserPath = 'src/components/ma-professor/planifications/planificationPdfParser.ts'
const documentPath = 'src/components/ma-professor/setup/planificationModuleDocument.ts'
for (const relative of [parserPath, documentPath]) {
  const target = join(output, relative.replace(/\.ts$/, '.js'))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, ts.transpileModule(readFileSync(join(root, relative), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText)
}
globalThis.DOMParser = new JSDOM('').window.DOMParser
const { parsePlanificationPdfDocument } = require(join(output, parserPath.replace(/\.ts$/, '.js')))
const { parseModuleDocxXml } = require(join(output, documentPath.replace(/\.ts$/, '.js')))

const cell = (text, x, width = 50) => ({ text, x, width })
const line = cells => ({ text: cells.map(c => c.text).join(' '), cells: cells.map(c => c.text), positionedCells: cells })
const header = () => line([
  cell('Período Letivo', 20), cell('UFCD', 100), cell('Temas/Conteúdos', 200),
  cell('Objetivos/Competências', 400), cell('Estratégias/Metodologias', 550),
  cell('Nº de aulas Previstas (50 min)', 700)
])

test('“Avaliação diagnóstica” nos conteúdos não fecha a UFCD nem esconde as linhas seguintes', () => {
  const [section] = parsePlanificationPdfDocument({
    pageCount: 1, characterCount: 500,
    pages: [{ pageNumber: 1, lines: [
      header(),
      line([cell('1.º', 20), cell('UFCD 0773 Rede local (25h)', 100), cell('Tema A', 200), cell('Obj A', 400), cell('Métodos: expositivo', 550), cell('30', 700)]),
      line([cell('Avaliação diagnóstica', 200), cell('Obj B', 400)]),
      line([cell('Tema C', 200), cell('Obj C', 400), cell('Uso de: computador', 550)]),
      line([cell('Avaliação', 20), cell('Ficha de avaliação', 200, 500)])
    ] }]
  }, 'teste.pdf').sections

  assert.equal(section.contentsText, 'Tema A\nAvaliação diagnóstica\nTema C')
  assert.equal(section.objectivesText, 'Obj A\nObj B\nObj C')
  assert.equal(section.resourcesText, 'computador')
  assert.equal(section.evaluationText, 'Ficha de avaliação')
})

test('“Avaliação” isolado nas estratégias não fecha a UFCD', () => {
  const [section] = parsePlanificationPdfDocument({
    pageCount: 1, characterCount: 400,
    pages: [{ pageNumber: 1, lines: [
      header(),
      line([cell('1.º', 20), cell('UFCD 0773 Rede local (25h)', 100), cell('Tema A', 200), cell('Obj A', 400), cell('Métodos: expositivo', 550), cell('30', 700)]),
      line([cell('Avaliação', 550)]),
      line([cell('Tema B', 200), cell('Obj B', 400)]),
      line([cell('Avaliação', 20), cell('Ficha final', 200, 500)])
    ] }]
  }, 'teste.pdf').sections

  assert.equal(section.contentsText, 'Tema A\nTema B')
  assert.equal(section.objectivesText, 'Obj A\nObj B')
  assert.match(section.methodologyText, /Avaliação/)
  assert.equal(section.evaluationText, 'Ficha final')
})

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const p = v => `<w:p><w:r><w:t>${v}</w:t></w:r></w:p>`
const tc = (v, pr = '') => `<w:tc>${pr}${v.split('\n').map(p).join('')}</w:tc>`
const tr = cells => `<w:tr>${cells.map(c => Array.isArray(c) ? tc(...c) : tc(c)).join('')}</w:tr>`
const mergedStart = value => [value, '<w:tcPr><w:vMerge w:val="restart"/></w:tcPr>']
const mergedContinue = ['', '<w:tcPr><w:vMerge/></w:tcPr>']
const docx = rows => `<w:document xmlns:w="${W}"><w:body><w:tbl>${rows.map(tr).join('')}</w:tbl></w:body></w:document>`
const wordHeader = ['Período Letivo', 'UFCD (Horas)', 'Temas/Conteúdos', 'Objetivos/Competências', 'Estratégias/Metodologias', 'Aulas previstas (50 min)']

test('Word: linha de continuação com UFCD unida verticalmente não é descartada', () => {
  const { sections } = parseModuleDocxXml(docx([
    wordHeader,
    ['1.º', mergedStart('UFCD 0773 Rede local (25h)'), 'Tema A\nAvaliação diagnóstica', 'Obj A', 'Métodos: expositivo', '30'],
    [mergedContinue, mergedContinue, 'Tema D', 'Obj D', 'Trabalho de grupo', ''],
    ['Avaliação', 'Ficha de avaliação', '', '', '', ''],
    ['1.º', 'UFCD 0774 Outra (25h)', 'Tema X', 'Obj X', 'Métodos: prático', '30']
  ]), 'teste.docx')

  assert.equal(sections.length, 2)
  assert.equal(sections[0].contentsText, 'Tema A\nAvaliação diagnóstica\nTema D')
  assert.equal(sections[0].objectivesText, 'Obj A\nObj D')
  assert.match(sections[0].methodologyText, /Trabalho de grupo/)
  assert.equal(sections[0].evaluationText, 'Ficha de avaliação')
  assert.equal(sections[1].contentsText, 'Tema X')
})

test('Word: linha sem vMerge depois de uma UFCD continua a ser ignorada', () => {
  const { sections } = parseModuleDocxXml(docx([
    wordHeader,
    ['1.º', 'UFCD 0773 Rede local (25h)', 'Tema A', 'Obj A', 'Métodos: expositivo', '30'],
    ['', '', 'Nota solta', '', '', '']
  ]), 'teste.docx')

  assert.equal(sections[0].contentsText, 'Tema A')
})
