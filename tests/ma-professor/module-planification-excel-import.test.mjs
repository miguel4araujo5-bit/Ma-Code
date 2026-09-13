import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const parserSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/planificationSpreadsheetDocument.ts',
    import.meta.url
  ),
  'utf8'
)

const documentSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/planificationModuleDocument.ts',
    import.meta.url
  ),
  'utf8'
)

const scheduleGridSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/PlanificationScheduleGrid.tsx',
    import.meta.url
  ),
  'utf8'
)

function dataUrl(value) {
  return `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`
}

const runtimeSource = ts.transpileModule(
  parserSource,
  {
    fileName:
      'planificationSpreadsheetDocument.ts',
    compilerOptions: {
      target:
        ts.ScriptTarget.ES2022,
      module:
        ts.ModuleKind.ES2022
    }
  }
).outputText

const parserModule =
  await import(
    dataUrl(
      runtimeSource
    )
  )

test(
  'Excel planification parser reads the official six-column planning grid without saving anything',
  () => {
    const result =
      parserModule.parsePlanificationSpreadsheetRows(
        [
          ['PLANIFICAÇÃO DE Área de Expressões'],
          ['Curso Profissional – Técnico de Apoio Psicossocial 12º ANO'],
          [
            'Período Letivo',
            'UFCD ( Horas )',
            'Temas/Conteúdos',
            'Objetivos/ Competências',
            'Estratégias/ Metodologias',
            'Nº de aulas Previstas (50 min)'
          ],
          [
            '1º Período',
            'UFCD 10380 (50 Horas) – Intervenção nos comportamentos aditivos e dependências',
            'Conceito de desvio\nComportamentos aditivos',
            'Reconhecer os níveis de intervenção\nAplicar técnicas de abordagem',
            'Métodos: Expositivo e interrogativo.\nUso de: Filmes\nTextos de apoio.',
            60
          ],
          [
            'Avaliação',
            'Ficha de avaliação e/ou trabalho prático, fichas de trabalho e observação direta.'
          ]
        ],
        'planificacao.xlsx',
        'Planificação'
      )

    assert.equal(
      result.sections.length,
      1
    )

    const section =
      result.sections[0]

    assert.equal(
      section.code,
      '10380'
    )
    assert.equal(
      section.name,
      'Intervenção nos comportamentos aditivos e dependências'
    )
    assert.equal(
      section.durationHours,
      50
    )
    assert.equal(
      section.plannedLessons,
      60
    )
    assert.equal(
      section.periodLabel,
      '1º Período'
    )
    assert.match(
      section.contentsText,
      /Comportamentos aditivos/
    )
    assert.match(
      section.objectivesText,
      /Aplicar técnicas de abordagem/
    )
    assert.equal(
      section.methodologyText,
      'Expositivo e interrogativo.'
    )
    assert.match(
      section.resourcesText,
      /Filmes/
    )
    assert.match(
      section.evaluationText,
      /Ficha de avaliação/
    )
    assert.deepEqual(
      section.sourcePages,
      []
    )
    assert.match(
      section.warnings.join('\n'),
      /folha “Planificação”/
    )
  }
)

test(
  'Excel parser follows header meaning instead of fixed column positions',
  () => {
    const result =
      parserModule.parsePlanificationSpreadsheetRows(
        [
          [
            'Objetivos/Competências',
            'Nº de aulas Previstas (50 min)',
            'UFCD (Horas)',
            'Período Letivo',
            'Estratégias/Metodologias',
            'Temas/Conteúdos'
          ],
          [
            'Identificar conceitos essenciais',
            30,
            'UFCD 10371 (25h) – Respostas sociais de proximidade',
            '1º e 2º Período',
            'Métodos: ativo e expositivo.\nUso de: textos de apoio',
            'Organização e gestão do terceiro setor'
          ]
        ],
        'planificacao-reordenada.xlsx',
        'Dados'
      )

    assert.equal(
      result.sections.length,
      1
    )
    assert.equal(
      result.sections[0].code,
      '10371'
    )
    assert.equal(
      result.sections[0].durationHours,
      25
    )
    assert.equal(
      result.sections[0].plannedLessons,
      30
    )
    assert.match(
      result.sections[0].contentsText,
      /terceiro setor/
    )
  }
)

test(
  'Excel parser accepts wrapped headers split across adjacent rows',
  () => {
    const result =
      parserModule.parsePlanificationSpreadsheetRows(
        [
          [
            'Período',
            'UFCD',
            'Temas/',
            'Objetivos/',
            'Estratégias/',
            'Nº de aulas'
          ],
          [
            'Letivo',
            '(Horas)',
            'Conteúdos',
            'Competências',
            'Metodologias',
            'Previstas (50 min)'
          ],
          [
            '2º Período',
            'UFCD 4261 (50 Horas) – Trabalho de projeto comunitário - metodologia',
            'Conceito de Metodologia',
            'Elaborar um plano de atividades',
            'Métodos: Expositivo e interrogativo.',
            60
          ]
        ],
        'cabecalho-partido.xlsx',
        'Planificação'
      )

    assert.equal(
      result.sections.length,
      1
    )
    assert.equal(
      result.sections[0].code,
      '4261'
    )
    assert.match(
      result.sections[0].name,
      /Trabalho de projeto comunitário/
    )
  }
)

test(
  'module document lazy-loads xlsx and accepts xlsx, xlsm and xls while preserving the existing preview flow',
  () => {
    assert.match(
      documentSource,
      /\\\.\(\?:xlsx\|xlsm\|xls\)/
    )
    assert.match(
      documentSource,
      /extractPlanificationSpreadsheet/
    )
    assert.match(
      parserSource,
      /await import\('xlsx'\)/
    )
    assert.match(
      scheduleGridSource,
      /accept="\.pdf,\.docx,\.xlsx,\.xlsm,\.xls"/
    )
    assert.match(
      scheduleGridSource,
      /PDF, Word ou Excel/
    )
  }
)

test(
  'Excel planification import remains local-first and does not add Cloudflare or remote parsing',
  () => {
    assert.doesNotMatch(
      parserSource,
      /fetch\(|snapshotApi|Durable Object|wrangler|cloudflare|workers ai/i
    )
    assert.doesNotMatch(
      documentSource,
      /snapshotApi|Durable Object|wrangler|cloudflare|workers ai/i
    )
  }
)
