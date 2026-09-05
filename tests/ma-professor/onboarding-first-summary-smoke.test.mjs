import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

import {
  DailyWorkspaceRepository,
  lessonDraft,
  loadLesson,
  resetDailyState
} from './daily-workflow-harness.mjs'

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

  assert.equal(
    errors.length,
    0,
    errors.map(item =>
      ts.flattenDiagnosticMessageText(
        item.messageText,
        '\n'
      )
    ).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const preparationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyScheduledLessonPreparation.ts',
    import.meta.url
  ),
  'utf8'
)

globalThis.__materializeFirstSummarySmokeLesson = date => {
  const daily = globalThis.__dailyState

  if (
    daily.lesson &&
    daily.lesson.date === date &&
    daily.lesson.teachingAssignmentId === 'assignment-1' &&
    daily.lesson.startTime === '09:00'
  ) {
    return false
  }

  daily.lesson = {
    id: 'lesson-1',
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-1',
    date,
    origin: 'scheduled',
    scheduleSlotId: 'schedule-1',
    status: 'planned',
    startTime: '09:00',
    endTime: '10:00',
    periodCount: 1,
    countTowardProgress: true,
    plannedActivity: '',
    summary: '',
    summarySource: 'manual',
    planificationItemIds: [],
    notes: '',
    giaeStatus: 'pending',
    giaeSubmittedAt: null,
    updatedAt: 'v1'
  }

  return true
}

const initialCalendarUrl = transpile(`
  export async function ensureInitialSchoolCalendar2026_2027(academicYearId) {
    const smoke = globalThis.__firstSummarySmoke
    smoke.sBentoCalls += 1

    let createdLessons = 0

    if (smoke.sBentoApplied) {
      createdLessons = globalThis.__materializeFirstSummarySmokeLesson(
        smoke.date
      ) ? 1 : 0
    }

    return {
      applied: smoke.sBentoApplied,
      createdEvents: 0,
      updatedScheduleSlots: 0,
      createdLessons,
      skippedExistingLessons: createdLessons ? 0 : 1
    }
  }
`)

const reconciliationRepositoryUrl = transpile(`
  export const scheduledLessonReconciliationRepository = {
    async reconcile(input) {
      const smoke = globalThis.__firstSummarySmoke
      smoke.genericCalls.push(structuredClone(input))

      const created = globalThis.__materializeFirstSummarySmokeLesson(
        input.dateFrom
      )

      return {
        deletedLessonIds: [],
        createdLessonIds: created ? ['lesson-1'] : [],
        preservedLessonIds: created ? [] : ['lesson-1'],
        skippedWithoutModule: 0,
        createdOutsidePlannedCapacity: 0
      }
    }
  }
`)

const repositoryUrl = transpile(`
  export const maProfessorRepository = {
    async getAcademicYear(academicYearId) {
      const smoke = globalThis.__firstSummarySmoke
      return smoke.academicYear.id === academicYearId
        ? structuredClone(smoke.academicYear)
        : null
    },
    async getTeacherProfile() {
      return {
        id: 'teacher-1',
        displayName: 'Professor de teste',
        schoolName: globalThis.__firstSummarySmoke.schoolName
      }
    }
  }
`)

const schoolPolicyUrl = transpile(`
  export function isSBentoSchoolName() {
    return Boolean(globalThis.__firstSummarySmoke.isSBento)
  }
`)

const preparationRuntime = preparationSource
  .replaceAll(
    "'../calendar/initialSchoolCalendar2026_2027'",
    `'${initialCalendarUrl}'`
  )
  .replaceAll(
    "'../lessons/scheduledLessonReconciliationRepository'",
    `'${reconciliationRepositoryUrl}'`
  )
  .replaceAll(
    "'../repository'",
    `'${repositoryUrl}'`
  )
  .replaceAll(
    "'../setup/schoolDutyDatePolicy'",
    `'${schoolPolicyUrl}'`
  )

const preparationModule = await import(
  transpile(preparationRuntime)
)

const {
  ensureDailyScheduledLessonsForDate
} = preparationModule

function resetScenario({
  schoolName,
  isSBento,
  sBentoApplied
}) {
  const daily = resetDailyState()
  daily.lesson = null
  daily.scheduleSlots = [
    {
      id: 'schedule-1',
      academicYearId: 'year-1',
      teachingAssignmentId: 'assignment-1',
      weekday: 1,
      startTime: '09:00',
      endTime: '10:00',
      periodCount: 1,
      validFrom: '2026-09-01',
      validUntil: '2027-08-31',
      active: true
    }
  ]

  globalThis.__firstSummarySmoke = {
    date: '2026-09-07',
    schoolName,
    isSBento,
    sBentoApplied,
    sBentoCalls: 0,
    genericCalls: [],
    academicYear: {
      id: 'year-1',
      name: '2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      active: true
    }
  }

  return {
    daily,
    smoke: globalThis.__firstSummarySmoke
  }
}

async function saveAndReopenFirstSummary(summary) {
  const repository =
    new DailyWorkspaceRepository()

  const opened =
    await loadLesson(repository)

  assert.equal(
    opened.context.lessonRow.lesson.origin,
    'scheduled'
  )
  assert.equal(
    opened.context.lessonRow.lesson.scheduleSlotId,
    'schedule-1'
  )
  assert.equal(
    opened.context.lessonRow.lesson.status,
    'planned'
  )

  await repository.saveLesson(
    lessonDraft({ summary })
  )

  const reopened =
    await loadLesson(
      new DailyWorkspaceRepository()
    )

  assert.equal(
    reopened.context.lessonRow.lesson.summary,
    summary
  )
  assert.equal(
    reopened.context.lessonRow.lesson.status,
    'taught'
  )
  assert.equal(
    reopened.context.lessonRow.lesson.origin,
    'scheduled'
  )
  assert.equal(
    reopened.context.lessonRow.lesson.scheduleSlotId,
    'schedule-1'
  )
}

test(
  'Outra escola: operational schedule reaches a persisted first summary without duplicate lesson creation',
  { concurrency: false },
  async () => {
    const {
      daily,
      smoke
    } = resetScenario({
      schoolName: 'Escola Secundária de Teste',
      isSBento: false,
      sBentoApplied: false
    })

    await ensureDailyScheduledLessonsForDate(
      'year-1',
      smoke.date
    )

    assert.equal(
      smoke.sBentoCalls,
      0
    )
    assert.equal(
      smoke.genericCalls.length,
      1
    )
    assert.deepEqual(
      smoke.genericCalls[0],
      {
        academicYearId: 'year-1',
        dateFrom: smoke.date,
        dateTo: smoke.date
      }
    )
    assert.equal(
      daily.lesson.id,
      'lesson-1'
    )

    const firstLessonReference =
      daily.lesson

    await ensureDailyScheduledLessonsForDate(
      'year-1',
      smoke.date
    )

    assert.equal(
      smoke.genericCalls.length,
      2
    )
    assert.equal(
      daily.lesson,
      firstLessonReference,
      'Reabrir o mesmo dia não deve substituir a aula já materializada.'
    )

    await saveAndReopenFirstSummary(
      'Primeiro sumário guardado noutra escola.'
    )
  }
)

test(
  'S. Bento: preset preparation runs before Daily and the first summary persists after reopening',
  { concurrency: false },
  async () => {
    const {
      daily,
      smoke
    } = resetScenario({
      schoolName:
        'Agrupamento de Escolas de S. Bento, Vizela',
      isSBento: true,
      sBentoApplied: true
    })

    await ensureDailyScheduledLessonsForDate(
      'year-1',
      smoke.date
    )

    assert.equal(
      smoke.sBentoCalls,
      1
    )
    assert.equal(
      smoke.genericCalls.length,
      0,
      'Na primeira preparação aplicada de S. Bento, o helper deve aguardar o preset e regressar sem uma segunda reconciliação.'
    )
    assert.equal(
      daily.lesson.id,
      'lesson-1'
    )

    await saveAndReopenFirstSummary(
      'Primeiro sumário guardado em S. Bento.'
    )
  }
)
