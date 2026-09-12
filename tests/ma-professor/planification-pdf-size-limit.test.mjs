import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const extractorSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfExtractor.ts',
    import.meta.url
  ),
  'utf8'
)

const scheduleSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx',
    import.meta.url
  ),
  'utf8'
)

const criteriaSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/assessmentCriteriaDocumentReader.ts',
    import.meta.url
  ),
  'utf8'
)

const moduleSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/planificationModuleDocument.ts',
    import.meta.url
  ),
  'utf8'
)

const output = ts.transpileModule(
  extractorSource,
  {
    fileName: 'planificationPdfExtractor.ts',
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

function compact(source) {
  return source
    .replace(/\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const extractor = compact(extractorSource)

test(
  'direct planification PDF extraction uses the same 20 MB ceiling as the other MA-Professor document imports',
  () => {
    assert.match(
      extractor,
      /MAX_PLANIFICATION_PDF_BYTES = 20 \* 1024 \* 1024/
    )
    assert.match(
      scheduleSource,
      /MAX_SCHEDULE_PDF_BYTES\s*=\s*20 \* 1024 \* 1024/
    )
    assert.match(
      criteriaSource,
      /MAX_FILE_BYTES = 20 \* 1024 \* 1024/
    )
    assert.match(
      moduleSource,
      /MAX_FILE_BYTES = 20 \* 1024 \* 1024/
    )
  }
)

test(
  'oversized planification PDFs are rejected before allocating the file buffer or starting pdf.js',
  () => {
    const sizeGuard = extractor.indexOf(
      'file.size > MAX_PLANIFICATION_PDF_BYTES'
    )
    const arrayBuffer = extractor.indexOf(
      'await file.arrayBuffer()'
    )
    const getDocument = extractor.indexOf(
      'getDocument({ data })'
    )

    assert.ok(sizeGuard >= 0)
    assert.ok(arrayBuffer > sizeGuard)
    assert.ok(getDocument > arrayBuffer)
    assert.match(
      extractor,
      /PDF ultrapassa o limite de 20 MB/
    )
  }
)

test(
  'C12 does not introduce an arbitrary page-count ceiling',
  () => {
    assert.doesNotMatch(
      extractorSource,
      /MAX_[A-Z_]*PAGES|numPages\s*>\s*\d+/
    )
  }
)
