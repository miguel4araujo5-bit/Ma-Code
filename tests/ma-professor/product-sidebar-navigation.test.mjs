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

const regularAssessmentSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/RegularAssessmentWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const professionalAssessmentSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ProfessionalAssessmentWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const criteriaWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/CriteriaWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const navigationModelSource = await readFile(new URL('../../src/components/ma-professor/product/productNavigationModel.ts', import.meta.url), 'utf8')

const settingsSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/SettingsWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

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
  assert.match(productNavigationSource, /menuDestinations[\s\S]*\.filter\(item => item\.id !== 'restore'\)[\s\S]*\.map/)
  assert.match(
    navigationModelSource,
    /id: 'restore', label: 'Restaurar dados'/,
    'Restaurar dados deve continuar disponível no Menu e na área de Definições.'
  )
  assert.match(menuSource, /const target = navigationRequest\?\.target \?\? 'home'/)
  assert.doesNotMatch(menuSource, /setSection|setActiveWorkspace/)
  assert.match(productSource, /onNavigate=\{next => void handleSidebarDestination\(next\)\}/)
  assert.match(productSource, /onOpenMenu=\{\(\) => void handleSelect\('menu'\)\}/)
  assert.match(legacyAppSource, /const activeWorkspace = workspaceRequest\?\.workspace \?\? 'dashboard'/)
})

test('assessment criteria are a dedicated destination instead of a section inside assessments', () => {
  assert.match(
    navigationModelSource,
    /id: 'criteria', label: 'Critérios de avaliação'/
  )
  assert.match(
    legacyAppSource,
    /activeWorkspace ===[\s\S]*'criteria'[\s\S]*<CriteriaWorkspaceView/
  )
  assert.match(
    criteriaWorkspaceSource,
    /AssessmentCriteriaManagementPanel/
  )
  assert.doesNotMatch(
    productNavigationSource,
    /criteriaManagement|scrollToCriteriaManagement|MutationObserver|ma-professor-criteria-section/
  )
  assert.doesNotMatch(
    regularAssessmentSource,
    /AssessmentCriteriaManagementPanel|ma-professor-criteria-section|Critérios e ponderações/
  )
  assert.doesNotMatch(
    professionalAssessmentSource,
    /ma-professor-criteria-section|Critérios e ponderações/
  )
})

test('obsolete navigation and DOM replacements are removed from management screens', () => {
  assert.doesNotMatch(legacyAppSource, /navigationItems|mobileNavigationItems|<nav|<aside|Em breve/)
  assert.doesNotMatch(bridgeSource, /NAVIGATION_SELECTOR|externalItems|hiddenButtons|target\.nav/)
  assert.doesNotMatch(productNavigationSource, /singleSidebar\.css/)
  assert.match(menuSource, /<SavedScheduleActions/)
})

test('the existing teaching workspaces remain reachable without a duplicate overview destination', () => {
  for (const target of ['giae', 'assessments', 'criteria', 'planifications', 'groups', 'attendance', 'schedule', 'settings', 'restore']) {
    assert.ok(navigationModelSource.includes(`id: '${target}'`), `missing destination: ${target}`)
  }
  assert.match(
    navigationModelSource,
    /ProductMenuTarget =[^\n]*'configuration'/,
    'A rota de correção deve continuar disponível internamente.'
  )
  assert.doesNotMatch(
    navigationModelSource,
    /\{ id: 'configuration', label: 'Corrigir configuração inicial'/,
    'A correção não deve continuar como destino autónomo do Menu/barra lateral.'
  )
  assert.match(
    settingsSource,
    /id:\s*'configuration',[\s\S]*label:\s*'Corrigir configuração inicial'/,
    'A correção deve aparecer dentro de Definições.'
  )
  assert.match(
    settingsSource,
    /id:\s*'search'[\s\S]*id:\s*'configuration'[\s\S]*id:\s*'license'/,
    'A correção deve ficar entre Pesquisa e Licença.'
  )
  assert.doesNotMatch(
    navigationModelSource,
    /\{ id: 'dashboard', label:/
  )
  assert.match(
    navigationModelSource,
    /ManagementWorkspace = 'dashboard'/
  )
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
  'reset confirmation warns clearly but always leaves a final APAGAR action',
  () => {
    assert.match(
      bridgeSource,
      /Esta operação apaga o horário importado e reinicia a configuração do ano letivo/
    )
    assert.match(
      bridgeSource,
      /aulas, presenças, avaliações, classificações e recuperações/
    )
    assert.match(
      bridgeSource,
      /Esta ação não pode ser anulada/
    )
    assert.match(
      bridgeSource,
      /role="alertdialog"/
    )
    assert.match(
      bridgeSource,
      /'APAGAR'/
    )
    assert.doesNotMatch(
      bridgeSource,
      /window\.confirm/
    )
  }
)

test(
  'confirmed schedule reset removes downstream data and reopens setup without historical blockers',
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
      /lessons\.bulkDelete/
    )
    assert.match(
      resetSource,
      /summarySuggestions\.bulkDelete/
    )
    assert.match(
      resetSource,
      /lessonAttendance\.bulkDelete/
    )
    assert.match(
      resetSource,
      /lessonAssessments\.bulkDelete/
    )
    assert.match(
      resetSource,
      /assessmentResults\.bulkDelete/
    )
    assert.match(
      resetSource,
      /moduleFinalGrades\.bulkDelete/
    )
    assert.match(
      resetSource,
      /learningRecoveries\.bulkDelete/
    )
    assert.match(
      resetSource,
      /isDutyEvent\(event\)/
    )
    assert.match(
      resetSource,
      /setupCompletedAt: null/
    )
    assert.match(
      resetSource,
      /completedAt: null/
    )
    assert.match(
      resetSource,
      /step !== 'weekly_schedule'[\s\S]*step !== 'planifications'[\s\S]*step !== 'assessment_criteria'[\s\S]*step !== 'students'/
    )
    assert.doesNotMatch(
      resetSource,
      /linkedLessonCount|dutyWithRecordedWork/
    )
    assert.doesNotMatch(
      resetSource,
      /groups\.(?:delete|bulkDelete)|subjects\.(?:delete|bulkDelete)|teachingAssignments\.(?:delete|bulkDelete)|modules\.(?:delete|bulkDelete)/
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
