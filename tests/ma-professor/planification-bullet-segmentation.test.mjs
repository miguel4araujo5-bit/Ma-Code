import assert from 'node:assert/strict'
import {
  webcrypto
} from 'node:crypto'
import {
  readFile
} from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

if (!globalThis.crypto) {
  Object.defineProperty(
    globalThis,
    'crypto',
    {
      value: webcrypto,
      configurable: true
    }
  )
}

function dataUrl(value) {
  return `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`
}

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfImportAdapter.ts',
    import.meta.url
  ),
  'utf8'
)

const importRepositoryUrl = dataUrl(`
  export const planificationImportRepository = {
    async getPlanificationImportDestinationState() {
      throw new Error('not used')
    },
    async commitPlanificationImportBatch() {
      throw new Error('not used')
    }
  }
`)

const repositoryUrl = dataUrl(`
  export const maProfessorRepository = {
    async getSetupSnapshot() {
      throw new Error('not used')
    }
  }
`)

const runtimeSource = ts.transpileModule(
  source,
  {
    fileName: 'planificationPdfImportAdapter.ts',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    }
  }
).outputText
  .replaceAll(
    "'../planificationImportRepository'",
    `'${importRepositoryUrl}'`
  )
  .replaceAll(
    '"../planificationImportRepository"',
    `"${importRepositoryUrl}"`
  )
  .replaceAll(
    "'../repository'",
    `'${repositoryUrl}'`
  )
  .replaceAll(
    '"../repository"',
    `"${repositoryUrl}"`
  )

const adapter = await import(
  dataUrl(runtimeSource)
)

test(
  'bullet lists preserve wrapped continuation lines as one pedagogical point',
  () => {
    assert.deepEqual(
      adapter.splitPlanificationContentBlocks(
        '• Comunicação verbal\ne não verbal\n• Escuta ativa\ne empatia'
      ),
      [
        'Comunicação verbal e não verbal',
        'Escuta ativa e empatia'
      ]
    )
  }
)

test(
  'inline bullets are normalized into separate ordered points',
  () => {
    assert.deepEqual(
      adapter.splitPlanificationContentBlocks(
        '• Tema A • Tema B\ncontinuação do B • Tema C'
      ),
      [
        'Tema A',
        'Tema B continuação do B',
        'Tema C'
      ]
    )
  }
)

test(
  'plain line-separated content keeps the existing one-line-one-point behavior',
  () => {
    assert.deepEqual(
      adapter.splitPlanificationContentBlocks(
        'Tema A\nTema B\nTema A\nTema C'
      ),
      [
        'Tema A',
        'Tema B',
        'Tema C'
      ]
    )
  }
)
