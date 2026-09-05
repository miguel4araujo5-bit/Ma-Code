import {
  calendarEventContainsDate,
  calendarRepository,
  getSchoolCalendarEventScopeLabel,
  getSchoolCalendarEventTypeLabel
} from './calendarRepository'

import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import {
  lessonRepository,
  type PreviousLessonTemplate
} from '../lessons/lessonRepository'

import type {
  AcademicYear,
  ClassGroup,
  EntityId,
  ISODate,
  Lesson,
  LessonStatus,
  ModuleUnit,
  PlanificationItem,
  SchoolCalendarEvent,
  Subject,
  TeachingAssignment
} from '../types'

export type CalendarViewMode =
  | 'week'
  | 'month'

export interface CalendarWorkspaceFilters {
  groupId?: EntityId | null
  teachingAssignmentId?: EntityId | null
  lessonStatus?: LessonStatus | null
}

export interface CalendarAssignmentOption {
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  label: string
}

export interface CalendarLessonRow {
  lesson: Lesson
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  module: ModuleUnit
}

export interface CalendarEventRow {
  event: SchoolCalendarEvent
  typeLabel: string
  scopeLabel: string
  targetLabel: string
  group: ClassGroup | null
  assignment: TeachingAssignment | null
  subject: Subject | null
}

export interface CalendarDayRow {
  date: ISODate
  isToday: boolean
  isInPrimaryPeriod: boolean
  isWithinAcademicYear: boolean
  lessons: CalendarLessonRow[]
  events: CalendarEventRow[]
  blockingEventCount: number
}

export interface CalendarWorkspaceTotals {
  lessonCount: number
  periodCount: number
  plannedLessonCount: number
  taughtLessonCount: number
  cancelledLessonCount: number
  extraLessonCount: number
  missingSummaryCount: number
  pendingGIAECount: number
  eventCount: number
  blockingEventCount: number
}

export interface CalendarWorkspaceSnapshot {
  academicYear: AcademicYear
  mode: CalendarViewMode
  anchorDate: ISODate
  primaryStartDate: ISODate
  primaryEndDate: ISODate
  displayStartDate: ISODate
  displayEndDate: ISODate
  previousAnchorDate: ISODate | null
  nextAnchorDate: ISODate | null
  filters: CalendarWorkspaceFilters
  assignmentOptions: CalendarAssignmentOption[]
  days: CalendarDayRow[]
  totals: CalendarWorkspaceTotals
  generatedAt: string
}

export interface CalendarLessonEditorContext {
  lessonRow: CalendarLessonRow
  assignmentModules: ModuleUnit[]
  previousLessonTemplate: PreviousLessonTemplate | null
  nextPlanificationItem: PlanificationItem | null
}

interface CalendarPeriod {
  primaryStartDate: ISODate
  primaryEndDate: ISODate
  displayStartDate: ISODate
  displayEndDate: ISODate
}

interface CalendarContext {
  academicYear: AcademicYear
  groups: ClassGroup[]
  subjects: Subject[]
  assignments: TeachingAssignment[]
  modules: ModuleUnit[]
}

function now() {
  return new Date().toISOString()
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

  if (
    formatISODate(
      parseISODate(
        value
      )
    ) !== value
  ) {
    throw new Error(
      `${label} não é uma data válida.`
    )
  }
}

function todayISO(): ISODate {
  const current =
    new Date()

  return [
    String(
      current.getFullYear()
    ).padStart(
      4,
      '0'
    ),

    String(
      current.getMonth() +
        1
    ).padStart(
      2,
      '0'
    ),

    String(
      current.getDate()
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
      ) -
      1
    )
  )
}

function getEndOfWeek(
  value: ISODate
): ISODate {
  return addDays(
    getStartOfWeek(
      value
    ),
    6
  )
}

function getStartOfMonth(
  value: ISODate
): ISODate {
  const date =
    parseISODate(
      value
    )

  return formatISODate(
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        1
      )
    )
  )
}

function getEndOfMonth(
  value: ISODate
): ISODate {
  const date =
    parseISODate(
      value
    )

  return formatISODate(
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() +
          1,
        0
      )
    )
  )
}

function shiftMonth(
  value: ISODate,
  difference: number
): ISODate {
  const date =
    parseISODate(
      value
    )

  return formatISODate(
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() +
          difference,
        1
      )
    )
  )
}

function clampDate(
  value: ISODate,
  minimum: ISODate,
  maximum: ISODate
): ISODate {
  if (
    value < minimum
  ) {
    return minimum
  }

  if (
    value > maximum
  ) {
    return maximum
  }

  return value
}

function maxDate(
  first: ISODate,
  second: ISODate
) {
  return first > second
    ? first
    : second
}

function minDate(
  first: ISODate,
  second: ISODate
) {
  return first < second
    ? first
    : second
}

function dateRangesOverlap(
  firstStart: ISODate,
  firstEnd: ISODate,
  secondStart: ISODate,
  secondEnd: ISODate
) {
  return (
    firstStart <=
      secondEnd &&
    secondStart <=
      firstEnd
  )
}

function buildPeriod(
  mode: CalendarViewMode,
  anchorDate: ISODate
): CalendarPeriod {
  if (
    mode === 'week'
  ) {
    const startDate =
      getStartOfWeek(
        anchorDate
      )

    return {
      primaryStartDate:
        startDate,

      primaryEndDate:
        getEndOfWeek(
          anchorDate
        ),

      displayStartDate:
        startDate,

      displayEndDate:
        getEndOfWeek(
          anchorDate
        )
    }
  }

  const monthStart =
    getStartOfMonth(
      anchorDate
    )

  const monthEnd =
    getEndOfMonth(
      anchorDate
    )

  return {
    primaryStartDate:
      monthStart,

    primaryEndDate:
      monthEnd,

    displayStartDate:
      getStartOfWeek(
        monthStart
      ),

    displayEndDate:
      getEndOfWeek(
        monthEnd
      )
  }
}

function getShiftedAnchorDate(
  mode: CalendarViewMode,
  anchorDate: ISODate,
  direction:
    | -1
    | 1
) {
  return mode === 'week'
    ? addDays(
        anchorDate,
        direction *
          7
      )
    : shiftMonth(
        anchorDate,
        direction
      )
}

function getNavigationAnchorDate(
  academicYear: AcademicYear,
  mode: CalendarViewMode,
  anchorDate: ISODate,
  direction:
    | -1
    | 1
): ISODate | null {
  const shiftedAnchorDate =
    getShiftedAnchorDate(
      mode,
      anchorDate,
      direction
    )

  const shiftedPeriod =
    buildPeriod(
      mode,
      shiftedAnchorDate
    )

  const intersectsAcademicYear =
    dateRangesOverlap(
      shiftedPeriod.primaryStartDate,
      shiftedPeriod.primaryEndDate,
      academicYear.startDate,
      academicYear.endDate
    )

  if (
    !intersectsAcademicYear
  ) {
    return null
  }

  return clampDate(
    shiftedAnchorDate,
    academicYear.startDate,
    academicYear.endDate
  )
}

function sortAssignments(
  rows: CalendarAssignmentOption[]
) {
  return rows.sort(
    (
      left,
      right
    ) => {
      const groupComparison =
        left.group.name.localeCompare(
          right.group.name,
          'pt-PT',
          {
            numeric: true,
            sensitivity:
              'base'
          }
        )

      if (
        groupComparison !== 0
      ) {
        return groupComparison
      }

      return left.subject.name.localeCompare(
        right.subject.name,
        'pt-PT',
        {
          sensitivity:
            'base'
        }
      )
    }
  )
}

function sortModules(
  modules: ModuleUnit[]
) {
  return modules.sort(
    (
      left,
      right
    ) => {
      const orderComparison =
        left.order -
        right.order

      if (
        orderComparison !== 0
      ) {
        return orderComparison
      }

      return left.name.localeCompare(
        right.name,
        'pt-PT',
        {
          sensitivity:
            'base'
        }
      )
    }
  )
}

function sortLessonRows(
  rows: CalendarLessonRow[]
) {
  return rows.sort(
    (
      left,
      right
    ) => {
      const dateComparison =
        left.lesson.date.localeCompare(
          right.lesson.date
        )

      if (
        dateComparison !== 0
      ) {
        return dateComparison
      }

      const timeComparison =
        left.lesson.startTime.localeCompare(
          right.lesson.startTime
        )

      if (
        timeComparison !== 0
      ) {
        return timeComparison
      }

      return left.group.name.localeCompare(
        right.group.name,
        'pt-PT',
        {
          numeric: true,
          sensitivity:
            'base'
        }
      )
    }
  )
}

function sortEventRows(
  rows: CalendarEventRow[]
) {
  return rows.sort(
    (
      left,
      right
    ) => {
      const startComparison =
        left.event.startDate.localeCompare(
          right.event.startDate
        )

      if (
        startComparison !== 0
      ) {
        return startComparison
      }

      return left.event.title.localeCompare(
        right.event.title,
        'pt-PT',
        {
          sensitivity:
            'base'
        }
      )
    }
  )
}

function buildAssignmentLabel(
  group: ClassGroup,
  subject: Subject
) {
  const subjectLabel =
    subject.shortName.trim() ||
    subject.name

  return `${group.name} · ${subjectLabel}`
}

function buildLessonRow(
  lesson: Lesson,
  assignmentById: Map<
    EntityId,
    TeachingAssignment
  >,
  groupById: Map<
    EntityId,
    ClassGroup
  >,
  subjectById: Map<
    EntityId,
    Subject
  >,
  moduleById: Map<
    EntityId,
    ModuleUnit
  >
): CalendarLessonRow | null {
  const assignment =
    assignmentById.get(
      lesson.teachingAssignmentId
    )

  const module =
    moduleById.get(
      lesson.moduleId
    )

  if (
    !assignment ||
    !module
  ) {
    return null
  }

  const group =
    groupById.get(
      assignment.groupId
    )

  const subject =
    subjectById.get(
      assignment.subjectId
    )

  if (
    !group ||
    !subject
  ) {
    return null
  }

  return {
    lesson,
    assignment,
    group,
    subject,
    module
  }
}

function buildEventRow(
  event: SchoolCalendarEvent,
  assignmentById: Map<
    EntityId,
    TeachingAssignment
  >,
  groupById: Map<
    EntityId,
    ClassGroup
  >,
  subjectById: Map<
    EntityId,
    Subject
  >
): CalendarEventRow {
  const directGroup =
    event.groupId
      ? groupById.get(
          event.groupId
        ) ?? null
      : null

  const assignment =
    event.teachingAssignmentId
      ? assignmentById.get(
          event.teachingAssignmentId
        ) ?? null
      : null

  const assignmentGroup =
    assignment
      ? groupById.get(
          assignment.groupId
        ) ?? null
      : null

  const subject =
    assignment
      ? subjectById.get(
          assignment.subjectId
        ) ?? null
      : null

  let targetLabel =
    getSchoolCalendarEventScopeLabel(
      event.scope
    )

  if (
    event.scope ===
      'group'
  ) {
    targetLabel =
      directGroup?.name ??
      'Turma removida'
  }

  if (
    event.scope ===
      'teaching_assignment'
  ) {
    targetLabel =
      assignmentGroup &&
      subject
        ? buildAssignmentLabel(
            assignmentGroup,
            subject
          )
        : 'Turma e disciplina removidas'
  }

  return {
    event,

    typeLabel:
      getSchoolCalendarEventTypeLabel(
        event.type
      ),

    scopeLabel:
      getSchoolCalendarEventScopeLabel(
        event.scope
      ),

    targetLabel,

    group:
      directGroup ??
      assignmentGroup,

    assignment,
    subject
  }
}

async function loadCalendarContext(
  academicYearId: EntityId
): Promise<CalendarContext> {
  const [
    academicYear,
    groups,
    subjects,
    assignments,
    modules
  ] = await Promise.all([
    maProfessorDb
      .academicYears
      .get(
        academicYearId
      ),

    maProfessorDb
      .groups
      .where(
        'academicYearId'
      )
      .equals(
        academicYearId
      )
      .toArray(),

    maProfessorDb
      .subjects
      .where(
        'academicYearId'
      )
      .equals(
        academicYearId
      )
      .toArray(),

    maProfessorDb
      .teachingAssignments
      .where(
        'academicYearId'
      )
      .equals(
        academicYearId
      )
      .toArray(),

    maProfessorDb
      .modules
      .where(
        'academicYearId'
      )
      .equals(
        academicYearId
      )
      .toArray()
  ])

  if (
    !academicYear
  ) {
    throw new Error(
      'O ano letivo indicado não existe.'
    )
  }

  return {
    academicYear,
    groups,
    subjects,
    assignments,
    modules
  }
}

function validateFilters(
  filters: CalendarWorkspaceFilters,
  assignmentById: Map<
    EntityId,
    TeachingAssignment
  >,
  groupById: Map<
    EntityId,
    ClassGroup
  >
) {
  if (
    filters.groupId &&
    !groupById.has(
      filters.groupId
    )
  ) {
    throw new Error(
      'A turma selecionada não pertence ao ano letivo.'
    )
  }

  if (
    filters.teachingAssignmentId
  ) {
    const assignment =
      assignmentById.get(
        filters.teachingAssignmentId
      )

    if (
      !assignment
    ) {
      throw new Error(
        'A turma e disciplina selecionadas não pertencem ao ano letivo.'
      )
    }

    if (
      filters.groupId &&
      assignment.groupId !==
        filters.groupId
    ) {
      throw new Error(
        'A disciplina selecionada não pertence à turma indicada.'
      )
    }
  }
}

function eventMatchesGroup(
  event: SchoolCalendarEvent,
  groupId: EntityId,
  assignmentById: Map<
    EntityId,
    TeachingAssignment
  >
) {
  if (
    event.scope === 'all'
  ) {
    return true
  }

  if (
    event.scope === 'group'
  ) {
    return (
      event.groupId ===
      groupId
    )
  }

  if (
    !event.teachingAssignmentId
  ) {
    return false
  }

  return (
    assignmentById.get(
      event.teachingAssignmentId
    )?.groupId ===
    groupId
  )
}

function buildDays(
  period: CalendarPeriod,
  academicYear: AcademicYear,
  lessonRows: CalendarLessonRow[],
  eventRows: CalendarEventRow[]
): CalendarDayRow[] {
  const today =
    todayISO()

  const lessonsByDate =
    new Map<
      ISODate,
      CalendarLessonRow[]
    >()

  const eventsByDate =
    new Map<
      ISODate,
      CalendarEventRow[]
    >()

  lessonRows.forEach(
    (
      row
    ) => {
      const rows =
        lessonsByDate.get(
          row.lesson.date
        ) ??
        []

      rows.push(
        row
      )

      lessonsByDate.set(
        row.lesson.date,
        rows
      )
    }
  )

  for (
    let date =
      period.displayStartDate;
    date <=
      period.displayEndDate;
    date =
      addDays(
        date,
        1
      )
  ) {
    const matchingEvents =
      eventRows.filter(
        (
          row
        ) =>
          calendarEventContainsDate(
            row.event,
            date
          )
      )

    eventsByDate.set(
      date,
      sortEventRows(
        matchingEvents
      )
    )
  }

  const days:
    CalendarDayRow[] =
    []

  for (
    let date =
      period.displayStartDate;
    date <=
      period.displayEndDate;
    date =
      addDays(
        date,
        1
      )
  ) {
    const dayEvents =
      eventsByDate.get(
        date
      ) ??
      []

    days.push({
      date,

      isToday:
        date === today,

      isInPrimaryPeriod:
        date >=
          period.primaryStartDate &&
        date <=
          period.primaryEndDate,

      isWithinAcademicYear:
        date >=
          academicYear.startDate &&
        date <=
          academicYear.endDate,

      lessons:
        sortLessonRows(
          lessonsByDate.get(
            date
          ) ??
            []
        ),

      events:
        dayEvents,

      blockingEventCount:
        dayEvents.filter(
          (
            row
          ) =>
            row.event
              .blocksLessons
        ).length
    })
  }

  return days
}

export class CalendarWorkspaceRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getActiveWorkspace(
    mode:
      CalendarViewMode =
      'week',
    anchorDate?: ISODate,
    filters:
      CalendarWorkspaceFilters =
      {}
  ): Promise<
    CalendarWorkspaceSnapshot | null
  > {
    await this.initialize()

    const academicYears =
      (
        await maProfessorDb
          .academicYears
          .toArray()
      ) as AcademicYear[]

    const activeAcademicYear =
      academicYears.find(
        (
          academicYear
        ) =>
          academicYear.active
      )

    if (
      !activeAcademicYear
    ) {
      return null
    }

    return this.getWorkspace(
      activeAcademicYear.id,
      mode,
      anchorDate,
      filters
    )
  }

  async getWorkspace(
    academicYearId: EntityId,
    mode:
      CalendarViewMode =
      'week',
    requestedAnchorDate?: ISODate,
    filters:
      CalendarWorkspaceFilters =
      {}
  ): Promise<CalendarWorkspaceSnapshot> {
    await this.initialize()

    if (
      mode !== 'week' &&
      mode !== 'month'
    ) {
      throw new Error(
        'A vista do calendário não é válida.'
      )
    }

    if (
      requestedAnchorDate
    ) {
      assertISODate(
        requestedAnchorDate,
        'A data selecionada'
      )
    }

    const context =
      await loadCalendarContext(
        academicYearId
      )

    const activeGroups =
      context.groups.filter(
        (
          group
        ) =>
          group.active
      )

    const activeSubjects =
      context.subjects.filter(
        (
          subject
        ) =>
          subject.active
      )

    const groupById =
      new Map(
        activeGroups.map(
          (
            group
          ) => [
            group.id,
            group
          ]
        )
      )

    const subjectById =
      new Map(
        activeSubjects.map(
          (
            subject
          ) => [
            subject.id,
            subject
          ]
        )
      )

    const activeAssignments =
      context.assignments.filter(
        (
          assignment
        ) =>
          assignment.active &&
          groupById.has(
            assignment.groupId
          ) &&
          subjectById.has(
            assignment.subjectId
          )
      )

    const assignmentById =
      new Map(
        activeAssignments.map(
          (
            assignment
          ) => [
            assignment.id,
            assignment
          ]
        )
      )

    const activeModules =
      context.modules.filter(
        (
          module
        ) =>
          module.active &&
          assignmentById.has(
            module.teachingAssignmentId
          )
      )

    const moduleById =
      new Map(
        activeModules.map(
          (
            module
          ) => [
            module.id,
            module
          ]
        )
      )

    validateFilters(
      filters,
      assignmentById,
      groupById
    )

    const anchorDate =
      clampDate(
        requestedAnchorDate ??
          todayISO(),
        context.academicYear
          .startDate,
        context.academicYear
          .endDate
      )

    const period =
      buildPeriod(
        mode,
        anchorDate
      )

    const queryStartDate =
      maxDate(
        period.displayStartDate,
        context.academicYear
          .startDate
      )

    const queryEndDate =
      minDate(
        period.displayEndDate,
        context.academicYear
          .endDate
      )

    const hasQueryableRange =
      queryStartDate <=
      queryEndDate

    const [
      lessons,
      events
    ] = hasQueryableRange
      ? await Promise.all([
          lessonRepository.listLessons({
            academicYearId,

            dateFrom:
              queryStartDate,

            dateTo:
              queryEndDate,

            teachingAssignmentId:
              filters
                .teachingAssignmentId ??
              null,

            status:
              filters.lessonStatus ??
              null
          }),

          calendarRepository.listEvents({
            academicYearId,

            dateFrom:
              queryStartDate,

            dateTo:
              queryEndDate,

            appliesToTeachingAssignmentId:
              filters
                .teachingAssignmentId ??
              null
          })
        ])
      : [
          [] as Lesson[],
          [] as SchoolCalendarEvent[]
        ]

    const filteredLessons =
      filters.groupId
        ? lessons.filter(
            (
              lesson
            ) =>
              assignmentById.get(
                lesson.teachingAssignmentId
              )?.groupId ===
              filters.groupId
          )
        : lessons

    const filteredEvents =
      filters.groupId &&
      !filters
        .teachingAssignmentId
        ? events.filter(
            (
              event
            ) =>
              eventMatchesGroup(
                event,
                filters.groupId!,
                assignmentById
              )
          )
        : events

    const lessonRows =
      sortLessonRows(
        filteredLessons
          .map(
            (
              lesson
            ) =>
              buildLessonRow(
                lesson,
                assignmentById,
                groupById,
                subjectById,
                moduleById
              )
          )
          .filter(
            (
              row
            ): row is CalendarLessonRow =>
              Boolean(
                row
              )
          )
      )

    const eventRows =
      sortEventRows(
        filteredEvents.map(
          (
            event
          ) =>
            buildEventRow(
              event,
              assignmentById,
              groupById,
              subjectById
            )
        )
      )

    const assignmentOptions =
      sortAssignments(
        activeAssignments
          .map(
            (
              assignment
            ) => {
              const group =
                groupById.get(
                  assignment.groupId
                )

              const subject =
                subjectById.get(
                  assignment.subjectId
                )

              if (
                !group ||
                !subject
              ) {
                return null
              }

              return {
                assignment,
                group,
                subject,

                label:
                  buildAssignmentLabel(
                    group,
                    subject
                  )
              }
            }
          )
          .filter(
            (
              row
            ): row is CalendarAssignmentOption =>
              Boolean(
                row
              )
          )
      )

    return {
      academicYear:
        context.academicYear,

      mode,
      anchorDate,

      primaryStartDate:
        period.primaryStartDate,

      primaryEndDate:
        period.primaryEndDate,

      displayStartDate:
        period.displayStartDate,

      displayEndDate:
        period.displayEndDate,

      previousAnchorDate:
        getNavigationAnchorDate(
          context.academicYear,
          mode,
          anchorDate,
          -1
        ),

      nextAnchorDate:
        getNavigationAnchorDate(
          context.academicYear,
          mode,
          anchorDate,
          1
        ),

      filters: {
        groupId:
          filters.groupId ??
          null,

        teachingAssignmentId:
          filters
            .teachingAssignmentId ??
          null,

        lessonStatus:
          filters.lessonStatus ??
          null
      },

      assignmentOptions,

      days:
        buildDays(
          period,
          context.academicYear,
          lessonRows,
          eventRows
        ),

      totals: {
        lessonCount:
          lessonRows.length,

        periodCount:
          lessonRows.reduce(
            (
              total,
              row
            ) =>
              total +
              row.lesson
                .periodCount,
            0
          ),

        plannedLessonCount:
          lessonRows.filter(
            (
              row
            ) =>
              row.lesson
                .status ===
              'planned'
          ).length,

        taughtLessonCount:
          lessonRows.filter(
            (
              row
            ) =>
              row.lesson
                .status ===
              'taught'
          ).length,

        cancelledLessonCount:
          lessonRows.filter(
            (
              row
            ) =>
              row.lesson
                .status ===
              'cancelled'
          ).length,

        extraLessonCount:
          lessonRows.filter(
            (
              row
            ) =>
              row.lesson
                .origin ===
              'extra'
          ).length,

        missingSummaryCount:
          lessonRows.filter(
            (
              row
            ) =>
              row.lesson
                .status ===
                'taught' &&
              !row.lesson
                .summary
                .trim()
          ).length,

        pendingGIAECount:
          lessonRows.filter(
            (
              row
            ) =>
              row.lesson
                .status ===
                'taught' &&
              Boolean(
                row.lesson
                  .summary
                  .trim()
              ) &&
              row.lesson
                .giaeStatus ===
                'pending'
          ).length,

        eventCount:
          eventRows.length,

        blockingEventCount:
          eventRows.filter(
            (
              row
            ) =>
              row.event
                .blocksLessons
          ).length
      },

      generatedAt:
        now()
    }
  }

  async getLessonEditorContext(
    lessonId: EntityId
  ): Promise<CalendarLessonEditorContext> {
    await this.initialize()

    const lesson =
      await lessonRepository.getLesson(
        lessonId
      )

    if (
      !lesson
    ) {
      throw new Error(
        'A aula indicada não existe.'
      )
    }

    const [
      assignment,
      module
    ] = await Promise.all([
      maProfessorDb
        .teachingAssignments
        .get(
          lesson.teachingAssignmentId
        ),

      maProfessorDb
        .modules
        .get(
          lesson.moduleId
        )
    ])

    if (
      !assignment
    ) {
      throw new Error(
        'A turma e disciplina associadas à aula já não existem.'
      )
    }

    if (
      !module
    ) {
      throw new Error(
        'A UFCD associada à aula já não existe.'
      )
    }

    const [
      group,
      subject,
      assignmentModules,
      previousLessonTemplate,
      nextPlanificationItem
    ] = await Promise.all([
      maProfessorDb
        .groups
        .get(
          assignment.groupId
        ),

      maProfessorDb
        .subjects
        .get(
          assignment.subjectId
        ),

      maProfessorDb
        .modules
        .where(
          'teachingAssignmentId'
        )
        .equals(
          assignment.id
        )
        .toArray(),

      lessonRepository.getPreviousLessonTemplate(
        assignment.id,
        lesson.date,
        lesson.startTime
      ),

      lessonRepository.getNextPlanificationItem(
        lesson.moduleId
      )
    ])

    if (
      !group
    ) {
      throw new Error(
        'A turma associada à aula já não existe.'
      )
    }

    if (
      !subject
    ) {
      throw new Error(
        'A disciplina associada à aula já não existe.'
      )
    }

    return {
      lessonRow: {
        lesson,
        assignment,
        group,
        subject,
        module
      },

      assignmentModules:
        sortModules(
          assignmentModules.filter(
            (
              currentModule
            ) =>
              currentModule.active
          )
        ),

      previousLessonTemplate,

      nextPlanificationItem
    }
  }
}

export function getCalendarViewModeLabel(
  mode: CalendarViewMode
) {
  return mode === 'week'
    ? 'Semana'
    : 'Mês'
}

export function getCalendarLessonStatusLabel(
  status: LessonStatus
) {
  const labels:
    Record<
      LessonStatus,
      string
    > = {
    planned:
      'Planeada',

    taught:
      'Dada',

    cancelled:
      'Cancelada'
  }

  return labels[
    status
  ]
}

export const calendarWorkspaceRepository =
  new CalendarWorkspaceRepository()
