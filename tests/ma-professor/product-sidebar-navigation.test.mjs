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
  'schedule import reset removes only schedule data and refuses destructive historical cleanup',
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
      /step !== 'weekly_schedule'/
    )
    assert.doesNotMatch(
      resetSource,
      /groups\.(?:delete|bulkDelete)|subjects\.(?:delete|bulkDelete)|teachingAssignments\.(?:delete|bulkDelete)|planifications\.(?:delete|bulkDelete)/
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
