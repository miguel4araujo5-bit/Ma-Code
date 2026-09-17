import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path =>
  readFile(
    new URL(
      `../../${path}`,
      import.meta.url
    ),
    'utf8'
  )

const [
  productNavigationSource,
  productSource,
  legacyAppSource,
  setupWizardSource,
  settingsSource,
  backupSource,
  restoreSource,
  onlineRestoreSource,
  licenseSource
] = await Promise.all([
  read('src/components/ma-professor/product/ProductNavigation.tsx'),
  read('src/components/ma-professor/product/MAProfessorProduct.tsx'),
  read('src/components/ma-professor/MAProfessorApp.tsx'),
  read('src/components/ma-professor/setup/SetupWizard.tsx'),
  read('src/components/ma-professor/settings/SettingsWorkspaceView.tsx'),
  read('src/components/ma-professor/settings/BackupSettingsPanel.tsx'),
  read('src/components/ma-professor/settings/RestoreSettingsPanel.tsx'),
  read('src/components/ma-professor/settings/OnlineRestorePanel.tsx'),
  read('src/components/ma-professor/settings/LicenseSettingsPanel.tsx')
])

const navigationModelSource = await readFile(new URL('../../src/components/ma-professor/product/productNavigationModel.ts', import.meta.url), 'utf8')
const navigationLabelsSource = productNavigationSource + navigationModelSource

const fullNavigationLabels = [
  'Calendário',
  'Sumários / GIAE',
  'Avaliações',
  'Critérios de avaliação',
  'Planificações',
  'Turmas e alunos',
  'Faltas e recuperações',
  'Horários',
  'Definições',
  'Restaurar dados'
]

test(
  'desktop and mobile use the same complete MA-Professor sidebar instead of separate capability lists',
  () => {
    for (const label of fullNavigationLabels) {
      assert.ok(
        navigationLabelsSource.includes(label),
        `missing shared navigation capability: ${label}`
      )
    }

    assert.match(
      productNavigationSource,
      /<aside[\s\S]*aria-label="Navegação completa do MA-Professor"[\s\S]*<SidebarPanel[\s\S]*onOpenWorkspace=\{openWorkspace\}[\s\S]*onOpenDestination=\{openDestination\}/
    )

    assert.match(
      productNavigationSource,
      /role="dialog"[\s\S]*aria-label="Navegação completa do MA-Professor"[\s\S]*<SidebarPanel[\s\S]*onOpenWorkspace=\{openWorkspace\}[\s\S]*onOpenDestination=\{openDestination\}/
    )

    assert.equal(
      (productNavigationSource.match(/<SidebarPanel/g) ?? []).length,
      2,
      'the full desktop sidebar and the mobile drawer must keep reusing the same SidebarPanel'
    )
  }
)

test(
  'Calendar is directly available from the complete mobile drawer',
  () => {
    assert.match(
      productNavigationSource,
      /key:\s*'calendar'[\s\S]*workspace:\s*'calendar'[\s\S]*label:\s*'Calendário'/
    )
    assert.match(
      productNavigationSource,
      /'workspace' in item[\s\S]*onOpenWorkspace\([\s\S]*item\.workspace/
    )
    assert.match(
      productSource,
      /workspace ===[\s\S]*'calendar'[\s\S]*<CalendarProductWorkspace/
    )
  }
)

test(
  'restore is added as an extra shared shortcut and never replaces a desktop capability',
  () => {
    assert.match(
      navigationModelSource,
      /id: 'restore',[\s\S]*label: 'Restaurar dados'/
    )

    assert.match(
      productNavigationSource,
      /'workspace' in item[\s\S]*onOpenWorkspace\([\s\S]*item\.workspace/
    )

    for (const label of [
      'Calendário',
      'Sumários / GIAE',
      'Avaliações',
      'Critérios de avaliação',
      'Planificações',
      'Turmas e alunos',
      'Faltas e recuperações',
      'Horários',
      'Definições'
    ]) {
      assert.ok(
        navigationLabelsSource.includes(label),
        `existing desktop shortcut was removed while adding mobile parity: ${label}`
      )
    }
  }
)

test(
  'the shared restore shortcut opens the existing security workspace with direct cloud and device actions',
  () => {
    assert.match(
      productSource,
      /workspace ===[\s\S]*'backup' \? \(\s*<SettingsWorkspaceView[\s\S]*initialTab="backup"/
    )

    assert.match(
      backupSource,
      /id="ma-professor-security-restore"[\s\S]*<RestoreSettingsPanel/
    )

    assert.match(
      restoreSource,
      /<OnlineRestorePanel[\s\S]*onDataChanged=/
    )
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
      /Restaurar cópia do seu dispositivo/
    )
    assert.match(
      restoreSource,
      /Escolher cópia do dispositivo/
    )
    assert.doesNotMatch(
      restoreSource,
      /source === 'cloud'|source === 'device'|chooseSource/
    )

    assert.doesNotMatch(
      productNavigationSource,
      /OnlineRestorePanel|restoreMAProfessorCloudRestore|previewMAProfessorCloudRestore/
    )
  }
)

test(
  'responsive settings keep the same tabs and expose sign-out through Settings on small screens',
  () => {
    for (const label of [
      'Perfil e regras',
      'Segurança e recuperação',
      'Pesquisa',
      'Licença'
    ]) {
      assert.ok(
        settingsSource.includes(label),
        `missing settings tab: ${label}`
      )
    }

    assert.match(
      settingsSource,
      /tabs\.map/
    )
    assert.doesNotMatch(
      settingsSource,
      /mobileTabs|desktopTabs|isMobile/
    )
    assert.match(
      licenseSource,
      /Terminar sessão neste dispositivo/
    )
    assert.ok(
      navigationLabelsSource.includes('Definições')
    )
  }
)

test(
  'advanced setup changes layout on mobile but keeps exactly the same setup step source',
  () => {
    assert.match(
      setupWizardSource,
      /className="mt-6 lg:hidden"[\s\S]*<select[\s\S]*setupSteps\.map/
    )
    assert.match(
      setupWizardSource,
      /className="mt-6 hidden grid-cols-2 gap-3 lg:grid xl:grid-cols-8"[\s\S]*setupSteps\.map/
    )
  }
)

test('management screens have no second sidebar or mobile navigation', () => {
  assert.doesNotMatch(legacyAppSource, /mobileNavigationItems|navigationItems|<nav|<aside/)
  for (const label of fullNavigationLabels) {
    assert.ok(navigationLabelsSource.includes(label), `missing capability: ${label}`)
  }
})
