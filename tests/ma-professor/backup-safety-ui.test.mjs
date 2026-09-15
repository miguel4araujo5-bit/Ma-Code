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

const backupSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/BackupSettingsPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const productMenuSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/ProductMenuWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

const productNavigationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/ProductNavigation.tsx',
    import.meta.url
  ),
  'utf8'
)

const productSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/MAProfessorProduct.tsx',
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
    assert.match(
      backupSource,
      /Esta cópia local não está cifrada/
    )
  }
)

test(
  'the security screen exposes only one local JSON download action',
  () => {
    assert.doesNotMatch(
      safetySource,
      /Descarregar cópia para este computador/
    )
    assert.doesNotMatch(
      safetySource,
      /createMAProfessorBackup\(\)/
    )
    assert.doesNotMatch(
      safetySource,
      /downloadTextFile\(/
    )
    assert.match(
      backupSource,
      /Cópias de segurança/
    )
    assert.match(
      backupSource,
      /Descarregar cópia completa/
    )
    assert.match(
      backupSource,
      /handleJsonExport/
    )
  }
)

test(
  'security and recovery page has one clear task-based organization',
  () => {
    assert.match(
      settingsSource,
      /Segurança e recuperação/
    )
    assert.match(
      settingsSource,
      /Proteção, cópias, restauro e exportações/
    )

    const protectionPosition =
      backupSource.indexOf(
        'Proteção automática'
      )
    const backupPosition =
      backupSource.indexOf(
        'Cópias de segurança'
      )
    const restorePosition =
      backupSource.indexOf(
        '<RestoreSettingsPanel'
      )
    const exportPosition =
      backupSource.indexOf(
        'Abrir dados no Excel'
      )
    const advancedPosition =
      backupSource.indexOf(
        'Opções avançadas'
      )

    assert.ok(protectionPosition >= 0)
    assert.ok(backupPosition >= 0)
    assert.ok(restorePosition >= 0)
    assert.ok(exportPosition >= 0)
    assert.ok(advancedPosition >= 0)
    assert.ok(protectionPosition < backupPosition)
    assert.ok(backupPosition < exportPosition)
    assert.ok(exportPosition < advancedPosition)

    assert.match(
      backupSource,
      /<EncryptedSyncPanel \/>/
    )
    assert.match(
      backupSource,
      /<BackupLocalSafetyPanel \/>/
    )
    assert.doesNotMatch(
      backupSource,
      /<OnlineRestorePanel/
    )
    assert.doesNotMatch(
      backupSource,
      /parseMAProfessorBackupFile\(/
    )
  }
)

test(
  'JSON restore remains directly discoverable from the menu and during an incomplete setup',
  () => {
    assert.match(
      productMenuSource,
      /\| 'restore'/
    )
    assert.match(
      productMenuSource,
      /id:\s*'restore'[\s\S]*title:\s*'Tenho uma cópia JSON'/
    )
    assert.match(
      productMenuSource,
      /Já tem uma cópia de segurança\?/
    )
    assert.match(
      productMenuSource,
      /onClick=\{\(\) => setSection\('restore'\)\}/
    )
    assert.match(
      productMenuSource,
      /section === 'settings' \|\|[\s\S]*section === 'restore'/
    )
  }
)

test(
  'security is directly reachable from the global product navigation and works before setup is complete',
  () => {
    assert.match(
      productNavigationSource,
      /ProductWorkspace = 'daily' \| 'calendar' \| 'backup' \| 'menu'/
    )
    assert.match(
      productNavigationSource,
      /id:\s*'backup'[\s\S]*label:\s*'Segurança'/
    )
    assert.match(
      productNavigationSource,
      /grid-cols-4/
    )
    assert.match(
      productSource,
      /nextWorkspace ===[\s\S]*'backup'[\s\S]*setWorkspace\([\s\S]*'backup'/
    )
    assert.match(
      productSource,
      /workspace !== 'menu' &&[\s\S]*workspace !== 'backup' &&[\s\S]*checkingYear/
    )
    assert.match(
      productSource,
      /workspace ===[\s\S]*'backup' \? \(\s*<SettingsWorkspaceView[\s\S]*initialTab="backup"/
    )
  }
)

test(
  'security screen warns about private browsing and keeps both local and encrypted-online choices',
  () => {
    assert.match(
      safetySource,
      /Em janela privada, guarde uma cópia antes de fechar/
    )
    assert.match(
      safetySource,
      /navegação privada ou anónima[\s\S]*eliminar os dados locais/i
    )
    assert.match(
      safetySource,
      /opção de cópia local ou a cópia cifrada online disponíveis abaixo/i
    )
    assert.match(
      backupSource,
      /Descarregar cópia completa/
    )
    assert.match(
      backupSource,
      /<EncryptedSyncPanel \/>/
    )
    assert.match(
      backupSource,
      /<RestoreSettingsPanel/
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
  'storage details remain available under advanced security options',
  () => {
    assert.match(
      backupSource,
      /Opções avançadas/
    )
    assert.match(
      backupSource,
      /Armazenamento local e navegação privada/
    )
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
