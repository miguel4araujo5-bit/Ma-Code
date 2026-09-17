import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const progressSource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/ufcdProgress.ts',
    import.meta.url
  ),
  'utf8'
)

const dashboardSource = await readFile(
  new URL(
    '../../src/components/ma-professor/dashboard/dashboardRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const calendarSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/calendarWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const extraLessonSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/extraLessonRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const noticeSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyUfcdProgressNotice.tsx',
    import.meta.url
  ),
  'utf8'
)

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )

  assert.equal(errors.length, 0)

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

async function loadProgress() {
  return import(
    transpile(progressSource)
  )
}

function moduleUnit(
  id,
  order,
  plannedPeriods
) {
  return {
    id,
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    code: `UFCD-${order}`,
    name: `UFCD ${order}`,
    plannedPeriods,
    order,
    plannedStartDate: null,
    plannedEndDate: null,
    active: true,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z'
  }
}

function lesson({
  id,
  date,
  moduleId = 'module-1',
  status = 'taught',
  giaeStatus = 'pending',
  countTowardProgress = true,
  periodCount = 1,
  startTime = '09:00'
}) {
  return {
    id,
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId,
    scheduleSlotId: 'slot-1',
    origin: 'scheduled',
    status,
    date,
    startTime,
    endTime: '10:00',
    periodCount,
    countTowardProgress,
    plannedActivity: '',
    summary: status === 'taught' ? 'Sumário.' : '',
    summarySource: 'manual',
    planificationItemIds: [],
    giaeStatus,
    giaeSubmittedAt:
      giaeStatus === 'submitted'
        ? `${date}T10:00:00.000Z`
        : null,
    notes: '',
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`
  }
}

test(
  'today and past taught lessons count immediately, while future lessons require the GIAE check',
  async () => {
    const progress = await loadProgress()
    const today = '2026-09-16'

    assert.equal(
      progress.lessonCountsTowardUfcdProgress(
        lesson({
          id: 'past',
          date: '2026-09-15'
        }),
        today
      ),
      true
    )

    assert.equal(
      progress.lessonCountsTowardUfcdProgress(
        lesson({
          id: 'today',
          date: today
        }),
        today
      ),
      true
    )

    assert.equal(
      progress.lessonCountsTowardUfcdProgress(
        lesson({
          id: 'future-pending',
          date: '2026-09-17'
        }),
        today
      ),
      false
    )

    assert.equal(
      progress.lessonCountsTowardUfcdProgress(
        lesson({
          id: 'future-submitted',
          date: '2026-09-17',
          giaeStatus: 'submitted'
        }),
        today
      ),
      true
    )
  }
)

test(
  'planned, cancelled and explicitly non-progress lessons never validate UFCD progress',
  async () => {
    const progress = await loadProgress()
    const today = '2026-09-16'

    for (const candidate of [
      lesson({
        id: 'planned',
        date: today,
        status: 'planned'
      }),
      lesson({
        id: 'cancelled',
        date: today,
        status: 'cancelled'
      }),
      lesson({
        id: 'no-progress',
        date: today,
        countTowardProgress: false
      })
    ]) {
      assert.equal(
        progress.lessonCountsTowardUfcdProgress(
          candidate,
          today
        ),
        false
      )
    }
  }
)

test(
  'the current UFCD advances only when the previous UFCD reaches its validated duration',
  async () => {
    const progress = await loadProgress()
    const today = '2026-09-16'
    const modules = [
      moduleUnit('module-1', 1, 2),
      moduleUnit('module-2', 2, 2)
    ]

    const oneValidatedLesson = [
      lesson({
        id: 'lesson-1',
        date: today,
        moduleId: 'module-1'
      })
    ]

    const firstProgress =
      progress.buildUfcdModuleProgress(
        modules,
        oneValidatedLesson,
        today
      )

    assert.equal(
      progress.selectCurrentUfcd(
        modules,
        firstProgress
      )?.id,
      'module-1'
    )

    const completedFirstUfcd =
      progress.buildUfcdModuleProgress(
        modules,
        [
          ...oneValidatedLesson,
          lesson({
            id: 'lesson-2',
            date: today,
            moduleId: 'module-1',
            startTime: '11:00'
          }),
          lesson({
            id: 'future-pending',
            date: '2026-09-17',
            moduleId: 'module-2'
          })
        ],
        today
      )

    assert.equal(
      progress.selectCurrentUfcd(
        modules,
        completedFirstUfcd
      )?.id,
      'module-2'
    )

    assert.equal(
      completedFirstUfcd.find(
        row => row.moduleId === 'module-2'
      )?.periodsTaught,
      0,
      'A aula futura sem visto GIAE não deve avançar a segunda UFCD.'
    )
  }
)

test(
  'dashboard, diary and extra lessons all use the central validated-progress rule',
  () => {
    assert.match(
      dashboardSource,
      /applyActualProgressToDashboard/
    )
    assert.match(
      calendarSource,
      /ensureLessonUsesCurrentUfcd\([\s\S]*lessonId/
    )
    assert.ok(
      calendarSource.indexOf(
        'ensureLessonUsesCurrentUfcd('
      ) <
      calendarSource.indexOf(
        'super.getLessonEditorContext('
      )
    )
    assert.match(
      extraLessonSource,
      /lessonCountsTowardUfcdProgress/
    )
  }
)

test(
  'the Daily summary shows validated time progress and the final evaluation reminders',
  () => {
    assert.match(
      noticeSource,
      /buildUfcdModuleProgress/
    )
    assert.match(
      noticeSource,
      /snapshot\.periodsRemaining <= 5/
    )
    assert.match(
      noticeSource,
      /já tem elementos necessários para a avaliação\?/
    )
    assert.match(
      noticeSource,
      /Realizar auto e heteroavaliação/
    )
    assert.match(
      noticeSource,
      /createPortal/
    )
  }
)
