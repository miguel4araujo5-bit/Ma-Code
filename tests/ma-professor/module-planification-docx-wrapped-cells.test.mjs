import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test, { after } from 'node:test'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

const root = resolve(new URL('../..', import.meta.url).pathname)
const cache = join(root, 'node_modules', '.cache')
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(join(cache, 'module-docx-wrapped-'))
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}')
const require = createRequire(import.meta.url)

function compile(relative) {
  const source = readFileSync(join(root, relative), 'utf8')
  const target = join(output, relative.replace(/\.tsx?$/, '.js'))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(
    target,
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS
      }
    }).outputText
  )
}

const parserPath =
  'src/components/ma-professor/planifications/planificationPdfParser.ts'
const documentPath =
  'src/components/ma-professor/setup/planificationModuleDocument.ts'

compile(parserPath)
compile(documentPath)

const dom = new JSDOM('', { url: 'https://example.test' })
globalThis.DOMParser = dom.window.DOMParser

const { parseModuleDocxXml } = require(
  join(output, documentPath.replace(/\.ts$/, '.js'))
)

const xmlText = value =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')

const paragraph = value =>
  `<w:p><w:r><w:t>${xmlText(value)}</w:t></w:r></w:p>`

const cell = value =>
  `<w:tc>${value.split('\n').map(paragraph).join('')}</w:tc>`

const wrappedCell = value =>
  `<w:sdt><w:sdtContent>${cell(value)}</w:sdtContent></w:sdt>`

const row = values =>
  `<w:tr>${values.map(cell).join('')}</w:tr>`

const wrappedRow = (values, wrappedIndex) =>
  `<w:tr>${values.map((value, index) =>
    index === wrappedIndex
      ? wrappedCell(value)
      : cell(value)
  ).join('')}</w:tr>`

after(() => {
  dom.window.close()
  rmSync(output, { recursive: true, force: true })
})

test(
  'DOCX import reads the six visual UFCD columns even when Word wraps one table cell in OOXML markup',
  () => {
    const xml =
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      paragraph('PLANIFICAÇÃO DE Área de Expressões') +
      paragraph('Curso Profissional – Técnico de Apoio Psicossocial 12º ANO') +
      '<w:tbl>' +
      row([
        'Período Letivo',
        'UFCD (Horas)',
        'Temas/Conteúdos',
        'Objetivos/Competências',
        'Estratégias/Metodologias',
        'Nº de aulas Previstas (50 min)'
      ]) +
      wrappedRow([
        '1º Período',
        'UFCD 10380 (50 Horas) – Intervenção nos comportamentos aditivos e dependências',
        'Conteúdo A\nConteúdo B',
        'Objetivo A\nObjetivo B',
        'Métodos: ativo.\nUso de: filme.',
        '60'
      ], 3) +
      row([
        'Avaliação',
        'Ficha de avaliação e/ou trabalho prático.'
      ]) +
      '</w:tbl></w:body></w:document>'

    const parsed = parseModuleDocxXml(
      xml,
      'PLANIFICAÇÃO 12.º D · Área de Expressões 2627.docx'
    )

    assert.equal(parsed.sections.length, 1)
    assert.equal(parsed.sections[0].code, '10380')
    assert.equal(
      parsed.sections[0].name,
      'Intervenção nos comportamentos aditivos e dependências'
    )
    assert.equal(parsed.sections[0].periodLabel, '1º Período')
    assert.equal(parsed.sections[0].contentsText, 'Conteúdo A\nConteúdo B')
    assert.equal(parsed.sections[0].objectivesText, 'Objetivo A\nObjetivo B')
    assert.equal(parsed.sections[0].methodologyText, 'ativo.')
    assert.equal(parsed.sections[0].resourcesText, 'filme.')
    assert.equal(parsed.sections[0].plannedLessons, 60)
    assert.equal(parsed.sections[0].evaluationText, 'Ficha de avaliação e/ou trabalho prático.')
    assert.equal(parsed.groupLabel, '12.º D')
    assert.equal(parsed.subjectLabel, 'Área de Expressões')
    assert.equal(parsed.courseLabel, 'Técnico de Apoio Psicossocial')
  }
)
