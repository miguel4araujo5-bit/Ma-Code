import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const matrixSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/assessmentCriteriaProfessionalMatrixParser.ts',
    import.meta.url
  ),
  'utf8'
)

const routerSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/assessmentCriteriaPdfParser.ts',
    import.meta.url
  ),
  'utf8'
)

function loadMatrixParser() {
  const javascript = ts.transpileModule(
    matrixSource,
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
    () => {
      throw new Error(
        'O parser de matriz não deve exigir dependências de runtime neste teste.'
      )
    }
  )

  return module.exports
    .parseProfessionalAssessmentCriteriaMatrix
}

const parseMatrix = loadMatrixParser()

function positionedLine(
  values,
  positions = [
    0,
    170,
    330,
    510,
    690
  ]
) {
  return {
    text: values.join(' '),
    cells: values,
    positionedCells:
      values.map(
        (text, index) => ({
          text,
          x: positions[index] ?? index * 170,
          width: 120
        })
      )
  }
}

function noiseRows(count) {
  return Array.from(
    { length: count },
    (_, index) =>
      positionedLine([
        '',
        '',
        '',
        `Indicador de desempenho ${index + 1}`,
        `Instrumento ${index + 1}`
      ])
  )
}

test(
  'professional 60/20/20 matrix returns only three weighted domains despite many indicators and instruments',
  () => {
    const parsed = parseMatrix({
      pageCount: 4,
      characterCount: 6000,
      pages: [
        {
          pageNumber: 1,
          lines: [
            positionedLine([
              'CRITÉRIOS DE AVALIAÇÃO - Área de Expressões'
            ]),
            positionedLine([
              'CURSO PROFISSIONAL DE TÉCNICO DE APOIO PSICOSSOCIAL'
            ]),
            positionedLine([
              'Domínio',
              'Ponderação',
              'Operacionalização',
              'Indicadores de desempenho',
              'Técnicas e instrumentos de avaliação'
            ]),
            ...noiseRows(20),
            positionedLine([
              'Desempenho nas aprendizagens',
              '60%',
              '',
              'Mobiliza conhecimentos',
              'Projetos'
            ])
          ]
        },
        {
          pageNumber: 2,
          lines: [
            positionedLine([
              'Domínio',
              'Ponderação',
              'Operacionalização',
              'Indicadores de desempenho',
              'Técnicas e instrumentos de avaliação'
            ]),
            ...noiseRows(18),
            positionedLine([
              'Raciocínio, informação e',
              '',
              '',
              'Analisa informação',
              'Debates'
            ]),
            positionedLine([
              'comunicação',
              '20%',
              '',
              'Comunica com clareza',
              'Apresentações'
            ]),
            ...noiseRows(12),
            positionedLine([
              'Competências Transversais e',
              '20%',
              '',
              'É responsável',
              'Portefólio'
            ]),
            positionedLine([
              'Atitudinais',
              '',
              '',
              'Coopera',
              'Autoavaliação'
            ])
          ]
        },
        {
          pageNumber: 3,
          lines: [
            positionedLine([
              'Níveis de desempenho'
            ]),
            positionedLine([
              'Desempenho nas aprendizagens',
              'Insuficiente 0 a 9',
              'Suficiente 10 a 13',
              'Bom 14 a 17',
              'Muito Bom 18 a 20'
            ])
          ]
        },
        {
          pageNumber: 4,
          lines: [
            positionedLine([
              'Resumo estruturado para teste do importador'
            ]),
            positionedLine([
              'Domínio 1',
              'Desempenho nas aprendizagens'
            ]),
            positionedLine([
              'Ponderação 1',
              '60%'
            ]),
            positionedLine([
              'Ponderação 2',
              '20%'
            ]),
            positionedLine([
              'Ponderação 3',
              '20%'
            ]),
            positionedLine([
              'Total',
              '100%'
            ])
          ]
        }
      ]
    })

    assert.ok(parsed)
    assert.equal(parsed.candidates.length, 3)
    assert.deepEqual(
      parsed.candidates.map(candidate => [
        candidate.name,
        candidate.weightPercent
      ]),
      [
        ['Desempenho nas aprendizagens', 60],
        ['Raciocínio, informação e comunicação', 20],
        ['Competências Transversais e Atitudinais', 20]
      ]
    )
    assert.equal(
      parsed.candidates.reduce(
        (total, candidate) =>
          total + candidate.weightPercent,
        0
      ),
      100
    )
    assert.equal(
      parsed.metadata.subject?.value,
      'Área de Expressões'
    )
    assert.equal(
      parsed.metadata.course?.value,
      'TÉCNICO DE APOIO PSICOSSOCIAL'
    )
    assert.ok(
      parsed.candidates.every(
        candidate =>
          !/indicador|instrumento|portef[oó]lio/i.test(
            candidate.name
          )
      )
    )
    assert.match(
      parsed.warnings.join(' '),
      /não foram transformados em critérios autónomos/i
    )
  }
)

test(
  'general professional matrix also supports percentages embedded in the domain cell',
  () => {
    const positions = [
      0,
      250,
      500,
      720
    ]
    const parsed = parseMatrix({
      pageCount: 2,
      characterCount: 3000,
      pages: [
        {
          pageNumber: 1,
          lines: [
            positionedLine([
              'Domínio',
              'Operacionalização',
              'Indicadores de Desempenho',
              'Técnicas e Instrumentos de avaliação'
            ], positions),
            positionedLine([
              'Desempenho nas',
              'Compreensão dos conteúdos',
              'Compreende os conceitos essenciais',
              'Fichas de trabalho'
            ], positions),
            positionedLine([
              'aprendizagens',
              '',
              'Identifica aspetos fundamentais',
              'Questões orais'
            ], positions),
            positionedLine([
              '(60%)',
              'Realização de tarefas',
              'Realiza tarefas com rigor',
              'Atividades'
            ], positions),
            positionedLine([
              'Raciocínio, informação e',
              'Análise, informação e pensamento crítico',
              'Pesquisa e organiza informação',
              'Debates'
            ], positions),
            positionedLine([
              'comunicação (20%)',
              'Comunicação',
              'Comunica com clareza',
              'Apresentações'
            ], positions)
          ]
        },
        {
          pageNumber: 2,
          lines: [
            positionedLine([
              'Competências Transversais e',
              'Autonomia e responsabilidade',
              'Organiza o trabalho',
              'Portefólio'
            ], positions),
            positionedLine([
              'Atitudinais (20%)',
              'Competências transversais e atitudinais',
              'Coopera e respeita',
              'Autoavaliação'
            ], positions),
            positionedLine([
              'Níveis de Desempenho'
            ])
          ]
        }
      ]
    })

    assert.ok(parsed)
    assert.deepEqual(
      parsed.candidates.map(candidate => [
        candidate.name,
        candidate.weightPercent
      ]),
      [
        ['Desempenho nas aprendizagens', 60],
        ['Raciocínio, informação e comunicação', 20],
        ['Competências Transversais e Atitudinais', 20]
      ]
    )
  }
)

test(
  'old simple criteria tables are left to the generic criteria parser',
  () => {
    const parsed = parseMatrix({
      pageCount: 1,
      characterCount: 100,
      pages: [
        {
          pageNumber: 1,
          lines: [
            positionedLine([
              'Domínio',
              'Critério',
              'Ponderação'
            ]),
            positionedLine([
              'Conhecimentos',
              'Mobilização',
              '60%'
            ])
          ]
        }
      ]
    })

    assert.equal(parsed, null)
    assert.match(
      routerSource,
      /parseProfessionalAssessmentCriteriaMatrix/
    )
    assert.match(
      routerSource,
      /parseGenericAssessmentCriteriaPdfDocument/
    )
  }
)
