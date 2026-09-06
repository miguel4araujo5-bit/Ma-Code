import {
  maProfessorDb
} from '../db'

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

export class LessonRepository
  extends BaseLessonRepository {
  override async createLesson(
    input: LessonDraft
  ) {
    const requestedStatus =
      input.status ?? 'planned'

    return super.createLesson({
      ...input,
      status:
        resolveLessonStatusForDate(
          input.date,
          requestedStatus
        )
    })
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

        const [
          attendanceCount,
          assessmentCount
        ] =
          !relatedContextChanged
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

        return super.updateLesson(
          id,
          safeChanges,
          options
        )
      }
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
