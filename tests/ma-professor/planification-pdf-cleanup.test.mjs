import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfExtractor.ts',
    import.meta.url
  ),
  'utf8'
)

const output = ts.transpileModule(source, {
  fileName: 'planificationPdfExtractor.ts',
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  },
  reportDiagnostics: true
})

const errors = (output.diagnostics || []).filter(
  diagnostic => diagnostic.category === ts.DiagnosticCategory.Error
)

assert.equal(
  errors.length,
  0,
  errors
    .map(diagnostic =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    )
    .join('\n')
)

test(
  'loading failures are inside the cleanup boundary and worker cleanup cannot mask the primary error',
  () => {
    const loadingTaskIndex = source.indexOf(
      'const loadingTask =\n    getDocument({ data })'
    )
    const protectedTryIndex = source.indexOf(
      'try {',
      loadingTaskIndex
    )
    const loadingPromiseIndex = source.indexOf(
      'await loadingTask.promise',
      loadingTaskIndex
    )
    const destroyIndex = source.indexOf(
      'await loadingTask.destroy()',
      loadingTaskIndex
    )

    assert.ok(loadingTaskIndex >= 0)
    assert.ok(protectedTryIndex > loadingTaskIndex)
    assert.ok(loadingPromiseIndex > protectedTryIndex)
    assert.ok(destroyIndex > loadingPromiseIndex)
    assert.match(
      source.slice(destroyIndex - 160, destroyIndex + 220),
      /finally\s*\{[\s\S]*?try\s*\{[\s\S]*?await loadingTask\.destroy\(\)[\s\S]*?catch/
    )
  }
)

test(
  'every acquired planification PDF page is cleaned even if text or operator extraction fails',
  () => {
    const pageIndex = source.indexOf(
      'await pdf.getPage(pageNumber)'
    )
    const nextPageLoopBoundary = source.indexOf(
      'const document =',
      pageIndex
    )
    const pageSection = source.slice(
      pageIndex,
      nextPageLoopBoundary
    )

    assert.ok(pageIndex >= 0)
    assert.match(
      pageSection,
      /try\s*\{[\s\S]*?streamTextContent\(\)[\s\S]*?getOperatorList\(\)[\s\S]*?finally\s*\{[\s\S]*?page\.cleanup\(\)/
    )
  }
)
