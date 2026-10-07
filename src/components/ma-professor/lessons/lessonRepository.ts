import {
  maProfessorDb
} from '../db'

import {
  findPlanificationReservationConflict,
  getReservedPlanificationItemIds,
} from '../planifications/planificationItemReservation'

import type {
  EntityId,
  Lesson,
  WeeklyScheduleSlot
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

export type LessonMoveScope =
  | 'single'
  | 'from_here'
  | 'whole_schedule'

function createScheduleEntityId() {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  return uuid
    ? `schedule-${uuid}`
    : `schedule-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 12)}`
}

function parseISODate(
  value: string
) {
  const [year, month, day] =
    value
      .split('-')
      .map(Number)

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )
}

function formatISODate(
  value: Date
) {
  return value
    .toISOString()
    .slice(0, 10)
}

function addDays(
  value: string,
  amount: number
) {
  const date =
    parseISODate(
      value
    )

  date.setUTCDate(
    date.getUTCDate() +
      amount
  )

  return formatISODate(
    date
  )
}

function getWeekday(
  value: string
): WeeklyScheduleSlot['weekday'] {
  const weekday =
    parseISODate(
      value
    ).getUTCDay()

  return (
    weekday === 0
      ? 7
      : weekday
  ) as WeeklyScheduleSlot['weekday']
}

function getStartOfWeek(
  value: string
) {
  return addDays(
    value,
    -(
      getWeekday(
        value
      ) - 1
    )
  )
}

function dateForWeekday(
  weekStart: string,
  weekday: WeeklyScheduleSlot['weekday']
) {
  return addDays(
    weekStart,
    weekday - 1
  )
}

function scheduleDatesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
) {
  return (
    leftStart <= rightEnd &&
    rightStart <= leftEnd
  )
}

function scheduleTimesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
) {
  return (
    leftStart < rightEnd &&
    rightStart < leftEnd
  )
}

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

  async moveLessonWithScope(
    id: EntityId,
    requestedPosition: Pick<Lesson, 'date' | 'startTime' | 'endTime'>,
    expectedUpdatedAt: string,
    scope: LessonMoveScope = 'single',
    swap?: {
      id: EntityId
      updatedAt: string
    }
  ) {
    if (scope === 'single') {
      return this.moveLesson(
        id,
        requestedPosition,
        expectedUpdatedAt,
        swap
      )
    }

    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.tables,
      async () => {
        const current =
          await maProfessorDb.lessons.get(
            id
          )

        if (
          !current ||
          current.updatedAt !==
            expectedUpdatedAt
        ) {
          throw new Error(
            'Esta aula foi alterada entretanto. Atualize antes de a mover.'
          )
        }

        if (
          current.origin !==
            'scheduled' ||
          !current.scheduleSlotId ||
          current.scheduleOriginalPosition
        ) {
          throw new Error(
            'Este âmbito só pode ser aplicado a uma aula normal do horário. Use «Só esta célula» para uma exceção já deslocada.'
          )
        }

        const currentSlot =
          await maProfessorDb
            .weeklyScheduleSlots
            .get(
              current.scheduleSlotId
            )

        if (!currentSlot) {
          throw new Error(
            'O bloco de horário desta aula já não está disponível.'
          )
        }

        const targetWeekday =
          getWeekday(
            requestedPosition.date
          )

        const anchorWeekStart =
          getStartOfWeek(
            current.date
          )

        if (
          getStartOfWeek(
            requestedPosition.date
          ) !== anchorWeekStart
        ) {
          throw new Error(
            'Para «Daqui para a frente» ou «Do início ao fim», escolha uma célula da mesma semana. Para mudar esta aula para outra semana, use «Só esta célula».'
          )
        }

        const allLessons =
          await maProfessorDb.lessons
            .where(
              'academicYearId'
            )
            .equals(
              current.academicYearId
            )
            .toArray()

        const allSlots =
          await maProfessorDb
            .weeklyScheduleSlots
            .where(
              'academicYearId'
            )
            .equals(
              current.academicYearId
            )
            .toArray()

        const destinationLesson =
          swap
            ? await maProfessorDb.lessons.get(
                swap.id
              )
            : null

        if (
          swap &&
          (
            !destinationLesson ||
            destinationLesson.updatedAt !==
              swap.updatedAt
          )
        ) {
          throw new Error(
            'A aula de destino foi alterada entretanto. Escolha novamente o destino.'
          )
        }

        let destinationSlot:
          WeeklyScheduleSlot | null =
          null

        if (destinationLesson) {
          if (
            destinationLesson.origin !==
              'scheduled' ||
            !destinationLesson.scheduleSlotId ||
            destinationLesson.scheduleOriginalPosition
          ) {
            throw new Error(
              'Para permutar várias ocorrências, a aula de destino também tem de ser uma aula normal do horário. Use «Só esta célula» para esta permuta.'
            )
          }

          destinationSlot =
            await maProfessorDb
              .weeklyScheduleSlots
              .get(
                destinationLesson.scheduleSlotId
              ) ?? null

          if (!destinationSlot) {
            throw new Error(
              'O bloco de horário da aula de destino já não está disponível.'
            )
          }

          if (
            currentSlot.periodCount !==
              destinationSlot.periodCount
          ) {
            throw new Error(
              'A permuta exige blocos com o mesmo número de tempos.'
            )
          }
        }

        const inScope = (
          lesson: Lesson,
          slotId: EntityId
        ) =>
          lesson.origin ===
            'scheduled' &&
          lesson.scheduleSlotId ===
            slotId &&
          !lesson.scheduleOriginalPosition &&
          (
            scope ===
              'whole_schedule' ||
            getStartOfWeek(
              lesson.date
            ) >= anchorWeekStart
          )

        const primaryLessons =
          allLessons.filter(
            lesson =>
              inScope(
                lesson,
                currentSlot.id
              )
          )

        const secondaryLessons =
          destinationSlot
            ? allLessons.filter(
                lesson =>
                  inScope(
                    lesson,
                    destinationSlot!.id
                  )
              )
            : []

        const movingIds =
          new Set([
            ...primaryLessons.map(
              lesson => lesson.id
            ),
            ...secondaryLessons.map(
              lesson => lesson.id
            )
          ])

        const submittedLesson =
          [
            ...primaryLessons,
            ...secondaryLessons
          ].find(
            lesson =>
              lesson.giaeStatus ===
                'submitted'
          )

        if (submittedLesson) {
          throw new Error(
            'Existem aulas neste âmbito já submetidas no programa oficial. Retire primeiro o visto dessas aulas; nenhuma alteração foi aplicada.'
          )
        }

        const primaryTarget = {
          weekday:
            targetWeekday,
          startTime:
            requestedPosition.startTime,
          endTime:
            requestedPosition.endTime
        }

        const secondaryTarget =
          destinationSlot
            ? {
                weekday:
                  currentSlot.weekday,
                startTime:
                  currentSlot.startTime,
                endTime:
                  currentSlot.endTime
              }
            : null

        const destinationRows = [
          ...primaryLessons.map(
            lesson => ({
              lesson,
              date:
                dateForWeekday(
                  getStartOfWeek(
                    lesson.date
                  ),
                  primaryTarget.weekday
                ),
              startTime:
                primaryTarget.startTime,
              endTime:
                primaryTarget.endTime
            })
          ),
          ...secondaryLessons.map(
            lesson => ({
              lesson,
              date:
                dateForWeekday(
                  getStartOfWeek(
                    lesson.date
                  ),
                  secondaryTarget!.weekday
                ),
              startTime:
                secondaryTarget!.startTime,
              endTime:
                secondaryTarget!.endTime
            })
          )
        ]

        for (const destination of destinationRows) {
          const collision =
            allLessons.find(
              row =>
                !movingIds.has(
                  row.id
                ) &&
                row.status !==
                  'cancelled' &&
                row.date ===
                  destination.date &&
                row.startTime <
                  destination.endTime &&
                row.endTime >
                  destination.startTime
            )

          if (collision) {
            throw new Error(
              'A alteração iria sobrepor-se a outra aula. Nenhuma alteração foi aplicada.'
            )
          }
        }

        const splitStart =
          scope ===
            'from_here'
            ? anchorWeekStart
            : null

        const getChangedValidity = (
          slot: WeeklyScheduleSlot
        ) => ({
          validFrom:
            splitStart &&
            splitStart >
              slot.validFrom
              ? splitStart
              : slot.validFrom,
          validUntil:
            slot.validUntil
        })

        const slotConflicts = (
          slot: WeeklyScheduleSlot,
          target: {
            weekday: WeeklyScheduleSlot['weekday']
            startTime: string
            endTime: string
          },
          ignoredIds: Set<EntityId>
        ) => {
          const validity =
            getChangedValidity(
              slot
            )

          return allSlots.some(
            other =>
              !ignoredIds.has(
                other.id
              ) &&
              other.active &&
              other.weekday ===
                target.weekday &&
              scheduleDatesOverlap(
                validity.validFrom,
                validity.validUntil,
                other.validFrom,
                other.validUntil
              ) &&
              scheduleTimesOverlap(
                target.startTime,
                target.endTime,
                other.startTime,
                other.endTime
              )
          )
        }

        const ignoredSlotIds =
          new Set<EntityId>([
            currentSlot.id,
            ...(
              destinationSlot
                ? [
                    destinationSlot.id
                  ]
                : []
            )
          ])

        if (
          slotConflicts(
            currentSlot,
            primaryTarget,
            ignoredSlotIds
          ) ||
          (
            destinationSlot &&
            secondaryTarget &&
            slotConflicts(
              destinationSlot,
              secondaryTarget,
              ignoredSlotIds
            )
          )
        ) {
          throw new Error(
            'A alteração iria criar uma sobreposição no horário semanal. Nenhuma alteração foi aplicada.'
          )
        }

        const timestamp =
          new Date().toISOString()

        async function updateSlotForScope(
          slot: WeeklyScheduleSlot,
          target: {
            weekday: WeeklyScheduleSlot['weekday']
            startTime: string
            endTime: string
          }
        ) {
          if (
            !splitStart ||
            splitStart <=
              slot.validFrom
          ) {
            const updatedSlot = {
              ...slot,
              ...target,
              updatedAt:
                timestamp
            }

            await maProfessorDb
              .weeklyScheduleSlots
              .put(
                updatedSlot
              )

            return updatedSlot
          }

          if (
            splitStart >
              slot.validUntil
          ) {
            throw new Error(
              'A aula selecionada fica fora da vigência atual do bloco de horário.'
            )
          }

          const suffix: WeeklyScheduleSlot = {
            ...slot,
            id:
              createScheduleEntityId(),
            ...target,
            validFrom:
              splitStart,
            createdAt:
              timestamp,
            updatedAt:
              timestamp
          }

          await maProfessorDb
            .weeklyScheduleSlots
            .put({
              ...slot,
              validUntil:
                addDays(
                  splitStart,
                  -1
                ),
              updatedAt:
                timestamp
            })

          await maProfessorDb
            .weeklyScheduleSlots
            .add(
              suffix
            )

          return suffix
        }

        const primaryResultSlot =
          await updateSlotForScope(
            currentSlot,
            primaryTarget
          )

        const secondaryResultSlot =
          destinationSlot &&
          secondaryTarget
            ? await updateSlotForScope(
                destinationSlot,
                secondaryTarget
              )
            : null

        for (const destination of destinationRows) {
          const targetSlot =
            primaryLessons.some(
              lesson =>
                lesson.id ===
                  destination.lesson.id
            )
              ? primaryResultSlot
              : secondaryResultSlot

          if (!targetSlot) {
            continue
          }

          await maProfessorDb.lessons.put({
            ...destination.lesson,
            scheduleSlotId:
              targetSlot.id,
            date:
              destination.date,
            startTime:
              destination.startTime,
            endTime:
              destination.endTime,
            updatedAt:
              timestamp
          })
        }

        const moved =
          await maProfessorDb.lessons.get(
            current.id
          )

        if (!moved) {
          throw new Error(
            'Não foi possível concluir a alteração do horário.'
          )
        }

        return moved
      }
    )
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

  async getAvailablePlanificationItems(
    moduleId: EntityId,
    ignoredLessonId?: EntityId
  ) {
    await this.initialize()

    const [planifications, moduleLessons] = await Promise.all([
      maProfessorDb.planifications.where('moduleId').equals(moduleId).toArray(),
      maProfessorDb.lessons.where('moduleId').equals(moduleId).toArray()
    ])

    const activePlanification = planifications.find(
      planification => planification.active
    )

    if (!activePlanification) return []

    const items = await maProfessorDb.planificationItems
      .where('planificationId')
      .equals(activePlanification.id)
      .toArray()

    const reservedIds = getReservedPlanificationItemIds(
      moduleLessons,
      moduleId,
      ignoredLessonId
    )

    return items
      .filter(item =>
        item.status === 'planned' &&
        !item.usedLessonId &&
        !reservedIds.has(item.id)
      )
      .sort((left, right) => left.order - right.order)
  }

  override async getNextPlanificationItem(
    moduleId: EntityId,
    ignoredLessonId?: EntityId
  ) {
    const items = await this.getAvailablePlanificationItems(
      moduleId,
      ignoredLessonId
    )
    return items[0] ?? null
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
