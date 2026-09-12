import type {
  EntityId,
  Lesson,
  PlanificationItem
} from '../types'

export function getReservedPlanificationItemIds(
  lessons: Lesson[],
  moduleId: EntityId,
  ignoredLessonId?: EntityId
) {
  const reservedIds =
    new Set<EntityId>()

  lessons.forEach(
    lesson => {
      if (
        lesson.moduleId !== moduleId ||
        lesson.status !== 'planned' ||
        lesson.id === ignoredLessonId
      ) {
        return
      }

      lesson.planificationItemIds.forEach(
        itemId => {
          reservedIds.add(itemId)
        }
      )
    }
  )

  return reservedIds
}

export function findPlanificationReservationConflict(
  lessons: Lesson[],
  moduleId: EntityId,
  planificationItemIds: EntityId[],
  ignoredLessonId?: EntityId
) {
  if (planificationItemIds.length === 0) {
    return null
  }

  const selectedIds =
    new Set(planificationItemIds)

  return (
    lessons.find(
      lesson =>
        lesson.moduleId === moduleId &&
        lesson.status === 'planned' &&
        lesson.id !== ignoredLessonId &&
        lesson.planificationItemIds.some(
          itemId =>
            selectedIds.has(itemId)
        )
    ) ?? null
  )
}

export function selectNextAvailablePlanificationItem(
  items: PlanificationItem[],
  reservedIds: ReadonlySet<EntityId>
) {
  return (
    items
      .filter(
        item =>
          item.status === 'planned' &&
          !item.usedLessonId &&
          !reservedIds.has(item.id)
      )
      .sort(
        (
          left,
          right
        ) =>
          left.order - right.order
      )[0] ?? null
  )
}
