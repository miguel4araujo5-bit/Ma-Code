import {
  maProfessorDb
} from '../db'

import {
  findPlanificationReservationConflict,
  getReservedPlanificationItemIds,
  selectNextAvailablePlanificationItem
} from '../planifications/planificationItemReservation'

import type {
  EntityId
} from '../types'

import {
  LessonRepository as BaseLessonRepository
} from './lessonRepositoryBase'

import type {
  LessonChanges,
  LessonDraft,
  LessonUpdateOptions
} from './lessonRepositoryBase'

import {
  assertLessonHistoricalDateChangeAllowed,
  assertLessonHistoricalModuleChangeAllowed
} from './lessonHistoricalEditSafety'

import {
  assertLessonNotTaughtInFuture,
  resolveLessonStatusForDate
} from './lessonTemporalSafety'

export type {
  LessonDraft,
  LessonChanges,
  LessonUpdateOptions,
  LessonFilters,
  ScheduledLessonGenerationInput,
  ScheduledLessonGenerationResult,
  PreviousLessonTemplate
} from './lessonRepositoryBase'

export {
  formatLessonSummaryForGIAE,
  formatLessonsForBulkGIAE
} from './lessonRepositoryBase'

async function assertPlanificationItemsAvailable(
  moduleId: EntityId,
  planificationItemIds: EntityId[],
  ignoredLessonId?: EntityId
) {
  if (planificationItemIds.length === 0) {
    return
  }

  const moduleLessons =
    await maProfessorDb.lessons
      .where(
        'moduleId'
      )
      .equals(
        moduleId
      )
      .toArray()

  const conflict =
    findPlanificationReservationConflict(
      moduleLessons,
      moduleId,
      planificationItemIds,
      ignoredLessonId
    )

  if (conflict) {
    throw new Error(
      'Um dos conteúdos da planificação já está reservado noutra aula planeada.'
    )
  }
}

export class LessonRepository
  extends BaseLessonRepository {
  override async createLesson(
    input: LessonDraft
  ) {
    await this.initialize()

    const requestedStatus =
      input.status ?? 'planned'

    const safeInput: LessonDraft = {
      ...input,
      status:
        resolveLessonStatusForDate(
          input.date,
          requestedStatus
        )
    }

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.tables,
      async () => {
        if (
          safeInput.status !== 'cancelled'
        ) {
          await assertPlanificationItemsAvailable(
            safeInput.moduleId,
            safeInput.planificationItemIds ?? []
          )
        }

        return super.createLesson(
          safeInput
        )
      }
    )
  }

  override async updateLesson(
    id: EntityId,
    changes: LessonChanges,
    options: LessonUpdateOptions = {}
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.tables,
      async () => {
        const latest =
          await maProfessorDb.lessons.get(
            id
          )

        if (!latest) {
          throw new Error(
            'A aula indicada não existe.'
          )
        }

        if (
          options.expectedUpdatedAt &&
          latest.updatedAt !==
            options.expectedUpdatedAt
        ) {
          throw new Error(
            'Esta aula foi alterada noutra aba ou janela. Atualize a página antes de guardar para não substituir as alterações mais recentes.'
          )
        }

        const nextDate =
          changes.date ??
          latest.date

        const requestedStatus =
          changes.status ??
          latest.status

        const nextStatus =
          resolveLessonStatusForDate(
            nextDate,
            requestedStatus
          )

        const safeChanges:
          LessonChanges =
          nextStatus !==
            requestedStatus ||
          changes.status !==
            undefined
            ? {
                ...changes,
                status:
                  nextStatus
              }
            : changes

        const nextModuleId =
          changes.moduleId ??
          latest.moduleId

        const relatedContextChanged =
          latest.date !== nextDate ||
          latest.moduleId !== nextModuleId

        const leavesTaughtStatus =
          latest.status === 'taught' &&
          nextStatus !== 'taught'

        const cancelsLesson =
          latest.status !== 'cancelled' &&
          nextStatus === 'cancelled'

        const relatedEvidenceRequired =
          relatedContextChanged ||
          leavesTaughtStatus ||
          cancelsLesson

        const [
          attendanceCount,
          assessmentCount
        ] =
          !relatedEvidenceRequired
            ? [0, 0]
            : await Promise.all([
                maProfessorDb
                  .lessonAttendance
                  .where(
                    'lessonId'
                  )
                  .equals(
                    id
                  )
                  .count(),
                maProfessorDb
                  .lessonAssessments
                  .where(
                    'lessonId'
                  )
                  .equals(
                    id
                  )
                  .count()
              ])

        assertLessonHistoricalDateChangeAllowed(
          latest.date,
          nextDate,
          attendanceCount,
          assessmentCount
        )

        assertLessonHistoricalModuleChangeAllowed(
          latest.moduleId,
          nextModuleId,
          attendanceCount,
          assessmentCount
        )

        if (
          cancelsLesson &&
          (
            attendanceCount > 0 ||
            assessmentCount > 0
          )
        ) {
          throw new Error(
            'Esta aula já possui faltas ou avaliações. Mantenha-a marcada como dada para preservar esses registos.'
          )
        }

        if (
          leavesTaughtStatus &&
          attendanceCount > 0
        ) {
          throw new Error(
            'Esta aula já possui faltas. Mantenha-a marcada como dada para preservar esses registos.'
          )
        }

        const selectedPlanificationItemIds =
          safeChanges.planificationItemIds ??
          latest.planificationItemIds

        const existingReservationIds =
          latest.status === 'planned'
            ? new Set(
                latest.planificationItemIds
              )
            : new Set<EntityId>()

        const newReservationIds =
          nextStatus === 'cancelled'
            ? []
            : selectedPlanificationItemIds.filter(
                itemId =>
                  !existingReservationIds.has(
                    itemId
                  )
              )

        await assertPlanificationItemsAvailable(
          nextModuleId,
          newReservationIds,
          id
        )

        return super.updateLesson(
          id,
          safeChanges,
          options
        )
      }
    )
  }

  override async getNextPlanificationItem(
    moduleId: EntityId,
    ignoredLessonId?: EntityId
  ) {
    await this.initialize()

    const [
      planifications,
      moduleLessons
    ] = await Promise.all([
      maProfessorDb.planifications
        .where(
          'moduleId'
        )
        .equals(
          moduleId
        )
        .toArray(),
      maProfessorDb.lessons
        .where(
          'moduleId'
        )
        .equals(
          moduleId
        )
        .toArray()
    ])

    const activePlanification =
      planifications.find(
        planification =>
          planification.active
      )

    if (!activePlanification) {
      return null
    }

    const items =
      await maProfessorDb.planificationItems
        .where(
          'planificationId'
        )
        .equals(
          activePlanification.id
        )
        .toArray()

    const reservedIds =
      getReservedPlanificationItemIds(
        moduleLessons,
        moduleId,
        ignoredLessonId
      )

    return selectNextAvailablePlanificationItem(
      items,
      reservedIds
    )
  }

  override async markGIAESubmitted(
    id: EntityId
  ) {
    await this.initialize()

    const lesson =
      await maProfessorDb.lessons.get(
        id
      )

    if (lesson) {
      assertLessonNotTaughtInFuture(
        lesson.date,
        lesson.status
      )
    }

    return super.markGIAESubmitted(
      id
    )
  }

  override async markManyGIAESubmitted(
    ids: EntityId[]
  ) {
    await this.initialize()

    const lessons =
      await maProfessorDb.lessons.bulkGet(
        ids
      )

    lessons.forEach(
      lesson => {
        if (!lesson) {
          return
        }

        assertLessonNotTaughtInFuture(
          lesson.date,
          lesson.status
        )
      }
    )

    return super.markManyGIAESubmitted(
      ids
    )
  }
}

export const lessonRepository =
  new LessonRepository()
