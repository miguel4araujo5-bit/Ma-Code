import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  AcademicYear,
  ClassGroup,
  EntityId,
  ISODate,
  Lesson,
  ModuleUnit,
  SchoolCalendarEvent,
  TeachingAssignment,
  WeeklyScheduleSlot
} from '../types'

export const REGULAR_ANNUAL_COMPONENT_NAME =
  'Componente anual'

export interface RegularAnnualComponentSyncResult {
  created: EntityId[]
  updated: EntityId[]
  skippedExplicitAssignments: EntityId[]
}

function createEntityId(
  prefix: string
): EntityId {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 12)}`
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
    ).padStart(4, '0'),
    String(
      value.getUTCMonth() + 1
    ).padStart(2, '0'),
    String(
      value.getUTCDate()
    ).padStart(2, '0')
  ].join('-')
}

function addDays(
  value: ISODate,
  amount: number
): ISODate {
  const date =
    parseISODate(value)

  date.setUTCDate(
    date.getUTCDate() + amount
  )

  return formatISODate(date)
}

function getWeekday(
  value: ISODate
) {
  const weekday =
    parseISODate(value)
      .getUTCDay()

  return weekday === 0
    ? 7
    : weekday
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

export function isRegularEducationGroup(
  group: ClassGroup | null | undefined
) {
  return group?.educationType ===
    'regular'
}

export function isRegularAnnualComponent(
  module: ModuleUnit
) {
  return module.regularAnnual ===
    true
}

export function calculateRegularAnnualPlannedPeriods(
  input: {
    academicYear: AcademicYear
    assignment: TeachingAssignment
    slots: WeeklyScheduleSlot[]
    events: SchoolCalendarEvent[]
  }
) {
  const activeSlots =
    input.slots.filter(
      slot =>
        slot.active &&
        slot.teachingAssignmentId ===
          input.assignment.id
    )

  let plannedPeriods = 0

  for (
    let date = input.academicYear.startDate;
    date <= input.academicYear.endDate;
    date = addDays(date, 1)
  ) {
    if (
      input.events.some(
        event =>
          eventBlocksAssignment(
            event,
            input.assignment,
            date
          )
      )
    ) {
      continue
    }

    const weekday =
      getWeekday(date)

    for (const slot of activeSlots) {
      if (
        slot.weekday === weekday &&
        date >= slot.validFrom &&
        date <= slot.validUntil
      ) {
        plannedPeriods +=
          slot.periodCount
      }
    }
  }

  return plannedPeriods
}

function taughtPeriodsForModule(
  moduleId: EntityId,
  lessons: Lesson[]
) {
  return lessons
    .filter(
      lesson =>
        lesson.moduleId ===
          moduleId &&
        lesson.status ===
          'taught' &&
        lesson.countTowardProgress
    )
    .reduce(
      (
        total,
        lesson
      ) =>
        total +
        lesson.periodCount,
      0
    )
}

export async function syncRegularAnnualComponentsInCurrentContext(
  academicYearId: EntityId
): Promise<RegularAnnualComponentSyncResult> {
  const [
    academicYear,
    groups,
    assignments,
    slots,
    modules,
    events,
    lessons
  ] = await Promise.all([
    maProfessorDb.academicYears.get(
      academicYearId
    ),
    maProfessorDb.groups
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.teachingAssignments
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.weeklyScheduleSlots
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.modules
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.schoolCalendarEvents
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.lessons
      .where('academicYearId')
      .equals(academicYearId)
      .toArray()
  ])

  if (!academicYear) {
    throw new Error(
      'O ano letivo indicado não existe.'
    )
  }

  const groupById =
    new Map(
      groups.map(group => [
        group.id,
        group
      ])
    )

  const modulesByAssignment =
    new Map<EntityId, ModuleUnit[]>()

  modules.forEach(module => {
    const rows =
      modulesByAssignment.get(
        module.teachingAssignmentId
      ) ?? []

    rows.push(module)
    modulesByAssignment.set(
      module.teachingAssignmentId,
      rows
    )
  })

  const result:
    RegularAnnualComponentSyncResult = {
      created: [],
      updated: [],
      skippedExplicitAssignments: []
    }

  for (const assignment of assignments) {
    const group =
      groupById.get(
        assignment.groupId
      )

    if (
      !assignment.active ||
      !group?.active ||
      !isRegularEducationGroup(group)
    ) {
      continue
    }

    const plannedFromSchedule =
      calculateRegularAnnualPlannedPeriods({
        academicYear,
        assignment,
        slots,
        events
      })

    const assignmentModules =
      modulesByAssignment.get(
        assignment.id
      ) ?? []

    const annualComponent =
      assignmentModules.find(
        isRegularAnnualComponent
      )

    if (!annualComponent) {
      if (
        assignmentModules.length > 0
      ) {
        result.skippedExplicitAssignments.push(
          assignment.id
        )
        continue
      }

      if (
        plannedFromSchedule <= 0
      ) {
        continue
      }

      const timestamp =
        new Date().toISOString()

      const created: ModuleUnit = {
        id:
          createEntityId(
            'regular-annual'
          ),
        academicYearId,
        teachingAssignmentId:
          assignment.id,
        code: '',
        name:
          REGULAR_ANNUAL_COMPONENT_NAME,
        plannedPeriods:
          plannedFromSchedule,
        order: 1,
        plannedStartDate:
          academicYear.startDate,
        plannedEndDate:
          academicYear.endDate,
        regularAnnual: true,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }

      await maProfessorDb.modules.add(
        created
      )

      assignmentModules.push(
        created
      )
      modulesByAssignment.set(
        assignment.id,
        assignmentModules
      )
      result.created.push(
        created.id
      )
      continue
    }

    if (
      plannedFromSchedule <= 0
    ) {
      continue
    }

    const plannedPeriods =
      Math.max(
        plannedFromSchedule,
        taughtPeriodsForModule(
          annualComponent.id,
          lessons
        ),
        1
      )

    if (
      annualComponent.name ===
        REGULAR_ANNUAL_COMPONENT_NAME &&
      annualComponent.code === '' &&
      annualComponent.plannedPeriods ===
        plannedPeriods &&
      annualComponent.order === 1 &&
      annualComponent.plannedStartDate ===
        academicYear.startDate &&
      annualComponent.plannedEndDate ===
        academicYear.endDate &&
      annualComponent.active
    ) {
      continue
    }

    await maProfessorDb.modules.put({
      ...annualComponent,
      code: '',
      name:
        REGULAR_ANNUAL_COMPONENT_NAME,
      plannedPeriods,
      order: 1,
      plannedStartDate:
        academicYear.startDate,
      plannedEndDate:
        academicYear.endDate,
      regularAnnual: true,
      active: true,
      updatedAt:
        new Date().toISOString()
    })

    result.updated.push(
      annualComponent.id
    )
  }

  return result
}

export async function syncRegularAnnualComponentsForAcademicYear(
  academicYearId: EntityId
) {
  await openMAProfessorDatabase()

  return syncRegularAnnualComponentsInCurrentContext(
    academicYearId
  )
}
