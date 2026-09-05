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
  LessonUpdateOptions
} from './lessonRepositoryBase'

import {
  assertLessonHistoricalDateChangeAllowed,
  assertLessonHistoricalModuleChangeAllowed
} from './lessonHistoricalEditSafety'

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
          changes,
          options
        )
      }
    )
  }
}

export const lessonRepository =
  new LessonRepository()
