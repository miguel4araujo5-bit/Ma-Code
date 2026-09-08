import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfParser.ts',
    import.meta.url
  ),
  'utf8'
)

const compiled = ts.transpileModule(
  source,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020
    }
  }
).outputText

const {
  matchPlanificationPdfDestinations,
  parsePlanificationPdfDocument
} = await import(
  `data:text/javascript;base64,${Buffer
    .from(compiled)
    .toString('base64')}`
)

function cell(text, x, width = 50) {
  return { text, x, width }
}

function line(cells) {
  return {
    text: cells.map(item => item.text).join(' '),
    cells: cells.map(item => item.text),
    positionedCells: cells
  }
}

function header() {
  return line([
    cell('Período Letivo', 20),
    cell('UFCD', 100),
    cell('Temas/Conteúdos', 200),
    cell('Objetivos/Competências', 400),
    cell('Estratégias/Metodologias', 550),
    cell('Nº de aulas Previstas (50 min)', 700)
  ])
}

function realFormatFixture() {
  return {
    pageCount: 4,
    characterCount: 1000,
    pages: [
      {
        pageNumber: 1,
        lines: [
          line([cell('PLANIFICAÇÃO DE ÁREA DE EXPRESSÕES', 200)]),
          header(),
          line([
            cell('1º e 2º Período', 20),
            cell('UFCD 4271', 100),
            cell('Formas animadas', 200),
            cell('Aplicar as técnicas de construção e manipulação', 400),
            cell('Métodos: Expositivo e interrogativo.', 550),
            cell('60', 700)
          ]),
          line([
            cell('(50 Horas) Oficina de expressão dramática', 100),
            cell('Teatro de sombras', 200),
            cell('Uso de: Filmes; Cartolinas, tesoura, lápis e marcadores.', 550)
          ]),
          line([cell('A Máscara', 200)]),
          line([
            cell('Avaliação', 20),
            cell('Ficha de avaliação e/ou trabalho prático, observação direta.', 200, 500)
          ])
        ]
      },
      {
        pageNumber: 2,
        lines: [
          header(),
          line([
            cell('2º e 3º Período', 20),
            cell('UFCD', 100),
            cell('Conceito de Metodologia', 200),
            cell('Reconhecer a importância da metodologia', 400),
            cell('Métodos: Expositivo e interrogativo.', 550),
            cell('60', 700)
          ]),
          line([
            cell('4261', 100),
            cell('A Metodologia como instrumento de transformação da realidade', 200),
            cell('Uso de: Filmes; Artigos de Jornais; Textos de apoio.', 550)
          ]),
          line([
            cell('(50 Horas) Trabalho de projeto comunitário - metodologia', 100)
          ]),
          line([
            cell('Avaliação', 20),
            cell('Ficha de avaliação e/ou trabalho prático, fichas de trabalho e observação direta.', 200, 500)
          ])
        ]
      },
      {
        pageNumber: 3,
        lines: [
          header(),
          line([
            cell('3º Período', 20),
            cell('UFCD 3279', 100),
            cell('Expressão dramática e desenvolvimento pessoal', 200),
            cell('Planificar e desenvolver técnicas de animação', 400),
            cell('Métodos: Expositivo e interrogativo.', 550),
            cell('30', 700)
          ]),
          line([
            cell('(25 Horas) Expressão dramática, corporal, vocal e verbal', 100),
            cell('Expressão dramática - função simbólica', 200),
            cell('Uso de: Filmes; Textos de apoio.', 550)
          ])
        ]
      },
      {
        pageNumber: 4,
        lines: [
          header(),
          line([cell('Jogo simbólico', 200)]),
          line([cell('Expressão corporal', 200)]),
          line([cell('Expressão vocal e verbal', 200)]),
          line([
            cell('Avaliação', 20),
            cell('Ficha de avaliação e/ou trabalho prático, fichas de trabalho e observação direta.', 200, 500)
          ])
        ]
      }
    ]
  }
}

test('planification PDF parser preserves multi-UFCD structure and cross-page continuation from the real 10D format', () => {
  const result = parsePlanificationPdfDocument(
    realFormatFixture(),
    'Planificação AE 10D 2425.pdf'
  )

  assert.deepEqual(
    result.sections.map(section => section.code),
    ['4271', '4261', '3279']
  )
  assert.equal(result.sections[0].durationHours, 50)
  assert.equal(result.sections[0].plannedLessons, 60)
  assert.match(result.sections[0].name, /Oficina de expressão dramática/)
  assert.match(result.sections[0].resourcesText, /Cartolinas/)
  assert.deepEqual(result.sections[2].sourcePages, [3, 4])
  assert.match(result.sections[2].contentsText, /Expressão vocal e verbal/)
  assert.match(result.sections[2].evaluationText, /observação direta/)
})

test('planification PDF matching preserves a leading zero and does not silently select between several classes', () => {
  const zeroDocument = {
    pageCount: 1,
    characterCount: 100,
    pages: [
      {
        pageNumber: 1,
        lines: [
          header(),
          line([
            cell('1º Período', 20),
            cell('UFCD 0349 (25 Horas) Ambiente, segurança, higiene e saúde no trabalho', 100),
            cell('Conteúdo de teste', 200),
            cell('Objetivo de teste', 400),
            cell('Métodos: ativo', 550),
            cell('30', 700)
          ]),
          line([
            cell('Avaliação', 20),
            cell('Observação direta', 200)
          ])
        ]
      }
    ]
  }

  const parsed = parsePlanificationPdfDocument(zeroDocument, 'zero.pdf')
  assert.equal(parsed.sections[0].code, '0349')

  const exact = matchPlanificationPdfDestinations(
    parsed.sections,
    [
      {
        moduleId: 'module-0349',
        teachingAssignmentId: 'assignment-a',
        code: '0349',
        name: 'Ambiente, segurança, higiene e saúde no trabalho',
        label: '11.º D · AP',
        hasActivePlanification: false
      },
      {
        moduleId: 'module-349',
        teachingAssignmentId: 'assignment-b',
        code: '349',
        name: 'Outro destino',
        label: '12.º E · AP',
        hasActivePlanification: false
      }
    ]
  )

  assert.deepEqual(
    exact[0].candidates.map(destination => destination.moduleId),
    ['module-0349']
  )

  const ambiguous = matchPlanificationPdfDestinations(
    [{ ...parsed.sections[0], code: '4271' }],
    [
      {
        moduleId: 'module-a',
        teachingAssignmentId: 'assignment-a',
        code: '4271',
        name: 'Oficina de expressão dramática',
        label: '10.º D · AE',
        hasActivePlanification: false
      },
      {
        moduleId: 'module-b',
        teachingAssignmentId: 'assignment-b',
        code: '4271',
        name: 'Oficina de expressão dramática',
        label: '10.º E · AE',
        hasActivePlanification: false
      }
    ]
  )

  assert.equal(ambiguous[0].automaticDestinationId, null)
  assert.equal(ambiguous[0].candidates.length, 2)
})

test('planification PDF parser refuses to simulate success when no text is extractable', () => {
  const result = parsePlanificationPdfDocument(
    {
      pageCount: 1,
      characterCount: 0,
      pages: [{ pageNumber: 1, lines: [] }]
    },
    'scan.pdf'
  )

  assert.equal(result.sections.length, 0)
  assert.match(result.warnings[0], /não contém texto extraível/i)
})
