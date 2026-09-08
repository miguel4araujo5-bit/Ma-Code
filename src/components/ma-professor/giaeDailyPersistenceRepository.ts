import {
  maProfessorDb,
  openMAProfessorDatabase
} from './db'

import {
  lessonRepository,
  type LessonChanges
} from './lessons/lessonRepository'

import type {
  EntityId,
  Lesson
} from './types'

export interface SaveDailyLessonPendingVersionInput {
  lessonId: EntityId
  changes: LessonChanges
  expectedUpdatedAt: string
}

type GIAEDailyDb = Pick<
  typeof maProfessorDb,
  'tables' | 'transaction'
>

type GIAEDailyLessonRepository = Pick<
  typeof lessonRepository,
  'updateLesson' | 'markGIAEPending'
>

export class GIAEDailyPersistenceRepository {
  constructor(
    private readonly db: GIAEDailyDb =
      maProfessorDb,
    private readonly repository: GIAEDailyLessonRepository =
      lessonRepository,
    private readonly initializeDatabase =
      openMAProfessorDatabase
  ) {}

  async savePendingVersion(
    input: SaveDailyLessonPendingVersionInput
  ): Promise<Lesson> {
    await this.initializeDatabase()

    return this.db.transaction(
      'rw',
      this.db.tables,
      async () => {
        let persisted =
          await this.repository.updateLesson(
            input.lessonId,
            input.changes,
            {
              expectedUpdatedAt:
                input.expectedUpdatedAt
            }
          )

        if (
          persisted.giaeStatus ===
          'submitted'
        ) {
          persisted =
            await this.repository.markGIAEPending(
              persisted.id
            )
        }

        return persisted
      }
    )
  }
}

export const giaeDailyPersistenceRepository =
  new GIAEDailyPersistenceRepository()
