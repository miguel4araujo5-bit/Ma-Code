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

async function loadHelper() {
  const source = transpile(
    helperSource,
    'pdfPasswordError.ts'
  )
  const moduleUrl =
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  return import(moduleUrl)
}

test(
  'PDF.js password errors keep a friendly fallback while unrelated failures remain unchanged',
  async () => {
    const helper = await loadHelper()

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
  'protected PDFs ask locally for a password and retry with a specific wrong-password message',
  async () => {
    const helper = await loadHelper()
    const messages = []
    const suppliedPasswords = []
    const answers = [
      'primeira-tentativa',
      'correta-123'
    ]
    let destroyCalls = 0
    const loadingTask = {
      onPassword: null,
      async destroy() {
        destroyCalls += 1
      }
    }

    const controller =
      helper.configurePdfPasswordPrompt(
        loadingTask,
        message => {
          messages.push(message)
          return answers.shift() ?? null
        }
      )

    assert.equal(typeof loadingTask.onPassword, 'function')

    loadingTask.onPassword(
      password => suppliedPasswords.push(password),
      1
    )
    loadingTask.onPassword(
      password => suppliedPasswords.push(password),
      2
    )

    assert.deepEqual(
      messages,
      [
        'Este PDF está protegido por palavra-passe. Introduza a palavra-passe para continuar:',
        'A palavra-passe está incorreta. Tente novamente ou cancele:'
      ]
    )
    assert.deepEqual(
      suppliedPasswords,
      [
        'primeira-tentativa',
        'correta-123'
      ]
    )
    assert.equal(destroyCalls, 0)

    const unrelated = new Error('falha diferente')
    assert.equal(
      controller.normalizeError(unrelated),
      unrelated
    )
  }
)

test(
  'cancelling a protected PDF destroys the loading task and reports cancellation without retaining the password',
  async () => {
    const helper = await loadHelper()
    let destroyCalls = 0
    let updateCalls = 0
    const loadingTask = {
      onPassword: null,
      async destroy() {
        destroyCalls += 1
      }
    }

    const controller =
      helper.configurePdfPasswordPrompt(
        loadingTask,
        () => null
      )

    loadingTask.onPassword(
      () => { updateCalls += 1 },
      1
    )
    await Promise.resolve()

    assert.equal(updateCalls, 0)
    assert.equal(destroyCalls, 1)

    const passwordError = Object.assign(
      new Error('Password required'),
      { name: 'PasswordException' }
    )
    const normalized =
      controller.normalizeError(passwordError)

    assert.ok(normalized instanceof Error)
    assert.equal(
      normalized.message,
      'A abertura do PDF protegido foi cancelada.'
    )
    assert.doesNotMatch(
      helperSource,
      /localStorage|sessionStorage|console\.|indexedDB|password\s*:/i
    )
  }
)

test(
  'planification/criteria and schedule readers attach the shared password controller without changing their parsers',
  () => {
    for (const source of [
      extractorSource,
      sharedTextExtractorSource
    ]) {
      assert.match(
        source,
        /configurePdfPasswordPrompt/
      )
      assert.match(
        source,
        /passwordPrompt\.normalizeError/
      )
      assert.match(
        source,
        /getDocument\(\{\s*data\s*\}\)/
      )
    }

    assert.match(
      extractorSource,
      /readRuledPlanificationTable/
    )
    assert.match(
      sharedTextExtractorSource,
      /discardTimetableRoomColumns/
    )
  }
)
