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
  restoreServiceSource,
  workerSource,
  entrySource,
  syncPanelSource,
  restorePanelSource,
  dailySource
] = await Promise.all([
  read('src/components/ma-professor/sync/cloudBackupService.ts'),
  read('src/components/ma-professor/sync/cloudBackupRestoreService.ts'),
  read('worker/maProfessorCloudBackup.ts'),
  read('worker/entry.ts'),
  read('src/components/ma-professor/settings/EncryptedSyncPanel.tsx'),
  read('src/components/ma-professor/settings/OnlineRestorePanel.tsx'),
  read('src/components/ma-professor/daily/DailyWorkspaceWithDuties.tsx')
])

const client = compact(clientSource)
const restoreService = compact(restoreServiceSource)
const worker = compact(workerSource)
const entry = compact(entrySource)
const syncPanel = compact(syncPanelSource)
const restorePanel = compact(restorePanelSource)
const daily = compact(dailySource)

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
      /postJson\( '\/push', \{ \.\.\.sessionBody\(session\), recordId: RECORD_ID, expectedServerRevision: status\.serverRevision, encrypted: prepared\.encrypted \}/
    )
    assert.doesNotMatch(
      client,
      /postJson\( '\/push',[\s\S]{0,500}\bbackup\s*:/
    )
    assert.match(
      client,
      /subtle\.encrypt\(/
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
  'online backup supports automatic and manual saves while restore keeps local and remote race guards',
  () => {
    assert.match(
      syncPanel,
      /Automático \+ manual/
    )
    assert.match(
      syncPanel,
      /Sem polling:/
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
      /expectedLocalContentSignature: foundPreview\.localContentSignature/
    )
    assert.match(
      restoreService,
      /freshRemote\.serverRevision !== options\.expectedServerRevision/
    )
    assert.match(
      restoreService,
      /freshRemote\.ciphertextHash !== options\.expectedCiphertextHash/
    )
    assert.match(
      restoreService,
      /restoreMAProfessorDatabaseSnapshotIfLocalUnchanged\(/
    )
  }
)

test(
  'cloud restore does not force a browser download before replacing local data',
  () => {
    const start = restorePanel.indexOf(
      'const handleRestore ='
    )
    const end = restorePanel.indexOf(
      'return (',
      start
    )
    const restoreHandler = restorePanel.slice(
      start,
      end
    )

    assert.ok(start >= 0)
    assert.ok(end > start)
    assert.doesNotMatch(
      restoreHandler,
      /downloadTextFile\(/
    )
    assert.match(
      restoreHandler,
      /restoreMAProfessorCloudRestore\(/
    )
    assert.match(
      restorePanel,
      /Descarregar cópia atual \(opcional\)/
    )
  }
)

test(
  'Hoje shows a discreet local reminder without adding network polling',
  () => {
    assert.match(
      daily,
      /activeDate === todayISO\(\)/
    )
    assert.match(
      daily,
      /faça regularmente uma cópia de segurança/
    )
    assert.doesNotMatch(
      daily,
      /fetch\(|setInterval\(|setTimeout\(/
    )
  }
)
