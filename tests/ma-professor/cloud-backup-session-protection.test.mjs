import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path =>
  readFile(
    new URL(`../../${path}`, import.meta.url),
    'utf8'
  )

const compact = value =>
  value.replace(/\s+/g, ' ')

const [
  clientSource,
  workerSource,
  entrySource,
  syncPanelSource,
  restorePanelSource
] = await Promise.all([
  read('src/components/ma-professor/sync/cloudBackupService.ts'),
  read('worker/maProfessorCloudBackup.ts'),
  read('worker/entry.ts'),
  read('src/components/ma-professor/settings/EncryptedSyncPanel.tsx'),
  read('src/components/ma-professor/settings/OnlineRestorePanel.tsx')
])

const client = compact(clientSource)
const worker = compact(workerSource)
const entry = compact(entrySource)
const syncPanel = compact(syncPanelSource)
const restorePanel = compact(restorePanelSource)

test(
  'cloud backup API is routed through the worker entrypoint',
  () => {
    assert.match(
      entry,
      /isMAProfessorCloudBackupApiPath\( url\.pathname \)/
    )
    assert.match(
      entry,
      /handleMAProfessorCloudBackupApiRequest\( request, env \)/
    )
  }
)

test(
  'every cloud backup operation is gated by the MA-Professor access session',
  () => {
    for (const handler of [
      'handleStatus',
      'handleKey',
      'handleGet',
      'handlePush'
    ]) {
      const start = worker.indexOf(
        `async function ${handler}`
      )
      assert.notEqual(
        start,
        -1,
        `${handler} must exist`
      )

      const end = worker.indexOf(
        'async function ',
        start + 20
      )
      const block = worker.slice(
        start,
        end === -1
          ? worker.length
          : end
      )

      assert.match(
        block,
        /verifyAccessSession\(body, env\)/,
        `${handler} must validate the current session`
      )
    }
  }
)

test(
  'client encrypts locally and only sends the encrypted record to push',
  () => {
    assert.match(
      client,
      /const prepared = await encryptBackup\( backup, key \)/
    )
    assert.match(
      client,
      /postJson\( '\/push', \{ \.\.\.sessionBody\( session \), recordId: RECORD_ID, expectedServerRevision: status\.serverRevision, encrypted: prepared\.encrypted \}/
    )
    assert.doesNotMatch(
      client,
      /postJson\( '\/push',[\s\S]{0,500}\bbackup\s*:/
    )
    assert.match(
      client,
      /subtle \.encrypt\(/
    )
  }
)

test(
  'worker stores ciphertext with compare-and-swap revision protection',
  () => {
    assert.match(
      worker,
      /INSERT INTO ma_professor_encrypted_records/
    )
    assert.match(
      worker,
      /FROM ma_professor_sync_profiles WHERE account_id = \? AND server_revision = \? AND deleted_at IS NULL/
    )
    assert.match(
      worker,
      /UPDATE ma_professor_sync_profiles SET server_revision = \?, updated_at = \? WHERE account_id = \? AND server_revision = \? AND deleted_at IS NULL/
    )
    assert.match(
      worker,
      /results\[0\]\?\.meta\?\.changes === 1/
    )
    assert.match(
      worker,
      /results\[1\]\?\.meta\?\.changes === 1/
    )
  }
)

test(
  'online backup remains manual and restore requires explicit confirmation plus a safety copy',
  () => {
    assert.match(
      syncPanel,
      /Nada é enviado automaticamente\./
    )
    assert.match(
      syncPanel,
      /uploadAndVerifyMAProfessorCloudBackup\( session, backup \)/
    )
    assert.match(
      restorePanel,
      /\.toUpperCase\(\) !== 'RESTAURAR'/
    )
    assert.match(
      restorePanel,
      /const safetyBackup = await createMAProfessorBackup\(\)/
    )
    assert.match(
      restorePanel,
      /await restoreMAProfessorBackup\( preview\.backup \)/
    )
  }
)
