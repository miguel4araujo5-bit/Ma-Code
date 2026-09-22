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
  automaticSource,
  trustSource,
  serviceSource,
  syncPanelSource,
  restorePanelSource,
  reporterSource,
  reauthenticationSource,
  preferencePanelSource
] = await Promise.all([
  read('src/components/ma-professor/sync/AutomaticCloudBackup.tsx'),
  read('src/components/ma-professor/sync/cloudBackupTrust.ts'),
  read('src/components/ma-professor/sync/cloudBackupService.ts'),
  read('src/components/ma-professor/settings/EncryptedSyncPanel.tsx'),
  read('src/components/ma-professor/settings/OnlineRestorePanel.tsx'),
  read('src/components/ma-professor/setup/OperationalReadinessReporter.tsx'),
  read('src/components/ma-professor/sync/CloudBackupReauthentication.tsx'),
  read('src/components/ma-professor/sync/CloudBackupPreferencePanel.tsx')
])

const automatic = compact(automaticSource)
const trust = compact(trustSource)
const service = compact(serviceSource)
const syncPanel = compact(syncPanelSource)
const restorePanel = compact(restorePanelSource)
const reporter = compact(reporterSource)
const reauthentication = compact(reauthenticationSource)
const preferencePanel = compact(preferencePanelSource)

test(
  'manual v3 backup is gated by the in-memory OPAQUE key and reuses the existing reauthentication flow',
  () => {
    assert.match(
      syncPanel,
      /MA_PROFESSOR_OPAQUE_KEY_EVENT/
    )
    assert.match(
      syncPanel,
      /MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT/
    )
    assert.match(
      syncPanel,
      /!keyAvailable \|\| reauthenticationRequired/
    )
    assert.match(
      syncPanel,
      /readMAProfessorOpaqueExportKey\( session\.email \)/
    )
    assert.match(
      syncPanel,
      /<CloudBackupPreferencePanel canEnable=\{ !needsReauthentication \}/
    )
    assert.match(
      syncPanel,
      /<CloudBackupReauthentication forceRequired embedded/
    )
    assert.doesNotMatch(
      automatic,
      /CloudBackupReauthentication/
    )
    assert.match(
      automatic,
      /return null/
    )
    assert.match(
      service,
      /response\.status === 401 && authEmail/
    )
    assert.match(
      syncPanel,
      /busy \|\| needsReauthentication/
    )
    assert.match(
      syncPanel,
      /disabled=\{ busy \}/
    )
    assert.match(
      syncPanel,
      /const requestId = \+\+statusRequestId\.current/
    )
    assert.match(
      syncPanel,
      /statusRequestId\.current !== requestId/
    )
    assert.match(
      syncPanel,
      /setStatusError\(''\)/
    )
    assert.doesNotMatch(
      syncPanel,
      /writeCloudBackupPreference/
    )
    assert.match(
      preferencePanel,
      /enabled && !canEnable/
    )
    assert.match(
      preferencePanel,
      /onEnableBlocked\?\.\(\)/
    )
    assert.match(
      preferencePanel,
      /preference !== 'enabled' \?/
    )
    assert.doesNotMatch(
      preferencePanel,
      /preference !== 'enabled' && canEnable/
    )
    assert.match(
      reauthentication,
      /!forceRequired && !required/
    )
    assert.match(
      reauthentication,
      /name="username" autoComplete="username"/
    )
    assert.match(
      reauthentication,
      /name="password" type="password" autoComplete="current-password"/
    )
  }
)

test(
  'automatic backup observes IndexedDB mutations without polling',
  () => {
    assert.match(
      automatic,
      /Dexie\.on\( 'storagemutated', handleStorageMutation \)/
    )
    assert.match(
      automatic,
      /part\.startsWith\(prefix\)/
    )
    assert.match(
      automatic,
      /AUTO_BACKUP_MIN_INTERVAL_MS = 10 \* 60 \* 1000/
    )
    assert.doesNotMatch(
      automatic,
      /setInterval\(/
    )
  }
)

test(
  'automatic backup never overwrites an unknown remote revision',
  () => {
    assert.match(
      automatic,
      /expectedServerRevision: trust\.serverRevision/
    )
    assert.match(
      service,
      /status\.serverRevision !== expectedServerRevision/
    )
    assert.match(
      service,
      /throw new MAProfessorCloudBackupRevisionConflictError\(\)/
    )
    assert.match(
      automatic,
      /blockedByDivergence = true/
    )
  }
)

test(
  'a device can only arm automatic backup when local and remote content are aligned',
  () => {
    assert.match(
      automatic,
      /createMAProfessorBackupContentSignature\( remote\.backup \) === createMAProfessorBackupContentSignature\( local \)/
    )
    assert.match(
      trust,
      /product: backup\.product, schemaVersion: backup\.schemaVersion, data: backup\.data/
    )
    assert.doesNotMatch(
      trust,
      /exportedAt: backup\.exportedAt/
    )
  }
)

test(
  'manual upload and successful restore establish trusted revision for later automatic backups',
  () => {
    assert.match(
      syncPanel,
      /writeMAProfessorCloudBackupTrust\( session, \{ serverRevision: result\.serverRevision, recordRevision: result\.recordRevision, updatedAt: result\.updatedAt \} \)/
    )
    assert.match(
      restorePanel,
      /writeMAProfessorCloudBackupTrust\( session, \{ serverRevision: foundPreview\.serverRevision, recordRevision: foundPreview\.recordRevision, updatedAt: foundPreview\.updatedAt \} \)/
    )
  }
)

test(
  'automatic backup is mounted globally inside the authenticated MA-Professor product',
  () => {
    assert.match(
      reporter,
      /import AutomaticCloudBackup from '\.\.\/sync\/AutomaticCloudBackup'/
    )
    assert.match(
      reporter,
      /return <AutomaticCloudBackup \/>/
    )
  }
)
