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

test('cloud backup API is routed through the worker entrypoint', () => {
  assert.match(entry, /isMAProfessorCloudBackupApiPath\( url\.pathname \)/)
  assert.match(entry, /handleMAProfessorCloudBackupApiRequest\( request, env \)/)
})

test('every active cloud backup operation validates the MA-Professor access session', () => {
  for (const handler of [
    'handleStatus',
    'handleGet',
    'handleInitializeV3',
    'handlePushV3'
  ]) {
    const start = worker.indexOf(`async function ${handler}`)
    assert.notEqual(start, -1, `${handler} must exist`)
    const end = worker.indexOf('async function ', start + 20)
    const block = worker.slice(start, end === -1 ? worker.length : end)
    assert.match(block, /verifyAccessSession\( body, env \)|verifyAccessSession\(body, env\)/, `${handler} must validate the current session`)
  }
})

test('legacy v2 endpoints and server-side backup keys are absent', () => {
  assert.doesNotMatch(worker, /case '\/key'/)
  assert.doesNotMatch(worker, /case '\/push'/)
  assert.doesNotMatch(worker, /case '\/promote-v3'/)
  assert.doesNotMatch(worker, /handleKey/)
  assert.doesNotMatch(worker, /handlePush\b/)
  assert.doesNotMatch(worker, /SESSION_KEY_MARKER|RAW-AES|SESSION-AUTH-V1/)
  assert.doesNotMatch(client, /postJson\( '\/key'/)
  assert.doesNotMatch(client, /postJson\( '\/push'/)
  assert.doesNotMatch(client, /postJson\( '\/promote-v3'/)
})

test('v3 initialization stores only wrapped key material and encrypted payload', () => {
  const start = worker.indexOf('async function handleInitializeV3')
  const end = worker.indexOf('async function handleStatus', start)
  const initialize = worker.slice(start, end)
  assert.match(initialize, /parseV3Profile/)
  assert.match(initialize, /parseV3EncryptedPayload/)
  assert.match(initialize, /INSERT INTO ma_professor_sync_profiles/)
  assert.match(initialize, /INSERT INTO ma_professor_encrypted_records/)
  assert.match(initialize, /MA_PROFESSOR_DB\.batch\(\[/)
  assert.doesNotMatch(initialize, /raw key|session key/i)
})

test('v3 push keeps profile and record revisions under symmetric CAS', () => {
  const start = worker.indexOf('async function handlePushV3')
  const end = worker.indexOf('function getErrorDetails', start)
  const push = worker.slice(start, end)
  assert.ok(start >= 0)
  assert.match(push, /assertV3StoredProfile/)
  assert.match(push, /currentRecordRevision !== expectedRecordRevision/)
  assert.match(push, /UPDATE ma_professor_encrypted_records/)
  assert.match(push, /record_revision = \?/)
  assert.match(push, /UPDATE ma_professor_sync_profiles/)
  assert.match(push, /AND EXISTS \(/)
  assert.match(push, /results\[0\]\?\.meta\?\.changes === 1/)
  assert.match(push, /results\[1\]\?\.meta\?\.changes === 1/)
})

test('status rejects stored profiles that are not valid v3 profiles', () => {
  const start = worker.indexOf('async function handleStatus')
  const end = worker.indexOf('async function handleGet', start)
  const status = worker.slice(start, end)
  assert.match(status, /assertV3StoredProfile\(profile\)/)
  assert.match(worker, /profile\.crypto_version !== CRYPTO_VERSION/)
  assert.match(worker, /proteção online existente não é compatível com a versão v3 atual/)
})

test('restore preview and guarded restore use only the v3 reader', () => {
  assert.match(restoreService, /downloadMAProfessorCloudBackupV3/)
  assert.doesNotMatch(restoreService, /downloadCompatibleMAProfessorCloudBackup/)
  assert.match(restoreService, /expectedServerRevision/)
  assert.match(restoreService, /expectedRecordRevision/)
  assert.match(restoreService, /expectedCiphertextHash/)
  assert.match(restoreService, /expectedPlaintextHash/)
  assert.match(restoreService, /restoreMAProfessorDatabaseSnapshotIfLocalUnchanged/)
})

test('manual and automatic saves use the same v3-only compatible uploader', () => {
  assert.match(automatic, /uploadAndVerifyCompatibleMAProfessorCloudBackup/)
  assert.match(syncPanelSource, /uploadAndVerifyCompatibleMAProfessorCloudBackup/)
  assert.doesNotMatch(automaticSource, /migrateMAProfessorCloudBackupV2ToV3/)
  assert.doesNotMatch(syncPanelSource, /migrateMAProfessorCloudBackupV2ToV3/)
  assert.doesNotMatch(restoreServiceSource, /migrateMAProfessorCloudBackupV2ToV3/)
  assert.doesNotMatch(restorePanelSource, /migrateMAProfessorCloudBackupV2ToV3/)
  assert.doesNotMatch(dailySource, /migrateMAProfessorCloudBackupV2ToV3/)
})

test('client v3 writes are encrypted locally before upload', () => {
  assert.match(client, /encryptMAProfessorBackupV3Data\(/)
  assert.match(client, /unwrapMAProfessorBackupV3MasterKey\(/)
  assert.match(client, /postJson\( '\/push-v3'/)
  assert.doesNotMatch(client, /postJson\( '\/push-v3',[\s\S]{0,500}\bbackup\s*:/)
})

test('cloud backup writes are not serialized by the access durable object', () => {
  assert.match(worker, /await durableObject\.fetch\(/)
  assert.match(worker, /ACCESS_VERIFY_PATH/)
  assert.match(entry, /handleMAProfessorCloudBackupApiRequest\( request, env \)/)
  assert.doesNotMatch(entry, /MA_PROFESSOR_ACCESS[\s\S]{0,200}handleMAProfessorCloudBackupApiRequest/)
  assert.match(access, /this\.operation = response\.then/)
})

test('a fresh OPAQUE login restores the in-memory export key required by v3 after reload', () => {
  assert.match(authGate, /await loginMAProfessorOpaqueOnly\(/)
  assert.match(authGate, /saveMAProfessorOpaqueExportKey\( normalizedEmail, exportKey \)/)
  assert.match(accessStorage, /let memoryOpaqueExportKey:/)
  assert.match(accessStorage, /readMAProfessorOpaqueExportKey/)
})
