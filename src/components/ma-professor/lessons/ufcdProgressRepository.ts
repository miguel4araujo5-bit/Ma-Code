import {
  assessmentWorkspaceRepository
} from '../assessments/assessmentWorkspaceRepository'
import {
  calendarEventBlocksAssignmentOnDate
} from '../calendar/calendarRepository'
import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import type {
  DashboardSnapshot
} from '../dashboard/dashboardRepositoryBase'
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
import {
  buildUfcdModuleProgress,
  calculateCompletionPercent,
  compareLessonsChronologically,
  lessonCountsTowardUfcdProgress,
  lessonOccursBefore,
  selectCurrentUfcd,
  todayISO,
  type UfcdModuleProgress
} from './ufcdProgress'
import {
  projectSequentialUfcdCompletionDates,
  type UfcdCompletionProjection
} from './ufcdCompletionProjection'
import {
  planScheduledLessonReconciliation
} from './scheduledLessonReconciliation'

export interface UfcdEndingNotice {
  lessonId: EntityId
  moduleId: EntityId
  moduleCode: string
  moduleName: string
  periodsTaughtBeforeLesson: number
  plannedPeriods: number
  lessonsRemaining: number
  assessmentSufficient: boolean
}

interface AssignmentProgressData {
  academicYear: AcademicYear
  assignment: TeachingAssignment
  modules: ModuleUnit[]
  lessons: Lesson[]
  slots: WeeklyScheduleSlot[]
  events: SchoolCalendarEvent[]
}

function parseISODate(
  value: ISODate
) {
  const [year, month, day] =
    value.split('-').map(Number)

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
    String(value.getUTCFullYear()).padStart(4, '0'),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function addDays(
  value: ISODate,
  amount: number
): ISODate {
  const date = parseISODate(value)

  date.setUTCDate(
    date.getUTCDate() + amount
  )

  return formatISODate(date)
}

function getWeekday(
  value: ISODate
) {
  const weekday =
    parseISODate(value).getUTCDay()

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

function sortModules(
  modules: ModuleUnit[]
) {
  return [...modules].sort(
    (left, right) =>
      left.order - right.order ||
      left.name.localeCompare(
        right.name,
        'pt-PT',
        {
          sensitivity: 'base'
        }
      )
  )
}

function getLastCountedLessonDate(
  moduleId: EntityId,
  lessons: Lesson[],
  referenceToday: ISODate
) {
  return (
    lessons
      .filter(
        lesson =>
          lesson.moduleId === moduleId &&
          lessonCountsTowardUfcdProgress(
            lesson,
            referenceToday
          )
      )
      .sort(compareLessonsChronologically)
      .at(-1)?.date ?? null
  )
}

function estimateCompletionDate(
  data: AssignmentProgressData,
  module: ModuleUnit,
  periodsRemaining: number,
  referenceDate: ISODate
) {
  if (periodsRemaining <= 0) {
    return getLastCountedLessonDate(
      module.id,
      data.lessons,
      todayISO()
    )
  }

  const activeSlots =
    data.slots.filter(
      slot =>
        slot.active &&
        slot.teachingAssignmentId ===
          data.assignment.id
    )

  if (activeSlots.length === 0) {
    return null
  }

  let cursor =
    module.plannedStartDate &&
    module.plannedStartDate > referenceDate
      ? module.plannedStartDate
      : referenceDate

  let accumulated = 0
  let checkedDays = 0

  while (
    cursor <= data.academicYear.endDate &&
    checkedDays < 550
  ) {
    checkedDays += 1

    if (
      !data.events.some(
        event =>
          eventBlocksAssignment(
            event,
            data.assignment,
            cursor
          )
      )
    ) {
      const weekday = getWeekday(cursor)

      accumulated +=
        activeSlots
          .filter(
            slot =>
              slot.weekday === weekday &&
              slot.validFrom <= cursor &&
              slot.validUntil >= cursor
          )
          .reduce(
            (total, slot) =>
              total + slot.periodCount,
            0
          )

      if (accumulated >= periodsRemaining) {
        return cursor
      }
    }

    cursor = addDays(cursor, 1)
  }

  return null
}

async function loadAssignmentProgressData(
  teachingAssignmentId: EntityId
): Promise<AssignmentProgressData> {
  const assignment =
    await maProfessorDb
      .teachingAssignments
      .get(teachingAssignmentId)

  if (!assignment) {
    throw new Error(
      'A turma e disciplina indicadas já não existem.'
    )
  }

  const [
    academicYear,
    modules,
    lessons,
    slots,
    events
  ] = await Promise.all([
    maProfessorDb.academicYears.get(
      assignment.academicYearId
    ),
    maProfessorDb.modules
      .where('teachingAssignmentId')
      .equals(assignment.id)
      .toArray(),
    maProfessorDb.lessons
      .where('teachingAssignmentId')
      .equals(assignment.id)
      .toArray(),
    maProfessorDb.weeklyScheduleSlots
      .where('teachingAssignmentId')
      .equals(assignment.id)
      .toArray(),
    maProfessorDb.schoolCalendarEvents
      .where('academicYearId')
      .equals(assignment.academicYearId)
      .toArray()
  ])

  if (!academicYear) {
    throw new Error(
      'O ano letivo associado já não existe.'
    )
  }

  return {
    academicYear,
    assignment,
    modules:
      sortModules(
        modules.filter(module =>
          module.active
        )
      ),
    lessons:
      [...lessons].sort(
        compareLessonsChronologically
      ),
    slots,
    events
  }
}


async function loadRelatedLessonIds(
  lessons: Lesson[],
  academicYearId: EntityId
) {
  const lessonIds =
    new Set(
      lessons.map(
        lesson => lesson.id
      )
    )

  if (lessonIds.size === 0) {
    return new Set<EntityId>()
  }

  const [
    attendanceRows,
    assessments,
    suggestions,
    planificationItems
  ] = await Promise.all([
    maProfessorDb.lessonAttendance
      .toArray(),
    maProfessorDb.lessonAssessments
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.summarySuggestions
      .toArray(),
    maProfessorDb.planificationItems
      .toArray()
  ])

  const relatedLessonIds =
    new Set<EntityId>()

  attendanceRows.forEach(
    row => {
      if (
        lessonIds.has(
          row.lessonId
        )
      ) {
        relatedLessonIds.add(
          row.lessonId
        )
      }
    }
  )

  assessments.forEach(
    assessment => {
      if (
        lessonIds.has(
          assessment.lessonId
        )
      ) {
        relatedLessonIds.add(
          assessment.lessonId
        )
      }
    }
  )

  suggestions.forEach(
    suggestion => {
      if (
        lessonIds.has(
          suggestion.lessonId
        )
      ) {
        relatedLessonIds.add(
          suggestion.lessonId
        )
      }
    }
  )

  planificationItems.forEach(
    item => {
      if (
        item.usedLessonId &&
        lessonIds.has(
          item.usedLessonId
        )
      ) {
        relatedLessonIds.add(
          item.usedLessonId
        )
      }
    }
  )

  return relatedLessonIds
}

function buildProgressBeforeLesson(
  data: AssignmentProgressData,
  lesson: Lesson,
  referenceToday: ISODate
) {
  return buildUfcdModuleProgress(
    data.modules,
    data.lessons.filter(candidate =>
      lessonOccursBefore(
        candidate,
        lesson
      )
    ),
    referenceToday
  )
}

function getProgressRow(
  progress: UfcdModuleProgress[],
  moduleId: EntityId
) {
  return progress.find(
    row =>
      row.moduleId === moduleId
  ) ?? null
}

async function lessonHasRelatedData(
  lesson: Lesson
) {
  if (
    lesson.planificationItemIds.length > 0 ||
    lesson.plannedActivity.trim() ||
    lesson.summary.trim() ||
    lesson.notes.trim()
  ) {
    return true
  }

  const [
    attendanceCount,
    assessmentCount,
    suggestionCount
  ] = await Promise.all([
    maProfessorDb.lessonAttendance
      .where('lessonId')
      .equals(lesson.id)
      .count(),
    maProfessorDb.lessonAssessments
      .where('lessonId')
      .equals(lesson.id)
      .count(),
    maProfessorDb.summarySuggestions
      .where('lessonId')
      .equals(lesson.id)
      .count()
  ])

  return (
    attendanceCount > 0 ||
    assessmentCount > 0 ||
    suggestionCount > 0
  )
}

function countScheduledLessonsUntilCompletion(
  data: AssignmentProgressData,
  lesson: Lesson,
  periodsRemainingBeforeLesson: number
) {
  if (
    periodsRemainingBeforeLesson <= 0 ||
    lesson.status === 'cancelled' ||
    !lesson.countTowardProgress
  ) {
    return null
  }

  let remaining =
    periodsRemainingBeforeLesson -
    lesson.periodCount
  let lessonCount = 1

  if (remaining <= 0) {
    return lessonCount
  }

  const slots =
    data.slots.filter(
      slot =>
        slot.active &&
        slot.teachingAssignmentId ===
          data.assignment.id
    )

  if (slots.length === 0) {
    return null
  }

  let cursor = lesson.date
  let checkedDays = 0

  while (
    cursor <= data.academicYear.endDate &&
    checkedDays < 550 &&
    lessonCount <= 5
  ) {
    checkedDays += 1

    if (
      !data.events.some(
        event =>
          eventBlocksAssignment(
            event,
            data.assignment,
            cursor
          )
      )
    ) {
      const weekday = getWeekday(cursor)

      const daySlots =
        slots
          .filter(
            slot =>
              slot.weekday === weekday &&
              slot.validFrom <= cursor &&
              slot.validUntil >= cursor &&
              (
                cursor > lesson.date ||
                slot.startTime > lesson.startTime
              )
          )
          .sort(
            (left, right) =>
              left.startTime.localeCompare(
                right.startTime
              )
          )

      for (const slot of daySlots) {
        remaining -= slot.periodCount
        lessonCount += 1

        if (remaining <= 0) {
          return lessonCount
        }

        if (lessonCount > 5) {
          return lessonCount
        }
      }
    }

    cursor = addDays(cursor, 1)
  }

  return remaining <= 0
    ? lessonCount
    : null
}

async function hasEnoughAssessmentEvidence(
  academicYearId: EntityId,
  teachingAssignmentId: EntityId,
  moduleId: EntityId
) {
  try {
    const snapshot =
      await assessmentWorkspaceRepository
        .getWorkspace(
          academicYearId,
          {
            teachingAssignmentId,
            moduleId
          }
        )

    return (
      snapshot.criteria.length > 0 &&
      snapshot.studentRows.length > 0 &&
      snapshot.studentRows.every(
        row =>
          row.gradeSummary
            .allActiveCriteriaAssessed
      )
    )
  } catch {
    return false
  }
}

export class UfcdProgressRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getAssignmentCompletionProjection(
    teachingAssignmentId: EntityId
  ): Promise<UfcdCompletionProjection> {
    await this.initialize()

    const data =
      await loadAssignmentProgressData(
        teachingAssignmentId
      )

    const referenceToday =
      todayISO()

    const progress =
      buildUfcdModuleProgress(
        data.modules,
        data.lessons,
        referenceToday
      )

    const actualCompletionDateByModuleId =
      new Map<EntityId, ISODate | null>(
        data.modules.map(
          module => {
            const row =
              progress.find(
                item =>
                  item.moduleId ===
                    module.id
              )

            return [
              module.id,
              row?.periodsRemaining === 0
                ? getLastCountedLessonDate(
                    module.id,
                    data.lessons,
                    referenceToday
                  )
                : null
            ]
          }
        )
      )

    const dateFrom =
      referenceToday <
      data.academicYear.startDate
        ? data.academicYear.startDate
        : referenceToday

    if (
      dateFrom >
      data.academicYear.endDate
    ) {
      return projectSequentialUfcdCompletionDates({
        modules:
          data.modules,
        progress,
        actualCompletionDateByModuleId,
        futureLessons:
          []
      })
    }

    const relatedLessonIds =
      await loadRelatedLessonIds(
        data.lessons,
        data.academicYear.id
      )

    const reconciliation =
      planScheduledLessonReconciliation({
        academicYear:
          data.academicYear,
        assignments: [
          data.assignment
        ],
        slots:
          data.slots,
        modules:
          data.modules,
        events:
          data.events,
        lessons:
          data.lessons,
        relatedLessonIds,
        dateFrom,
        dateTo:
          data.academicYear.endDate
      })

    const deletedLessonIds =
      new Set(
        reconciliation.deleteLessonIds
      )

    const existingFutureLessons =
      data.lessons
        .filter(
          lesson =>
            !deletedLessonIds.has(
              lesson.id
            ) &&
            lesson.date >=
              dateFrom &&
            lesson.status !==
              'cancelled' &&
            lesson.countTowardProgress &&
            !lessonCountsTowardUfcdProgress(
              lesson,
              referenceToday
            ) &&
            !data.events.some(
              event =>
                calendarEventBlocksAssignmentOnDate(
                  event,
                  data.assignment,
                  lesson.date
                )
            )
        )
        .map(
          lesson => ({
            date:
              lesson.date,
            startTime:
              lesson.startTime,
            periodCount:
              lesson.periodCount
          })
        )

    const projectedFutureLessons =
      reconciliation.createLessons
        .filter(
          lesson =>
            lesson.countTowardProgress &&
            lesson.date >=
              dateFrom
        )
        .map(
          lesson => ({
            date:
              lesson.date,
            startTime:
              lesson.startTime,
            periodCount:
              lesson.periodCount
          })
        )

    return projectSequentialUfcdCompletionDates({
      modules:
        data.modules,
      progress,
      actualCompletionDateByModuleId,
      futureLessons: [
        ...existingFutureLessons,
        ...projectedFutureLessons
      ]
    })
  }

  async ensureLessonUsesCurrentUfcd(
    lessonId: EntityId
  ) {
    await this.initialize()

    const lesson =
      await maProfessorDb.lessons.get(
        lessonId
      )

    if (!lesson) {
      return null
    }

    const data =
      await loadAssignmentProgressData(
        lesson.teachingAssignmentId
      )

    const referenceToday = todayISO()
    const progress =
      buildProgressBeforeLesson(
        data,
        lesson,
        referenceToday
      )

    const currentModule =
      selectCurrentUfcd(
        data.modules,
        progress
      )

    if (
      !currentModule ||
      currentModule.id ===
        lesson.moduleId
    ) {
      return currentModule
    }

    if (
      lesson.status !== 'planned' ||
      lesson.giaeStatus !== 'pending' ||
      await lessonHasRelatedData(lesson)
    ) {
      return currentModule
    }

    await maProfessorDb.lessons.put({
      ...lesson,
      moduleId:
        currentModule.id
    })

    return currentModule
  }

  async getEndingNoticeForDate(
    academicYearId: EntityId,
    date: ISODate,
    requestedLessonId?:
      | EntityId
      | null
  ): Promise<UfcdEndingNotice | null> {
    await this.initialize()

    let lesson:
      Lesson | undefined

    if (requestedLessonId) {
      lesson =
        await maProfessorDb.lessons.get(
          requestedLessonId
        )
    }

    if (!lesson) {
      const lessons =
        await maProfessorDb.lessons
          .where('academicYearId')
          .equals(academicYearId)
          .toArray()

      const dayLessons =
        lessons
          .filter(
            candidate =>
              candidate.date === date &&
              candidate.status !==
                'cancelled'
          )
          .sort(
            compareLessonsChronologically
          )

      if (date === todayISO()) {
        const currentTime =
          new Intl.DateTimeFormat(
            'pt-PT',
            {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }
          ).format(new Date())

        lesson =
          dayLessons.find(
            candidate =>
              candidate.startTime <=
                currentTime &&
              candidate.endTime >=
                currentTime
          ) ??
          dayLessons[0]
      } else {
        lesson = dayLessons[0]
      }
    }

    if (
      !lesson ||
      lesson.academicYearId !==
        academicYearId
    ) {
      return null
    }

    await this.ensureLessonUsesCurrentUfcd(
      lesson.id
    )

    lesson =
      await maProfessorDb.lessons.get(
        lesson.id
      )

    if (!lesson) {
      return null
    }

    const data =
      await loadAssignmentProgressData(
        lesson.teachingAssignmentId
      )

    const progressBefore =
      buildProgressBeforeLesson(
        data,
        lesson,
        todayISO()
      )

    const currentModule =
      selectCurrentUfcd(
        data.modules,
        progressBefore
      )

    if (
      !currentModule ||
      currentModule.id !==
        lesson.moduleId
    ) {
      return null
    }

    const currentProgress =
      getProgressRow(
        progressBefore,
        currentModule.id
      )

    if (!currentProgress) {
      return null
    }

    const lessonsRemaining =
      countScheduledLessonsUntilCompletion(
        data,
        lesson,
        currentProgress.periodsRemaining
      )

    if (
      lessonsRemaining === null ||
      lessonsRemaining < 1 ||
      lessonsRemaining > 5
    ) {
      return null
    }

    return {
      lessonId: lesson.id,
      moduleId: currentModule.id,
      moduleCode: currentModule.code,
      moduleName: currentModule.name,
      periodsTaughtBeforeLesson:
        currentProgress.periodsTaught,
      plannedPeriods:
        currentModule.plannedPeriods,
      lessonsRemaining,
      assessmentSufficient:
        await hasEnoughAssessmentEvidence(
          academicYearId,
          lesson.teachingAssignmentId,
          currentModule.id
        )
    }
  }

  async applyActualProgressToDashboard(
    snapshot: DashboardSnapshot
  ): Promise<DashboardSnapshot> {
    await this.initialize()

    const academicYearId =
      snapshot.academicYear.id

    const [
      lessons,
      slots,
      events
    ] = await Promise.all([
      maProfessorDb.lessons
        .where('academicYearId')
        .equals(academicYearId)
        .toArray(),
      maProfessorDb.weeklyScheduleSlots
        .where('academicYearId')
        .equals(academicYearId)
        .toArray(),
      maProfessorDb.schoolCalendarEvents
        .where('academicYearId')
        .equals(academicYearId)
        .toArray()
    ])

    const referenceToday = todayISO()
    let totalPeriodsPlanned = 0
    let totalPeriodsTaught = 0
    let totalPeriodsRemaining = 0

    const assignments =
      snapshot.assignments.map(row => {
        const assignmentLessons =
          lessons.filter(
            lesson =>
              lesson.teachingAssignmentId ===
                row.assignment.id
          )

        const modules =
          row.modules.map(
            moduleRow =>
              moduleRow.module
          )

        const progress =
          buildUfcdModuleProgress(
            modules,
            assignmentLessons,
            referenceToday
          )

        const progressByModuleId =
          new Map(
            progress.map(item => [
              item.moduleId,
              item
            ])
          )

        const progressData:
          AssignmentProgressData = {
          academicYear:
            snapshot.academicYear,
          assignment:
            row.assignment,
          modules,
          lessons:
            assignmentLessons,
          slots,
          events
        }

        const dashboardModules =
          row.modules.map(moduleRow => {
            const actual =
              progressByModuleId.get(
                moduleRow.module.id
              )!

            return {
              ...moduleRow,
              progress: {
                ...moduleRow.progress,
                periodsTaught:
                  actual.periodsTaught,
                periodsRemaining:
                  actual.periodsRemaining,
                completionPercent:
                  actual.completionPercent,
                estimatedCompletionDate:
                  estimateCompletionDate(
                    progressData,
                    moduleRow.module,
                    actual.periodsRemaining,
                    snapshot.referenceDate <
                      referenceToday
                      ? referenceToday
                      : snapshot.referenceDate
                  )
              }
            }
          })

        const currentModule =
          selectCurrentUfcd(
            modules,
            progress
          )

        const currentModuleProgress =
          currentModule
            ? dashboardModules.find(
                moduleRow =>
                  moduleRow.module.id ===
                    currentModule.id
              )?.progress ?? null
            : null

        const periodsPlanned =
          modules.reduce(
            (total, module) =>
              total + module.plannedPeriods,
            0
          )

        const periodsTaught =
          progress.reduce(
            (total, item) =>
              total + item.periodsTaught,
            0
          )

        const assignmentPeriodsRemaining =
          progress.reduce(
            (total, item) =>
              total + item.periodsRemaining,
            0
          )

        totalPeriodsPlanned +=
          periodsPlanned
        totalPeriodsTaught +=
          periodsTaught
        totalPeriodsRemaining +=
          assignmentPeriodsRemaining

        return {
          ...row,
          modules:
            dashboardModules.map(
              moduleRow => ({
                ...moduleRow,
                isCurrent:
                  moduleRow.module.id ===
                    currentModule?.id
              })
            ),
          currentModule,
          currentModuleProgress,
          periodsPlanned,
          periodsTaught,
          periodsRemaining:
            currentModuleProgress
              ?.periodsRemaining ?? 0,
          completionPercent:
            calculateCompletionPercent(
              periodsTaught,
              periodsPlanned
            )
        }
      })

    return {
      ...snapshot,
      assignments,
      totals: {
        ...snapshot.totals,
        periodsPlanned:
          totalPeriodsPlanned,
        periodsTaught:
          totalPeriodsTaught,
        periodsRemaining:
          totalPeriodsRemaining,
        completionPercent:
          calculateCompletionPercent(
            totalPeriodsTaught,
            totalPeriodsPlanned
          )
      }
    }
  }
}

export const ufcdProgressRepository =
  new UfcdProgressRepository()
