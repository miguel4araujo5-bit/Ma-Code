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

const headerRow = () =>
  row([
    'Período Letivo',
    'UFCD (Horas)',
    'Temas/Conteúdos',
    'Objetivos/Competências',
    'Estratégias/Metodologias',
    'Nº de aulas Previstas (50 min)'
  ])

const evaluationRow = () =>
  row([
    'Avaliação',
    'Ficha de avaliação e/ou trabalho prático, fichas de trabalho e/ou observação direta.'
  ])

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
      headerRow() +
      wrappedRow([
        '1º Período',
        'UFCD 10380 (50 Horas) – Intervenção nos comportamentos aditivos e dependências',
        'Conteúdo A\nConteúdo B',
        'Objetivo A\nObjetivo B',
        'Métodos: ativo.\nUso de: filme.',
        '60'
      ], 3) +
      evaluationRow() +
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
    assert.equal(parsed.sections[0].evaluationText, 'Ficha de avaliação e/ou trabalho prático, fichas de trabalho e/ou observação direta.')
    assert.equal(parsed.groupLabel, '12.º D')
    assert.equal(parsed.subjectLabel, 'Área de Expressões')
    assert.equal(parsed.courseLabel, 'Técnico de Apoio Psicossocial')
  }
)

test(
  '12D professional DOCX structure keeps four UFCD across repeated headers and long page-spanning cells',
  () => {
    const xml =
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      paragraph('PLANIFICAÇÃO DE Área de Expressões') +
      paragraph('Curso Profissional – Técnico de Apoio Psicossocial 12º ANO') +
      '<w:tbl>' +
      headerRow() +
      wrappedRow([
        '1º Período',
        'UFCD 10380 (50 Horas) – Intervenção nos comportamentos aditivos e dependências',
        'Conceito de desvio / representação social\nComportamentos aditivos e dependências\nModalidades de tratamento\nReinserção social e comunitária\nRedução de riscos e minimização de danos',
        'Reconhecer os níveis de intervenção\nIdentificar dispositivos de intervenção\nAplicar técnicas de abordagem',
        'Métodos: expositivo, ativo, interrogativo.\nUso de: filmes, artigos, textos de apoio, estudo de casos, role-play, debates e simulações.',
        '60'
      ], 4) +
      evaluationRow() +
      '</w:tbl>' +
      '<w:tbl>' +
      headerRow() +
      wrappedRow([
        '2º Período',
        'UFCD 10382 (50 Horas) – Laboratório de competências pessoais',
        '1. Autoconhecimento\n2. Autoestima e eficácia pessoal\n3. Comunicação\n4. Literacia emocional\n5. Resolução de problemas\n6. Rede social e conhecimento pessoal\n7. Gestão de emoções\n8. Gestão de stress',
        'Identificar as competências pessoais\nPromover o autoconhecimento pessoal\nDesenvolver mecanismos de gestão emocional\nIdentificar potenciais causas de stress',
        'Métodos: ativo, expositivo, interrogativo e demonstrativo.\nUso de: exercícios práticos, dinâmicas de grupo, role-play, fichas de reflexão.',
        '60'
      ], 2) +
      evaluationRow() +
      '</w:tbl>' +
      '<w:tbl>' +
      headerRow() +
      wrappedRow([
        '2º Período',
        'UFCD 10383 (50 Horas) – Laboratório de competências sociais',
        '1. Autoconhecimento e representação social\n2. Autoestima e eficácia pessoal em contexto social\n3. Comunicação\n4. Literacia emocional\n5. Resolução de problemas\n6. Rede social e conhecimento dos outros\n7. Gestão de conflitos\n7.7. Estratégias e técnicas para potenciar uma atitude cooperativa\n7.8. Técnicas de dinâmicas de grupo',
        'Identificar as competências sociais\nReconhecer a importância do desenvolvimento social\nReconhecer a relação entre sentimentos e emoções\nAplicar técnicas de comunicação na intervenção social',
        'Métodos: ativo, expositivo, interrogativo e demonstrativo.\nUso de: simulações, exercícios de comunicação, jogos de cooperação, trabalhos de grupo e debates.',
        '60'
      ], 3) +
      evaluationRow() +
      '</w:tbl>' +
      '<w:tbl>' +
      headerRow() +
      wrappedRow([
        '3º Período',
        'UFCD 10384 (50 Horas) – Laboratório de competências profissionais',
        '1. Autoconhecimento em contexto profissional\n2. Autoestima e eficácia profissional\n3. Comunicação\n4. Literacia emocional\n5. Resolução de problemas profissionais\n6. Rede social e imagem profissional\n7. Gestão de conflitos profissionais\n7.1. Causas dos conflitos\n7.2. Causas das tensões\n7.3. Competências de análise e diagnóstico de situações\n7.4. Modos de lidar com conflitos\n7.5. Tipologia de negociação\n7.6. O acordo e o compromisso\n7.7. Gestão construtiva de desacordos\n7.8. Técnicas de dinâmicas de grupo',
        'Identificar as competências profissionais\nReconhecer a importância do desenvolvimento profissional\nAplicar técnicas de atuação assertiva perante conflitos profissionais',
        'Métodos: ativo, expositivo, interrogativo e demonstrativo.\nUso de: role-play de entrevistas, trabalhos práticos, elaboração de currículos e simulações.',
        '30'
      ], 2) +
      evaluationRow() +
      '</w:tbl></w:body></w:document>'

    const parsed = parseModuleDocxXml(
      xml,
      'PLANIFICAÇÃO 12.º D · Área de Expressões 2627.docx'
    )

    assert.deepEqual(
      parsed.sections.map(section => section.code),
      ['10380', '10382', '10383', '10384']
    )
    assert.deepEqual(
      parsed.sections.map(section => section.periodLabel),
      ['1º Período', '2º Período', '2º Período', '3º Período']
    )
    assert.deepEqual(
      parsed.sections.map(section => section.plannedLessons),
      [60, 60, 60, 30]
    )
    assert.ok(
      parsed.sections.every(section =>
        section.durationHours === 50 &&
        section.contentsText &&
        section.objectivesText &&
        section.methodologyText &&
        section.resourcesText &&
        section.evaluationText === 'Ficha de avaliação e/ou trabalho prático, fichas de trabalho e/ou observação direta.'
      )
    )
    assert.match(
      parsed.sections[2].contentsText,
      /atitude cooperativa/
    )
    assert.match(
      parsed.sections[3].contentsText,
      /Gestão construtiva de desacordos/
    )
    assert.equal(parsed.groupLabel, '12.º D')
    assert.equal(parsed.subjectLabel, 'Área de Expressões')
    assert.equal(parsed.courseLabel, 'Técnico de Apoio Psicossocial')
    assert.equal(parsed.periodMinutes, 50)
  }
)
