import type {
  EntityId,
  Lesson
} from '../types'
import type {
  ScheduledLessonCreationPlan
} from '../lessons/scheduledLessonReconciliation'
import type {
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

  const assignments =
    input.snapshot.assignments.map(
      row => ({
        ...row,
        nextLesson:
          futurePlannedLessons.find(
            lesson =>
              lesson.teachingAssignmentId ===
              row.assignment.id
          ) ??
          null
      })
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

  return {
    ...input.snapshot,
    totals: {
      ...input.snapshot.totals,
      plannedLessonCount:
        plannedLessons.length
    },
    assignments,
    upcomingLessons
  }
}
