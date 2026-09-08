import assert from 'node:assert/strict'
import {
  readdir,
  readFile
} from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root =
  process.cwd()

const productPath =
  path.join(
    root,
    'src/components/ma-professor/product/MAProfessorProduct.tsx'
  )

const gatePath =
  path.join(
    root,
    'src/components/ma-professor/sync/CryptoSetupGate.tsx'
  )

const recoveryPath =
  path.join(
    root,
    'src/components/ma-professor/sync/deviceRecoveryService.ts'
  )

async function listSourceFiles(directory) {
  const entries =
    await readdir(
      directory,
      {
        withFileTypes: true
      }
    )

  const files = []

  for (const entry of entries) {
    const fullPath =
      path.join(
        directory,
        entry.name
      )

    if (entry.isDirectory()) {
      files.push(
        ...await listSourceFiles(
          fullPath
        )
      )
      continue
    }

    if (
      entry.isFile() &&
      /\.(?:ts|tsx)$/.test(
        entry.name
      )
    ) {
      files.push(fullPath)
    }
  }

  return files
}

async function findProductionOccurrences(
  needle
) {
  const sourceRoot =
    path.join(
      root,
      'src'
    )

  const files =
    await listSourceFiles(
      sourceRoot
    )

  const matches = []

  for (const file of files) {
    const source =
      await readFile(
        file,
        'utf8'
      )

    if (source.includes(needle)) {
      matches.push(
        path.relative(
          root,
          file
        )
      )
    }
  }

  return matches.sort()
}

test(
  'CryptoSetupGate and new-device recovery have no mounted production consumer in the current product tree',
  async () => {
    const productSource =
      await readFile(
        productPath,
        'utf8'
      )

    assert.match(
      productSource,
      /<AccessGate>[\s\S]*<AccountIsolationGate>/,
      'O produto deve continuar a montar a barreira de isolamento de conta.'
    )

    assert.doesNotMatch(
      productSource,
      /CryptoSetupGate/,
      'Se CryptoSetupGate passar a ser montado, esta investigação de reachability tem de ser revista antes de release.'
    )

    const gateOccurrences =
      await findProductionOccurrences(
        'CryptoSetupGate'
      )

    assert.deepEqual(
      gateOccurrences,
      [
        'src/components/ma-professor/sync/CryptoSetupGate.tsx'
      ],
      'Foi encontrado um consumidor produtivo adicional de CryptoSetupGate; rever imediatamente o risco de remoção de chave.'
    )

    const recoveryOccurrences =
      await findProductionOccurrences(
        'recoverMAProfessorOnNewDevice('
      )

    assert.deepEqual(
      recoveryOccurrences,
      [
        'src/components/ma-professor/sync/CryptoSetupGate.tsx',
        'src/components/ma-professor/sync/deviceRecoveryService.ts'
      ],
      'Foi encontrado um consumidor produtivo adicional do recovery; a classificação NÃO REPRODUZIDO pode já não ser válida.'
    )
  }
)

test(
  'the inactive gate deletes existing local crypto before replacement creation can fail',
  async () => {
    const source =
      await readFile(
        gatePath,
        'utf8'
      )

    const handlerStart =
      source.indexOf(
        'const handleCreateProtection'
      )

    const handlerEnd =
      source.indexOf(
        'const handleCopyRecoveryCode',
        handlerStart
      )

    assert.ok(
      handlerStart >= 0 &&
      handlerEnd > handlerStart,
      'Não foi possível localizar handleCreateProtection.'
    )

    const handlerSource =
      source.slice(
        handlerStart,
        handlerEnd
      )

    const readPosition =
      handlerSource.indexOf(
        'readMAProfessorLocalCryptoMaterial('
      )

    const deletePosition =
      handlerSource.indexOf(
        'deleteMAProfessorLocalCryptoMaterial('
      )

    const createPosition =
      handlerSource.indexOf(
        'createAndStoreMAProfessorCryptoMaterial('
      )

    assert.ok(
      readPosition >= 0 &&
      deletePosition > readPosition &&
      createPosition > deletePosition,
      'A sequência de substituição deixou de ser read -> delete -> create; rever o relatório de risco.'
    )

    const events = []
    let localMaterial =
      'DISPOSABLE-OLD-MATERIAL'

    async function readExisting() {
      events.push('read')
      return localMaterial
    }

    async function deleteExisting() {
      events.push('delete')
      localMaterial = null
    }

    async function createReplacement() {
      events.push('create')
      throw new Error(
        'simulated generation/storage failure'
      )
    }

    const existing =
      await readExisting()

    if (existing) {
      await deleteExisting()
    }

    await assert.rejects(
      createReplacement,
      /simulated generation\/storage failure/
    )

    assert.deepEqual(
      events,
      [
        'read',
        'delete',
        'create'
      ]
    )

    assert.equal(
      localMaterial,
      null,
      'Depois de uma falha de criação, o material anterior já foi removido neste caminho.'
    )
  }
)

test(
  'the inactive gate also removes local material when server status reports no crypto profile',
  async () => {
    const source =
      await readFile(
        gatePath,
        'utf8'
      )

    const noProfileBranch =
      source.indexOf(
        'if (\n            local\n          )'
      )

    const deletePosition =
      source.indexOf(
        'await deleteMAProfessorLocalCryptoMaterial(',
        noProfileBranch
      )

    const setupPosition =
      source.indexOf(
        "setStage(\n            'setup'",
        deletePosition
      )

    assert.ok(
      noProfileBranch >= 0 &&
      deletePosition > noProfileBranch &&
      setupPosition > deletePosition,
      'O caminho remote profile absent -> delete local -> setup mudou; rever a investigação.'
    )
  }
)

test(
  'new-device recovery remains guarded against concurrent local writes, but does not itself re-read a current UI session',
  async () => {
    const recoverySource =
      await readFile(
        recoveryPath,
        'utf8'
      )

    const functionStart =
      recoverySource.indexOf(
        'export async function recoverMAProfessorOnNewDevice('
      )

    assert.ok(
      functionStart >= 0,
      'Não foi encontrada a função de recovery.'
    )

    const functionSource =
      recoverySource.slice(
        functionStart
      )

    assert.match(
      functionSource,
      /restoreMAProfessorDatabaseSnapshotIfLocalUnchanged\(/,
      'O recovery deve continuar a usar o restauro guardado contra escrita local concorrente.'
    )

    assert.doesNotMatch(
      functionSource,
      /useMAProfessorAccess|AccountIsolationGate|currentSession|refreshSession/,
      'A função passou a revalidar sessão/contexto de forma explícita; rever a classificação desta investigação.'
    )

    const concurrencyTest =
      await readFile(
        path.join(
          root,
          'tests/ma-professor/new-device-recovery-concurrency.test.mjs'
        ),
        'utf8'
      )

    assert.match(
      concurrencyTest,
      /automatic recovery aborts if another tab writes/,
      'A prova existente de proteção contra escrita local concorrente deixou de estar presente.'
    )
  }
)
