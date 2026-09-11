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

const dbSource = await readFile(
  new URL(
    '../../src/components/ma-professor/db.ts',
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

test(
  'MA-Professor requests persistent browser storage without changing the Dexie schema',
  () => {
    assert.match(
      dbSource,
      /MA_PROFESSOR_DATABASE_VERSION\s*=\s*\n\s*1/
    )
    assert.match(
      dbSource,
      /navigator\.storage[\s\S]*\.persist\(\)/
    )
    assert.match(
      dbSource,
      /navigator\.storage[\s\S]*\.persisted\(\)/
    )
    assert.match(
      dbSource,
      /navigator\.storage[\s\S]*\.estimate\(\)/
    )
    assert.match(
      dbSource,
      /await requestPersistentMAProfessorStorage\(\)/
    )
  }
)

test(
  'storage quota exhaustion is recognised and converted into an explicit non-saved warning',
  () => {
    assert.match(
      dbSource,
      /QuotaExceededError/
    )
    assert.match(
      dbSource,
      /NS_ERROR_DOM_QUOTA_REACHED/
    )
    assert.match(
      dbSource,
      /normalizeMAProfessorStorageError/
    )
    assert.match(
      dbSource,
      /Esta alteração não foi guardada/
    )
    assert.match(
      dbSource,
      /await maProfessorDb\.open\(\)[\s\S]*normalizeMAProfessorStorageError/
    )
    assert.match(
      dbSource,
      /await database\.settings\.put\([\s\S]*normalizeMAProfessorStorageError/
    )
  }
)

test(
  'backup safety panel explains persistent-storage state and origin-wide usage estimate',
  () => {
    assert.match(
      safetySource,
      /Proteção do armazenamento local/
    )
    assert.match(
      safetySource,
      /Armazenamento persistente ativo/
    )
    assert.match(
      safetySource,
      /não concedeu armazenamento persistente/
    )
    assert.match(
      safetySource,
      /getMAProfessorStorageStatus\(\)/
    )
    assert.match(
      safetySource,
      /requestPersistentMAProfessorStorage\(\)/
    )
    assert.match(
      safetySource,
      /incluem o armazenamento da origem, não apenas o MA-Professor/
    )
  }
)
