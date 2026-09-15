import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = resolve(new URL('../..', import.meta.url).pathname)
const base = 'src/components/ma-professor/'
const modules = new Map()
let extracted

function load(relative) {
  if (modules.has(relative)) return modules.get(relative).exports
  const module = { exports: {} }
  modules.set(relative, module)
  const code = ts.transpileModule(readFileSync(resolve(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const localRequire = id => {
    if (id.endsWith('/planificationPdfExtractor')) {
      return { extractPlanificationPdf: async () => extracted }
    }
    return id.startsWith('.')
      ? load(resolve(root, dirname(relative), id + '.ts').slice(root.length + 1))
      : require(id)
  }
  Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}

const { readRuledPlanificationTable } = load(base + 'planifications/planificationPdfTableLayout.ts')
const { readModuleDocument } = load(base + 'setup/planificationModuleDocument.ts')
const { resolvePlanificationDestination } = load(base + 'setup/planificationDestination.ts')

function item(str, x, y, width = str.length * 5) {
  return { str, transform: [1, 0, 0, 1, x, y], width, height: 10 }
}

const rules = [0, 100, 200, 300, 400, 500, 600].map(x => [x, 100, x, 700])
rules.push(...[100, 650, 700].map(y => [0, y, 600, y]))
const cells = [
  ...['Período Letivo', 'UFCD', 'Temas/Conteúdos', 'Objetivos/Competências', 'Estratégias/Metodologias', 'Aulas previstas (50 min)']
    .map((value, index) => item(value, index * 100 + 5, 675)),
  item('1.º período', 5, 450),
  item('UFCD 0349 (25h) — Trabalho de grupo', 105, 400),
  item('Conteúdo antes da etiqueta', 205, 600),
  item('Objetivo antes da etiqueta', 305, 600),
  item('Métodos: ativo', 405, 450),
  item('30', 505, 450)
]

async function read(headers, content = cells) {
  const lines = readRuledPlanificationTable([...headers, ...content], rules)
  assert.ok(lines)
  extracted = { pages: [{ pageNumber: 1, lines }], pageCount: 1,
    characterCount: lines.reduce((total, line) => total + line.text.length, 0) }
  return readModuleDocument(new File(['fixture'], 'planificacao.pdf', { type: 'application/pdf' }))
}

test('ruled PDF joins split title and course fragments before resolving the timetable destination', async () => {
  const parsed = await read([
    item('PLANIFICAÇÃO DE ', 10, 800, 90),
    item('Área de ', 100, 800, 50),
    item('Expressões', 150, 800),
    item('Curso Profissional – ', 10, 780, 120),
    item('Técnico de Apoio Psicossocial', 130, 780, 180),
    item('12.º ANO', 320, 780),
    item('Turma: 12.º D', 10, 760)
  ])
  assert.equal(parsed.subjectLabel, 'Área de Expressões')
  assert.equal(parsed.courseLabel, 'Técnico de Apoio Psicossocial')
  assert.equal(parsed.gradeLabel, '12.º ano')
  assert.equal(parsed.groupLabel, '12.º D')
  const audit = { active: true, academicYearId: 'year' }
  const snapshot = {
    academicYear: { id: 'year' },
    subjects: [{ id: 'subject', name: 'Área de Expressões', code: 'AE', shortName: 'AEXP', ...audit }],
    groups: ['C', 'D'].map(letter => ({ id: letter, name: `12.º ${letter}`, gradeLevel: '12.º ano', courseName: 'Técnico de Apoio Psicossocial', ...audit })),
    teachingAssignments: ['C', 'D'].map(letter => ({ id: `assignment-${letter}`, subjectId: 'subject', groupId: letter, ...audit }))
  }
  assert.equal(resolvePlanificationDestination(snapshot, parsed).destination?.assignment.id, 'assignment-D')
  assert.equal(parsed.sections[0].code, '0349')
  assert.equal(parsed.sections[0].contentsText, 'Conteúdo antes da etiqueta')
  assert.equal(parsed.sections[0].objectivesText, 'Objetivo antes da etiqueta')
  assert.equal(parsed.sections[0].plannedLessons, 30)
  assert.equal(parsed.periodMinutes, 50)
})

test('ruled PDF preserves explicit discipline and class fields outside the table', async () => {
  const parsed = await read([
    item('PLANIFICAÇÃO', 10, 820),
    item('Disciplina:', 10, 800, 60),
    item('Animação Sociocultural', 80, 800),
    item('Turma: 10.º D', 10, 780)
  ])
  assert.equal(parsed.subjectLabel, 'Animação Sociocultural')
  assert.equal(parsed.groupLabel, '10.º D')
  assert.equal(parsed.sections.length, 1)
})

test('keywords inside a content cell never become the document discipline', async () => {
  const parsed = await read([
    item('Disciplina: Área de Expressões', 10, 800),
    item('Turma: 12.º D', 10, 780)
  ], [...cells, item('Planificação de uma intervenção', 205, 580)])
  assert.equal(parsed.subjectLabel, 'Área de Expressões')
  assert.match(parsed.sections[0].contentsText, /Planificação de uma intervenção/)
})

test('unknown table geometry still uses the existing fallback', () => {
  assert.equal(readRuledPlanificationTable(cells, []), null)
  assert.equal(readRuledPlanificationTable(cells, [], true), null)
})
