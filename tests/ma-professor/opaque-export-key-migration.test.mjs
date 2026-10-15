import assert from 'node:assert/strict'
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import {
  tmpdir
} from 'node:os'
import {
  join
} from 'node:path'
import test from 'node:test'
import {
  pathToFileURL
} from 'node:url'
import * as ts from 'typescript'

function toBase64Url(bytes) {
  return Buffer
    .from(bytes)
    .toString('base64url')
}

test(
  'mobile OPAQUE migration wraps the legacy export key without changing it',
  async t => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'ma-professor-opaque-wrap-'
        )
      )

    t.after(
      () =>
        rm(
          directory,
          {
            recursive: true,
            force: true
          }
        )
    )

    let source =
      await readFile(
        new URL(
          '../../src/components/ma-professor/access/opaqueExportKeyMigration.ts',
          import.meta.url
        ),
        'utf8'
      )

    source =
      source.replace(
        /import type[\s\S]*?from '\.\/accessTypes'\n\n/,
        ''
      )

    const output =
      ts.transpileModule(
        source,
        {
          fileName:
            'opaqueExportKeyMigration.ts',
          compilerOptions: {
            module:
              ts.ModuleKind.ESNext,
            target:
              ts.ScriptTarget.ES2022
          },
          reportDiagnostics:
            true
        }
      )

    const errors =
      (output.diagnostics || [])
        .filter(
          diagnostic =>
            diagnostic.category ===
              ts.DiagnosticCategory.Error
        )

    assert.equal(
      errors.length,
      0
    )

    const path =
      join(
        directory,
        'migration.mjs'
      )

    await writeFile(
      path,
      output.outputText,
      'utf8'
    )

    const migration =
      await import(
        pathToFileURL(path).href
      )

    const legacy =
      toBase64Url(
        crypto.getRandomValues(
          new Uint8Array(64)
        )
      )

    const current =
      toBase64Url(
        crypto.getRandomValues(
          new Uint8Array(64)
        )
      )

    const wrong =
      toBase64Url(
        crypto.getRandomValues(
          new Uint8Array(64)
        )
      )

    const wrapped =
      await migration
        .wrapMAProfessorLegacyOpaqueExportKey(
          current,
          legacy
        )

    assert.equal(
      await migration
        .unwrapMAProfessorLegacyOpaqueExportKey(
          current,
          wrapped
        ),
      legacy
    )

    await assert.rejects(
      migration
        .unwrapMAProfessorLegacyOpaqueExportKey(
          wrong,
          wrapped
        )
    )
  }
)
