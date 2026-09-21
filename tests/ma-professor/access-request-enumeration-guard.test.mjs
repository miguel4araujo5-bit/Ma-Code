import assert from 'node:assert/strict'
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import * as ts from 'typescript'

const REQUEST_GUARD_KEY =
  'ma-professor-access-request-guard-v1'

function clone(value) {
  return value === undefined
    ? undefined
    : structuredClone(value)
}

class MemoryStorage {
  constructor(initial = {}) {
    this.values =
      new Map(
        Object.entries(initial).map(
          ([key, value]) => [
            key,
            clone(value)
          ]
        )
      )
  }

  async get(key) {
    return clone(
      this.values.get(key)
    )
  }

  async put(keyOrEntries, value) {
    if (
      typeof keyOrEntries ===
        'string'
    ) {
      this.values.set(
        keyOrEntries,
        clone(value)
      )
      return
    }

    for (
      const [key, entry] of
        Object.entries(keyOrEntries)
    ) {
      this.values.set(
        key,
        clone(entry)
      )
    }
  }

  snapshot(key) {
    return clone(
      this.values.get(key)
    )
  }
}

function transpile(source, filename) {
  const output =
    ts.transpileModule(
      source,
      {
        fileName: filename,
        compilerOptions: {
          module:
            ts.ModuleKind.ESNext,
          target:
            ts.ScriptTarget.ES2022
        },
        reportDiagnostics: true
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
    .replaceAll(
      "'./maProfessorExplicitApprovalBridge'",
      "'./maProfessorExplicitApprovalBridge.mjs'"
    )
    .replaceAll(
      '"./maProfessorExplicitApprovalBridge"',
      '"./maProfessorExplicitApprovalBridge.mjs"'
    )
}

async function stageGuard() {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'ma-professor-enumeration-guard-'
      )
    )

  const source =
    await readFile(
      new URL(
        '../../worker/maProfessorActivationCredentialGuardBridge.ts',
        import.meta.url
      ),
      'utf8'
    )

  await writeFile(
    join(
      directory,
      'maProfessorActivationCredentialGuardBridge.mjs'
    ),
    transpile(
      source,
      'maProfessorActivationCredentialGuardBridge.ts'
    ),
    'utf8'
  )

  await writeFile(
    join(
      directory,
      'maProfessorExplicitApprovalBridge.mjs'
    ),
    