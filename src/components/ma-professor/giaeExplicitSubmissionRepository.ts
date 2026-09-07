import {
  maProfessorDb,
  openMAProfessorDatabase
} from './db'

import type {
  EntityId,
  Lesson
} from './types'

import {
  assertLessonNotTaughtInFuture
} from './lessons/lessonTemporalSafety'

export interface GIAEExplicitSubmissionInput {
  lessonId: EntityId
  expectedUpdatedAt: string
}

function now() {
  return new Date().toISOString()
}

function assertExpectedVersion(
  lesson: Lesson,
  expectedUpdatedAt: string
) {
  if (
    !expectedUpdatedAt ||
    lesson.updatedAt !==
      expectedUpdatedAt
  ) {
    throw new Error(
      'Esta aula foi alterada desde a cópia para o GIAE. Copie novamente o sumário antes de o marcar como submetido.'
    )
  }
}

function assertCanSubmit(
  lesson: Lesson
) {
  assertLessonNotTaughtInFuture(
    lesson.date,
    lesson.status
  )

  if (
    lesson.status !==
      'taught' ||
    !lesson.summary.trim()
  ) {
    throw new Error(
      'Apenas aulas dadas com sumário podem ser marcadas como submetidas no GIAE.'
    )
  }
}

function buildSubmittedLesson(
  lesson: Lesson,
  timestamp: string
): Lesson {
  return {
    ...lesson,
    giaeStatus:
      'submitted',
    giaeSubmittedAt:
      timestamp,
    updatedAt:
      timestamp
  }
}

export class GIAEExplicitSubmissionRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async markSubmitted(
    input: GIAEExplicitSubmissionInput
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.lessons,
      async () => {
        const lesson =
          await maProfessorDb
            .lessons
            .get(
              input.lessonId
            )

        if (!lesson) {
          throw new Error(
            'A aula indicada não existe.'
          )
        }

        assertExpectedVersion(
          lesson,
          input.expectedUpdatedAt
        )
        assertCanSubmit(
          lesson
        )

        const updated =
          buildSubmittedLesson(
            lesson,
            now()
          )

        await maProfessorDb
          .lessons
          .put(
            updated
          )

        return updated
      }
    )
  }

  async markManySubmitted(
    inputs: GIAEExplicitSubmissionInput[]
  ) {
    await this.initialize()

    if (
      inputs.length ===
      0
    ) {
      return []
    }

    const seen =
      new Set<EntityId>()

    for (
      const input of
      inputs
    ) {
      if (
        seen.has(
          input.lessonId
        )
      ) {
        throw new Error(
          'A mesma aula não pode ser submetida duas vezes no mesmo lote.'
        )
      }

      seen.add(
        input.lessonId
      )
    }

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.lessons,
      async () => {
        const lessons =
          await maProfessorDb
            .lessons
            .bulkGet(
              inputs.map(
                input =>
                  input.lessonId
              )
            )

        const validated =
          lessons.map(
            (
              lesson,
              index
            ) => {
              if (!lesson) {
                throw new Error(
                  `A aula ${index + 1} já não existe.`
                )
              }

              assertExpectedVersion(
                lesson,
                inputs[index]
                  .expectedUpdatedAt
              )
              assertCanSubmit(
                lesson
              )

              return lesson
            }
          )

        const timestamp =
          now()

        const updated =
          validated.map(
            lesson =>
              buildSubmittedLesson(
                lesson,
                timestamp
              )
          )

        await maProfessorDb
          .lessons
          .bulkPut(
            updated
          )

        return updated
      }
    )
  }
}

export const giaeExplicitSubmissionRepository =
  new GIAEExplicitSubmissionRepository()
