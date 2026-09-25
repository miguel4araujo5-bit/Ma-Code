import { maProfessorDb } from '../db'
import type { Planification, PlanificationItem } from '../types'

// Called inside the caller's transaction, including lessons and both planning tables.
// Existing lessons keep their exact item IDs, including future reservations.
export async function removePlanificationPreservingLessons(
  planification: Planification,
  items: PlanificationItem[]
) {
  const itemIds = new Set(items.map(item => item.id))
  const linkedByUsage = items.some(item =>
    item.status === 'used' || Boolean(item.usedLessonId) || Boolean(item.usedAt)
  )
  const linkedByLesson = itemIds.size > 0 &&
    (await maProfessorDb.lessons.toArray()).some(lesson =>
      (lesson.planificationItemIds ?? []).some(id => itemIds.has(id))
    )

  if (linkedByUsage || linkedByLesson) {
    await maProfessorDb.planifications.put({
      ...planification,
      active: false,
      updatedAt: new Date().toISOString()
    })
    return
  }

  await maProfessorDb.planificationItems.bulkDelete([...itemIds])
  await maProfessorDb.planifications.delete(planification.id)
}
