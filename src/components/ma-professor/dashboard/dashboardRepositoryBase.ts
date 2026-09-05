import { maProfessorDb, openMAProfessorDatabase } from '../db'
import {
  attendanceRepository,
  type AttendanceOverviewRow
} from '../attendance/attendanceRepository'
import { calendarEventBlocksAssignmentOnDate } from '../calendar/calendarRepository'
import type {
  AcademicYear,
  ClassGroup,
  DashboardModuleProgress,
  EntityId,
  ISODate,
  Lesson,
  ModuleUnit,
  Planification,
  PlanificationItem,
  SchoolCalendarEvent,
  Student,
  Subject,
  TeachingAssignment,
  WeeklyScheduleSlot
} from '../types'

export type DashboardPendingReason = 'missing_summary' | 'giae_pending'

export interface DashboardModuleRow {
  module: ModuleUnit
  progress: DashboardModuleProgress
  isCurrent: boolean
}

export interface DashboardAssignmentRow {
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  modules: DashboardModuleRow[]
  currentModule: ModuleUnit | null
  currentModuleProgress: DashboardModuleProgress | null
  periodsPlanned: number
  periodsTaught: number
  periodsRemaining: number
  completionPercent: number
  pendingSummaryCount: number
  pendingGIAECount: number
  nextLesson: Lesson | null
  nextPlanificationItem: PlanificationItem | null
}

export interface DashboardLessonRow {
  lesson: Lesson
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  module: ModuleUnit
}

export interface DashboardPendingSummaryRow extends DashboardLessonRow {
  reason: DashboardPendingReason
}

export type DashboardAttendanceAlertRow = AttendanceOverviewRow

export interface DashboardTotals {
  activeGroupCount: number
  activeStudentCount: number
  activeAssignmentCount: number
  activeModuleCount: number
  periodsPlanned: number
  periodsTaught: number
  periodsRemaining: number
  completionPercent: number
  plannedLessonCount: number
  taughtLessonCount: number
  cancelledLessonCount: number
  pendingSummaryCount: number
  pendingGIAECount: number
  attendanceWarningCount: number
  recoveryRequiredCount: number
}

export interface DashboardSnapshot {
  academicYear: AcademicYear
  referenceDate: ISODate
  generatedAt: string
  totals: DashboardTotals
  assignments: DashboardAssignmentRow[]
  upcomingLessons: DashboardLessonRow[]
  pendingSummaries: DashboardPendingSummaryRow[]
  attendanceAlerts: DashboardAttendanceAlertRow[]
}

interface DashboardDataSet {
  academicYear: AcademicYear
  groups: ClassGroup[]
  subjects: Subject[]
  assignments: TeachingAssignment[]
  modules: ModuleUnit[]
  students: Student[]
  lessons: Lesson[]
  weeklyScheduleSlots: WeeklyScheduleSlot[]
  calendarEvents: SchoolCalendarEvent[]
  planifications: Planification[]
  planificationItems: PlanificationItem[]
}

interface ModuleProgressContext {
  academicYear: AcademicYear
  assignment: TeachingAssignment
  module: ModuleUnit
  lessons: Lesson[]
  weeklyScheduleSlots: WeeklyScheduleSlot[]
  calendarEvents: SchoolCalendarEvent[]
  referenceDate: ISODate
}

const MAX_UPCOMING_LESSONS = 8
const MAX_PENDING_SUMMARIES = 12
const MAX_ATTENDANCE_ALERTS = 12
const MAX_ESTIMATION_DAYS = 550

function now() {
  return new Date().toISOString()
}

function formatISODate(value: Date): ISODate {
  return [
    String(value.getUTCFullYear()).padStart(4, '0'),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function parseISODate(value: ISODate) {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )
}

function assertISODate(value: ISODate, label: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    formatISODate(parseISODate(value)) !== value
  ) {
    throw new Error(`${label} não é uma data válida.`)
  }
}

function todayISO(): ISODate {
  const current = new Date()

  return formatISODate(
    new Date(
      Date.UTC(
        current.getFullYear(),
        current.getMonth(),
        current.getDate()
      )
    )
  )
}

function addDays(value: ISODate, days: number): ISODate {
  const date = parseISODate(value)

  date.setUTCDate(
    date.getUTCDate() + days
  )

  return formatISODate(date)
}

function getWeekday(value: ISODate) {
  const weekday = parseISODate(value).getUTCDay()

  return weekday === 0
    ? 7
    : weekday
}

function clampReferenceDate(
  academicYear: AcademicYear,
  referenceDate?: ISODate
): ISODate {
  const nextReferenceDate = referenceDate ?? todayISO()

  assertISODate(
    nextReferenceDate,
    'A data de referência'
  )

  if (nextReferenceDate < academicYear.startDate) {
    return academicYear.startDate
  }

  if (nextReferenceDate > academicYear.endDate) {
    return academicYear.endDate
  }

  return nextReferenceDate
}

function sumPeriods(lessons: Lesson[]) {
  return lessons.reduce(
    (total, lesson) =>
      total + lesson.periodCount,
    0
  )
}

function getCompletionPercent(
  taught: number,
  planned: number
) {
  if (planned <= 0) {
    return 0
  }

  const percentage = Math.min(
    100,
    Math.max(
      0,
      (taught / planned) * 100
    )
  )

  return Math.round(
    percentage * 100
  ) / 100
}

function sortLessons(lessons: Lesson[]) {
  return lessons.sort(
    (left, right) => {
      const dateComparison =
        left.date.localeCompare(
          right.date
        )

      if (dateComparison !== 0) {
        return dateComparison
      }

      const timeComparison =
        left.startTime.localeCompare(
          right.startTime
        )

      return timeComparison !== 0
        ? timeComparison
        : left.id.localeCompare(
            right.id
          )
    }
  )
}

function sortModules(modules: ModuleUnit[]) {
  return modules.sort(
    (left, right) => {
      const orderComparison =
        left.order - right.order

      return orderComparison !== 0
        ? orderComparison
        : left.name.localeCompare(
            right.name,
            'pt-PT',
            {
              sensitivity: 'base'
            }
          )
    }
  )
}

function isTaughtProgressLesson(
  lesson: Lesson
) {
  return (
    lesson.status === 'taught' &&
    lesson.countTowardProgress
  )
}

function isPlannedProgressLesson(
  lesson: Lesson
) {
  return (
    lesson.status === 'planned' &&
    lesson.countTowardProgress
  )
}

function getLastTaughtDate(
  lessons: Lesson[]
) {
  const taughtLessons = lessons
    .filter(
      isTaughtProgressLesson
    )
    .sort(
      (left, right) =>
        right.date.localeCompare(
          left.date
        )
    )

  return taughtLessons[0]?.date ?? null
}

function isDateBlocked(
  events: SchoolCalendarEvent[],
  assignment: TeachingAssignment,
  date: ISODate
) {
  return events.some(
    (event) =>
      calendarEventBlocksAssignmentOnDate(
        event,
        assignment,
        date
      )
  )
}

function estimateCompletionDate({
  academicYear,
  assignment,
  module,
  lessons,
  weeklyScheduleSlots,
  calendarEvents,
  referenceDate
}: ModuleProgressContext) {
  const moduleLessons = lessons.filter(
    (lesson) =>
      lesson.moduleId === module.id
  )

  const periodsTaught = sumPeriods(
    moduleLessons.filter(
      isTaughtProgressLesson
    )
  )

  const periodsRemaining = Math.max(
    0,
    module.plannedPeriods -
      periodsTaught
  )

  if (periodsRemaining === 0) {
    return getLastTaughtDate(
      moduleLessons
    )
  }

  const startDate =
    module.plannedStartDate &&
    module.plannedStartDate > referenceDate
      ? module.plannedStartDate
      : referenceDate

  const explicitLessons = sortLessons(
    moduleLessons.filter(
      (lesson) =>
        isPlannedProgressLesson(
          lesson
        ) &&
        lesson.date >= startDate &&
        lesson.date <=
          academicYear.endDate
    )
  )

  let accumulatedPeriods = 0

  for (const lesson of explicitLessons) {
    if (
      isDateBlocked(
        calendarEvents,
        assignment,
        lesson.date
      )
    ) {
      continue
    }

    accumulatedPeriods +=
      lesson.periodCount

    if (
      accumulatedPeriods >=
      periodsRemaining
    ) {
      return lesson.date
    }
  }

  const lastExplicitLesson =
    explicitLessons[
      explicitLessons.length - 1
    ]

  let cursor = lastExplicitLesson
    ? addDays(
        lastExplicitLesson.date,
        1
      )
    : startDate

  const activeSlots =
    weeklyScheduleSlots.filter(
      (slot) =>
        slot.active &&
        slot.teachingAssignmentId ===
          assignment.id
    )

  if (activeSlots.length === 0) {
    return null
  }

  let checkedDays = 0

  while (
    cursor <= academicYear.endDate &&
    checkedDays < MAX_ESTIMATION_DAYS
  ) {
    checkedDays += 1

    if (
      !isDateBlocked(
        calendarEvents,
        assignment,
        cursor
      )
    ) {
      const weekday =
        getWeekday(cursor)

      const periodsOnDate =
        activeSlots
          .filter(
            (slot) =>
              slot.weekday ===
                weekday &&
              slot.validFrom <=
                cursor &&
              slot.validUntil >=
                cursor
          )
          .reduce(
            (total, slot) =>
              total +
              slot.periodCount,
            0
          )

      accumulatedPeriods +=
        periodsOnDate

      if (
        accumulatedPeriods >=
        periodsRemaining
      ) {
        return cursor
      }
    }

    cursor = addDays(
      cursor,
      1
    )
  }

  return null
}

function buildModuleProgress(
  context: ModuleProgressContext
): DashboardModuleProgress {
  const moduleLessons =
    context.lessons.filter(
      (lesson) =>
        lesson.moduleId ===
        context.module.id
    )

  const periodsTaught = sumPeriods(
    moduleLessons.filter(
      isTaughtProgressLesson
    )
  )

  return {
    moduleId: context.module.id,
    periodsTaught,
    periodsRemaining: Math.max(
      0,
      context.module.plannedPeriods -
        periodsTaught
    ),
    completionPercent:
      getCompletionPercent(
        periodsTaught,
        context.module.plannedPeriods
      ),
    estimatedCompletionDate:
      estimateCompletionDate(
        context
      )
  }
}

function getCurrentModule(
  modules: ModuleUnit[],
  progressByModuleId: Map<
    EntityId,
    DashboardModuleProgress
  >
) {
  const orderedModules =
    sortModules([
      ...modules
    ])

  const startedModule =
    orderedModules.find(
      (module) => {
        const progress =
          progressByModuleId.get(
            module.id
          )

        return Boolean(
          progress &&
          progress.periodsTaught > 0 &&
          progress.periodsRemaining > 0
        )
      }
    )

  if (startedModule) {
    return startedModule
  }

  const firstIncomplete =
    orderedModules.find(
      (module) =>
        (
          progressByModuleId.get(
            module.id
          )?.periodsRemaining ?? 0
        ) > 0
    )

  return (
    firstIncomplete ??
    orderedModules[
      orderedModules.length - 1
    ] ??
    null
  )
}

function getNextPlanificationItem(
  moduleId: EntityId,
  planifications: Planification[],
  planificationItems: PlanificationItem[]
) {
  const planificationIds =
    new Set(
      planifications
        .filter(
          (planification) =>
            planification.active &&
            planification.moduleId ===
              moduleId
        )
        .map(
          (planification) =>
            planification.id
        )
    )

  return (
    planificationItems
      .filter(
        (item) =>
          planificationIds.has(
            item.planificationId
          ) &&
          item.status === 'planned'
      )
      .sort(
        (left, right) =>
          left.order -
          right.order
      )[0] ?? null
  )
}

function buildLessonContextRow(
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
): DashboardLessonRow | null {
  const assignment =
    assignmentById.get(
      lesson.teachingAssignmentId
    )

  const module =
    moduleById.get(
      lesson.moduleId
    )

  if (!assignment || !module) {
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

  if (!group || !subject) {
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

function sortAssignmentRows(
  rows: DashboardAssignmentRow[]
) {
  return rows.sort(
    (left, right) => {
      const groupComparison =
        left.group.name.localeCompare(
          right.group.name,
          'pt-PT',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )

      return groupComparison !== 0
        ? groupComparison
        : left.subject.name.localeCompare(
            right.subject.name,
            'pt-PT',
            {
              sensitivity: 'base'
            }
          )
    }
  )
}

function sortAttendanceAlerts(
  rows: DashboardAttendanceAlertRow[]
) {
  const warningOrder = {
    recovery_required: 0,
    warning: 1,
    regular: 2
  } as const

  return rows.sort(
    (left, right) => {
      const warningComparison =
        warningOrder[
          left.summary.warningLevel
        ] -
        warningOrder[
          right.summary.warningLevel
        ]

      if (warningComparison !== 0) {
        return warningComparison
      }

      const percentageComparison =
        right.summary.absencePercent -
        left.summary.absencePercent

      return percentageComparison !== 0
        ? percentageComparison
        : left.student.name.localeCompare(
            right.student.name,
            'pt-PT',
            {
              sensitivity: 'base'
            }
          )
    }
  )
}

async function loadDashboardData(
  academicYearId: EntityId
): Promise<DashboardDataSet> {
  const [
    academicYear,
    groups,
    subjects,
    assignments,
    modules,
    students,
    lessons,
    weeklyScheduleSlots,
    calendarEvents,
    planifications,
    allPlanificationItems
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
      .toArray(),

    maProfessorDb
      .students
      .where(
        'academicYearId'
      )
      .equals(
        academicYearId
      )
      .toArray(),

    maProfessorDb
      .lessons
      .where(
        'academicYearId'
      )
      .equals(
        academicYearId
      )
      .toArray(),

    maProfessorDb
      .weeklyScheduleSlots
      .where(
        'academicYearId'
      )
      .equals(
        academicYearId
      )
      .toArray(),

    maProfessorDb
      .schoolCalendarEvents
      .where(
        'academicYearId'
      )
      .equals(
        academicYearId
      )
      .toArray(),

    maProfessorDb
      .planifications
      .where(
        'academicYearId'
      )
      .equals(
        academicYearId
      )
      .toArray(),

    maProfessorDb
      .planificationItems
      .toArray()
  ])

  if (!academicYear) {
    throw new Error(
      'O ano letivo indicado não existe.'
    )
  }

  const planificationIds =
    new Set(
      (
        planifications as
          Planification[]
      ).map(
        (planification) =>
          planification.id
      )
    )

  return {
    academicYear,
    groups,
    subjects,
    assignments,
    modules,
    students,
    lessons,
    weeklyScheduleSlots,
    calendarEvents,
    planifications,
    planificationItems: (
      allPlanificationItems as
        PlanificationItem[]
    ).filter(
      (item) =>
        planificationIds.has(
          item.planificationId
        )
    )
  }
}

export class DashboardRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getActiveDashboard(
    referenceDate?: ISODate
  ): Promise<DashboardSnapshot | null> {
    await this.initialize()

    const academicYears =
      (
        await maProfessorDb
          .academicYears
          .toArray()
      ) as AcademicYear[]

    const activeAcademicYear =
      academicYears.find(
        (academicYear) =>
          academicYear.active
      )

    return activeAcademicYear
      ? this.getDashboard(
          activeAcademicYear.id,
          referenceDate
        )
      : null
  }

  async getDashboard(
    academicYearId: EntityId,
    requestedReferenceDate?: ISODate
  ): Promise<DashboardSnapshot> {
    await this.initialize()

    const data =
      await loadDashboardData(
        academicYearId
      )

    const referenceDate =
      clampReferenceDate(
        data.academicYear,
        requestedReferenceDate
      )

    const activeGroups =
      data.groups.filter(
        (group) =>
          group.active
      )

    const activeSubjects =
      data.subjects.filter(
        (subject) =>
          subject.active
      )

    const groupById =
      new Map(
        activeGroups.map(
          (group) => [
            group.id,
            group
          ]
        )
      )

    const subjectById =
      new Map(
        activeSubjects.map(
          (subject) => [
            subject.id,
            subject
          ]
        )
      )

    const activeAssignments =
      data.assignments.filter(
        (assignment) =>
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
          (assignment) => [
            assignment.id,
            assignment
          ]
        )
      )

    const activeModules =
      data.modules.filter(
        (module) =>
          module.active &&
          assignmentById.has(
            module.teachingAssignmentId
          )
      )

    const moduleById =
      new Map(
        activeModules.map(
          (module) => [
            module.id,
            module
          ]
        )
      )

    const activeLessons =
      data.lessons.filter(
        (lesson) =>
          assignmentById.has(
            lesson.teachingAssignmentId
          ) &&
          moduleById.has(
            lesson.moduleId
          )
      )

    const assignmentRows:
      DashboardAssignmentRow[] = []

    for (
      const assignment
      of activeAssignments
    ) {
      const group =
        groupById.get(
          assignment.groupId
        )

      const subject =
        subjectById.get(
          assignment.subjectId
        )

      if (!group || !subject) {
        continue
      }

      const assignmentModules =
        sortModules(
          activeModules.filter(
            (module) =>
              module.teachingAssignmentId ===
              assignment.id
          )
        )

      const assignmentLessons =
        activeLessons.filter(
          (lesson) =>
            lesson.teachingAssignmentId ===
            assignment.id
        )

      const progressByModuleId =
        new Map<
          EntityId,
          DashboardModuleProgress
        >()

      for (
        const module
        of assignmentModules
      ) {
        progressByModuleId.set(
          module.id,
          buildModuleProgress({
            academicYear:
              data.academicYear,
            assignment,
            module,
            lessons:
              assignmentLessons,
            weeklyScheduleSlots:
              data.weeklyScheduleSlots,
            calendarEvents:
              data.calendarEvents,
            referenceDate
          })
        )
      }

      const currentModule =
        getCurrentModule(
          assignmentModules,
          progressByModuleId
        )

      const modules =
        assignmentModules.map(
          (module) => ({
            module,
            progress:
              progressByModuleId.get(
                module.id
              )!,
            isCurrent:
              module.id ===
              currentModule?.id
          })
        )

      const periodsPlanned =
        assignmentModules.reduce(
          (total, module) =>
            total +
            module.plannedPeriods,
          0
        )

      const periodsTaught =
        sumPeriods(
          assignmentLessons.filter(
            isTaughtProgressLesson
          )
        )

      const futureLessons =
        sortLessons(
          assignmentLessons.filter(
            (lesson) =>
              lesson.status ===
                'planned' &&
              lesson.date >=
                referenceDate
          )
        )

      assignmentRows.push({
        assignment,
        group,
        subject,
        modules,
        currentModule,

        currentModuleProgress:
          currentModule
            ? progressByModuleId.get(
                currentModule.id
              ) ?? null
            : null,

        periodsPlanned,
        periodsTaught,

        periodsRemaining:
          modules.reduce(
            (total, row) =>
              total +
              row.progress
                .periodsRemaining,
            0
          ),

        completionPercent:
          getCompletionPercent(
            periodsTaught,
            periodsPlanned
          ),

        pendingSummaryCount:
          assignmentLessons.filter(
            (lesson) =>
              lesson.status ===
                'taught' &&
              !lesson.summary.trim()
          ).length,

        pendingGIAECount:
          assignmentLessons.filter(
            (lesson) =>
              lesson.status ===
                'taught' &&
              Boolean(
                lesson.summary.trim()
              ) &&
              lesson.giaeStatus ===
                'pending'
          ).length,

        nextLesson:
          futureLessons[0] ??
          null,

        nextPlanificationItem:
          currentModule
            ? getNextPlanificationItem(
                currentModule.id,
                data.planifications,
                data.planificationItems
              )
            : null
      })
    }

    const upcomingLessons =
      sortLessons(
        activeLessons.filter(
          (lesson) =>
            lesson.status ===
              'planned' &&
            lesson.date >=
              referenceDate
        )
      )
        .map(
          (lesson) =>
            buildLessonContextRow(
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
          ): row is DashboardLessonRow =>
            Boolean(row)
        )
        .slice(
          0,
          MAX_UPCOMING_LESSONS
        )

    const pendingSummaries =
      sortLessons(
        activeLessons.filter(
          (lesson) =>
            lesson.status ===
              'taught' &&
            (
              !lesson.summary.trim() ||
              lesson.giaeStatus ===
                'pending'
            )
        )
      )
        .reverse()
        .map(
          (lesson) => {
            const row =
              buildLessonContextRow(
                lesson,
                assignmentById,
                groupById,
                subjectById,
                moduleById
              )

            return row
              ? ({
                  ...row,

                  reason:
                    lesson.summary.trim()
                      ? 'giae_pending'
                      : 'missing_summary'
                } satisfies DashboardPendingSummaryRow)
              : null
          }
        )
        .filter(
          (
            row
          ): row is DashboardPendingSummaryRow =>
            Boolean(row)
        )
        .slice(
          0,
          MAX_PENDING_SUMMARIES
        )

    let allAttendanceAlerts:
      DashboardAttendanceAlertRow[] = []

    if (
      activeLessons.some(
        isTaughtProgressLesson
      )
    ) {
      const overview =
        await attendanceRepository
          .listAbsenceOverview({
            academicYearId
          })

      allAttendanceAlerts =
        sortAttendanceAlerts(
          overview.filter(
            (row) =>
              row.summary.warningLevel !==
              'regular'
          )
        )
    }

    const attendanceAlerts =
      allAttendanceAlerts.slice(
        0,
        MAX_ATTENDANCE_ALERTS
      )

    const periodsPlanned =
      activeModules.reduce(
        (total, module) =>
          total +
          module.plannedPeriods,
        0
      )

    const periodsTaught =
      sumPeriods(
        activeLessons.filter(
          isTaughtProgressLesson
        )
      )

    const pendingSummaryCount =
      activeLessons.filter(
        (lesson) =>
          lesson.status ===
            'taught' &&
          !lesson.summary.trim()
      ).length

    const pendingGIAECount =
      activeLessons.filter(
        (lesson) =>
          lesson.status ===
            'taught' &&
          Boolean(
            lesson.summary.trim()
          ) &&
          lesson.giaeStatus ===
            'pending'
      ).length

    return {
      academicYear:
        data.academicYear,

      referenceDate,

      generatedAt:
        now(),

      totals: {
        activeGroupCount:
          activeGroups.length,

        activeStudentCount:
          data.students.filter(
            (student) =>
              student.active &&
              groupById.has(
                student.groupId
              )
          ).length,

        activeAssignmentCount:
          activeAssignments.length,

        activeModuleCount:
          activeModules.length,

        periodsPlanned,
        periodsTaught,

        periodsRemaining:
          assignmentRows.reduce(
            (total, row) =>
              total +
              row.periodsRemaining,
            0
          ),

        completionPercent:
          getCompletionPercent(
            periodsTaught,
            periodsPlanned
          ),

        plannedLessonCount:
          activeLessons.filter(
            (lesson) =>
              lesson.status ===
              'planned'
          ).length,

        taughtLessonCount:
          activeLessons.filter(
            (lesson) =>
              lesson.status ===
              'taught'
          ).length,

        cancelledLessonCount:
          activeLessons.filter(
            (lesson) =>
              lesson.status ===
              'cancelled'
          ).length,

        pendingSummaryCount,
        pendingGIAECount,

        attendanceWarningCount:
          allAttendanceAlerts.filter(
            (row) =>
              row.summary.warningLevel ===
              'warning'
          ).length,

        recoveryRequiredCount:
          allAttendanceAlerts.filter(
            (row) =>
              row.summary.warningLevel ===
              'recovery_required'
          ).length
      },

      assignments:
        sortAssignmentRows(
          assignmentRows
        ),

      upcomingLessons,
      pendingSummaries,
      attendanceAlerts
    }
  }
}

export function getDashboardPendingReasonLabel(
  reason: DashboardPendingReason
) {
  return reason === 'missing_summary'
    ? 'Sumário por preencher'
    : 'Por registar no GIAE'
}

export const dashboardRepository =
  new DashboardRepository()
