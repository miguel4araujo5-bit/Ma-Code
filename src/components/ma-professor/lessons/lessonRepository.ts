import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  EntityId,
  GIAEStatus,
  ISODate,
  Lesson,
  LessonOrigin,
  LessonStatus,
  LocalTime,
  ModuleUnit,
  PlanificationItem,
  SchoolCalendarEvent,
  SummarySource,
  TeachingAssignment,
  WeeklyScheduleSlot
} from '../types'

export interface LessonDraft {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  scheduleSlotId?: EntityId | null
  origin?: LessonOrigin
  status?: LessonStatus
  date: ISODate
  startTime: LocalTime
  endTime: LocalTime
  periodCount: number
  countTowardProgress?: boolean
  plannedActivity?: string
  summary?: string
  summarySource?: SummarySource
  planificationItemIds?: EntityId[]
  notes?: string
}

export interface LessonChanges {
  teachingAssignmentId?: EntityId
  moduleId?: EntityId
  scheduleSlotId?: EntityId | null
  origin?: LessonOrigin
  status?: LessonStatus
  date?: ISODate
  startTime?: LocalTime
  endTime?: LocalTime
  periodCount?: number
  countTowardProgress?: boolean
  plannedActivity?: string
  summary?: string
  summarySource?: SummarySource
  planificationItemIds?: EntityId[]
  notes?: string
}

export interface LessonFilters {
  academicYearId: EntityId
  dateFrom?: ISODate | null
  dateTo?: ISODate | null
  teachingAssignmentId?: EntityId | null
  moduleId?: EntityId | null
  status?: LessonStatus | null
  giaeStatus?: GIAEStatus | null
  origin?: LessonOrigin | null
}

export interface ScheduledLessonGenerationInput {
  academicYearId: EntityId
  dateFrom: ISODate
  dateTo: ISODate
  teachingAssignmentId?: EntityId | null
  createCancelledForBlockedDates?: boolean
}

export interface ScheduledLessonGenerationResult {
  created: Lesson[]
  createdPlanned: number
  createdCancelled: number
  skippedExisting: number
  skippedWithoutModule: number
  createdOutsidePlannedCapacity: number
}

export interface PreviousLessonTemplate {
  sourceLessonId: EntityId
  plannedActivity: string
  summary: string
  notes: string
}

const MAX_GENERATION_DAYS = 550

function now() {
  return new Date().toISOString()
}

function createEntityId(prefix: string): EntityId {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  if (uuid) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}

function normalizeMultilineText(
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
      (
        line
      ) =>
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

function uniqueIds(
  ids: EntityId[] | undefined
) {
  return Array.from(
    new Set(
      ids ??
      []
    )
  )
}

function assertISODate(
  value: ISODate,
  label: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    throw new Error(
      `${label} não é uma data válida.`
    )
  }

  const parsed =
    parseISODate(
      value
    )

  if (
    formatISODate(
      parsed
    ) !==
    value
  ) {
    throw new Error(
      `${label} não é uma data válida.`
    )
  }
}

function assertTimeRange(
  startTime: LocalTime,
  endTime: LocalTime
) {
  if (
    !/^\d{2}:\d{2}$/.test(
      startTime
    ) ||
    !/^\d{2}:\d{2}$/.test(
      endTime
    )
  ) {
    throw new Error(
      'Indique horas válidas no formato HH:MM.'
    )
  }

  if (
    startTime >=
    endTime
  ) {
    throw new Error(
      'A hora de início deve ser anterior à hora de fim.'
    )
  }
}

function assertPositiveInteger(
  value: number,
  label: string
) {
  if (
    !Number.isInteger(
      value
    ) ||
    value <=
      0
  ) {
    throw new Error(
      `${label} deve ser um número inteiro superior a zero.`
    )
  }
}

function parseISODate(
  value: ISODate
) {
  const [
    year,
    month,
    day
  ] =
    value
      .split('-')
      .map(Number)

  return new Date(
    Date.UTC(
      year,
      month -
        1,
      day
    )
  )
}

function formatISODate(
  value: Date
): ISODate {
  return [
    String(
      value.getUTCFullYear()
    ).padStart(
      4,
      '0'
    ),
    String(
      value.getUTCMonth() +
        1
    ).padStart(
      2,
      '0'
    ),
    String(
      value.getUTCDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-')
}

function addDays(
  value: ISODate,
  days: number
): ISODate {
  const date =
    parseISODate(
      value
    )

  date.setUTCDate(
    date.getUTCDate() +
      days
  )

  return formatISODate(
    date
  )
}

function getWeekday(
  value: ISODate
): WeeklyScheduleSlot['weekday'] {
  const weekday =
    parseISODate(
      value
    ).getUTCDay()

  return (
    weekday ===
    0
      ? 7
      : weekday
  ) as WeeklyScheduleSlot['weekday']
}

function getInclusiveDayCount(
  dateFrom: ISODate,
  dateTo: ISODate
) {
  const milliseconds =
    parseISODate(
      dateTo
    ).getTime() -
    parseISODate(
      dateFrom
    ).getTime()

  return (
    Math.floor(
      milliseconds /
        86_400_000
    ) +
    1
  )
}

function sortLessons(
  lessons: Lesson[]
) {
  return lessons.sort(
    (
      left,
      right
    ) => {
      const dateComparison =
        left.date.localeCompare(
          right.date
        )

      if (
        dateComparison !==
        0
      ) {
        return dateComparison
      }

      const timeComparison =
        left.startTime.localeCompare(
          right.startTime
        )

      if (
        timeComparison !==
        0
      ) {
        return timeComparison
      }

      return left.createdAt.localeCompare(
        right.createdAt
      )
    }
  )
}

function lessonPositionKey(
  teachingAssignmentId: EntityId,
  date: ISODate,
  startTime: LocalTime
) {
  return `${teachingAssignmentId}|${date}|${startTime}`
}

function eventBlocksAssignment(
  event: SchoolCalendarEvent,
  assignment: TeachingAssignment,
  date: ISODate
) {
  if (
    !event.blocksLessons ||
    date <
      event.startDate ||
    date >
      event.endDate
  ) {
    return false
  }

  if (
    event.scope ===
    'all'
  ) {
    return true
  }

  if (
    event.scope ===
    'group'
  ) {
    return (
      event.groupId ===
      assignment.groupId
    )
  }

  return (
    event.teachingAssignmentId ===
    assignment.id
  )
}

function getBlockingEvents(
  events: SchoolCalendarEvent[],
  assignment: TeachingAssignment,
  date: ISODate
) {
  return events.filter(
    (
      event
    ) =>
      eventBlocksAssignment(
        event,
        assignment,
        date
      )
  )
}

function buildBlockedLessonNote(
  events: SchoolCalendarEvent[]
) {
  const titles =
    events
      .map(
        (
          event
        ) =>
          event.title
      )
      .filter(Boolean)

  if (
    titles.length ===
    0
  ) {
    return 'Aula cancelada por evento do calendário escolar.'
  }

  return `Aula cancelada por: ${titles.join('; ')}.`
}

function selectModuleForAllocation(
  modules: ModuleUnit[],
  allocatedPeriodsByModule:
    Map<EntityId, number>
) {
  const available =
    modules.find(
      (
        module
      ) => {
        const allocated =
          allocatedPeriodsByModule.get(
            module.id
          ) ??
          0

        return (
          allocated <
          module.plannedPeriods
        )
      }
    )

  return (
    available ??
    modules[
      modules.length -
        1
    ] ??
    null
  )
}

function isWithinModuleCapacity(
  module: ModuleUnit,
  allocatedPeriodsByModule:
    Map<EntityId, number>
) {
  return (
    (
      allocatedPeriodsByModule.get(
        module.id
      ) ??
      0
    ) <
    module.plannedPeriods
  )
}

function createLessonRecord(
  input: LessonDraft,
  timestamp =
    now()
): Lesson {
  const status =
    input.status ??
    'planned'

  const scheduleSlotId =
    input.scheduleSlotId ??
    null

  const origin =
    input.origin ??
    (
      scheduleSlotId
        ? 'scheduled'
        : 'extra'
    )

  const planificationItemIds =
    uniqueIds(
      input.planificationItemIds
    )

  const summary =
    normalizeMultilineText(
      input.summary
    )

  const plannedActivity =
    normalizeMultilineText(
      input.plannedActivity
    )

  const notes =
    normalizeMultilineText(
      input.notes
    )

  const summarySource =
    input.summarySource ??
    'manual'

  return {
    id:
      createEntityId(
        'lesson'
      ),
    academicYearId:
      input.academicYearId,
    teachingAssignmentId:
      input.teachingAssignmentId,
    moduleId:
      input.moduleId,
    scheduleSlotId,
    origin,
    status,
    date:
      input.date,
    startTime:
      input.startTime,
    endTime:
      input.endTime,
    periodCount:
      input.periodCount,
    countTowardProgress:
      status ===
      'cancelled'
        ? false
        : (
            input.countTowardProgress ??
            true
          ),
    plannedActivity,
    summary,
    summarySource,
    planificationItemIds,
    giaeStatus:
      'pending',
    giaeSubmittedAt:
      null,
    notes,
    createdAt:
      timestamp,
    updatedAt:
      timestamp
  }
}

async function getLessonContext(
  lesson: Lesson
) {
  const [
    academicYear,
    assignment,
    module,
    scheduleSlot
  ] =
    await Promise.all([
      maProfessorDb
        .academicYears
        .get(
          lesson.academicYearId
        ),
      maProfessorDb
        .teachingAssignments
        .get(
          lesson.teachingAssignmentId
        ),
      maProfessorDb
        .modules
        .get(
          lesson.moduleId
        ),
      lesson.scheduleSlotId
        ? maProfessorDb
            .weeklyScheduleSlots
            .get(
              lesson.scheduleSlotId
            )
        : Promise.resolve(
            undefined
          )
    ])

  if (
    !academicYear
  ) {
    throw new Error(
      'O ano letivo indicado não existe.'
    )
  }

  if (
    !assignment ||
    assignment.academicYearId !==
      academicYear.id
  ) {
    throw new Error(
      'A turma e disciplina indicadas não pertencem ao ano letivo.'
    )
  }

  if (
    !module ||
    module.academicYearId !==
      academicYear.id ||
    module.teachingAssignmentId !==
      assignment.id
  ) {
    throw new Error(
      'A UFCD ou módulo não pertence à turma e disciplina indicadas.'
    )
  }

  if (
    lesson.date <
      academicYear.startDate ||
    lesson.date >
      academicYear.endDate
  ) {
    throw new Error(
      'A data da aula deve ficar dentro do ano letivo.'
    )
  }

  if (
    lesson.origin ===
      'scheduled' &&
    !lesson.scheduleSlotId
  ) {
    throw new Error(
      'Uma aula do horário deve estar associada a um bloco semanal.'
    )
  }

  if (
    lesson.origin ===
      'extra' &&
    lesson.scheduleSlotId
  ) {
    throw new Error(
      'Uma aula extra não pode ficar associada a um bloco semanal.'
    )
  }

  if (
    lesson.scheduleSlotId
  ) {
    if (
      !scheduleSlot ||
      scheduleSlot.academicYearId !==
        academicYear.id ||
      scheduleSlot.teachingAssignmentId !==
        assignment.id
    ) {
      throw new Error(
        'O bloco de horário indicado não pertence a esta aula.'
      )
    }

    if (
      lesson.date <
        scheduleSlot.validFrom ||
      lesson.date >
        scheduleSlot.validUntil ||
      getWeekday(
        lesson.date
      ) !==
        scheduleSlot.weekday
    ) {
      throw new Error(
        'A data da aula não corresponde à vigência do bloco de horário.'
      )
    }
  }

  return {
    academicYear,
    assignment,
    module,
    scheduleSlot
  }
}

async function assertNoLessonCollision(
  lesson: Lesson,
  ignoredLessonId?:
    EntityId
) {
  const sameDayLessons =
    await maProfessorDb
      .lessons
      .where(
        '[teachingAssignmentId+date]'
      )
      .equals([
        lesson.teachingAssignmentId,
        lesson.date
      ])
      .toArray()

  const collision =
    sameDayLessons.find(
      (
        current
      ) =>
        current.id !==
          ignoredLessonId &&
        current.startTime ===
          lesson.startTime
    )

  if (
    collision
  ) {
    throw new Error(
      'Já existe uma aula desta turma e disciplina na mesma data e hora.'
    )
  }
}

async function getValidatedPlanificationItems(
  moduleId: EntityId,
  planificationItemIds:
    EntityId[],
  lessonId?:
    EntityId
) {
  if (
    planificationItemIds.length ===
    0
  ) {
    return []
  }

  const planifications =
    await maProfessorDb
      .planifications
      .where(
        'moduleId'
      )
      .equals(
        moduleId
      )
      .toArray()

  const validPlanificationIds =
    new Set(
      planifications
        .filter(
          (
            planification
          ) =>
            planification.active
        )
        .map(
          (
            planification
          ) =>
            planification.id
        )
    )

  if (
    validPlanificationIds.size ===
    0
  ) {
    throw new Error(
      'A UFCD selecionada não possui uma planificação ativa.'
    )
  }

  const loadedItems =
    await maProfessorDb
      .planificationItems
      .bulkGet(
        planificationItemIds
      )

  const items:
    PlanificationItem[] =
    []

  loadedItems.forEach(
    (
      item,
      index
    ) => {
      if (
        !item
      ) {
        throw new Error(
          `O item de planificação ${index + 1} já não existe.`
        )
      }

      if (
        !validPlanificationIds.has(
          item.planificationId
        )
      ) {
        throw new Error(
          'Um dos itens selecionados não pertence à UFCD da aula.'
        )
      }

      if (
        item.usedLessonId &&
        item.usedLessonId !==
          lessonId
      ) {
        throw new Error(
          'Um dos itens selecionados já foi utilizado noutra aula.'
        )
      }

      items.push(
        item
      )
    }
  )

  return items
}

async function synchronizePlanificationItems(
  previousLesson:
    Lesson | null,
  nextLesson:
    Lesson,
  validatedItems:
    PlanificationItem[],
  timestamp:
    string
) {
  const previousIds =
    new Set(
      previousLesson
        ?.planificationItemIds ??
        []
    )

  const nextIds =
    new Set(
      nextLesson
        .planificationItemIds
    )

  const validatedById =
    new Map(
      validatedItems.map(
        (
          item
        ) => [
          item.id,
          item
        ]
      )
    )

  const affectedIds =
    Array.from(
      new Set([
        ...previousIds,
        ...nextIds
      ])
    )

  if (
    affectedIds.length ===
    0
  ) {
    return
  }

  const loadedItems =
    await maProfessorDb
      .planificationItems
      .bulkGet(
        affectedIds
      )

  const updates:
    PlanificationItem[] =
    []

  loadedItems.forEach(
    (
      loadedItem
    ) => {
      if (
        !loadedItem
      ) {
        return
      }

      const selectedNext =
        nextIds.has(
          loadedItem.id
        )

      const shouldBeUsed =
        selectedNext &&
        nextLesson.status ===
          'taught'

      if (
        shouldBeUsed
      ) {
        const validated =
          validatedById.get(
            loadedItem.id
          )

        if (
          !validated
        ) {
          throw new Error(
            'Não foi possível validar um item da planificação.'
          )
        }

        updates.push({
          ...validated,
          status:
            'used',
          usedLessonId:
            nextLesson.id,
          usedAt:
            timestamp,
          updatedAt:
            timestamp
        })

        return
      }

      if (
        loadedItem.usedLessonId ===
          nextLesson.id ||
        loadedItem.usedLessonId ===
          previousLesson?.id
      ) {
        updates.push({
          ...loadedItem,
          status:
            'planned',
          usedLessonId:
            null,
          usedAt:
            null,
          updatedAt:
            timestamp
        })
      }
    }
  )

  if (
    updates.length >
    0
  ) {
    await maProfessorDb
      .planificationItems
      .bulkPut(
        updates
      )
  }
}

function removeUndefinedChanges(
  changes: LessonChanges
): LessonChanges {
  return Object.fromEntries(
    Object.entries(
      changes
    ).filter(
      ([
        ,
        value
      ]) =>
        value !==
        undefined
    )
  ) as LessonChanges
}

function normalizeLessonForSave(
  lesson: Lesson
) {
  const normalized:
    Lesson = {
    ...lesson,
    plannedActivity:
      normalizeMultilineText(
        lesson.plannedActivity
      ),
    summary:
      normalizeMultilineText(
        lesson.summary
      ),
    notes:
      normalizeMultilineText(
        lesson.notes
      ),
    planificationItemIds:
      uniqueIds(
        lesson.planificationItemIds
      )
  }

  if (
    normalized.status ===
    'cancelled'
  ) {
    normalized.countTowardProgress =
      false

    normalized.giaeStatus =
      'pending'

    normalized.giaeSubmittedAt =
      null
  }

  if (
    normalized.status !==
      'taught' &&
    normalized.giaeStatus ===
      'submitted'
  ) {
    normalized.giaeStatus =
      'pending'

    normalized.giaeSubmittedAt =
      null
  }

  return normalized
}

function assertLessonFields(
  lesson: Lesson
) {
  assertISODate(
    lesson.date,
    'A data da aula'
  )

  assertTimeRange(
    lesson.startTime,
    lesson.endTime
  )

  assertPositiveInteger(
    lesson.periodCount,
    'O número de tempos'
  )

  if (
    lesson.status ===
      'taught' &&
    !lesson.summary.trim()
  ) {
    throw new Error(
      'Indique o sumário antes de marcar a aula como dada.'
    )
  }

  if (
    lesson.giaeStatus ===
    'submitted'
  ) {
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
}

function hasGIAERelevantChanges(
  previous: Lesson,
  next: Lesson
) {
  return (
    previous.teachingAssignmentId !==
      next.teachingAssignmentId ||
    previous.moduleId !==
      next.moduleId ||
    previous.date !==
      next.date ||
    previous.startTime !==
      next.startTime ||
    previous.endTime !==
      next.endTime ||
    previous.periodCount !==
      next.periodCount ||
    previous.status !==
      next.status ||
    previous.summary !==
      next.summary
  )
}

export class LessonRepository {
  private readonly giaeInvalidatedAt =
    new Map<EntityId, string>()

  async initialize() {
    await openMAProfessorDatabase()
  }

  async getLesson(
    id: EntityId
  ) {
    await this.initialize()

    return maProfessorDb
      .lessons
      .get(
        id
      )
  }

  async listLessons(
    filters: LessonFilters
  ) {
    await this.initialize()

    let lessons =
      await maProfessorDb
        .lessons
        .where(
          'academicYearId'
        )
        .equals(
          filters.academicYearId
        )
        .toArray()

    if (
      filters.dateFrom
    ) {
      lessons =
        lessons.filter(
          (
            lesson
          ) =>
            lesson.date >=
            filters.dateFrom!
        )
    }

    if (
      filters.dateTo
    ) {
      lessons =
        lessons.filter(
          (
            lesson
          ) =>
            lesson.date <=
            filters.dateTo!
        )
    }

    if (
      filters.teachingAssignmentId
    ) {
      lessons =
        lessons.filter(
          (
            lesson
          ) =>
            lesson.teachingAssignmentId ===
            filters.teachingAssignmentId
        )
    }

    if (
      filters.moduleId
    ) {
      lessons =
        lessons.filter(
          (
            lesson
          ) =>
            lesson.moduleId ===
            filters.moduleId
        )
    }

    if (
      filters.status
    ) {
      lessons =
        lessons.filter(
          (
            lesson
          ) =>
            lesson.status ===
            filters.status
        )
    }

    if (
      filters.giaeStatus
    ) {
      lessons =
        lessons.filter(
          (
            lesson
          ) =>
            lesson.giaeStatus ===
            filters.giaeStatus
        )
    }

    if (
      filters.origin
    ) {
      lessons =
        lessons.filter(
          (
            lesson
          ) =>
            lesson.origin ===
            filters.origin
        )
    }

    return sortLessons(
      lessons
    )
  }

  async listPendingGIAELessons(
    academicYearId:
      EntityId
  ) {
    const lessons =
      await this.listLessons({
        academicYearId,
        status:
          'taught',
        giaeStatus:
          'pending'
      })

    return lessons.filter(
      (
        lesson
      ) =>
        Boolean(
          lesson.summary.trim()
        )
    )
  }

  async createLesson(
    input: LessonDraft
  ) {
    await this.initialize()

    const lesson =
      normalizeLessonForSave(
        createLessonRecord(
          input
        )
      )

    assertLessonFields(
      lesson
    )

    await getLessonContext(
      lesson
    )

    await assertNoLessonCollision(
      lesson
    )

    const validatedItems =
      await getValidatedPlanificationItems(
        lesson.moduleId,
        lesson.planificationItemIds
      )

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.lessons,
      maProfessorDb.planificationItems,
      async () => {
        await maProfessorDb
          .lessons
          .add(
            lesson
          )

        await synchronizePlanificationItems(
          null,
          lesson,
          validatedItems,
          lesson.createdAt
        )
      }
    )

    return lesson
  }

  async updateLesson(
    id: EntityId,
    changes: LessonChanges
  ) {
    await this.initialize()

    const current =
      await maProfessorDb
        .lessons
        .get(
          id
        )

    if (
      !current
    ) {
      throw new Error(
        'A aula indicada não existe.'
      )
    }

    const timestamp =
      now()

    const definedChanges =
      removeUndefinedChanges(
        changes
      )

    let next =
      normalizeLessonForSave({
        ...current,
        ...definedChanges,
        id:
          current.id,
        academicYearId:
          current.academicYearId,
        createdAt:
          current.createdAt,
        updatedAt:
          timestamp,
        planificationItemIds:
          definedChanges
            .planificationItemIds ===
          undefined
            ? current
                .planificationItemIds
            : definedChanges
                .planificationItemIds
      })

    if (
      current.status ===
        'cancelled' &&
      next.status !==
        'cancelled' &&
      definedChanges
        .countTowardProgress ===
        undefined
    ) {
      next = {
        ...next,
        countTowardProgress:
          true
      }
    }

    const giaeInvalidated =
      current.giaeStatus ===
        'submitted' &&
      hasGIAERelevantChanges(
        current,
        next
      )

    if (
      giaeInvalidated
    ) {
      next = {
        ...next,
        giaeStatus:
          'pending',
        giaeSubmittedAt:
          null
      }
    }

    assertLessonFields(
      next
    )

    await getLessonContext(
      next
    )

    await assertNoLessonCollision(
      next,
      current.id
    )

    const validatedItems =
      await getValidatedPlanificationItems(
        next.moduleId,
        next.planificationItemIds,
        current.id
      )

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.lessons,
      maProfessorDb.planificationItems,
      async () => {
        await maProfessorDb
          .lessons
          .put(
            next
          )

        await synchronizePlanificationItems(
          current,
          next,
          validatedItems,
          timestamp
        )
      }
    )

    if (
      giaeInvalidated
    ) {
      this.giaeInvalidatedAt.set(
        id,
        next.updatedAt
      )
    } else {
      this.giaeInvalidatedAt.delete(
        id
      )
    }

    return next
  }

  async markLessonTaught(
    id: EntityId,
    input: {
      summary: string
      summarySource?: SummarySource
      plannedActivity?: string
      planificationItemIds?: EntityId[]
      notes?: string
      countTowardProgress?: boolean
    }
  ) {
    return this.updateLesson(
      id,
      {
        status:
          'taught',
        summary:
          input.summary,
        summarySource:
          input.summarySource ??
          'manual',
        plannedActivity:
          input.plannedActivity,
        planificationItemIds:
          input.planificationItemIds,
        notes:
          input.notes,
        countTowardProgress:
          input.countTowardProgress ??
          true
      }
    )
  }

  async cancelLesson(
    id: EntityId,
    reason =
      ''
  ) {
    return this.updateLesson(
      id,
      {
        status:
          'cancelled',
        countTowardProgress:
          false,
        ...(
          reason.trim()
            ? {
                notes:
                  reason
              }
            : {}
        )
      }
    )
  }

  async reopenLesson(
    id: EntityId
  ) {
    return this.updateLesson(
      id,
      {
        status:
          'planned',
        countTowardProgress:
          true
      }
    )
  }

  async markGIAESubmitted(
    id: EntityId
  ) {
    await this.initialize()

    const lesson =
      await maProfessorDb
        .lessons
        .get(
          id
        )

    if (
      !lesson
    ) {
      throw new Error(
        'A aula indicada não existe.'
      )
    }

    const invalidatedAt =
      this.giaeInvalidatedAt.get(
        id
      )

    if (
      invalidatedAt &&
      invalidatedAt ===
        lesson.updatedAt
    ) {
      this.giaeInvalidatedAt.delete(
        id
      )

      return lesson
    }

    this.giaeInvalidatedAt.delete(
      id
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

    const timestamp =
      now()

    const updated:
      Lesson = {
      ...lesson,
      giaeStatus:
        'submitted',
      giaeSubmittedAt:
        timestamp,
      updatedAt:
        timestamp
    }

    await maProfessorDb
      .lessons
      .put(
        updated
      )

    return updated
  }

  async markGIAEPending(
    id: EntityId
  ) {
    await this.initialize()

    const lesson =
      await maProfessorDb
        .lessons
        .get(
          id
        )

    if (
      !lesson
    ) {
      throw new Error(
        'A aula indicada não existe.'
      )
    }

    this.giaeInvalidatedAt.delete(
      id
    )

    const updated:
      Lesson = {
      ...lesson,
      giaeStatus:
        'pending',
      giaeSubmittedAt:
        null,
      updatedAt:
        now()
    }

    await maProfessorDb
      .lessons
      .put(
        updated
      )

    return updated
  }

  async markManyGIAESubmitted(
    ids: EntityId[]
  ) {
    await this.initialize()

    const uniqueLessonIds =
      uniqueIds(
        ids
      )

    if (
      uniqueLessonIds.length ===
      0
    ) {
      return []
    }

    const lessons =
      await maProfessorDb
        .lessons
        .bulkGet(
          uniqueLessonIds
        )

    const timestamp =
      now()

    const updated =
      lessons.map(
        (
          lesson,
          index
        ) => {
          if (
            !lesson
          ) {
            throw new Error(
              `A aula ${index + 1} já não existe.`
            )
          }

          if (
            lesson.status !==
              'taught' ||
            !lesson.summary.trim()
          ) {
            throw new Error(
              'Todas as aulas selecionadas devem estar dadas e possuir sumário.'
            )
          }

          return {
            ...lesson,
            giaeStatus:
              'submitted' as const,
            giaeSubmittedAt:
              timestamp,
            updatedAt:
              timestamp
          }
        }
      )

    await maProfessorDb
      .lessons
      .bulkPut(
        updated
      )

    uniqueLessonIds.forEach(
      lessonId => {
        this.giaeInvalidatedAt.delete(
          lessonId
        )
      }
    )

    return updated
  }

  async getPreviousLessonTemplate(
    teachingAssignmentId:
      EntityId,
    beforeDate:
      ISODate,
    beforeStartTime =
      '23:59'
  ): Promise<
    PreviousLessonTemplate | null
  > {
    await this.initialize()

    const lessons =
      await maProfessorDb
        .lessons
        .where(
          'teachingAssignmentId'
        )
        .equals(
          teachingAssignmentId
        )
        .toArray()

    const previous =
      lessons
        .filter(
          (
            lesson
          ) =>
            lesson.status ===
              'taught' &&
            (
              lesson.date <
                beforeDate ||
              (
                lesson.date ===
                  beforeDate &&
                lesson.startTime <
                  beforeStartTime
              )
            )
        )
        .sort(
          (
            left,
            right
          ) => {
            const dateComparison =
              right.date.localeCompare(
                left.date
              )

            if (
              dateComparison !==
              0
            ) {
              return dateComparison
            }

            return right.startTime.localeCompare(
              left.startTime
            )
          }
        )[0]

    if (
      !previous
    ) {
      return null
    }

    return {
      sourceLessonId:
        previous.id,
      plannedActivity:
        previous.plannedActivity,
      summary:
        previous.summary,
      notes:
        previous.notes
    }
  }

  async getNextPlanificationItem(
    moduleId:
      EntityId
  ) {
    await this.initialize()

    const planifications =
      await maProfessorDb
        .planifications
        .where(
          'moduleId'
        )
        .equals(
          moduleId
        )
        .toArray()

    const activePlanification =
      planifications.find(
        (
          planification
        ) =>
          planification.active
      )

    if (
      !activePlanification
    ) {
      return null
    }

    const items =
      await maProfessorDb
        .planificationItems
        .where(
          'planificationId'
        )
        .equals(
          activePlanification.id
        )
        .toArray()

    return (
      items
        .filter(
          (
            item
          ) =>
            item.status ===
              'planned' &&
            !item.usedLessonId
        )
        .sort(
          (
            left,
            right
          ) =>
            left.order -
            right.order
        )[0] ??
      null
    )
  }

  async deletePlannedLesson(
    id: EntityId
  ) {
    await this.initialize()

    const lesson =
      await maProfessorDb
        .lessons
        .get(
          id
        )

    if (
      !lesson
    ) {
      return false
    }

    if (
      lesson.status !==
      'planned'
    ) {
      throw new Error(
        'Apenas aulas ainda planeadas podem ser eliminadas.'
      )
    }

    const [
      attendanceCount,
      assessmentCount,
      suggestionCount
    ] =
      await Promise.all([
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
          .count(),
        maProfessorDb
          .summarySuggestions
          .where(
            'lessonId'
          )
          .equals(
            id
          )
          .count()
      ])

    if (
      attendanceCount >
        0 ||
      assessmentCount >
        0 ||
      suggestionCount >
        0
    ) {
      throw new Error(
        'Esta aula já possui dados associados e não pode ser eliminada.'
      )
    }

    const timestamp =
      now()

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.lessons,
      maProfessorDb.planificationItems,
      async () => {
        const items =
          await maProfessorDb
            .planificationItems
            .bulkGet(
              lesson.planificationItemIds
            )

        const releasedItems =
          items
            .filter(
              (
                item
              ): item is PlanificationItem =>
                Boolean(
                  item &&
                  item.usedLessonId ===
                    lesson.id
                )
            )
            .map(
              (
                item
              ) => ({
                ...item,
                status:
                  'planned' as const,
                usedLessonId:
                  null,
                usedAt:
                  null,
                updatedAt:
                  timestamp
              })
            )

        if (
          releasedItems.length >
          0
        ) {
          await maProfessorDb
            .planificationItems
            .bulkPut(
              releasedItems
            )
        }

        await maProfessorDb
          .lessons
          .delete(
            id
          )
      }
    )

    this.giaeInvalidatedAt.delete(
      id
    )

    return true
  }

  async generateScheduledLessons(
    input:
      ScheduledLessonGenerationInput
  ): Promise<
    ScheduledLessonGenerationResult
  > {
    await this.initialize()

    assertISODate(
      input.dateFrom,
      'A data inicial'
    )

    assertISODate(
      input.dateTo,
      'A data final'
    )

    if (
      input.dateFrom >
      input.dateTo
    ) {
      throw new Error(
        'A data inicial não pode ser posterior à data final.'
      )
    }

    const dayCount =
      getInclusiveDayCount(
        input.dateFrom,
        input.dateTo
      )

    if (
      dayCount >
      MAX_GENERATION_DAYS
    ) {
      throw new Error(
        `Só é possível gerar até ${MAX_GENERATION_DAYS} dias de cada vez.`
      )
    }

    const academicYear =
      await maProfessorDb
        .academicYears
        .get(
          input.academicYearId
        )

    if (
      !academicYear
    ) {
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
        'O intervalo deve ficar dentro do ano letivo.'
      )
    }

    const [
      allAssignments,
      allSlots,
      allModules,
      allEvents,
      existingLessons
    ] =
      await Promise.all([
        maProfessorDb
          .teachingAssignments
          .where(
            'academicYearId'
          )
          .equals(
            input.academicYearId
          )
          .toArray(),
        maProfessorDb
          .weeklyScheduleSlots
          .where(
            'academicYearId'
          )
          .equals(
            input.academicYearId
          )
          .toArray(),
        maProfessorDb
          .modules
          .where(
            'academicYearId'
          )
          .equals(
            input.academicYearId
          )
          .toArray(),
        maProfessorDb
          .schoolCalendarEvents
          .where(
            'academicYearId'
          )
          .equals(
            input.academicYearId
          )
          .toArray(),
        maProfessorDb
          .lessons
          .where(
            'academicYearId'
          )
          .equals(
            input.academicYearId
          )
          .toArray()
      ])

    const assignments =
      allAssignments.filter(
        (
          assignment
        ) =>
          assignment.active &&
          (
            !input.teachingAssignmentId ||
            assignment.id ===
              input.teachingAssignmentId
          )
      )

    if (
      input.teachingAssignmentId &&
      assignments.length ===
        0
    ) {
      throw new Error(
        'A turma e disciplina selecionadas não existem ou estão inativas.'
      )
    }

    const assignmentById =
      new Map(
        assignments.map(
          (
            assignment
          ) => [
            assignment.id,
            assignment
          ]
        )
      )

    const slots =
      allSlots
        .filter(
          (
            slot
          ) =>
            slot.active &&
            assignmentById.has(
              slot.teachingAssignmentId
            )
        )
        .sort(
          (
            left,
            right
          ) => {
            if (
              left.weekday !==
              right.weekday
            ) {
              return (
                left.weekday -
                right.weekday
              )
            }

            return left.startTime.localeCompare(
              right.startTime
            )
          }
        )

    const modulesByAssignment =
      new Map<
        EntityId,
        ModuleUnit[]
      >()

    assignments.forEach(
      (
        assignment
      ) => {
        modulesByAssignment.set(
          assignment.id,
          []
        )
      }
    )

    allModules
      .filter(
        (
          module
        ) =>
          module.active &&
          assignmentById.has(
            module.teachingAssignmentId
          )
      )
      .forEach(
        (
          module
        ) => {
          const modules =
            modulesByAssignment.get(
              module.teachingAssignmentId
            ) ??
            []

          modules.push(
            module
          )

          modulesByAssignment.set(
            module.teachingAssignmentId,
            modules
          )
        }
      )

    modulesByAssignment.forEach(
      (
        modules
      ) => {
        modules.sort(
          (
            left,
            right
          ) =>
            left.order -
            right.order
        )
      }
    )

    const allocatedPeriodsByModule =
      new Map<
        EntityId,
        number
      >()

    const existingProgressLessons =
      existingLessons
        .filter(
          (
            lesson
          ) =>
            lesson.status !==
              'cancelled' &&
            lesson.countTowardProgress
        )
        .sort(
          (
            left,
            right
          ) => {
            const dateComparison =
              left.date.localeCompare(
                right.date
              )

            if (
              dateComparison !==
              0
            ) {
              return dateComparison
            }

            return left.startTime.localeCompare(
              right.startTime
            )
          }
        )

    let existingProgressIndex =
      0

    function includeExistingProgressUntil(
      date: ISODate,
      startTime:
        LocalTime
    ) {
      while (
        existingProgressIndex <
        existingProgressLessons.length
      ) {
        const lesson =
          existingProgressLessons[
            existingProgressIndex
          ]

        const occursBeforeOrAt =
          lesson.date <
            date ||
          (
            lesson.date ===
              date &&
            lesson.startTime <=
              startTime
          )

        if (
          !occursBeforeOrAt
        ) {
          break
        }

        allocatedPeriodsByModule.set(
          lesson.moduleId,
          (
            allocatedPeriodsByModule.get(
              lesson.moduleId
            ) ??
            0
          ) +
            lesson.periodCount
        )

        existingProgressIndex +=
          1
      }
    }

    const occupiedPositions =
      new Set(
        existingLessons.map(
          (
            lesson
          ) =>
            lessonPositionKey(
              lesson.teachingAssignmentId,
              lesson.date,
              lesson.startTime
            )
        )
      )

    const timestamp =
      now()

    const generated:
      Lesson[] =
      []

    let skippedExisting =
      0

    let skippedWithoutModule =
      0

    let createdOutsidePlannedCapacity =
      0

    for (
      let date =
        input.dateFrom;
      date <=
      input.dateTo;
      date =
        addDays(
          date,
          1
        )
    ) {
      const weekday =
        getWeekday(
          date
        )

      const matchingSlots =
        slots.filter(
          (
            slot
          ) =>
            slot.weekday ===
              weekday &&
            date >=
              slot.validFrom &&
            date <=
              slot.validUntil
        )

      for (
        const slot
        of matchingSlots
      ) {
        includeExistingProgressUntil(
          date,
          slot.startTime
        )

        const assignment =
          assignmentById.get(
            slot.teachingAssignmentId
          )

        if (
          !assignment
        ) {
          continue
        }

        const positionKey =
          lessonPositionKey(
            assignment.id,
            date,
            slot.startTime
          )

        if (
          occupiedPositions.has(
            positionKey
          )
        ) {
          skippedExisting +=
            1

          continue
        }

        const modules =
          modulesByAssignment.get(
            assignment.id
          ) ??
          []

        const module =
          selectModuleForAllocation(
            modules,
            allocatedPeriodsByModule
          )

        if (
          !module
        ) {
          skippedWithoutModule +=
            1

          continue
        }

        const blockingEvents =
          getBlockingEvents(
            allEvents,
            assignment,
            date
          )

        const blocked =
          blockingEvents.length >
          0

        if (
          blocked &&
          input.createCancelledForBlockedDates ===
            false
        ) {
          continue
        }

        const withinCapacity =
          isWithinModuleCapacity(
            module,
            allocatedPeriodsByModule
          )

        const lesson =
          createLessonRecord(
            {
              academicYearId:
                input.academicYearId,
              teachingAssignmentId:
                assignment.id,
              moduleId:
                module.id,
              scheduleSlotId:
                slot.id,
              origin:
                'scheduled',
              status:
                blocked
                  ? 'cancelled'
                  : 'planned',
              date,
              startTime:
                slot.startTime,
              endTime:
                slot.endTime,
              periodCount:
                slot.periodCount,
              countTowardProgress:
                blocked
                  ? false
                  : withinCapacity,
              plannedActivity:
                '',
              summary:
                '',
              summarySource:
                'manual',
              planificationItemIds:
                [],
              notes:
                blocked
                  ? buildBlockedLessonNote(
                      blockingEvents
                    )
                  : ''
            },
            timestamp
          )

        generated.push(
          lesson
        )

        occupiedPositions.add(
          positionKey
        )

        if (
          !blocked
        ) {
          if (
            !withinCapacity
          ) {
            createdOutsidePlannedCapacity +=
              1
          }

          if (
            lesson.countTowardProgress
          ) {
            allocatedPeriodsByModule.set(
              module.id,
              (
                allocatedPeriodsByModule.get(
                  module.id
                ) ??
                0
              ) +
                lesson.periodCount
            )
          }
        }
      }
    }

    if (
      generated.length >
      0
    ) {
      await maProfessorDb
        .lessons
        .bulkAdd(
          generated
        )
    }

    return {
      created:
        sortLessons(
          generated
        ),
      createdPlanned:
        generated.filter(
          (
            lesson
          ) =>
            lesson.status ===
            'planned'
        ).length,
      createdCancelled:
        generated.filter(
          (
            lesson
          ) =>
            lesson.status ===
            'cancelled'
        ).length,
      skippedExisting,
      skippedWithoutModule,
      createdOutsidePlannedCapacity
    }
  }
}

export function formatLessonSummaryForGIAE(
  lesson: Lesson
) {
  return lesson.summary.trim()
}

export function formatLessonsForBulkGIAE(
  lessons: Lesson[]
) {
  return sortLessons([
    ...lessons
  ])
    .filter(
      (
        lesson
      ) =>
        lesson.status ===
          'taught' &&
        Boolean(
          lesson.summary.trim()
        )
    )
    .map(
      (
        lesson
      ) =>
        lesson.summary.trim()
    )
    .join(
      '\n\n'
    )
}

export const lessonRepository =
  new LessonRepository()
