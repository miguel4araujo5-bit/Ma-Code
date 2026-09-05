import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const safetySource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/BackupLocalSafetyPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const settingsSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/SettingsWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'local JSON backup warning explicitly states that the file is not encrypted',
  () => {
    assert.match(
      safetySource,
      /cópia JSON local não está cifrada/i
    )
    assert.match(
      safetySource,
      /nomes de alunos, faltas, avaliações/i
    )
  }
)

test(
  'the user can explicitly download the current state before restoring',
  () => {
    assert.match(
      safetySource,
      /Descarregar estado atual antes de restaurar/
    )
    assert.match(
      safetySource,
      /createMAProfessorBackup\(\)/
    )
    assert.match(
      safetySource,
      /downloadTextFile\(/
    )
  }
)

test(
  'backup safety is shown before the existing backup and restore workspace',
  () => {
    const safetyPosition =
      settingsSource.indexOf(
        '<BackupLocalSafetyPanel />'
      )
    const backupPosition =
      settingsSource.indexOf(
        '<BackupSettingsPanel'
      )

    assert.ok(safetyPosition >= 0)
    assert.ok(backupPosition >= 0)
    assert.ok(
      safetyPosition < backupPosition,
      'O aviso de segurança deve surgir antes das operações de backup/restauro.'
    )
  }
)
