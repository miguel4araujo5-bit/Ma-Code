import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfParser.ts',
    import.meta.url
  ),
  'utf8'
)

const javascript = ts.transpileModule(
  source,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText

const parser = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
)

const cell = (text, x, width = 80) => ({ text, x, width })
const line = cells => ({
  text: cells.map(item => item.text).join(' '),
  cells: cells.map(item => item.text),
  positionedCells: cells
})

const header = line([
  cell('Período Letivo', 0),
  cell('UC (Horas)', 100),
  cell('Temas/Conteúdos', 200),
  cell('Objetivos/Competências', 300),
  cell('Estratégias/Metodologias', 400),
  cell('Aulas previstas (50 min)', 500)
])

test(
  'UC split across label and numeric code preserves the UC prefix',
  () => {
    const parsed = parser.parsePlanificationPdfDocument(
      {
        pageCount: 1,
        characterCount: 300,
        pages: [
          {
            pageNumber: 1,
            lines: [
              header,
              line([
                cell('', 0),
                cell('UC', 100),
                cell('', 200),
                cell('', 300),
                cell('', 400),
                cell('', 500)
              ]),
              line([
                cell('1.º Período', 0),
                cell('00033 (50 Horas) Comunicar e interagir em contexto profissional', 100),
                cell('Comunicação escrita', 200),
                cell('Reportar informação profissional.', 300),
                cell('Métodos: ativo.', 400),
                cell('60', 500)
              ])
            ]
          }
        ]
      },
      'uc-split-label.pdf'
    )

    assert.equal(parsed.sections.length, 1)
    assert.equal(parsed.sections[0].code, 'UC00033')
    assert.equal(
      parsed.sections[0].name,
      'Comunicar e interagir em contexto profissional'
    )
    assert.equal(parsed.sections[0].durationHours, 50)
    assert.equal(parsed.sections[0].plannedLessons, 60)
  }
)
