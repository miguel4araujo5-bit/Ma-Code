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

const restoreSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/RestoreSettingsPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const onlineRestoreSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/OnlineRestorePanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const encryptedSyncSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/EncryptedSyncPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const cloudPreferenceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/CloudBackupPreferencePanel.tsx',
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

const dailyWrapperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceWithDuties.tsx',
    import.meta.url
  ),
  'utf8'
)

const dailySource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const navigationModelSource = await readFile(new URL('../../src/components/ma-professor/product/productNavigationModel.ts', import.meta.url), 'utf8')

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
      /Descarregar cópia de segurança para o seu dispositivo/
    )
    assert.match(
      backupSource,
      /handleJsonExport/
    )
  }
)

test(
  'security and recovery page is organized around the four primary user actions',
  () => {
    assert.match(
      settingsSource,
      /Segurança e recuperação/
    )

    const restorePosition =
      backupSource.indexOf(
        'Restaurar uma cópia'
      )
    const backupPosition =
      backupSource.indexOf(
        'Criar uma cópia de segurança'
      )
    const exportPosition =
      backupSource.indexOf(
        'Abrir dados no Excel'
      )
    const advancedPosition =
      backupSource.indexOf(
        'Opções avançadas'
      )

    assert.ok(restorePosition >= 0)
    assert.ok(backupPosition >= 0)
    assert.ok(exportPosition >= 0)
    assert.ok(advancedPosition >= 0)
    assert.ok(restorePosition < backupPosition)
    assert.ok(backupPosition < exportPosition)
    assert.ok(exportPosition < advancedPosition)

    assert.match(
      restoreSource,
      /<OnlineRestorePanel/
    )
    assert.match(
      onlineRestoreSource,
      /Restaurar cópia cifrada da nuvem/
    )
    assert.match(
      restoreSource,
      /Restaurar cópia do seu dispositivo/
    )
    assert.match(
      encryptedSyncSource,
      /Fazer cópia de segurança para a nuvem/
    )
    assert.match(
      backupSource,
      /Descarregar cópia de segurança para o seu dispositivo/
    )
    assert.doesNotMatch(
      encryptedSyncSource,
      /Atualizar estado|Atualizar cópia cifrada agora|Guardar primeira cópia cifrada agora/
    )

    assert.match(
      backupSource,
      /Proteção automática/
    )
    assert.match(
      backupSource,
      /<EncryptedSyncPanel \/>/
    )
    assert.match(
      backupSource,
      /<BackupLocalSafetyPanel \/>/
    )
    assert.match(
      backupSource,
      /<RestoreSettingsPanel/
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
  'restore remains available inside Settings without a duplicate Menu destination',
  () => {
    assert.match(
      navigationModelSource,
      /\| 'restore'/
    )
    assert.doesNotMatch(
      navigationModelSource,
      /id:\s*'restore'[\s\S]*label:\s*'Restaurar dados'/
    )
    assert.match(
      settingsSource,
      /id:\s*'backup'[\s\S]*label:\s*'Segurança e recuperação'/
    )
    assert.match(
      backupSource,
      /<RestoreSettingsPanel/
    )
    assert.match(
      productMenuSource,
      /section === 'settings' \|\|[\s\S]*section === 'restore'/
    )
    assert.doesNotMatch(
      productMenuSource,
      /Quer recuperar os seus dados\?|antes de voltar a configurar tudo manualmente/
    )
    assert.doesNotMatch(
      productMenuSource,
      /Tenho uma cópia JSON|Recuperar cópia JSON|Definições e dados/
    )
  }
)

test(
  'menu terminology reflects security and recovery instead of the former copies-only label',
  () => {
    assert.match(
      navigationModelSource,
      /id: 'settings',[\s\S]*label: 'Definições'/
    )
    assert.match(
      navigationModelSource,
      /segurança e recuperação, exportações e licença/
    )
    assert.match(
      productMenuSource,
      /\? 'Restaurar dados'[\s\S]*: 'Definições'/
    )
  }
)

test(
  'security remains available in settings without a duplicate primary-navigation button',
  () => {
    assert.match(
      navigationModelSource,
      /ProductWorkspace = 'daily' \| 'calendar' \| 'backup' \| 'menu'/
    )
    assert.doesNotMatch(
      navigationModelSource,
      /id:\s*'backup'[\s\S]*label:\s*'Segurança'/
    )
    assert.match(
      productNavigationSource,
      /grid-cols-3/
    )
    assert.match(
      settingsSource,
      /id:\s*'backup'[\s\S]*label:\s*'Segurança e recuperação'/
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
      /Descarregar cópia de segurança para o seu dispositivo/
    )
    assert.match(
      encryptedSyncSource,
      /Fazer cópia de segurança para a nuvem/
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
  'daily backup reminder stays below the summary editor on any selected date',
  () => {
    assert.doesNotMatch(
      dailyWrapperSource,
      /Para maior segurança, faça regularmente uma/
    )
    assert.match(
      dailyWrapperSource,
      /<DailyWorkspaceView[\s\S]*onOpenBackup=\{[\s\S]*onOpenBackup/
    )
    assert.match(
      dailySource,
      /onOpenBackup\?: \(\) => void/
    )
    assert.match(
      dailySource,
      /Aula guardada'[\s\S]*<\/footer>[\s\S]*<\/article>[\s\S]*Para maior segurança, faça regularmente uma/
    )
    assert.match(
      dailySource,
      /onClick=\{onOpenBackup\}[\s\S]*cópia de segurança/
    )
    assert.match(
      dailySource,
      /text-amber-300[\s\S]*underline/
    )
    assert.match(
      productSource,
      /onOpenBackup=\{\(\) =>[\s\S]*handleSelect\([\s\S]*'backup'/
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


test(
  'persistent browser storage is requested as soon as the authenticated product mounts',
  () => {
    assert.match(
      productSource,
      /requestPersistentMAProfessorStorage/
    )
    assert.match(
      productSource,
      /useEffect\([\s\S]*void requestPersistentMAProfessorStorage\(\)[\s\S]*\[\]/
    )
  }
)

test(
  'cloud-backup controls link to the MA-Professor privacy information',
  () => {
    assert.match(
      cloudPreferenceSource,
      /href="\/privacidade\/ma-professor"/
    )
  }
)
