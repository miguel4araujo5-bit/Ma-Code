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
  dailySource,
  accessSource,
  automaticSource,
  authGateSource,
  accessStorageSource
] = await Promise.all([
  read('src/components/ma-professor/sync/cloudBackupService.ts'),
  read('src/components/ma-professor/sync/cloudBackupRestoreService.ts'),
  read('worker/maProfessorCloudBackup.ts'),
  read('worker/entry.ts'),
  read('src/components/ma-professor/settings/EncryptedSyncPanel.tsx'),
  read('src/components/ma-professor/settings/OnlineRestorePanel.tsx'),
  read('src/components/ma-professor/daily/DailyWorkspaceWithDuties.tsx'),
  read('worker/maProfessorAccess.ts'),
  read('src/components/ma-professor/sync/AutomaticCloudBackup.tsx'),
  read('src/components/ma-professor/access/MAProfessorAuthGate.tsx'),
  read('src/components/ma-professor/access/accessStorage.ts')
])

const client = compact(clientSource)
const restoreService = compact(restoreServiceSource)
const worker = compact(workerSource)
const entry = compact(entrySource)
const access = compact(accessSource)
const automatic = compact(automaticSource)
const authGate = compact(authGateSource)
const accessStorage = compact(accessStorageSource)
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
      'handlePromoteV3',
      'handlePushV3',
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
  'cloud backup writes are not serialized by the access durable object',
  () => {
    assert.match(worker, /await durableObject\.fetch\(/)
    assert.match(worker, /ACCESS_VERIFY_PATH/)
    assert.match(entry, /handleMAProfessorCloudBackupApiRequest\( request, env \)/)
    assert.doesNotMatch(entry, /MA_PROFESSOR_ACCESS[\s\S]{0,200}handleMAProfessorCloudBackupApiRequest/)
    assert.match(access, /this\.operation = response\.then/)
  }
)

test(
  'v3 push keeps profile and record revisions under symmetric CAS without legacy key material',
  () => {
    const start = worker.indexOf('async function handlePushV3')
    const end = worker.indexOf('async function handlePush', start + 20)
    const push = worker.slice(start, end)

    assert.ok(start >= 0)
    assert.match(push, /readExistingProfile/)
    assert.match(push, /profile\.crypto_version !== V3_CRYPTO_VERSION/)
    assert.match(push, /currentRecordRevision !== expectedRecordRevision/)
    assert.match(push, /UPDATE ma_professor_encrypted_records/)
    assert.match(push, /record_revision = \? AND encryption_version = \?/)
    assert.match(push, /UPDATE ma_professor_sync_profiles/)
    assert.match(push, /AND EXISTS \( SELECT 1 FROM ma_professor_encrypted_records/)
    assert.match(push, /results\[0\]\?\.meta\?\.changes === 1/)
    assert.match(push, /results\[1\]\?\.meta\?\.changes === 1/)
    assert.doesNotMatch(push, /ensureSessionProfile|SESSION_KEY_MARKER|RAW-AES|\/key/)
    assert.match(worker, /case '\/push-v3': return await handlePushV3\(body, env\)/)
  }
)

test(
  'v3 record upsert applies recordRevision CAS inside the atomic batch',
  () => {
    const promoteStart = worker.indexOf('async function handlePromoteV3')
    const promoteEnd = worker.indexOf('async function handleStatus', promoteStart)
    const promote = worker.slice(promoteStart, promoteEnd)

    assert.match(
      promote,
      /WHERE ma_professor_encrypted_records\.record_revision = \?/
    )
    assert.match(
      promote,
      /SESSION_KEY_MARKER,\s*expectedRecordRevision\s*\)/
    )
    assert.match(promote, /MA_PROFESSOR_DB\.batch\(\[/)
  }
)

test(
  'v3 profile promotion depends on the record write produced by the same batch',
  () => {
    const start = worker.indexOf('async function handlePromoteV3')
    const end = worker.indexOf('async function handleStatus', start)
    const promote = worker.slice(start, end)

    assert.match(promote, /AND EXISTS \( SELECT 1 FROM ma_professor_encrypted_records/)
    assert.match(promote, /server_revision = \? AND record_revision = \? AND encryption_version = \? AND ciphertext_hash = \?/)
    assert.match(
      promote,
      /SESSION_KEY_MARKER, authenticated\.accountId, RECORD_ID, nextServerRevision, nextRecordRevision, encrypted\.encryptionVersion, encrypted\.ciphertextHash/
    )
  }
)

test(
  'v3 promotion is isolated, CAS-bound and does not replace the active v2 routes',
  () => {
    const start = worker.indexOf(
      'async function handlePromoteV3'
    )
    const end = worker.indexOf(
      'async function ',
      start + 20
    )
    const promote = worker.slice(
      start,
      end === -1
        ? worker.length
        : end
    )

    assert.ok(start >= 0)
    assert.match(
      promote,
      /assertSessionProfile\(profile\)/
    )
    assert.match(
      promote,
      /profile\.server_revision !== expectedServerRevision/
    )
    assert.match(
      promote,
      /parseExpectedRevision\( body\.expectedRecordRevision \)/
    )
    assert.match(
      promote,
      /currentRecordRevision !== expectedRecordRevision/
    )
    assert.match(
      promote,
      /nextRecordRevision = expectedRecordRevision \+ 1/
    )
    assert.match(
      promote,
      /MA_PROFESSOR_DB\.batch\(\[/
    )
    assert.match(
      promote,
      /crypto_version = \?/
    )
    assert.match(
      promote,
      /recovery_kdf_algorithm = \?/
    )
    assert.match(
      promote,
      /recovery_key_wrap_algorithm = \?/
    )
    assert.match(
      promote,
      /results\[0\]\?\.meta\?\.changes === 1/
    )
    assert.match(
      promote,
      /results\[1\]\?\.meta\?\.changes === 1/
    )
    const recordCas =
      promote.match(
        /AND server_revision = \?/g
      ) || []
    const versionCas =
      promote.match(
        /AND crypto_version = \?/g
      ) || []
    const kdfCas =
      promote.match(
        /AND recovery_kdf_algorithm = \?/g
      ) || []
    const wrapCas =
      promote.match(
        /AND recovery_key_wrap_algorithm = \?/g
      ) || []

    assert.equal(recordCas.length, 3)
    assert.equal(versionCas.length, 2)
    assert.equal(kdfCas.length, 2)
    assert.equal(wrapCas.length, 2)
    const firstWrite =
      promote.indexOf(
        'INSERT INTO ma_professor_encrypted_records'
      )
    const profileWrite =
      promote.indexOf(
        'UPDATE ma_professor_sync_profiles'
      )

    assert.ok(firstWrite >= 0)
    assert.ok(profileWrite > firstWrite)
    assert.match(
      promote,
      /if \(!recordChanged \|\| !profileChanged\)/
    )
    assert.match(
      promote,
      /A promoção segura da cópia v3 não foi concluída\. A proteção anterior foi preservada\./
    )

    assert.match(
      promote,
      /parseV3EncryptedPayload\(\s*body\.encrypted\s*\)/
    )
    assert.doesNotMatch(
      promote,
      /parseEncryptedPayload\(\s*body\.encrypted\s*\)/
    )
    assert.match(
      worker,
      /case '\/promote-v3': return await handlePromoteV3\(body, env\)/
    )
    assert.match(
      worker,
      /case '\/key': return await handleKey\(body, env\)/
    )
    assert.match(
      worker,
      /case '\/get': return await handleGet\(body, env\)/
    )
    assert.match(
      worker,
      /case '\/push': return await handlePush\(body, env\)/
    )
  }
)

test(
  'v3 status and get can read the promoted profile while key remains strictly v2-only',
  () => {
    const statusStart = worker.indexOf('async function handleStatus')
    const keyStart = worker.indexOf('async function handleKey')
    const getStart = worker.indexOf('async function handleGet')
    const pushStart = worker.indexOf('async function handlePush')
    const status = worker.slice(statusStart, keyStart)
    const key = worker.slice(keyStart, getStart)
    const get = worker.slice(getStart, pushStart)

    assert.match(status, /readExistingProfile\(/)
    assert.doesNotMatch(status, /ensureSessionProfile\(/)
    assert.doesNotMatch(status, /assertSessionProfile\(/)
    assert.match(get, /readExistingProfile\(/)
    assert.doesNotMatch(get, /ensureSessionProfile\(/)
    assert.doesNotMatch(get, /assertSessionProfile\(/)
    assert.match(key, /readExistingProfile\(/)
    assert.match(key, /assertSessionProfile\(profile\)/)
    assert.doesNotMatch(key, /ensureSessionProfile\(/)
  }
)

test(
  'restore preview and guarded restore use the compatible v2-v3 reader',
  () => {
    assert.match(restoreService, /downloadCompatibleMAProfessorCloudBackup/)
    assert.doesNotMatch(restoreService, /\bdownloadMAProfessorCloudBackup\b/)
    assert.match(restoreService, /expectedServerRevision/)
    assert.match(restoreService, /expectedRecordRevision/)
    assert.match(restoreService, /expectedCiphertextHash/)
    assert.match(restoreService, /expectedPlaintextHash/)
    assert.match(restoreService, /restoreMAProfessorDatabaseSnapshotIfLocalUnchanged/)
  }
)

test(
  'manual and automatic saves use compatible upload without activating migration',
  () => {
    assert.match(automatic, /uploadAndVerifyCompatibleMAProfessorCloudBackup/)
    assert.doesNotMatch(automatic, /\buploadAndVerifyMAProfessorCloudBackup\(/)
    assert.doesNotMatch(automatic, /migrateMAProfessorCloudBackupV2ToV3/)
    assert.match(syncPanelSource, /uploadAndVerifyCompatibleMAProfessorCloudBackup/)
    assert.doesNotMatch(syncPanelSource, /\buploadAndVerifyMAProfessorCloudBackup\(/)
  }
)

test(
  'manual save is the only production trigger for v2 to v3 migration and records migrated trust',
  () => {
    assert.match(syncPanelSource, /currentStatus\.cryptoVersion === 2/)
    assert.match(syncPanelSource, /currentStatus\.backup\.found/)
    assert.match(syncPanelSource, /currentStatus\.backup\.recordRevision !== null/)
    assert.match(syncPanelSource, /await migrateMAProfessorCloudBackupV2ToV3\( session \)/)
    assert.match(syncPanelSource, /serverRevision: migrated\.serverRevision/)
    assert.match(syncPanelSource, /recordRevision: migrated\.recordRevision/)
    assert.doesNotMatch(automatic, /migrateMAProfessorCloudBackupV2ToV3/)
    assert.doesNotMatch(restoreService, /migrateMAProfessorCloudBackupV2ToV3/)
    assert.doesNotMatch(restorePanelSource, /migrateMAProfessorCloudBackupV2ToV3/)
    assert.doesNotMatch(dailySource, /migrateMAProfessorCloudBackupV2ToV3/)
  }
)

test(
  'first manual backup does not invoke migration when no remote copy exists',
  () => {
    const condition = /currentStatus\.cryptoVersion === 2 && currentStatus\.backup\.found && currentStatus\.backup\.recordRevision !== null/
    assert.match(syncPanel, condition)
    const migrationCall = syncPanel.indexOf('await migrateMAProfessorCloudBackupV2ToV3')
    const conditionStart = syncPanel.indexOf('currentStatus.cryptoVersion === 2')
    assert.ok(conditionStart >= 0 && migrationCall > conditionStart)
  }
)

test(
  'a fresh OPAQUE login restores the in-memory export key required by v3 after reload',
  () => {
    assert.match(authGate, /await loginMAProfessorOpaqueOnly\(/)
    assert.match(authGate, /saveMAProfessorOpaqueExportKey\( normalizedEmail, exportKey \)/)
    assert.match(accessStorage, /let memoryOpaqueExportKey:/)
    assert.match(accessStorage, /memoryOpaqueExportKey = \{ email: normalizedEmail, exportKey: normalizedExportKey \}/)
    const saveExportKeyStart = accessStorage.indexOf('export function saveMAProfessorOpaqueExportKey')
    const readExportKeyStart = accessStorage.indexOf('export function readMAProfessorOpaqueExportKey', saveExportKeyStart)
    const saveExportKey = accessStorage.slice(saveExportKeyStart, readExportKeyStart)
    assert.doesNotMatch(saveExportKey, /localStorage|sessionStorage|writeStoredValue/)
  }
)

test(
  'manual migration preserves v3 trust if the following upload fails',
  () => {
    assert.match(syncPanelSource, /let migratedTrust:/)
    assert.match(syncPanelSource, /migratedTrust = \{/)
    assert.match(syncPanelSource, /writeMAProfessorCloudBackupTrust\(\s*session,\s*migratedTrust\s*\)/)
    assert.match(syncPanelSource, /catch \(error\) \{\s*if \(migratedTrust\)/)
    assert.match(syncPanelSource, /await uploadAndVerifyCompatibleMAProfessorCloudBackup\(/)
  }
)

test(
  'legacy key endpoint remains v2-only after a profile is promoted to v3',
  () => {
    const start = worker.indexOf('async function handleKey')
    const end = worker.indexOf('async function handleGet', start)
    const keyHandler = worker.slice(start, end)
    assert.match(keyHandler, /assertSessionProfile\(profile\)/)
    assert.match(worker, /profile\.crypto_version !== CRYPTO_VERSION/)
    assert.match(worker, /const CRYPTO_VERSION = 2/)
  }
)

test(
  'v3 automatic writer fails on stale CAS instead of overwriting a newer remote copy',
  () => {
    const start = worker.indexOf('async function handlePushV3')
    const end = worker.indexOf('async function handlePush', start + 20)
    const push = worker.slice(start, end)
    assert.match(push, /profile\.server_revision !== expectedServerRevision/)
    assert.match(push, /currentRecordRevision !== expectedRecordRevision/)
    assert.match(push, /throw new CloudBackupApiError\([^]*409/)
    assert.match(push, /WHERE account_id = \? AND record_id = \? AND server_revision = \? AND record_revision = \? AND encryption_version = \?/)
  }
)

test(
  'automatic backup reaches the v3 writer through the compatible dispatcher without migration',
  () => {
    assert.match(automatic, /uploadAndVerifyCompatibleMAProfessorCloudBackup\(/)
    assert.doesNotMatch(automatic, /migrateMAProfessorCloudBackupV2ToV3/)
    const start = client.indexOf('export async function uploadAndVerifyCompatibleMAProfessorCloudBackup')
    const end = client.indexOf('export async function uploadAndVerifyMAProfessorCloudBackupV3', start)
    const dispatcher = client.slice(start, end)
    assert.match(dispatcher, /status\.cryptoVersion === 3/)
    assert.match(dispatcher, /uploadAndVerifyMAProfessorCloudBackupV3\(session, backup, forwardedOptions\)/)
  }
)

test(
  'restore re-reads the compatible v3 copy and rejects revision drift before local mutation',
  () => {
    assert.match(restoreService, /downloadCompatibleMAProfessorCloudBackup\( session \)/)
    assert.match(restoreService, /freshRemote\.serverRevision !== options\.expectedServerRevision/)
    assert.match(restoreService, /freshRemote\.recordRevision !== options\.expectedRecordRevision/)
    const drift = restoreService.indexOf('freshRemote.serverRevision !== options.expectedServerRevision')
    const restoreCall = restoreService.lastIndexOf('restoreMAProfessorDatabaseSnapshotIfLocalUnchanged')
    assert.ok(drift >= 0 && restoreCall > drift)
  }
)

test(
  'restore and trust reconciliation use the compatible v2 v3 reader while uploads remain legacy-gated',
  async () => {
    const restore = await readFile('src/components/ma-professor/sync/cloudBackupRestoreService.ts', 'utf8')
    const automatic = await readFile('src/components/ma-professor/sync/AutomaticCloudBackup.tsx', 'utf8')

    assert.match(restore, /downloadCompatibleMAProfessorCloudBackup/)
    assert.doesNotMatch(restore, /\bdownloadMAProfessorCloudBackup\(/)
    assert.match(automatic, /downloadCompatibleMAProfessorCloudBackup/)
    assert.doesNotMatch(automatic, /\bdownloadMAProfessorCloudBackup\(/)
    assert.match(automatic, /uploadAndVerifyCompatibleMAProfessorCloudBackup\(/)
    assert.doesNotMatch(automatic, /promotePreparedMAProfessorCloudBackupV3|prepareMAProfessorCloudBackupV3Promotion|migrateMAProfessorCloudBackupV2ToV3/)
  }
)

test(
  'compatible upload dispatches by profile version and forwards the observed CAS revision',
  () => {
    const start = client.indexOf('export async function uploadAndVerifyCompatibleMAProfessorCloudBackup')
    const end = client.indexOf('export async function uploadAndVerifyMAProfessorCloudBackupV3', start)
    const dispatcher = client.slice(start, end)

    assert.match(dispatcher, /await readStatus\(session\)/)
    assert.match(dispatcher, /status\.serverRevision !== options\.expectedServerRevision/)
    assert.match(dispatcher, /expectedServerRevision: status\.serverRevision/)
    assert.match(dispatcher, /status\.cryptoVersion === 3/)
    assert.match(dispatcher, /uploadAndVerifyMAProfessorCloudBackupV3/)
    assert.match(dispatcher, /status\.cryptoVersion === 2/)
    assert.match(dispatcher, /uploadAndVerifyMAProfessorCloudBackup\(/)
    assert.doesNotMatch(dispatcher, /promote-v3|\/key/)
  }
)

test(
  'v3 client upload unwraps locally, uses push-v3 and verifies by downloading v3',
  () => {
    const start = client.indexOf('export async function uploadAndVerifyMAProfessorCloudBackupV3')
    const end = client.indexOf('export async function uploadAndVerifyMAProfessorCloudBackup(', start)
    const upload = client.slice(start, end)

    assert.match(upload, /await readStatus\(session\)/)
    assert.match(upload, /status\.cryptoVersion !== 3/)
    assert.match(upload, /readMAProfessorOpaqueExportKey\(\s*session\.email\s*\)/)
    assert.match(upload, /unwrapMAProfessorBackupV3MasterKey\(exportKey, status\.protection\)/)
    assert.match(upload, /encryptMAProfessorBackupV3Data\(masterKey, compressed, RECORD_ID\)/)
    assert.match(upload, /postJson\('\/push-v3'/)
    assert.match(upload, /expectedRecordRevision: status\.backup\.recordRevision/)
    assert.match(upload, /downloadMAProfessorCloudBackupV3\(session\)/)
    assert.match(upload, /verified\.plaintextHash !== plaintextHash/)
    assert.doesNotMatch(upload, /importBackupKey|readKey|\/key/)
  }
)

test(
  'v2 to v3 migration stays explicit and verifies the promoted copy before returning',
  () => {
    const start = client.indexOf('export async function migrateMAProfessorCloudBackupV2ToV3')
    const end = client.indexOf('export async function downloadCompatibleMAProfessorCloudBackup', start)
    const migration = client.slice(start, end)

    assert.match(migration, /await readStatus\(session\)/)
    assert.match(migration, /status\.cryptoVersion !== 2/)
    assert.match(migration, /downloadMAProfessorCloudBackup\(/)
    assert.match(migration, /prepareMAProfessorCloudBackupV3Promotion\(/)
    assert.match(migration, /promotePreparedMAProfessorCloudBackupV3\(/)
    assert.match(migration, /downloadMAProfessorCloudBackupV3\(/)
    assert.match(migration, /verified\.plaintextHash !== prepared\.plaintextHash/)
    assert.doesNotMatch(restoreService, /migrateMAProfessorCloudBackupV2ToV3/)
  }
)

test(
  'migration fails closed on remote revision races before promotion',
  () => {
    const start = client.indexOf('export async function migrateMAProfessorCloudBackupV2ToV3')
    const end = client.indexOf('export async function downloadCompatibleMAProfessorCloudBackup', start)
    const migration = client.slice(start, end)
    const conflict = migration.indexOf('legacy.serverRevision !== status.serverRevision')
    const prepare = migration.indexOf('prepareMAProfessorCloudBackupV3Promotion')
    const promote = migration.indexOf('promotePreparedMAProfessorCloudBackupV3')

    assert.ok(conflict >= 0 && prepare > conflict && promote > prepare)
    assert.match(migration, /legacy\.recordRevision !== expectedRecordRevision/)
    assert.match(migration, /MAProfessorCloudBackupRevisionConflictError/)
  }
)

test(
  'migration cannot promote when the in-memory OPAQUE export key is unavailable',
  () => {
    const start = client.indexOf('export async function prepareMAProfessorCloudBackupV3Promotion')
    const end = client.indexOf('export async function promotePreparedMAProfessorCloudBackupV3', start)
    const prepare = client.slice(start, end)
    const migrationStart = client.indexOf('export async function migrateMAProfessorCloudBackupV2ToV3')
    const migrationEnd = client.indexOf('export async function downloadCompatibleMAProfessorCloudBackup', migrationStart)
    const migration = client.slice(migrationStart, migrationEnd)

    assert.match(prepare, /readMAProfessorOpaqueExportKey\(\s*session\.email\s*\)/)
    assert.match(prepare, /if \(!exportKey\)/)
    assert.ok(migration.indexOf('prepareMAProfessorCloudBackupV3Promotion') < migration.indexOf('promotePreparedMAProfessorCloudBackupV3'))
    assert.doesNotMatch(prepare, /readKey|\/key|activationPassword|personalPassword/)
  }
)

test(
  'migration verifies the exact promoted revision before reporting success',
  () => {
    const start = client.indexOf('export async function migrateMAProfessorCloudBackupV2ToV3')
    const end = client.indexOf('export async function downloadCompatibleMAProfessorCloudBackup', start)
    const migration = client.slice(start, end)

    assert.match(migration, /verified\.serverRevision !== promoted\.serverRevision/)
    assert.match(migration, /verified\.recordRevision !== promoted\.recordRevision/)
    assert.match(migration, /verified\.plaintextHash !== prepared\.plaintextHash/)
    assert.ok(migration.indexOf('downloadMAProfessorCloudBackupV3') > migration.indexOf('promotePreparedMAProfessorCloudBackupV3'))
  }
)

test(
  'compatible download dispatches only from the declared profile crypto version',
  () => {
    const start = client.indexOf('export async function downloadCompatibleMAProfessorCloudBackup')
    const end = client.indexOf('export async function downloadMAProfessorCloudBackupV3', start)
    const dispatcher = client.slice(start, end)

    assert.match(dispatcher, /await readStatus\(session\)/)
    assert.match(dispatcher, /status\.cryptoVersion === 3/)
    assert.match(dispatcher, /downloadMAProfessorCloudBackupV3\(/)
    assert.match(dispatcher, /status\.cryptoVersion === 2/)
    assert.match(dispatcher, /downloadMAProfessorCloudBackup\(/)
    assert.doesNotMatch(dispatcher, /\/key|importBackupKey|promote-v3|upload/)
  }
)

test(
  'v3 download uses OPAQUE client material and never requests the legacy server key',
  () => {
    const start = client.indexOf('export async function downloadMAProfessorCloudBackupV3')
    const end = client.indexOf('export async function downloadMAProfessorCloudBackup(', start)
    const downloadV3 = client.slice(start, end)

    assert.match(downloadV3, /readMAProfessorOpaqueExportKey\(/)
    assert.match(downloadV3, /unwrapMAProfessorBackupV3MasterKey\(/)
    assert.match(downloadV3, /decryptMAProfessorBackupV3Data\(/)
    assert.match(downloadV3, /validateMAProfessorBackup\(backup\)/)
    assert.match(downloadV3, /status\.serverRevision !== remote\.serverRevision/)
    assert.match(downloadV3, /status\.backup\.recordRevision !== remote\.recordRevision/)
    assert.doesNotMatch(downloadV3, /importBackupKey|readKey|\/key/)
  }
)

test(
  'legacy v2 download detects v3 before requesting the server-held v2 key',
  () => {
    const start = client.indexOf('export async function downloadMAProfessorCloudBackup')
    const download = client.slice(start)
    const versionGuard = download.indexOf('remote.cryptoVersion !== 2')
    const keyRead = download.indexOf('await importBackupKey(session)')

    assert.ok(versionGuard >= 0)
    assert.ok(keyRead > versionGuard)
    assert.match(download, /não pode ser aberta pelo fluxo legado v2/)
    assert.match(worker, /cryptoVersion: profile\.crypto_version/)
  }
)

test(
  'legacy v2 push remains fail-closed after a profile has moved to v3',
  () => {
    const start = worker.indexOf('async function handlePush')
    const end = worker.indexOf('function getErrorDetails', start)
    const push = worker.slice(start, end)

    assert.match(push, /ensureSessionProfile\(/)
    assert.match(worker, /return assertSessionProfile\(existing\)/)
    assert.match(worker, /profile\.crypto_version !== CRYPTO_VERSION/)
  }
)

test(
  'online backup keeps automatic and manual saves while restore keeps local and remote race guards',
  () => {
    assert.match(
      syncPanel,
      /Fazer cópia de segurança para a nuvem/
    )
    assert.match(
      syncPanel,
      /cópia automática continua ativa/
    )
    assert.doesNotMatch(
      syncPanel,
      /Atualizar estado|Atualizar cópia cifrada agora|Guardar primeira cópia cifrada agora/
    )
    assert.match(
      syncPanel,
      /uploadAndVerifyCompatibleMAProfessorCloudBackup\( session, backup \)/
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
  'daily workspace passes backup navigation to the editor without adding network polling',
  () => {
    assert.match(
      daily,
      /<DailyWorkspaceView[\s\S]*onOpenBackup=\{ onOpenBackup \}/
    )
    assert.doesNotMatch(
      daily,
      /fetch\(|setInterval\(|setTimeout\(/
    )
  }
)
