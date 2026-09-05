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
  isPristineScheduledLesson,
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

async function deleteLessonIfStillPristine(
  lessonId: EntityId
) {
  return maProfessorDb.transaction(
    'rw',
    [
      maProfessorDb.lessons,
      maProfessorDb.lessonAttendance,
      maProfessorDb.lessonAssessments,
      maProfessorDb.summarySuggestions,
      maProfessorDb.planificationItems
    ],
    async () => {
      const lesson =
        await maProfessorDb.lessons.get(
          lessonId
        )

      if (!lesson) {
        return true
      }

      const [
        attendanceCount,
        assessmentCount,
        suggestionCount,
        planificationItems
      ] = await Promise.all([
        maProfessorDb.lessonAttendance
          .where('lessonId')
          .equals(lessonId)
          .count(),
        maProfessorDb.lessonAssessments
          .where('lessonId')
          .equals(lessonId)
          .count(),
        maProfessorDb.summarySuggestions
          .where('lessonId')
          .equals(lessonId)
          .count(),
        maProfessorDb.planificationItems
          .toArray()
      ])

      const hasRelatedData =
        attendanceCount > 0 ||
        assessmentCount > 0 ||
        suggestionCount > 0 ||
        planificationItems.some(
          item =>
            item.usedLessonId ===
            lessonId
        )

      if (
        !isPristineScheduledLesson(
          lesson,
          hasRelatedData
        )
      ) {
        return false
      }

      await maProfessorDb.lessons.delete(
        lessonId
      )

      return true
    }
  )
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
      suggestions,
      planificationItems
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
        await deleteLessonIfStillPristine(
          lessonId
        )

      if (deleted) {
        deletedLessonIds.push(
          lessonId
        )
      }
    }

    if (
      deletedLessonIds.length !==
      plan.deleteLessonIds.length
    ) {
      return {
        deletedLessonIds,
        createdLessonIds: [],
        preservedLessonIds: [
          ...new Set([
            ...plan.preservedLessonIds,
            ...plan.deleteLessonIds.filter(
              lessonId =>
                !deletedLessonIds.includes(
                  lessonId
                )
            )
          ])
        ],
        skippedWithoutModule:
          plan.skippedWithoutModule,
        createdOutsidePlannedCapacity:
          plan.createdOutsidePlannedCapacity
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
