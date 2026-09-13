import type {
  EntityId,
  Lesson,
  ModuleUnit
} from '../types'
import type {
  ScheduledLessonCreationPlan
} from '../lessons/scheduledLessonReconciliation'
import type {
  DashboardAssignmentRow,
  DashboardLessonRow,
  DashboardSnapshot
} from './dashboardRepositoryBase'

export interface DashboardFutureAgendaProjectionInput {
  snapshot: DashboardSnapshot
  lessons: Lesson[]
  createLessons: ScheduledLessonCreationPlan[]
  deleteLessonIds: Iterable<EntityId>
}

const MAX_UPCOMING_LESSONS = 8

type RegularAnnualModule =
  ModuleUnit & {
    moduleKind?: 'regular_annual'
  }

function isRegularAnnualModule(
  module: ModuleUnit
) {
  return (
    module as RegularAnnualModule
  ).moduleKind ===
    'regular_annual'
}

function projectedLessonId(
  draft: ScheduledLessonCreationPlan
) {
  return `dashboard-projected-${draft.scheduleSlotId}-${draft.date}-${draft.startTime.replace(':', '')}`
}

function createProjectedLesson(
  draft: ScheduledLessonCreationPlan,
  timestamp: string
): Lesson {
  return {
    ...draft,
    id: projectedLessonId(
      draft
    ),
    giaeStatus: 'pending',
    giaeSubmittedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function sortLessons(
  lessons: Lesson[]
) {
  return [...lessons].sort(
    (left, right) =>
      left.date.localeCompare(
        right.date
      ) ||
      left.startTime.localeCompare(
        right.startTime
      ) ||
      left.id.localeCompare(
        right.id
      )
  )
}

function sumPeriods(
  lessons: Lesson[]
) {
  return lessons.reduce(
    (total, lesson) =>
      total + lesson.periodCount,
    0
  )
}

function completionPercent(
  taught: number,
  planned: number
) {
  if (planned <= 0) {
    return 0
  }

  return Math.round(
    Math.min(
      100,
      Math.max(
        0,
        taught / planned * 100
      )
    ) * 100
  ) / 100
}

function applyRegularAnnualProgress(
  row: DashboardAssignmentRow,
  effectiveLessons: Lesson[]
): DashboardAssignmentRow {
  const regularModuleRow =
    row.modules.find(
      item =>
        isRegularAnnualModule(
          item.module
        )
    )

  if (!regularModuleRow) {
    return row
  }

  const progressLessons =
    effectiveLessons.filter(
      lesson =>
        lesson.teachingAssignmentId ===
          row.assignment.id &&
        lesson.moduleId ===
          regularModuleRow.module.id &&
        lesson.status !==
          'cancelled' &&
        lesson.countTowardProgress
    )

  const periodsPlanned =
    sumPeriods(
      progressLessons
    )

  const periodsTaught =
    sumPeriods(
      progressLessons.filter(
        lesson =>
          lesson.status ===
          'taught'
      )
    )

  const periodsRemaining =
    Math.max(
      0,
      periodsPlanned -
        periodsTaught
    )

  const percent =
    completionPercent(
      periodsTaught,
      periodsPlanned
    )

  const estimatedCompletionDate =
    sortLessons(
      progressLessons
    ).at(-1)?.date ??
    null

  const annualProgress = {
    moduleId:
      regularModuleRow.module.id,
    periodsTaught,
    periodsRemaining,
    completionPercent:
      percent,
    estimatedCompletionDate
  }

  const modules =
    row.modules.map(
      item =>
        item.module.id ===
          regularModuleRow.module.id
          ? {
              ...item,
              progress:
                annualProgress
            }
          : item
    )

  return {
    ...row,
    modules,
    periodsPlanned,
    periodsTaught,
    periodsRemaining,
    completionPercent:
      percent,
    currentModuleProgress:
      row.currentModule?.id ===
        regularModuleRow.module.id
        ? annualProgress
        : row.currentModuleProgress
  }
}

export function applyDashboardFutureAgendaProjection(
  input: DashboardFutureAgendaProjectionInput
): DashboardSnapshot {
  const deleteLessonIds =
    new Set(
      input.deleteLessonIds
    )

  const projectedLessons =
    input.createLessons.map(
      draft =>
        createProjectedLesson(
          draft,
          input.snapshot.generatedAt
        )
    )

  const assignmentRowById =
    new Map(
      input.snapshot.assignments.map(
        row => [
          row.assignment.id,
          row
        ]
      )
    )

  const moduleById =
    new Map(
      input.snapshot.assignments.flatMap(
        row =>
          row.modules.map(
            moduleRow => [
              moduleRow.module.id,
              moduleRow.module
            ] as const
          )
      )
    )

  const effectiveLessons =
    [
      ...input.lessons.filter(
        lesson =>
          !deleteLessonIds.has(
            lesson.id
          )
      ),
      ...projectedLessons
    ].filter(
      lesson =>
        assignmentRowById.has(
          lesson.teachingAssignmentId
        ) &&
        moduleById.has(
          lesson.moduleId
        )
    )

  const plannedLessons =
    sortLessons(
      effectiveLessons.filter(
        lesson =>
          lesson.status ===
          'planned'
      )
    )

  const futurePlannedLessons =
    plannedLessons.filter(
      lesson =>
        lesson.date >=
        input.snapshot.referenceDate
    )

  const hasRegularAnnualProgress =
    input.snapshot.assignments.some(
      row =>
        row.modules.some(
          item =>
            isRegularAnnualModule(
              item.module
            )
        )
    )

  const assignments =
    input.snapshot.assignments.map(
      row => {
        const withAnnualProgress =
          applyRegularAnnualProgress(
            row,
            effectiveLessons
          )

        return {
          ...withAnnualProgress,
          nextLesson:
            futurePlannedLessons.find(
              lesson =>
                lesson.teachingAssignmentId ===
                row.assignment.id
            ) ??
            null
        }
      }
    )

  const updatedAssignmentRowById =
    new Map(
      assignments.map(
        row => [
          row.assignment.id,
          row
        ]
      )
    )

  const upcomingLessons:
    DashboardLessonRow[] =
    futurePlannedLessons
      .flatMap(
        lesson => {
          const assignmentRow =
            updatedAssignmentRowById.get(
              lesson.teachingAssignmentId
            )

          const module =
            moduleById.get(
              lesson.moduleId
            )

          if (
            !assignmentRow ||
            !module
          ) {
            return []
          }

          return [
            {
              lesson,
              assignment:
                assignmentRow.assignment,
              group:
                assignmentRow.group,
              subject:
                assignmentRow.subject,
              module
            }
          ]
        }
      )
      .slice(
        0,
        MAX_UPCOMING_LESSONS
      )

  const periodsPlanned =
    hasRegularAnnualProgress
      ? assignments.reduce(
          (total, row) =>
            total +
            row.periodsPlanned,
          0
        )
      : input.snapshot.totals.periodsPlanned

  const periodsTaught =
    hasRegularAnnualProgress
      ? assignments.reduce(
          (total, row) =>
            total +
            row.periodsTaught,
          0
        )
      : input.snapshot.totals.periodsTaught

  const periodsRemaining =
    hasRegularAnnualProgress
      ? assignments.reduce(
          (total, row) =>
            total +
            row.periodsRemaining,
          0
        )
      : input.snapshot.totals.periodsRemaining

  return {
    ...input.snapshot,
    totals: {
      ...input.snapshot.totals,
      periodsPlanned,
      periodsTaught,
      periodsRemaining,
      completionPercent:
        hasRegularAnnualProgress
          ? completionPercent(
              periodsTaught,
              periodsPlanned
            )
          : input.snapshot.totals
              .completionPercent,
      plannedLessonCount:
        plannedLessons.length
    },
    assignments,
    upcomingLessons
  }
}
