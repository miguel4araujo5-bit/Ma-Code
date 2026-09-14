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
  parsePlanificationPdfDocument
} = await import(
  `data:text/javascript;base64,${Buffer
    .from(compiled)
    .toString('base64')}`
)

function cell(text, x, width = 80) {
  return { text, x, width }
}

function line(cells) {
  return {
    text: cells.map(item => item.text).join(' '),
    cells: cells.map(item => item.text),
    positionedCells: cells
  }
}

test(
  'planification parser keeps only code and official UFCD designation when evaluation text leaks into the module column',
  () => {
    const document = {
      pageCount: 1,
      characterCount: 500,
      pages: [
        {
          pageNumber: 1,
          lines: [
            line([
              cell('Período Letivo', 20),
              cell('UFCD', 100),
              cell('Temas/Conteúdos', 280),
              cell('Objetivos/Competências', 480),
              cell('Estratégias/Metodologias', 650),
              cell('Nº de aulas Previstas (50 min)', 820)
            ]),
            line([
              cell('1.º Período', 20),
              cell(
                'UFCD 10374 deontologia do/a Técnico/a de Apoio Psicossocial Ficha de avaliação e/ou trabalho prático, fichas de trabalho e observação -Principais problemas ambientais da atualidade -Resíduos -Definição Gestão de resíduos -Estratégias de atuação -Boas práticas para o meio ambiente -CONCEITOS BÁSICOS RELACIONADOS',
                100,
                160
              ),
              cell('Conteúdo correto', 280),
              cell('Objetivo correto', 480),
              cell('Métodos: ativo', 650),
              cell('30', 820)
            ])
          ]
        }
      ]
    }

    const parsed =
      parsePlanificationPdfDocument(
        document,
        'planificacao.pdf'
      )

    assert.equal(parsed.sections.length, 1)
    assert.equal(parsed.sections[0].code, '10374')
    assert.equal(
      parsed.sections[0].name,
      'deontologia do/a Técnico/a de Apoio Psicossocial'
    )
    assert.doesNotMatch(
      parsed.sections[0].name,
      /Ficha de avaliação/i
    )
  }
)
