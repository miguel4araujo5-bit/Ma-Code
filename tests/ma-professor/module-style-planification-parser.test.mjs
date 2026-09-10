import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/moduleStylePlanificationPdfParser.ts',
    import.meta.url
  ),
  'utf8'
)

function loadParser() {
  const javascript = ts.transpileModule(
    source,
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
    'require',
    javascript
  )(
    module,
    module.exports,
    () => ({})
  )

  return module.exports
    .parseModuleStylePlanificationPdfDocument
}

const parseModuleStyle = loadParser()

function cells(values, positions) {
  return {
    text: values.join(' '),
    cells: values,
    positionedCells: values.map(
      (text, index) => ({
        text,
        x: positions?.[index] ?? index * 180,
        width: 130
      })
    )
  }
}

function page(pageNumber, lines) {
  return {
    pageNumber,
    lines
  }
}

function document(pages) {
  const characterCount = pages.reduce(
    (total, item) =>
      total + item.lines.reduce(
        (lineTotal, line) =>
          lineTotal + line.text.length,
        0
      ),
    0
  )

  return {
    pages,
    pageCount: pages.length,
    characterCount
  }
}

const bodyHeader = cells(
  [
    'Domínio / Tema',
    'Aprendizagens essenciais',
    'Ações estratégicas de ensino orientadas para o perfil dos alunos',
    'Descritores do perfil dos alunos',
    'Recursos',
    'Tempos letivos'
  ],
  [0, 180, 400, 650, 820, 980]
)

test(
  'single Educação Física planification becomes module M1 with topic and planned lessons',
  () => {
    const parsed = parseModuleStyle(
      document([
        page(1, [
          cells(['PLANIFICAÇÃO DE EDUCAÇÃO FÍSICA - 10.º ANO – ENSINO PROFISSIONAL']),
          cells(['Módulo 1']),
          cells(['DISCIPLINA: Educação Física Nº AULAS PREVISTAS: 16 TEMA: Jogos Desportivos Coletivos – Voleibol PROFESSOR: Carlos Faria']),
          bodyHeader,
          cells(
            [
              'Jogo Desportivo Coletivo 1 – Voleibol',
              'Coopera com os companheiros e aplica as regras.',
              'Proporcionar atividades formativas em grupo.',
              'Participativo',
              'Bolas, coletes e cones',
              '16 T (13 h)'
            ],
            [0, 180, 400, 650, 820, 980]
          )
        ])
      ]),
      'Planificação_MOD1_JDC1.pdf'
    )

    assert.equal(parsed.sections.length, 1)
    assert.equal(parsed.sections[0].code, 'M1')
    assert.match(
      parsed.sections[0].name,
      /Jogos Desportivos Coletivos/
    )
    assert.equal(parsed.sections[0].plannedLessons, 16)
    assert.equal(parsed.sections[0].durationHours, 13)
    assert.match(
      parsed.sections[0].contentsText,
      /Voleibol/
    )
    assert.match(
      parsed.sections[0].objectivesText,
      /Coopera com os companheiros/
    )
    assert.match(
      parsed.sections[0].resourcesText,
      /Bolas, coletes e cones/
    )
  }
)

test(
  'Psychology module heading keeps its real title and table lesson count',
  () => {
    const parsed = parseModuleStyle(
      document([
        page(1, [
          cells(['PLANIFICAÇÃO DE PSICOLOGIA - 10.º ANO – ENSINO PROFISSIONAL']),
          cells(['CURSO PROFISSIONAL: Técnico de Apoio Psicossocial']),
          cells(['DISCIPLINA: Psicologia Nº Horas: 25']),
          cells(['Módulo 1: Descobrindo a Psicologia']),
          bodyHeader,
          cells(
            [
              'Especificidade da psicologia como ciência',
              'Reconhecer a complexidade dos processos mentais.',
              'Delimitar o centro de interesse da Psicologia.',
              'Analítico',
              'Fichas informativas',
              '30'
            ],
            [0, 180, 400, 650, 820, 980]
          )
        ])
      ]),
      'M1 psic.pdf'
    )

    assert.equal(parsed.sections.length, 1)
    assert.equal(parsed.sections[0].code, 'M1')
    assert.equal(
      parsed.sections[0].name,
      'Descobrindo a Psicologia'
    )
    assert.equal(parsed.sections[0].durationHours, 25)
    assert.equal(parsed.sections[0].plannedLessons, 30)
    assert.match(
      parsed.sections[0].contentsText,
      /Especificidade da psicologia/
    )
  }
)

test(
  'annual Mathematics planification preserves alphanumeric modules and accumulates split period lesson counts',
  () => {
    const summaryHeader = cells(
      ['Período', 'Módulos', 'N.º de aulas (50 min)', 'DATAS'],
      [0, 220, 650, 820]
    )
    const summaryRow = (period, moduleLabel, lessons) =>
      cells(
        [period, moduleLabel, String(lessons), 'datas'],
        [0, 220, 650, 820]
      )

    const parsed = parseModuleStyle(
      document([
        page(1, [
          cells(['PLANIFICAÇÃO DE MATEMÁTICA - 10.º ANO PROFISSIONAL']),
          cells(['Planificação anual por módulos']),
          summaryHeader,
          summaryRow('1.º', 'Módulo P1 – Modelos Matemáticos para a Cidadania', 30),
          summaryRow('1.º', 'Módulo P2 – Estatística', 23),
          summaryRow('2.º', 'Módulo P2 – Estatística', 7),
          summaryRow('2.º', 'Módulo OP5 – MODELOS DISCRETOS', 30),
          summaryRow('3.º', 'Módulo OP8 – GEOMETRIA SINTÉTICA', 13),
          summaryRow('3.º', 'Módulo OP8 – GEOMETRIA SINTÉTICA', 17)
        ]),
        page(2, [
          cells(['Módulo P1 – Modelos Matemáticos para a Cidadania']),
          bodyHeader,
          cells(
            [
              'Modelos matemáticos nas eleições',
              'Reconhecer o papel da matemática.',
              'Promover análise de sistemas eleitorais.',
              'Analítico',
              'Folha de cálculo',
              '30'
            ],
            [0, 180, 400, 650, 820, 980]
          )
        ]),
        page(3, [
          cells(['Módulo P2 – Estatística'])
        ]),
        page(4, [
          cells(['Módulo OP5 – MODELOS DISCRETOS'])
        ]),
        page(5, [
          cells(['Módulo OP8 – GEOMETRIA SINTÉTICA'])
        ])
      ]),
      'Planificação MAT Profissional.pdf'
    )

    assert.deepEqual(
      parsed.sections.map(section => section.code),
      ['P1', 'P2', 'OP5', 'OP8']
    )
    assert.equal(
      parsed.sections.find(section => section.code === 'P2')?.plannedLessons,
      30
    )
    assert.equal(
      parsed.sections.find(section => section.code === 'OP8')?.plannedLessons,
      30
    )
    assert.equal(
      parsed.sections.find(section => section.code === 'P1')?.name,
      'Modelos Matemáticos para a Cidadania'
    )
  }
)

test(
  'non-planification text is rejected instead of being promoted to a module',
  () => {
    const parsed = parseModuleStyle(
      document([
        page(1, [
          cells(['Ata da reunião']),
          cells(['Módulo 1 foi referido durante a reunião'])
        ])
      ]),
      'ata.pdf'
    )

    assert.equal(parsed.sections.length, 0)
  }
)
