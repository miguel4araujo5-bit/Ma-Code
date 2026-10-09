import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

async function load(path) {
  const source = await readFile(new URL('../../' + path, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
}
const excel = await load('src/components/ma-professor/assessments/ufcdFinalGradeExcelImport.ts')
const pdf = await load('src/components/ma-professor/planifications/planificationPdfParser.ts')
const rows = label => [
  [label, '', '', 'Ano letivo: 2026-2027'],
  ['Nº Processo', 'Nº', 'Aluno / Domínio', 'ACS', 'Autoavaliação', 'Nível Final'],
  ['9001', '2', 'Aluno Exemplo', '', 15, 16], ['AVALIAÇÃO GLOBAL']
]
const snapshot = {
  academicYear: { id: 'year', name: '2026/2027' },
  selectedModule: { id: 'uc', code: 'UC00033', name: 'Comunicar' },
  selectedGroup: { id: 'group', name: '10.º D' },
  studentRows: [{ student: { id: 'student', number: '2', name: 'Aluno Exemplo' } }]
}
for (const label of ['UC: UC00033', 'UC: 00033', 'UC00033']) {
  test('Excel identifies the UC and preserves leading zeroes: ' + label, () => {
    const parsed = excel.parseUfcdFinalGradeSpreadsheetRows(rows(label), 'PRINTCFP')
    assert.ok(parsed)
    assert.equal(parsed.moduleCode, 'UC00033')
    const preview = excel.buildUfcdFinalGradeImportPreview(snapshot, parsed, 'grelha-uc.xlsx')
    assert.deepEqual(preview.blockingErrors, [])
    const wrongModule = { ...snapshot, selectedModule: { ...snapshot.selectedModule, code: 'UC00034' } }
    assert.ok(excel.buildUfcdFinalGradeImportPreview(wrongModule, parsed, 'grelha-uc.xlsx').blockingErrors.length)
  })
}
test('Excel retains existing UFCD and module identifiers', () => {
  for (const [label, code] of [['UFCD: 1234', '1234'], ['Módulo: 01', '01']]) {
    assert.equal(excel.parseUfcdFinalGradeSpreadsheetRows(rows(label), 'PRINTCFP').moduleCode, code)
  }
})
const cell = (text, x) => ({ text, x, width: 80 })
const line = texts => ({ text: texts.join(' '), cells: texts, positionedCells: texts.map((text, index) => cell(text, index * 100)) })
function document(label, code) {
  return { pageCount: 1, characterCount: 300, pages: [{ pageNumber: 1, lines: [
    line(['Período Letivo', label + ' (Horas)', 'Temas/Conteúdos', 'Objetivos/Competências', 'Estratégias/Metodologias', 'Aulas previstas (50 min)']),
    line(['', label, '', '', '', '']),
    line(['1.º Período', code + ' (50 Horas) Comunicar e interagir em contexto profissional', 'Comunicação escrita', 'Reportar informação profissional.', 'Métodos: ativo.', '60'])
  ] }] }
}
for (const [label, code] of [['UC', 'UC00033'], ['UFCD', '00033']]) {
  test('PDF recognises a split label/code and retains duration and contents: ' + label, () => {
    const parsed = pdf.parsePlanificationPdfDocument(document(label, '00033'), 'planificacao.pdf')
    assert.equal(parsed.sections.length, 1)
    const section = parsed.sections[0]
    assert.equal(section.code, code)
    assert.equal(section.name, 'Comunicar e interagir em contexto profissional')
    assert.equal(section.durationHours, 50)
    assert.equal(section.plannedLessons, 60)
  })
}
