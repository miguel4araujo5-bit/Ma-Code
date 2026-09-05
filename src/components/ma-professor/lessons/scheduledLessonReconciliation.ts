import type {
  AcademicYear,
  EntityId,
  ISODate,
  Lesson,
  ModuleUnit,
  SchoolCalendarEvent,
  TeachingAssignment,
  WeeklyScheduleSlot
} from '../types'

export interface ScheduledLessonCreationPlan {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  scheduleSlotId: EntityId
  origin: 'scheduled'
  status: 'planned'
  date: ISODate
  startTime: string
  endTime: string
  periodCount: number
  countTowardProgress: boolean
  plannedActivity: string
  summary: string
  summarySource: 'manual'
  planificationItemIds: EntityId[]
  notes: string
}

export interface ScheduledLessonReconciliationPlanInput {
  academicYear: AcademicYear
  assignments: TeachingAssignment[]
  slots: WeeklyScheduleSlot[]
  modules: ModuleUnit[]
  events: SchoolCalendarEvent[]
  lessons: Lesson[]
  relatedLessonIds: ReadonlySet<EntityId>
  dateFrom: ISODate
  dateTo: ISODate
}

export interface ScheduledLessonReconciliationPlan {
  deleteLessonIds: EntityId[]
  createLessons: ScheduledLessonCreationPlan[]
  preservedLessonIds: EntityId[]
  skippedWithoutModule: number
  createdOutsidePlannedCapacity: number
}

interface ExpectedOccurrence {
  key: string
  slot: WeeklyScheduleSlot
  assignment: TeachingAssignment
  date: ISODate
  blocked: boolean
}

function parseISODate(
  value: ISODate
) {
  const [
    year,
    month,
    day
  ] = value
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
): ISODate {
  return [
    String(
      value.getUTCFullYear()
    ).padStart(
      4,
      '0'
    ),
    String(
      value.getUTCMonth() + 1
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
  amount: number
): ISODate {
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
  value: ISODate
) {
  const weekday =
    parseISODate(
      value
    ).getUTCDay()

  return weekday === 0
    ? 7
    : weekday
}

function getStartOfWeek(
  value: ISODate
): ISODate {
  return addDays(
    value,
    -(
      getWeekday(
        value
      ) - 1
    )
  )
}

function lessonPositionKey(
  teachingAssignmentId: EntityId,
  date: ISODate,
  startTime: string
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
    date < event.startDate ||
    date > event.endDate
  ) {
    return false
  }

  if (event.scope === 'all') {
    return true
  }

  if (event.scope === 'group') {
    return event.groupId ===
      assignment.groupId
  }

  return event.teachingAssignmentId ===
    assignment.id
}

function matchesExpectedOccurrence(
  lesson: Lesson,
  expected: ExpectedOccurrence
) {
  return (
    lesson.origin === 'scheduled' &&
    lesson.scheduleSlotId ===
      expected.slot.id &&
    lesson.teachingAssignmentId ===
      expected.assignment.id &&
    lesson.date === expected.date &&
    lesson.startTime ===
      expected.slot.startTime &&
    lesson.endTime ===
      expected.slot.endTime &&
    lesson.periodCount ===
      expected.slot.periodCount
  )
}

function sortLessonsChronologically(
  lessons: Lesson[]
) {
  return [...lessons].sort(
    (left, right) =>
      left.date.localeCompare(
        right.date
      ) ||
      left.startTime.localeCompare(
        right.startTime
      ) ||
      left.createdAt.localeCompare(
        right.createdAt
      )
  )
}

function sortExpectedOccurrences(
  rows: ExpectedOccurrence[]
) {
  return [...rows].sort(
    (left, right) =>
      left.date.localeCompare(
        right.date
      ) ||
      left.slot.startTime.localeCompare(
        right.slot.startTime
      ) ||
      left.slot.id.localeCompare(
        right.slot.id
      )
  )
}

function selectModuleForAllocation(
  modules: ModuleUnit[],
  allocatedPeriodsByModule:
    Map<EntityId, number>
) {
  return (
    modules.find(
      module =>
        (
          allocatedPeriodsByModule.get(
            module.id
          ) ?? 0
        ) < module.plannedPeriods
    ) ??
    modules[
      modules.length - 1
    ] ??
    null
  )
}

export function getScheduleOccurrenceKey(
  scheduleSlotId: EntityId,
  date: ISODate
) {
  return `${scheduleSlotId}|${getStartOfWeek(
    date
  )}`
}

export function isPristineScheduledLesson(
  lesson: Lesson,
  hasRelatedData: boolean
) {
  return (
    lesson.origin ===
      'scheduled' &&
    lesson.status ===
      'planned' &&
    Boolean(
      lesson.scheduleSlotId
    ) &&
    lesson.createdAt ===
      lesson.updatedAt &&
    !lesson.plannedActivity.trim() &&
    !lesson.summary.trim() &&
    lesson.planificationItemIds.length ===
      0 &&
    lesson.giaeStatus ===
      'pending' &&
    lesson.giaeSubmittedAt ===
      null &&
    !lesson.notes.trim() &&
    !hasRelatedData
  )
}

export function planScheduledLessonReconciliation(
  input: ScheduledLessonReconciliationPlanInput
): ScheduledLessonReconciliationPlan {
  const activeAssignmentById =
    new Map(
      input.assignments
        .filter(
          assignment =>
            assignment.active
        )
        .map(
          assignment => [
            assignment.id,
            assignment
          ]
        )
    )

  const activeSlots =
    input.slots.filter(
      slot =>
        slot.active &&
        activeAssignmentById.has(
          slot.teachingAssignmentId
        )
    )

  const expectedByKey =
    new Map<string, ExpectedOccurrence>()

  for (
    let date = input.dateFrom;
    date <= input.dateTo;
    date = addDays(date, 1)
  ) {
    const weekday =
      getWeekday(date)

    for (const slot of activeSlots) {
      if (
        slot.weekday !== weekday ||
        date < slot.validFrom ||
        date > slot.validUntil
      ) {
        continue
      }

      const assignment =
        activeAssignmentById.get(
          slot.teachingAssignmentId
        )

      if (!assignment) {
        continue
      }

      const key =
        getScheduleOccurrenceKey(
          slot.id,
          date
        )

      expectedByKey.set(
        key,
        {
          key,
          slot,
          assignment,
          date,
          blocked:
            input.events.some(
              event =>
                eventBlocksAssignment(
                  event,
                  assignment,
                  date
                )
            )
        }
      )
    }
  }

  const existingByOccurrence =
    new Map<string, Lesson[]>()

  input.lessons.forEach(
    lesson => {
      if (
        lesson.origin !==
          'scheduled' ||
        !lesson.scheduleSlotId
      ) {
        return
      }

      const key =
        getScheduleOccurrenceKey(
          lesson.scheduleSlotId,
          lesson.date
        )

      const rows =
        existingByOccurrence.get(
          key
        ) ?? []

      rows.push(lesson)
      existingByOccurrence.set(
        key,
        rows
      )
    }
  )

  const deleteLessonIds =
    new Set<EntityId>()
  const preservedLessonIds =
    new Set<EntityId>()
  const createCandidates:
    ExpectedOccurrence[] = []

  for (
    const expected of
      sortExpectedOccurrences([
        ...expectedByKey.values()
      ])
  ) {
    const existing =
      existingByOccurrence.get(
        expected.key
      ) ?? []

    let hasProtectedOccupant =
      false
    let hasMatchingOccupant =
      false

    for (const lesson of existing) {
      const hasRelatedData =
        input.relatedLessonIds.has(
          lesson.id
        )

      const pristine =
        isPristineScheduledLesson(
          lesson,
          hasRelatedData
        )

      if (expected.blocked) {
        if (pristine) {
          deleteLessonIds.add(
            lesson.id
          )
        } else {
          preservedLessonIds.add(
            lesson.id
          )
          hasProtectedOccupant =
            true
        }

        continue
      }

      if (
        matchesExpectedOccurrence(
          lesson,
          expected
        )
      ) {
        preservedLessonIds.add(
          lesson.id
        )
        hasMatchingOccupant =
          true
        continue
      }

      if (pristine) {
        deleteLessonIds.add(
          lesson.id
        )
      } else {
        preservedLessonIds.add(
          lesson.id
        )
        hasProtectedOccupant =
          true
      }
    }

    if (
      !expected.blocked &&
      !hasMatchingOccupant &&
      !hasProtectedOccupant
    ) {
      createCandidates.push(
        expected
      )
    }
  }

  input.lessons.forEach(
    lesson => {
      if (
        lesson.origin !==
          'scheduled' ||
        !lesson.scheduleSlotId
      ) {
        return
      }

      const key =
        getScheduleOccurrenceKey(
          lesson.scheduleSlotId,
          lesson.date
        )

      if (expectedByKey.has(key)) {
        return
      }

      if (
        lesson.date < input.dateFrom ||
        lesson.date > input.dateTo
      ) {
        return
      }

      if (
        isPristineScheduledLesson(
          lesson,
          input.relatedLessonIds.has(
            lesson.id
          )
        )
      ) {
        deleteLessonIds.add(
          lesson.id
        )
      } else {
        preservedLessonIds.add(
          lesson.id
        )
      }
    }
  )

  const remainingLessons =
    input.lessons.filter(
      lesson =>
        !deleteLessonIds.has(
          lesson.id
        )
    )

  const occupiedPositions =
    new Set(
      remainingLessons.map(
        lesson =>
          lessonPositionKey(
            lesson.teachingAssignmentId,
            lesson.date,
            lesson.startTime
          )
      )
    )

  const modulesByAssignment =
    new Map<EntityId, ModuleUnit[]>()

  input.modules
    .filter(
      module =>
        module.active &&
        activeAssignmentById.has(
          module.teachingAssignmentId
        )
    )
    .forEach(
      module => {
        const modules =
          modulesByAssignment.get(
            module.teachingAssignmentId
          ) ?? []

        modules.push(module)
        modulesByAssignment.set(
          module.teachingAssignmentId,
          modules
        )
      }
    )

  modulesByAssignment.forEach(
    modules =>
      modules.sort(
        (left, right) =>
          left.order - right.order
      )
  )

  const progressLessons =
    sortLessonsChronologically(
      remainingLessons.filter(
        lesson =>
          lesson.status !==
            'cancelled' &&
          lesson.countTowardProgress
      )
    )

  const allocatedPeriodsByModule =
    new Map<EntityId, number>()

  let progressIndex = 0
  let skippedWithoutModule = 0
  let createdOutsidePlannedCapacity = 0
  const createLessons:
    ScheduledLessonCreationPlan[] = []

  for (
    const expected of
      sortExpectedOccurrences(
        createCandidates
      )
  ) {
    while (
      progressIndex <
      progressLessons.length
    ) {
      const lesson =
        progressLessons[
          progressIndex
        ]

      const occursBeforeOrAt =
        lesson.date < expected.date ||
        (
          lesson.date ===
            expected.date &&
          lesson.startTime <=
            expected.slot.startTime
        )

      if (!occursBeforeOrAt) {
        break
      }

      allocatedPeriodsByModule.set(
        lesson.moduleId,
        (
          allocatedPeriodsByModule.get(
            lesson.moduleId
          ) ?? 0
        ) + lesson.periodCount
      )

      progressIndex += 1
    }

    const positionKey =
      lessonPositionKey(
        expected.assignment.id,
        expected.date,
        expected.slot.startTime
      )

    if (
      occupiedPositions.has(
        positionKey
      )
    ) {
      continue
    }

    const modules =
      modulesByAssignment.get(
        expected.assignment.id
      ) ?? []

    const module =
      selectModuleForAllocation(
        modules,
        allocatedPeriodsByModule
      )

    if (!module) {
      skippedWithoutModule += 1
      continue
    }

    const allocated =
      allocatedPeriodsByModule.get(
        module.id
      ) ?? 0

    const withinCapacity =
      allocated <
      module.plannedPeriods

    if (!withinCapacity) {
      createdOutsidePlannedCapacity += 1
    }

    createLessons.push({
      academicYearId:
        input.academicYear.id,
      teachingAssignmentId:
        expected.assignment.id,
      moduleId:
        module.id,
      scheduleSlotId:
        expected.slot.id,
      origin: 'scheduled',
      status: 'planned',
      date:
        expected.date,
      startTime:
        expected.slot.startTime,
      endTime:
        expected.slot.endTime,
      periodCount:
        expected.slot.periodCount,
      countTowardProgress:
        withinCapacity,
      plannedActivity: '',
      summary: '',
      summarySource: 'manual',
      planificationItemIds: [],
      notes: ''
    })

    occupiedPositions.add(
      positionKey
    )

    if (withinCapacity) {
      allocatedPeriodsByModule.set(
        module.id,
        allocated +
          expected.slot.periodCount
      )
    }
  }

  return {
    deleteLessonIds: [
      ...deleteLessonIds
    ],
    createLessons,
    preservedLessonIds: [
      ...preservedLessonIds
    ],
    skippedWithoutModule,
    createdOutsidePlannedCapacity
  }
}
