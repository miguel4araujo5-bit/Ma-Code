import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const helperSource = await readFile(
  new URL(
    '../../src/lib/maPdf/pdfPasswordError.ts',
    import.meta.url
  ),
  'utf8'
)

const extractorSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfExtractor.ts',
    import.meta.url
  ),
  'utf8'
)

const sharedTextExtractorSource = await readFile(
  new URL(
    '../../src/lib/maPdf/extractPdfText.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(source, fileName) {
  return ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText
}

test(
  'PDF.js password errors receive one friendly Portuguese message while unrelated failures remain unchanged',
  async () => {
    const source = transpile(
      helperSource,
      'pdfPasswordError.ts'
    )
    const moduleUrl =
      `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
    const helper = await import(moduleUrl)

    const passwordError = Object.assign(
      new Error('No password given'),
      { name: 'PasswordException' }
    )
    const normalized =
      helper.normalizePdfPasswordError(
        passwordError
      )

    assert.ok(normalized instanceof Error)
    assert.equal(
      normalized.message,
      'Este PDF está protegido por palavra-passe. Remova a proteção antes de utilizar a ferramenta.'
    )

    const invalidPdf = Object.assign(
      new Error('Invalid PDF structure.'),
      { name: 'InvalidPDFException' }
    )

    assert.equal(
      helper.normalizePdfPasswordError(
        invalidPdf
      ),
      invalidPdf
    )
  }
)

test(
  'MA-Professor planification and schedule production PDF readers normalize password failures without changing parsers',
  () => {
    assert.match(
      extractorSource,
      /normalizePdfPasswordError/
    )
    assert.match(
      sharedTextExtractorSource,
      /normalizePdfPasswordError/
    )
    assert.match(
      extractorSource,
      /catch\s*\(\s*error\s*\)[\s\S]*throw\s+normalizePdfPasswordError\(\s*error\s*\)/
    )
    assert.match(
      sharedTextExtractorSource,
      /catch\s*\(\s*error\s*\)[\s\S]*throw\s+normalizePdfPasswordError\(\s*error\s*\)/
    )
  }
)
