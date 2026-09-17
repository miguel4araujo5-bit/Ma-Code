import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path =>
  readFile(
    new URL(`../../${path}`, import.meta.url),
    'utf8'
  )

const [
  workerEntry,
  professorPage,
  cloudRestore,
  restorePanel,
  snapshotService
] = await Promise.all([
  read('worker/entry.ts'),
  read('src/pages/MAProfessorPage.tsx'),
  read('src/components/ma-professor/sync/cloudBackupRestoreService.ts'),
  read('src/components/ma-professor/settings/OnlineRestorePanel.tsx'),
  read('src/components/ma-professor/sync/databaseSnapshotService.ts')
])

test(
  'legacy recovery and snapshot APIs are no longer routed by the worker',
  () => {
    assert.doesNotMatch(
      workerEntry,
      /maProfessorRecovery|maProfessorSnapshot|isMAProfessorRecoveryApiPath|isMAProfessorSnapshotApiPath/
    )

    assert.match(
      workerEntry,
      /isMAProfessorCloudBackupApiPath/
    )
  }
)

test(
  'legacy snapshot notices are no longer mounted on the MA-Professor page',
  () => {
    assert.doesNotMatch(
      professorPage,
      /SnapshotCapacityNotice|SyncStatePersistenceNotice/
    )
  }
)

test(
  'database snapshot service is now local-only and contains no v1 transport or key recovery',
  () => {
    assert.doesNotMatch(
      snapshotService,
      /cryptoStorage|cryptoService|snapshotApi|encryptMAProfessorRecord|decryptMAProfessorRecord|pushMAProfessorEncryptedSnapshot|getMAProfessorEncryptedSnapshot|unlockMAProfessorLocalMasterKey/
    )

    assert.match(
      snapshotService,
      /createMAProfessorDatabaseSnapshot/
    )

    assert.match(
      snapshotService,
      /restoreMAProfessorDatabaseSnapshot/
    )
  }
)

test(
  'current cloud restore remains wired after legacy recovery removal',
  () => {
    assert.match(
      cloudRestore,
      /restoreMAProfessorCloudRestore/
    )

    assert.match(
      restorePanel,
      /Restaurar cópia cifrada da nuvem/
    )
  }
)
