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

const tableLayoutSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/planifications/planificationPdfTableLayout.ts',
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
        target: ts.ScriptTarget.ES2022
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

const tableLayoutUrl =
  dataUrl(
    transpile(
      tableLayoutSource,
      'planificationPdfTableLayout.ts'
    )
  )

const pdfJsStubUrl =
  dataUrl(`
    export const GlobalWorkerOptions = { workerSrc: '' }
    export const OPS = {
      constructPath: 1,
      stroke: 2,
      save: 3,
      restore: 4,
      transform: 5,
      closeStroke: 6,
      fillStroke: 7,
      eoFillStroke: 8,
      closeFillStroke: 9,
      closeEOFillStroke: 10
    }

    export function getDocument() {
      const pages = globalThis.__maPlanificationSyntheticPages || []

      return {
        promise: Promise.resolve({
          numPages: pages.length,
          async getPage(pageNumber) {
            const synthetic = pages[pageNumber - 1]

            return {
              streamTextContent() {
                return {
                  getReader() {
                    let delivered = false

                    return {
                      async read() {
                        if (delivered) {
                          return { done: true }
                        }

                        delivered = true
                        return {
                          done: false,
                          value: {
                            items: synthetic.items
                          }
                        }
                      },
                      releaseLock() {}
                    }
                  }
                }
              },
              async getOperatorList() {
                return synthetic.operators
              },
              cleanup() {}
            }
          }
        }),
        async destroy() {}
      }
    }
  `)

const workerStubUrl =
  dataUrl('export default "worker-stub"')

const pdfPasswordErrorStubUrl =
  dataUrl(`
    export const normalizePdfPasswordError = error => error
    export const configurePdfPasswordPrompt = () => undefined
  `)

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
    .replaceAll(
      "'./planificationPdfTableLayout'",
      `'${tableLayoutUrl}'`
    )
    .replaceAll(
      '"./planificationPdfTableLayout"',
      `"${tableLayoutUrl}"`
    )
    .replaceAll(
      "'../../../lib/maPdf/pdfPasswordError'",
      `'${pdfPasswordErrorStubUrl}'`
    )
    .replaceAll(
      '"../../../lib/maPdf/pdfPasswordError"',
      `"${pdfPasswordErrorStubUrl}"`
    )

const extractor =
  await import(
    dataUrl(
      extractorRuntimeSource
    )
  )

const parser =
  await import(parserUrl)

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

function appendSegment(path, x1, y1, x2, y2) {
  path.push(
    0,
    x1,
    y1,
    1,
    x2,
    y2
  )
}

function operators(
  verticalXs,
  horizontalYs,
  bottom = 100,
  top = 700
) {
  const path = []

  for (const x of verticalXs) {
    appendSegment(
      path,
      x,
      bottom,
      x,
      top
    )
  }

  for (const y of horizontalYs) {
    appendSegment(
      path,
      verticalXs[0],
      y,
      verticalXs[verticalXs.length - 1],
      y
    )
  }

  return {
    fnArray: [1],
    argsArray: [[
      2,
      [new Float32Array(path)],
      new Float32Array([
        verticalXs[0],
        bottom,
        verticalXs[verticalXs.length - 1],
        top
      ])
    ]]
  }
}

const sevenColumns = [
  0,
  100,
  200,
  300,
  400,
  500,
  600
]

test(
  'a neutral ruled page does not break the recognized planification table chain',
  async () => {
    globalThis.__maPlanificationSyntheticPages = [
      {
        items: [
          item('Período Letivo', 10, 650),
          item('UFCD', 110, 650),
          item('Temas/Conteúdos', 210, 650),
          item('Objetivos/Competências', 310, 650),
          item('Estratégias/Metodologias', 410, 650),
          item('Nº de aulas Previstas (50 min)', 510, 650),

          item('1º Período', 10, 520),
          item('UFCD 10380', 110, 520),
          item('(50 Horas)', 110, 490),
          item('UFCD A', 110, 460),
          item('Conteúdo A', 210, 520),
          item('Objetivo A', 310, 520),
          item('Métodos: ativo', 410, 520),
          item('60', 510, 520, 20)
        ],
        operators: operators(
          sevenColumns,
          [700, 600, 100]
        )
      },
      {
        items: [],
        operators: operators(
          [0, 300, 600],
          [700, 100]
        )
      },
      {
        items: [
          item('2º Período', 10, 520),
          item('UFCD 10383', 110, 520),
          item('(50 Horas)', 110, 490),
          item('UFCD B', 110, 460),
          item('Conteúdo B', 210, 520),
          item('Objetivo B', 310, 520),
          item('Métodos: ativo', 410, 520),
          item('60', 510, 520, 20)
        ],
        operators: operators(
          sevenColumns,
          [700, 100]
        )
      }
    ]

    try {
      const document =
        await extractor.extractPlanificationPdf({
          type: 'application/pdf',
          name: 'synthetic-planification.pdf',
          size: 1,
          async arrayBuffer() {
            return new Uint8Array([1]).buffer
          }
        })

      const parsed =
        parser.parsePlanificationPdfDocument(
          document,
          'synthetic-planification.pdf'
        )

      assert.equal(
        parsed.sections.length,
        2
      )
      assert.deepEqual(
        parsed.sections.map(
          section => section.code
        ),
        ['10380', '10383']
      )
      assert.deepEqual(
        parsed.sections[1].sourcePages,
        [3]
      )
      assert.match(
        parsed.sections[1].name,
        /UFCD B/
      )
    } finally {
      delete globalThis.__maPlanificationSyntheticPages
    }
  }
)
