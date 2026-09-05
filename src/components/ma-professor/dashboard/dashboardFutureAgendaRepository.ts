import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import type {
  EntityId,
  Lesson
} from '../types'
import {
  planScheduledLessonReconciliation
} from '../lessons/scheduledLessonReconciliation'
import type {
  DashboardSnapshot
} from './dashboardRepositoryBase'
import {
  applyDashboardFutureAgendaProjection
} from './dashboardFutureAgenda'

export class DashboardFutureAgendaRepository {
  async project(
    snapshot: DashboardSnapshot
  ): Promise<DashboardSnapshot> {
    await openMAProfessorDatabase()

    const academicYearId =
      snapshot.academicYear.id

    const [
      assignments,
      slots,
      modules,
      events,
      lessons,
      attendanceRows,
      assessments,
      suggestions,
      planificationItems
    ] = await Promise.all([
      maProfessorDb.teachingAssignments
        .where('academicYearId')
        .equals(academicYearId)
        .toArray(),
      maProfessorDb.weeklyScheduleSlots
        .where('academicYearId')
        .equals(academicYearId)
        .toArray(),
      maProfessorDb.modules
        .where('academicYearId')
        .equals(academicYearId)
        .toArray(),
      maProfessorDb.schoolCalendarEvents
        .where('academicYearId')
        .equals(academicYearId)
        .toArray(),
      maProfessorDb.lessons
        .where('academicYearId')
        .equals(academicYearId)
        .toArray(),
      maProfessorDb.lessonAttendance
        .toArray(),
      maProfessorDb.lessonAssessments
        .where('academicYearId')
        .equals(academicYearId)
        .toArray(),
      maProfessorDb.summarySuggestions
        .toArray(),
      maProfessorDb.planificationItems
        .toArray()
    ])

    const academicYearLessonIds =
      new Set(
        lessons.map(
          lesson => lesson.id
        )
      )

    const relatedLessonIds =
      new Set<EntityId>()

    attendanceRows.forEach(
      row => {
        if (
          academicYearLessonIds.has(
            row.lessonId
          )
        ) {
          relatedLessonIds.add(
            row.lessonId
          )
        }
      }
    )

    assessments.forEach(
      assessment => {
        relatedLessonIds.add(
          assessment.lessonId
        )
      }
    )

    suggestions.forEach(
      suggestion => {
        if (
          academicYearLessonIds.has(
            suggestion.lessonId
          )
        ) {
          relatedLessonIds.add(
            suggestion.lessonId
          )
        }
      }
    )

    planificationItems.forEach(
      item => {
        if (
          item.usedLessonId &&
          academicYearLessonIds.has(
            item.usedLessonId
          )
        ) {
          relatedLessonIds.add(
            item.usedLessonId
          )
        }
      }
    )

    const plan =
      planScheduledLessonReconciliation({
        academicYear:
          snapshot.academicYear,
        assignments,
        slots,
        modules,
        events,
        lessons:
          lessons as Lesson[],
        relatedLessonIds,
        dateFrom:
          snapshot.academicYear.startDate,
        dateTo:
          snapshot.academicYear.endDate
      })

    return applyDashboardFutureAgendaProjection({
      snapshot,
      lessons:
        lessons as Lesson[],
      createLessons:
        plan.createLessons,
      deleteLessonIds:
        plan.deleteLessonIds
    })
  }
}

export const dashboardFutureAgendaRepository =
  new DashboardFutureAgendaRepository()
