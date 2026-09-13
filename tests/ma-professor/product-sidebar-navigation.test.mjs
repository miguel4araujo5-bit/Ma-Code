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
    '../../src/components/ma-professor/product/ManagementSidebarBridge.tsx',
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

test(
  'management sidebar replaces only the three legacy unavailable entries with real actions',
  () => {
    assert.match(
      bridgeSource,
      /button\[title="Em breve"\]/
    )
    assert.match(
      bridgeSource,
      /externalLabels\.has/
    )
    assert.match(
      bridgeSource,
      /Faltas e recuperações/
    )
    assert.match(
      bridgeSource,
      /Horários/
    )
    assert.match(
      bridgeSource,
      /Definições/
    )
    assert.match(
      bridgeSource,
      /data-management-external-nav=\{item\.id\}/
    )
    assert.match(
      bridgeSource,
      /createPortal/
    )
    assert.match(
      bridgeSource,
      /style\.setProperty\([\s\S]*'display'[\s\S]*'none'[\s\S]*'important'/
    )
    assert.match(
      legacyAppSource,
      /aria-label="Navegação do MA-Professor"/
    )
  }
)

test(
  'external sidebar actions open the existing attendance schedule and settings workspaces',
  () => {
    assert.match(
      menuSource,
      /<ManagementSidebarBridge[\s\S]*onOpenAttendance=\{\(\) => setSection\('attendance'\)\}[\s\S]*onOpenSchedule=\{\(\) => setSection\('schedule'\)\}[\s\S]*onOpenSettings=\{\(\) => setSection\('settings'\)\}/
    )
    assert.match(
      menuSource,
      /<AttendanceProductWorkspace academicYearId=\{academicYear\.id\}/
    )
    assert.match(
      menuSource,
      /<ScheduleProductWorkspace academicYearId=\{academicYear\.id\}/
    )
    assert.match(
      menuSource,
      /<SettingsWorkspaceView[\s\S]*academicYearId=\{academicYear\?\.id \?\? null\}/
    )
  }
)

test(
  'the bridge restores hidden legacy buttons when the management workspace unmounts',
  () => {
    assert.match(
      bridgeSource,
      /currentTarget\?\.hiddenButtons \?\? \[\]/
    )
    assert.match(
      bridgeSource,
      /button\.hidden = false/
    )
  }
)

test(
  'the MA-Code logo stays in the global product bar and opens the complete sidebar drawer',
  () => {
    assert.match(productNavigationSource, /aria-label=\"Abrir navegação completa do MA-Professor\"/)
    assert.match(productNavigationSource, /src=\"\/ma-code\.png\"/)
    assert.match(productNavigationSource, /sidebarOpen[\s\S]*role=\"dialog\"[\s\S]*aria-label=\"Navegação completa do MA-Professor\"/)
    for (const label of ['Painel', 'Calendário', 'Sumários / GIAE', 'Avaliações', 'Planificações', 'Turmas e alunos', 'Faltas e recuperações', 'Horários', 'Definições']) {
      assert.ok(productNavigationSource.includes(label), `missing global drawer entry: ${label}`)
    }
  }
)

test(
  'global sidebar destinations reuse existing workspaces instead of duplicating screens',
  () => {
    assert.match(productSource, /handleSidebarDestination[\s\S]*destination ===[\s\S]*'calendar'[\s\S]*handleSelect/)
    assert.match(productSource, /setMenuNavigationRequest\([\s\S]*target:[\s\S]*destination[\s\S]*setWorkspace\([\s\S]*'menu'/)
    assert.match(productSource, /navigationRequest=\{[\s\S]*menuNavigationRequest/)
    assert.match(menuSource, /isManagementWorkspaceTarget[\s\S]*setSection\('management'\)/)
    assert.match(menuSource, /<MAProfessorApp[\s\S]*workspaceRequest=/)
    assert.match(legacyAppSource, /handleWorkspaceChange\([\s\S]*workspaceRequest\.workspace/)
  }
)

test(
  'opening the global sidebar from Daily preserves the unsaved-work navigation guard',
  () => {
    assert.match(productSource, /handleSidebarDestination[\s\S]*workspace ===[\s\S]*'daily'[\s\S]*dailyNavigationGuardRef\.current/)
    assert.match(productSource, /if \(!canLeave\) \{[\s\S]*return/)
  }
)

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
