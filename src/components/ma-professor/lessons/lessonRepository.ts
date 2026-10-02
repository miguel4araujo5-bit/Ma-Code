import {
  maProfessorDb
} from '../db'

import {
  findPlanificationReservationConflict,
  getReservedPlanificationItemIds,
  selectNextAvailablePlanificationItem
} from '../planifications/planificationItemReservation'

import type {
  EntityId,
  Lesson
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
  isFutureLessonDate,
  resolveLessonStatusFromEvidence
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

function normalizeSummaryForComparison(
  value: string | undefined
) {
  return (
    value ??
    ''
  )
    .replace(
      /\r\n/g,
      '\n'
    )
    .split('\n')
    .map(
      line =>
        line
          .trim()
          .replace(
            /\s+/g,
            ' '
          )
    )
    .filter(Boolean)
    .join('\n')
}

function hasGIAERelevantRequestedChanges(
  lesson: Lesson,
  changes: LessonChanges
) {
  return (
    (
      changes.teachingAssignmentId !==
        undefined &&
      changes.teachingAssignmentId !==
        lesson.teachingAssignmentId
    ) ||
    (
      changes.moduleId !==
        undefined &&
      changes.moduleId !==
        lesson.moduleId
    ) ||
    (
      changes.date !==
        undefined &&
      changes.date !==
        lesson.date
    ) ||
    (
      changes.startTime !==
        undefined &&
      changes.startTime !==
        lesson.startTime
    ) ||
    (
      changes.endTime !==
        undefined &&
      changes.endTime !==
        lesson.endTime
    ) ||
    (
      changes.periodCount !==
        undefined &&
      changes.periodCount !==
        lesson.periodCount
    ) ||
    (
      changes.status !==
        undefined &&
      changes.status !==
        lesson.status
    ) ||
    (
      changes.summary !==
        undefined &&
      normalizeSummaryForComparison(
        changes.summary
      ) !== lesson.summary
    )
  )
}

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
  async findMoveCollision(id: EntityId, position: Pick<Lesson, 'date' | 'startTime' | 'endTime'>) {
    const lesson = await this.getLesson(id)
    if (!lesson) throw new Error('A aula indicada não existe.')
    const lessons = await maProfessorDb.lessons.where('academicYearId').equals(lesson.academicYearId).toArray()
    return lessons.find(row => row.id !== id && row.status !== 'cancelled' && row.date === position.date && row.startTime < position.endTime && row.endTime > position.startTime) ?? null
  }

  async moveLesson(id: EntityId, requestedPosition: Pick<Lesson, 'date' | 'startTime' | 'endTime'>, expectedUpdatedAt: string, swap?: { id: EntityId; updatedAt: string }) {
    await this.initialize()
    const { date, startTime, endTime } = requestedPosition
    const position = { date, startTime, endTime }
    return maProfessorDb.transaction('rw', maProfessorDb.tables, async () => {
      const current = await maProfessorDb.lessons.get(id)
      if (!current || current.updatedAt !== expectedUpdatedAt) throw new Error('Esta aula foi alterada entretanto. Atualize antes de a mover.')
      if (current.giaeStatus === 'submitted') throw new Error('Esta aula já está marcada como submetida no programa oficial. Para alterar a data ou hora, retire primeiro esse visto.')
      const collision = await this.findMoveCollision(id, position)
      if (collision && (!swap || swap.id !== collision.id)) throw new Error('Já existe uma aula nesse horário. Escolha Permutar/substituir ou outra hora.')
      const other = swap ? await maProfessorDb.lessons.get(swap.id) : null
      if (swap && (!other || !collision || other.updatedAt !== swap.updatedAt)) throw new Error('A aula de destino foi alterada entretanto. Escolha novamente o destino.')
      if (other?.giaeStatus === 'submitted') throw new Error('Uma ou mais aulas que está a tentar permutar estão marcadas como submetidas no programa oficial. Retire primeiro esse visto para prosseguir.')
      if (other && (other.startTime !== position.startTime || other.endTime !== position.endTime || other.periodCount !== current.periodCount)) throw new Error('A permuta exige células com o mesmo número de tempos. Escolha outra hora.')
      const all = await maProfessorDb.lessons.where('academicYearId').equals(current.academicYearId).toArray()
      for (const [, destination] of other ? [[current, position], [other, current]] as const : [[current, position]] as const) {
        if (all.some(row => row.id !== current.id && row.id !== other?.id && row.status !== 'cancelled' && row.date === destination.date && row.startTime < destination.endTime && row.endTime > destination.startTime)) throw new Error('A permuta sobrepõe-se a outra aula. Escolha outra hora.')
      }
      const timestamp = new Date().toISOString()
      if (other) await maProfessorDb.lessons.put({ ...other, date: current.date, startTime: current.startTime, endTime: current.endTime, scheduleOriginalPosition: other.scheduleOriginalPosition ?? { date: other.date, startTime: other.startTime }, updatedAt: timestamp })
      const saved = await super.updateLesson(id, position, { expectedUpdatedAt })
      const moved = { ...saved, scheduleOriginalPosition: current.scheduleOriginalPosition ?? { date: current.date, startTime: current.startTime } }
      await maProfessorDb.lessons.put(moved)
      return moved
    })
  }

  override async createLesson(
    input: LessonDraft
  ) {
    await this.initialize()

    const requestedStatus =
      input.status ?? 'planned'

    const safeInput: LessonDraft = {
      ...input,
      status:
        resolveLessonStatusFromEvidence(
          input.date,
          requestedStatus,
          input.summary ?? '',
          'pending'
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

        if (latest.giaeStatus === 'submitted' && (
          (changes.date !== undefined && changes.date !== latest.date) ||
          (changes.startTime !== undefined && changes.startTime !== latest.startTime) ||
          (changes.endTime !== undefined && changes.endTime !== latest.endTime) ||
          (changes.moduleId !== undefined && changes.moduleId !== latest.moduleId) ||
          (changes.teachingAssignmentId !== undefined && changes.teachingAssignmentId !== latest.teachingAssignmentId)
        )) throw new Error('Esta aula já está marcada como submetida no programa oficial. Para alterar a data, hora ou UFCD, retire primeiro esse visto.')

        const nextDate =
          changes.date ??
          latest.date

        const requestedStatus =
          changes.status ??
          latest.status

        const nextSummary =
          changes.summary ??
          latest.summary

        const nextGIAEStatus =
          latest.giaeStatus ===
            'submitted' &&
          hasGIAERelevantRequestedChanges(
            latest,
            changes
          )
            ? 'pending'
            : latest.giaeStatus

        const nextStatus =
          resolveLessonStatusFromEvidence(
            nextDate,
            requestedStatus,
            nextSummary,
            nextGIAEStatus
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

        // Com sumário, a normalização temporal futura não significa remover a assiduidade já guardada.
        const futureEvidenceNormalization =
          latest.date === nextDate &&
          latest.status === 'taught' &&
          nextStatus === 'planned' &&
          Boolean(
            nextSummary.trim()
          ) &&
          isFutureLessonDate(
            nextDate
          ) &&
          nextGIAEStatus !==
            'submitted'

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
                  .filter(record => record.status === 'absent')
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
            'Esta aula já possui faltas ou avaliações. Mantenha-a marcada como registada para preservar esses registos.'
          )
        }

        if (
          leavesTaughtStatus &&
          attendanceCount > 0 &&
          !futureEvidenceNormalization
        ) {
          throw new Error(
            'Esta aula já possui faltas. Mantenha-a marcada como registada para preservar esses registos.'
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

  async markGIAESubmittedExplicit(
    id: EntityId,
    expectedUpdatedAt: string
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.tables,
      async () => {
        let lesson =
          await maProfessorDb.lessons.get(
            id
          )

        if (!lesson) {
          throw new Error(
            'A aula indicada não existe.'
          )
        }

        if (
          !expectedUpdatedAt ||
          lesson.updatedAt !==
            expectedUpdatedAt
        ) {
          throw new Error(
            'Esta aula foi alterada desde a cópia para o GIAE. Copie novamente o sumário antes de o marcar como submetido.'
          )
        }

        if (
          lesson.status ===
            'cancelled' ||
          !lesson.summary.trim()
        ) {
          throw new Error(
            'Apenas aulas com sumário podem ser marcadas como submetidas no programa oficial.'
          )
        }

        if (
          lesson.status !==
          'taught'
        ) {
          lesson =
            await super.updateLesson(
              id,
              {
                status:
                  'taught'
              },
              {
                expectedUpdatedAt:
                  lesson.updatedAt
              }
            )
        }

        const timestamp =
          new Date().toISOString()

        const submitted: Lesson = {
          ...lesson,
          status:
            'taught',
          giaeStatus:
            'submitted',
          giaeSubmittedAt:
            timestamp,
          updatedAt:
            timestamp
        }

        await maProfessorDb.lessons.put(
          submitted
        )

        return submitted
      }
    )
  }

  async markGIAEPendingExplicit(
    id: EntityId,
    expectedUpdatedAt: string
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.tables,
      async () => {
        const lesson =
          await maProfessorDb.lessons.get(
            id
          )

        if (!lesson) {
          throw new Error(
            'A aula indicada não existe.'
          )
        }

        if (
          !expectedUpdatedAt ||
          lesson.updatedAt !==
            expectedUpdatedAt
        ) {
          throw new Error(
            'Esta aula foi alterada entretanto. Atualize a página antes de alterar o estado de submissão no GIAE.'
          )
        }

        let pending =
          await super.markGIAEPending(
            id
          )

        if (
          isFutureLessonDate(
            pending.date
          ) &&
          pending.status ===
            'taught'
        ) {
          pending =
            await super.updateLesson(
              id,
              {
                status:
                  'planned'
              },
              {
                expectedUpdatedAt:
                  pending.updatedAt
              }
            )
        }

        return pending
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

    if (
      lesson &&
      lesson.status !==
        'taught' &&
      lesson.status !==
        'cancelled' &&
      lesson.summary.trim()
    ) {
      return this.markGIAESubmittedExplicit(
        lesson.id,
        lesson.updatedAt
      )
    }

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
