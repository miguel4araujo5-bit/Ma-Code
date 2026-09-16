import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path =>
  readFile(
    new URL(`../../${path}`, import.meta.url),
    'utf8'
  )

const [
  restoreSource,
  onlineRestoreSource,
  settingsSource,
  backupSource
] = await Promise.all([
  read('src/components/ma-professor/settings/RestoreSettingsPanel.tsx'),
  read('src/components/ma-professor/settings/OnlineRestorePanel.tsx'),
  read('src/components/ma-professor/settings/SettingsWorkspaceView.tsx'),
  read('src/components/ma-professor/settings/BackupSettingsPanel.tsx')
])

test(
  'restore entry exposes cloud and device actions directly without a source selector',
  () => {
    assert.match(
      onlineRestoreSource,
      /Restaurar cópia cifrada da nuvem/
    )
    assert.match(
      onlineRestoreSource,
      /Decifrar e preparar restauro/
    )
    assert.match(
      restoreSource,
      /<OnlineRestorePanel[\s\S]*onDataChanged=/
    )
    assert.match(
      restoreSource,
      /Restaurar cópia do seu dispositivo/
    )
    assert.match(
      restoreSource,
      /Escolher cópia do dispositivo/
    )
    assert.match(
      restoreSource,
      /type="file"[\s\S]*accept="application\/json,\.json"/
    )
    assert.doesNotMatch(
      restoreSource,
      /RestoreSource|chooseSource|source === 'cloud'|source === 'device'/
    )
  }
)

test(
  'device restore validates and restores through the existing backup repository',
  () => {
    assert.match(
      restoreSource,
      /parseMAProfessorBackupFile\(file\)/
    )
    assert.match(
      restoreSource,
      /restoreMAProfessorBackup\([\s\S]*pendingBackup/
    )
    assert.match(
      restoreSource,
      /Escreva RESTAURAR para confirmar\./
    )
    assert.match(
      restoreSource,
      /clearMAProfessorCloudBackupTrust\([\s\S]*session/
    )
  }
)

test(
  'security area owns one restore panel and does not duplicate cloud restore logic',
  () => {
    assert.match(
      settingsSource,
      /<BackupSettingsPanel/
    )
    assert.doesNotMatch(
      settingsSource,
      /<RestoreSettingsPanel/
    )
    assert.match(
      backupSource,
      /<RestoreSettingsPanel/
    )
    assert.doesNotMatch(
      backupSource,
      /<OnlineRestorePanel/
    )
    assert.match(
      backupSource,
      /id="ma-professor-security-restore"/
    )
  }
)
