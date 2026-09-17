import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const menuSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/ProductMenuWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

const bridgeSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/SavedScheduleActions.tsx',
    import.meta.url
  ),
  'utf8'
)

const resetSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleImportResetRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const legacyAppSource = await readFile(
  new URL(
    '../../src/components/ma-professor/MAProfessorApp.tsx',
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

const navigationModelSource = await readFile(new URL('../../src/components/ma-professor/product/productNavigationModel.ts', import.meta.url), 'utf8')

const dailyCssSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyUnifiedWeek.css',
    import.meta.url
  ),
  'utf8'
)

const dailyWeekSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyUnifiedWeekOverview.tsx',
    import.meta.url
  ),
  'utf8'
)

test('all menu and sidebar destinations share one definition and parent navigation state', () => {
  assert.match(menuSource, /menuDestinations\.map/)
  assert.match(productNavigationSource, /menuDestinations\.flatMap/)
  assert.match(menuSource, /const target = navigationRequest\?\.target \?\? 'home'/)
  assert.doesNotMatch(menuSource, /setSection|setActiveWorkspace/)
  assert.match(productSource, /onNavigate=\{next => void handleSidebarDestination\(next\)\}/)
  assert.match(productSource, /onOpenMenu=\{\(\) => void handleSelect\('menu'\)\}/)
  assert.match(legacyAppSource, /const activeWorkspace = workspaceRequest\?\.workspace \?\? 'dashboard'/)
})

test('obsolete navigation and DOM replacements are removed from management screens', () => {
  assert.doesNotMatch(legacyAppSource, /navigationItems|mobileNavigationItems|<nav|<aside|Em breve/)
  assert.doesNotMatch(bridgeSource, /NAVIGATION_SELECTOR|externalItems|hiddenButtons|target\.nav/)
  assert.doesNotMatch(productNavigationSource, /singleSidebar\.css/)
  assert.match(menuSource, /<SavedScheduleActions/)
})

test('the existing teaching workspaces remain reachable', () => {
  for (const target of ['dashboard', 'giae', 'assessments', 'planifications', 'groups', 'attendance', 'schedule', 'settings', 'configuration', 'restore']) {
    assert.ok(navigationModelSource.includes(`id: '${target}'`), `missing destination: ${target}`)
  }
  assert.match(menuSource, /<MAProfessorApp/)
  assert.match(menuSource, /<AttendanceProductWorkspace academicYearId=\{academicYear\.id\}/)
  assert.match(menuSource, /<ScheduleProductWorkspace academicYearId=\{academicYear\.id\}/)
  assert.match(menuSource, /<SettingsWorkspaceView/)
})

test('Calendar uses one product workspace and daily navigation keeps its unsaved-work guard', () => {
  assert.doesNotMatch(legacyAppSource, /<CalendarWorkspaceView|calendarSnapshot/)
  assert.match(productSource, /handleSidebarDestination[\s\S]*destination ===[\s\S]*'calendar'[\s\S]*handleSelect/)
  assert.match(productSource, /handleSidebarDestination[\s\S]*workspace ===[\s\S]*'daily'[\s\S]*dailyNavigationGuardRef\.current/)
  assert.match(productSource, /if \(!canLeave\) \{[\s\S]*return/)
})

test(
  'saved guided schedule can be edited or reset before a replacement import',
  () => {
    assert.match(
      bridgeSource,
      /Usar horário guardado/
    )
    assert.match(
      bridgeSource,
      /Editar horário guardado/
    )
    assert.match(
      bridgeSource,
      /Apagar horário importado e importar outro/
    )
    assert.match(
      bridgeSource,
      /<ScheduleProductWorkspace[\s\S]*academicYearId=\{editingAcademicYearId\}/
    )
    assert.match(
      bridgeSource,
      /Concluir edição e voltar/
    )
    assert.match(
      bridgeSource,
      /resetScheduleImportForSetup/
    )
    assert.match(
      bridgeSource,
      /window\.location\.reload\(\)/
    )
  }
)

test(
  'reset confirmation explicitly warns that downstream setup will be lost',
  () => {
    assert.match(
      bridgeSource,
      /⚠️ Atenção: ao apagar o horário, irá perder também as planificações, os critérios de avaliação e os alunos já configurados/
    )
    assert.match(
      bridgeSource,
      /Deseja mesmo apagar tudo e começar de novo\?/
    )
    assert.match(
      bridgeSource,
      /window\.confirm\([\s\S]*RESET_SCHEDULE_CONFIRMATION/
    )
  }
)

test(
  'schedule reset clears schedule plus planifications criteria and students while preserving historical safeguards',
  () => {
    assert.match(
      resetSource,
      /maProfessorDb\.transaction/
    )
    assert.match(
      resetSource,
      /weeklyScheduleSlots\.bulkDelete/
    )
    assert.match(
      resetSource,
      /schoolCalendarEvents\.bulkDelete/
    )
    assert.match(
      resetSource,
      /assessmentCriteria\.bulkDelete/
    )
    assert.match(
      resetSource,
      /assessmentSchemes\.bulkDelete/
    )
    assert.match(
      resetSource,
      /planificationItems\.bulkDelete/
    )
    assert.match(
      resetSource,
      /planifications\.bulkDelete/
    )
    assert.match(
      resetSource,
      /students\.bulkDelete/
    )
    assert.match(
      resetSource,
      /isDutyEvent\(event\)/
    )
    assert.match(
      resetSource,
      /academicYear\.setupCompletedAt[\s\S]*progress\.completedAt/
    )
    assert.match(
      resetSource,
      /lessons[\s\S]*scheduleSlotId[\s\S]*count\(\)/
    )
    assert.match(
      resetSource,
      /event\.description/
    )
    assert.match(
      resetSource,
      /step !== 'weekly_schedule'[\s\S]*step !== 'planifications'[\s\S]*step !== 'assessment_criteria'[\s\S]*step !== 'students'/
    )
    assert.doesNotMatch(
      resetSource,
      /groups\.(?:delete|bulkDelete)|subjects\.(?:delete|bulkDelete)|teachingAssignments\.(?:delete|bulkDelete)/
    )
  }
)

test(
  'Daily weekly header hides the redundant Componente letiva and Cargo legend without removing cell terminology',
  () => {
    assert.match(
      dailyCssSource,
      /> section:first-child[\s\S]*> div[\s\S]*> div:first-child[\s\S]*> div:first-child[\s\S]*> div:first-child[\s\S]*display: none/
    )
    assert.match(
      dailyWeekSource,
      /Componente letiva/
    )
    assert.match(
      dailyWeekSource,
      />\s*Cargo\s*</
    )
  }
)
