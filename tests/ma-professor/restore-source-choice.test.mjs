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
  settingsSource
] = await Promise.all([
  read('src/components/ma-professor/settings/RestoreSettingsPanel.tsx'),
  read('src/components/ma-professor/settings/SettingsWorkspaceView.tsx')
])

test(
  'restore entry offers cloud and device file as explicit sources',
  () => {
    assert.match(
      restoreSource,
      /De onde quer restaurar a cópia\?/
    )
    assert.match(
      restoreSource,
      /Restaurar da nuvem/
    )
    assert.match(
      restoreSource,
      /Restaurar de um ficheiro/
    )
    assert.match(
      restoreSource,
      /source === 'cloud'[\s\S]*<OnlineRestorePanel/
    )
    assert.match(
      restoreSource,
      /source === 'device'[\s\S]*type="file"[\s\S]*accept="application\/json,\.json"/
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
  'data and copies screen surfaces source choice before the legacy backup tools',
  () => {
    const restorePosition =
      settingsSource.indexOf(
        '<RestoreSettingsPanel'
      )
    const safetyPosition =
      settingsSource.indexOf(
        '<BackupLocalSafetyPanel />'
      )
    const backupPosition =
      settingsSource.indexOf(
        '<BackupSettingsPanel'
      )

    assert.ok(restorePosition >= 0)
    assert.ok(safetyPosition >= 0)
    assert.ok(backupPosition >= 0)
    assert.ok(restorePosition < safetyPosition)
    assert.ok(restorePosition < backupPosition)
  }
)
