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
const output = mkdtempSync(join(cache, 'planification-uc-'))
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}')
const require = createRequire(import.meta.url)

function compile(relative) {
  const target = join(output, relative.replace(/\.ts$/, '.js'))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, ts.transpileModule(readFileSync(join(root, relative), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText)
}

const parserPath = 'src/components/ma-professor/planifications/planificationPdfParser.ts'
const layoutPath = 'src/components/ma-professor/planifications/planificationPdfTableLayout.ts'
const documentPath = 'src/components/ma-professor/setup/planificationModuleDocument.ts'
const spreadsheetPath = 'src/components/ma-professor/setup/planificationSpreadsheetDocument.ts'
for (const relative of [parserPath, layoutPath, documentPath, spreadsheetPath]) compile(relative)

globalThis.DOMParser = new JSDOM('').window.DOMParser
const { parsePlanificationPdfDocument } = require(join(output, parserPath.replace(/\.ts$/, '.js')))
const { readRuledPlanificationTable } = require(join(output, layoutPath.replace(/\.ts$/, '.js')))
const { parseModuleDocxXml } = require(join(output, documentPath.replace(/\.ts$/, '.js')))
const { parsePlanificationSpreadsheetRows } = require(join(output, spreadsheetPath.replace(/\.ts$/, '.js')))

const cell = (text, x, width = 80) => ({ text, x, width })
const line = cells => ({
  text: cells.map(item => item.text).join(' '),
  cells: cells.map(item => item.text),
  positionedCells: cells
})
const header = label => line([
  cell('Período Letivo', 0),
  cell(label, 100),
  cell('Temas/Conteúdos', 200),
  cell('Objetivos/Competências', 300),
  cell('Estratégias/Metodologias', 400),
  cell('Aulas previstas (50 min)', 500)
])

test('PDF reconhece UCxxxxx como Unidade de Competência sem alterar códigos UFCD', () => {
  const parsed = parsePlanificationPdfDocument({
    pageCount: 1,
    characterCount: 500,
    pages: [{
      pageNumber: 1,
      lines: [
        header('UC ( Horas )'),
        line([
          cell('1º Período', 0),
          cell('UC00033 ( 50 Horas ) Comunicar e interagir em contexto profissional', 100),
          cell('Comunicação escrita', 200),
          cell('Reportar informação profissional.', 300),
          cell('Métodos: Expositivo. Uso de: Estudos de caso;', 400),
          cell('60', 500)
        ]),
        line([cell('Avaliação', 0), cell('Ficha de avaliação', 200)]),
        line([
          cell('2º Período', 0),
          cell('UC00034 ( 50 Horas ) Colaborar e trabalhar em equipa', 100),
          cell('Gestão do tempo', 200),
          cell('Trocar conhecimentos.', 300),
          cell('Métodos: Ativo.', 400),
          cell('60', 500)
        ])
      ]
    }]
  }, 'uc.pdf')

  assert.deepEqual(parsed.warnings, [])
  assert.deepEqual(
    parsed.sections.map(section => [
      section.code,
      section.name,
      section.durationHours,
      section.plannedLessons
    ]),
    [
      ['UC00033', 'Comunicar e interagir em contexto profissional', 50, 60],
      ['UC00034', 'Colaborar e trabalhar em equipa', 50, 60]
    ]
  )
  assert.equal(parsed.sections[0].evaluationText, 'Ficha de avaliação')

  const legacy = parsePlanificationPdfDocument({
    pageCount: 1,
    characterCount: 200,
    pages: [{
      pageNumber: 1,
      lines: [
        header('UFCD'),
        line([
          cell('1º Período', 0),
          cell('UFCD 0773 Rede local (25h)', 100),
          cell('Tema', 200),
          cell('Objetivo', 300),
          cell('Métodos: prático', 400),
          cell('30', 500)
        ])
      ]
    }]
  }, 'ufcd.pdf')

  assert.equal(legacy.sections[0].code, '0773')
  assert.equal(legacy.sections[0].name, 'Rede local')
})

test('PDF com grelha desenhada reconhece cabeçalho UC', () => {
  const item = (str, x, y, width = str.length * 5) => ({
    str,
    transform: [1, 0, 0, 1, x, y],
    width,
    height: 10
  })
  const rules = [0, 100, 200, 300, 400, 500, 600]
    .map(x => [x, 100, x, 700])
  rules.push(...[100, 650, 700].map(y => [0, y, 600, y]))

  const items = [
    ...['Período Letivo', 'UC (Horas)', 'Temas/Conteúdos', 'Objetivos/Competências', 'Estratégias/Metodologias', 'Aulas previstas (50 min)']
      .map((value, index) => item(value, index * 100 + 5, 675)),
    item('1.º período', 5, 450),
    item('UC00033 (50h) Comunicar e interagir em contexto profissional', 105, 450),
    item('Comunicação escrita', 205, 450),
    item('Reportar informação', 305, 450),
    item('Métodos: ativo', 405, 450),
    item('60', 505, 450)
  ]

  const lines = readRuledPlanificationTable(items, rules)
  assert.ok(lines)
  const parsed = parsePlanificationPdfDocument({
    pages: [{ pageNumber: 1, lines }],
    pageCount: 1,
    characterCount: 300
  }, 'uc-grelha.pdf')

  assert.equal(parsed.sections[0].code, 'UC00033')
  assert.equal(parsed.sections[0].name, 'Comunicar e interagir em contexto profissional')
})

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const p = value => `<w:p><w:r><w:t>${value}</w:t></w:r></w:p>`
const tc = value => `<w:tc>${String(value).split('\n').map(p).join('')}</w:tc>`
const tr = values => `<w:tr>${values.map(tc).join('')}</w:tr>`

test('Word estruturado aceita UCxxxxx no mesmo caminho seguro das UFCD', () => {
  const rows = [
    ['Período Letivo', 'UC (Horas)', 'Temas/Conteúdos', 'Objetivos/Competências', 'Estratégias/Metodologias', 'Aulas previstas (50 min)'],
    ['1º Período', 'UC00033 (50 Horas) Comunicar e interagir em contexto profissional', 'Comunicação escrita', 'Reportar informação', 'Métodos: ativo', '60'],
    ['Avaliação', 'Ficha de avaliação', '', '', '', '']
  ]
  const xml = `<w:document xmlns:w="${W}"><w:body><w:tbl>${rows.map(tr).join('')}</w:tbl></w:body></w:document>`
  const parsed = parseModuleDocxXml(xml, 'uc.docx')

  assert.equal(parsed.sections.length, 1)
  assert.equal(parsed.sections[0].code, 'UC00033')
  assert.equal(parsed.sections[0].name, 'Comunicar e interagir em contexto profissional')
  assert.equal(parsed.sections[0].evaluationText, 'Ficha de avaliação')
})

test('Excel reconhece cabeçalho UC e preserva o prefixo no código', () => {
  const parsed = parsePlanificationSpreadsheetRows([
    ['Período Letivo', 'UC (Horas)', 'Temas/Conteúdos', 'Objetivos/Competências', 'Estratégias/Metodologias', 'Aulas previstas (50 min)'],
    ['1º Período', 'UC 00033 (50 Horas) Comunicar e interagir em contexto profissional', 'Comunicação escrita', 'Reportar informação', 'Métodos: ativo', '60']
  ], 'uc.xlsx', 'Planificação')

  assert.equal(parsed.sections.length, 1)
  assert.equal(parsed.sections[0].code, 'UC00033')
  assert.equal(parsed.sections[0].name, 'Comunicar e interagir em contexto profissional')
  assert.equal(parsed.sections[0].durationHours, 50)
  assert.equal(parsed.sections[0].plannedLessons, 60)
})
