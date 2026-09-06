import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const extractorSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/planifications/planificationPdfExtractor.ts',
      import.meta.url
    ),
    'utf8'
  )

const parserSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/planifications/planificationPdfParser.ts',
      import.meta.url
    ),
    'utf8'
  )

const previewSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/planifications/planificationPdfPreview.ts',
      import.meta.url
    ),
    'utf8'
  )

const panelSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/planifications/PlanificationPdfImportPanel.tsx',
      import.meta.url
    ),
    'utf8'
  )

function transpile(source, filename) {
  const output = ts.transpileModule(
    source,
    {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX
      },
      reportDiagnostics: true
    }
  )

  const errors =
    (output.diagnostics || []).filter(
      diagnostic =>
        diagnostic.category ===
        ts.DiagnosticCategory.Error
    )

  assert.equal(
    errors.length,
    0,
    errors.map(
      diagnostic =>
        ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        )
    ).join('\n')
  )

  return output.outputText
}

function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(
    source
  ).toString('base64')}`
}

const parserUrl =
  dataUrl(
    transpile(
      parserSource,
      'planificationPdfParser.ts'
    )
  )

const pdfJsStubUrl =
  dataUrl(`
    export const GlobalWorkerOptions = { workerSrc: '' }
    export function getDocument() {
      throw new Error('getDocument is not used by this behavioral extraction-result test')
    }
  `)

const workerStubUrl =
  dataUrl('export default "worker-stub"')

const extractorRuntimeSource =
  transpile(
    extractorSource,
    'planificationPdfExtractor.ts'
  )
    .replaceAll(
      "'pdfjs-dist'",
      `'${pdfJsStubUrl}'`
    )
    .replaceAll(
      '"pdfjs-dist"',
      `"${pdfJsStubUrl}"`
    )
    .replaceAll(
      "'pdfjs-dist/build/pdf.worker.min.mjs?url'",
      `'${workerStubUrl}'`
    )
    .replaceAll(
      '"pdfjs-dist/build/pdf.worker.min.mjs?url"',
      `"${workerStubUrl}"`
    )
    .replaceAll(
      "'./planificationPdfParser'",
      `'${parserUrl}'`
    )
    .replaceAll(
      '"./planificationPdfParser"',
      `"${parserUrl}"`
    )

const previewRuntimeSource =
  transpile(
    previewSource,
    'planificationPdfPreview.ts'
  )
    .replaceAll(
      "'./planificationPdfParser'",
      `'${parserUrl}'`
    )
    .replaceAll(
      '"./planificationPdfParser"',
      `"${parserUrl}"`
    )

const extractor =
  await import(
    dataUrl(
      extractorRuntimeSource
    )
  )

const parser =
  await import(parserUrl)

const preview =
  await import(
    dataUrl(
      previewRuntimeSource
    )
  )

function item(
  str,
  x,
  y,
  width = 70
) {
  return {
    str,
    transform: [
      1,
      0,
      0,
      1,
      x,
      y
    ],
    width,
    height: 10
  }
}

test(
  'extraction result -> parser -> preview preserves exact UFCD codes and separate modules',
  () => {
    const extractedDocument =
      extractor.buildPlanificationPdfDocumentFromExtraction([
        {
          pageNumber: 1,
          items: [
            item('Período', 10, 700, 55),
            item('UFCD (Horas)', 100, 700, 90),
            item('Temas / Conteúdos', 250, 700, 120),
            item('Objetivos / Competências', 450, 700, 150),
            item('Estratégias / Metodologias', 650, 700, 160),
            item('Nº de aulas previstas', 850, 700, 120),

            item('1.º período', 10, 650, 65),
            item('UFCD 0349 (25 horas)', 100, 650, 120),
            item('Introdução à comunicação', 250, 650, 150),
            item('Identificar princípios de comunicação', 450, 650, 180),
            item('Métodos: exposição e prática', 650, 650, 170),
            item('30', 850, 650, 20),

            item('Comunicação em contexto profissional', 250, 620, 190),
            item('Aplicar técnicas adequadas', 450, 620, 150),
            item('Uso de: computador e projetor', 650, 620, 170),

            item('1.º período', 10, 560, 65),
            item('UFCD 10385 (50 horas)', 100, 560, 130),
            item('Planeamento de atividades', 250, 560, 150),
            item('Planear atividades de animação', 450, 560, 170),
            item('Trabalho de projeto', 650, 560, 110),
            item('60', 850, 560, 20)
          ]
        },
        {
          pageNumber: 2,
          items: [
            item('Período', 10, 700, 55),
            item('UFCD (Horas)', 100, 700, 90),
            item('Temas / Conteúdos', 250, 700, 120),
            item('Objetivos / Competências', 450, 700, 150),
            item('Estratégias / Metodologias', 650, 700, 160),
            item('Nº de aulas previstas', 850, 700, 120),

            item('Continuação do planeamento', 250, 650, 160),
            item('Adequar o plano ao público', 450, 650, 150),
            item('Discussão orientada', 650, 650, 120),

            item('Avaliação', 10, 590, 60),
            item('Trabalho prático e observação', 250, 590, 170)
          ]
        }
      ])

    assert.equal(
      extractedDocument.pageCount,
      2
    )
    assert.ok(
      extractedDocument.characterCount > 0
    )
    assert.ok(
      extractedDocument.pages[0]
        .lines.some(
          line =>
            line.positionedCells
              ?.some(cell =>
                cell.text.includes('0349')
              )
        )
    )

    const parsed =
      parser.parsePlanificationPdfDocument(
        extractedDocument,
        'Planificacao 10D.pdf'
      )

    assert.equal(
      parsed.sections.length,
      2,
      'Várias UFCD do mesmo PDF devem permanecer separadas.'
    )

    const first =
      parsed.sections[0]
    const second =
      parsed.sections[1]

    assert.equal(
      first.code,
      '0349',
      'Zeros iniciais do código têm de ser preservados.'
    )
    assert.equal(
      second.code,
      '10385'
    )
    assert.equal(
      first.durationHours,
      25
    )
    assert.equal(
      first.plannedLessons,
      30
    )
    assert.equal(
      second.durationHours,
      50
    )
    assert.equal(
      second.plannedLessons,
      60
    )
    assert.match(
      first.contentsText,
      /Comunicação em contexto profissional/
    )
    assert.match(
      second.contentsText,
      /Continuação do planeamento/
    )
    assert.deepEqual(
      second.sourcePages,
      [1, 2],
      'A continuação de uma UFCD noutra página deve preservar a proveniência.'
    )

    const result =
      preview.buildPlanificationPdfPreview(
        parsed,
        [
          {
            moduleId: 'module-0349',
            teachingAssignmentId:
              'assignment-10d',
            code: '0349',
            name: 'Comunicação',
            label:
              '0349 · Comunicação',
            existingPlanification:
              'no'
          },
          {
            moduleId: 'module-10385',
            teachingAssignmentId:
              'assignment-10d',
            code: '10385',
            name: 'Planeamento',
            label:
              '10385 · Planeamento',
            existingPlanification:
              'unknown'
          }
        ]
      )

    assert.equal(
      result.rows.length,
      2
    )
    assert.equal(
      result.rows[0]
        .suggestedDestinationId,
      'module-0349',
      'Um único código exato provadamente livre pode ser sugerido.'
    )
    assert.equal(
      result.rows[1]
        .suggestedDestinationId,
      null,
      'Um destino cujo estado de planificação é desconhecido não pode ser escolhido automaticamente.'
    )
    assert.match(
      result.rows[1]
        .warnings.join('\n'),
      /gravação permanece bloqueada/i
    )
  }
)

test(
  'persistent import UI keeps explicit confirmation and avoids legacy write paths',
  () => {
    assert.match(
      panelSource,
      /Importação atómica/
    )
    assert.match(
      panelSource,
      /Confirmar a importação\?/
    )
    assert.match(
      panelSource,
      /Importar planificações confirmadas/
    )
    assert.match(
      panelSource,
      /Escolha explicitamente…/
    )
    assert.doesNotMatch(
      panelSource,
      /createPlanification\s*\(|importPlanificationLines\s*\(|onCreatePlanification|onImportLines|maProfessorDb\./,
      'O painel persistente deve usar apenas o adapter do contrato oficial, sem caminhos de escrita legados ou diretos.'
    )
  }
)
