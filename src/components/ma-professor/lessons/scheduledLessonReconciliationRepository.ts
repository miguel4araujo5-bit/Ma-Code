import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import type {
  EntityId,
  ISODate
} from '../types'
import {
  lessonRepository
} from './lessonRepository'
import {
  planScheduledLessonReconciliation
} from './scheduledLessonReconciliation'

export interface ScheduledLessonReconciliationInput {
  academicYearId: EntityId
  dateFrom: ISODate
  dateTo: ISODate
}

export interface ScheduledLessonReconciliationResult {
  deletedLessonIds: EntityId[]
  createdLessonIds: EntityId[]
  preservedLessonIds: EntityId[]
  skippedWithoutModule: number
  createdOutsidePlannedCapacity: number
}

function assertDateRange(
  dateFrom: ISODate,
  dateTo: ISODate
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateFrom
    ) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateTo
    ) ||
    dateFrom > dateTo
  ) {
    throw new Error(
      'O intervalo de reconciliação das aulas não é válido.'
    )
  }
}

export class ScheduledLessonReconciliationRepository {
  async reconcile(
    input: ScheduledLessonReconciliationInput
  ): Promise<ScheduledLessonReconciliationResult> {
    await openMAProfessorDatabase()

    assertDateRange(
      input.dateFrom,
      input.dateTo
    )

    const academicYear =
      await maProfessorDb.academicYears.get(
        input.academicYearId
      )

    if (!academicYear) {
      throw new Error(
        'O ano letivo indicado não existe.'
      )
    }

    if (
      input.dateFrom <
        academicYear.startDate ||
      input.dateTo >
        academicYear.endDate
    ) {
      throw new Error(
        'O intervalo de reconciliação deve ficar dentro do ano letivo.'
      )
    }

    const [
      assignments,
      slots,
      modules,
      events,
      lessons,
      attendanceRows,
      assessments,
      suggestions
    ] = await Promise.all([
      maProfessorDb.teachingAssignments
        .where('academicYearId')
        .equals(input.academicYearId)
        .toArray(),
      maProfessorDb.weeklyScheduleSlots
        .where('academicYearId')
        .equals(input.academicYearId)
        .toArray(),
      maProfessorDb.modules
        .where('academicYearId')
        .equals(input.academicYearId)
        .toArray(),
      maProfessorDb.schoolCalendarEvents
        .where('academicYearId')
        .equals(input.academicYearId)
        .toArray(),
      maProfessorDb.lessons
        .where('academicYearId')
        .equals(input.academicYearId)
        .toArray(),
      maProfessorDb.lessonAttendance
        .toArray(),
      maProfessorDb.lessonAssessments
        .where('academicYearId')
        .equals(input.academicYearId)
        .toArray(),
      maProfessorDb.summarySuggestions
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

    const plan =
      planScheduledLessonReconciliation({
        academicYear,
        assignments,
        slots,
        modules,
        events,
        lessons,
        relatedLessonIds,
        dateFrom:
          input.dateFrom,
        dateTo:
          input.dateTo
      })

    const deletedLessonIds:
      EntityId[] = []

    for (
      const lessonId of
      plan.deleteLessonIds
    ) {
      const deleted =
        await lessonRepository.deletePlannedLesson(
          lessonId
        )

      if (deleted) {
        deletedLessonIds.push(
          lessonId
        )
      }
    }

    const createdLessonIds:
      EntityId[] = []

    for (
      const draft of
      plan.createLessons
    ) {
      const lesson =
        await lessonRepository.createLesson(
          draft
        )

      createdLessonIds.push(
        lesson.id
      )
    }

    return {
      deletedLessonIds,
      createdLessonIds,
      preservedLessonIds:
        plan.preservedLessonIds,
      skippedWithoutModule:
        plan.skippedWithoutModule,
      createdOutsidePlannedCapacity:
        plan.createdOutsidePlannedCapacity
    }
  }
}

export const scheduledLessonReconciliationRepository =
  new ScheduledLessonReconciliationRepository()
