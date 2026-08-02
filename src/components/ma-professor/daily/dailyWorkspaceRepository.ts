import {
  assessmentRepository,
  type AssessmentResultDraft,
  type LessonAssessmentWorkspace
} from '../assessments/assessmentRepository'

import {
  assessmentWorkspaceRepository
} from '../assessments/assessmentWorkspaceRepository'

import {
  attendanceRepository,
  type AttendanceEntryDraft,
  type LessonAttendanceRegister
} from '../attendance/attendanceRepository'

import {
  calendarWorkspaceRepository,
  type CalendarLessonEditorContext,
  type CalendarLessonRow
} from '../calendar/calendarWorkspaceRepository'

import {
  lessonRepository
} from '../lessons/lessonRepository'

import type {
  AssessmentActivityType,
  AssessmentCriterion,
  AssessmentResultStatus,
  EntityId,
  GIAEStatus,
  ISODate,
  Lesson,
  LessonAssessment,
  LessonStatus,
  LocalTime,
  Score,
  Student,
  StudentAbsenceSummary,
  SummarySource
} from '../types'

export type DailyAssessmentStatus =
  | AssessmentResultStatus
  | 'not_evaluated'

export interface DailyStudentRow {
  student: Student
  attendanceStatus: 'present' | 'absent'
  attendanceCode: string
  attendanceNote: string
  assessmentStatus: DailyAssessmentStatus
  assessmentScore: Score | null
  assessmentNote: string
  provisionalAverage: Score | null
  absenceSummary: StudentAbsenceSummary | null
}

export interface DailyLessonWorkspace {
  context: CalendarLessonEditorContext
  attendance: LessonAttendanceRegister
  assessmentWorkspace: LessonAssessmentWorkspace
  selectedAssessment: LessonAssessment | null
  selectedCriterion: AssessmentCriterion | null
  students: DailyStudentRow[]
}

export interface DailyWeekDay {
  date: ISODate
  isToday: boolean
  isWithinAcademicYear: boolean
  lessons: CalendarLessonRow[]
}

export interface DailyDateWorkspace {
  date: ISODate
  weekStartDate: ISODate
  weekEndDate: ISODate
  previousWeekDate: ISODate | null
  nextWeekDate: ISODate | null
  weekDays: DailyWeekDay[]
  lessons: CalendarLessonRow[]
  selectedLessonId: EntityId | null
  selectedLesson: DailyLessonWorkspace | null
}

export interface DailyStudentSaveDraft {
  studentId: EntityId
  attendanceStatus: 'present' | 'absent'
  attendanceCode: string
  attendanceNote: string
  assessmentStatus: DailyAssessmentStatus
  assessmentScore: Score | null
  assessmentNote: string
}

export interface DailyAssessmentSaveDraft {
  mode: 'none' | 'existing' | 'new'
  assessmentId: EntityId | null
  criterionId: EntityId
  title: string
  activityType: AssessmentActivityType
  description: string
}

export interface DailyLessonSaveDraft {
  lessonId: EntityId
  status: LessonStatus
  startTime: LocalTime
  endTime: LocalTime
  periodCount: number
  countTowardProgress: boolean
  plannedActivity: string
  summary: string
  summarySource: SummarySource
  planificationItemIds: EntityId[]
  notes: string
  giaeStatus: GIAEStatus
  students: DailyStudentSaveDraft[]
  assessment: DailyAssessmentSaveDraft
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function sortLessons(
  rows: CalendarLessonRow[]
) {
  return [...rows].sort(
    (
      left,
      right
    ) => {
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
          sensitivity: 'base'
        }
      )
    }
  )
}

function todayISO(): ISODate {
  const date = new Date()

  return [
    String(
      date.getFullYear()
    ).padStart(
      4,
      '0'
    ),
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    ),
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-')
}

function getISOWeekday(
  value: ISODate
) {
  const [
    year,
    month,
    day
  ] = value
    .split('-')
    .map(Number)

  const weekday =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    ).getUTCDay()

  return weekday === 0
    ? 7
    : weekday
}

function resolveSelectedLessonId(
  date: ISODate,
  lessons: CalendarLessonRow[],
  requestedLessonId?:
    | EntityId
    | null
) {
  if (
    requestedLessonId &&
    lessons.some(
      row =>
        row.lesson.id ===
        requestedLessonId
    )
  ) {
    return requestedLessonId
  }

  if (
    date === todayISO()
  ) {
    const currentTime =
      new Intl.DateTimeFormat(
        'pt-PT',
        {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }
      ).format(
        new Date()
      )

    const currentLesson =
      lessons.find(
        row =>
          row.lesson.status !==
            'cancelled' &&
          row.lesson.startTime <=
            currentTime &&
          row.lesson.endTime >=
            currentTime
      )

    if (currentLesson) {
      return currentLesson
        .lesson.id
    }
  }

  return (
    lessons[0]?.lesson.id ??
    null
  )
}

function buildStudentRows(
  attendance:
    LessonAttendanceRegister,
  assessmentWorkspace:
    LessonAssessmentWorkspace,
  assessmentRegister:
    | Awaited<
        ReturnType<
          typeof assessmentRepository.getAssessmentRegister
        >
      >
    | null,
  absenceSummaries:
    StudentAbsenceSummary[],
  provisionalAverageByStudent:
    Map<
      EntityId,
      Score | null
    >
): DailyStudentRow[] {
  const assessmentResultByStudent =
    new Map(
      assessmentRegister
        ?.rows.map(
          row => [
            row.student.id,
            row.result
          ]
        ) ?? []
    )

  const absenceSummaryByStudent =
    new Map(
      absenceSummaries.map(
        summary => [
          summary.studentId,
          summary
        ]
      )
    )

  const students =
    attendance.rows.length > 0
      ? attendance.rows.map(
          row =>
            row.student
        )
      : assessmentWorkspace.students

  const attendanceByStudent =
    new Map(
      attendance.rows.map(
        row => [
          row.student.id,
          row
        ]
      )
    )

  return students.map(
    student => {
      const attendanceRow =
        attendanceByStudent.get(
          student.id
        )

      const assessmentResult =
        assessmentResultByStudent.get(
          student.id
        )

      return {
        student,
        attendanceStatus:
          attendanceRow
            ?.effectiveStatus ??
          'present',
        attendanceCode:
          attendanceRow
            ?.effectiveCode ??
          '',
        attendanceNote:
          attendanceRow
            ?.effectiveNote ??
          '',
        assessmentStatus:
          assessmentResult
            ?.status ??
          'not_evaluated',
        assessmentScore:
          assessmentResult
            ?.status ===
          'evaluated'
            ? assessmentResult.score
            : null,
        assessmentNote:
          assessmentResult
            ?.note ??
          '',
        provisionalAverage:
          provisionalAverageByStudent.get(
            student.id
          ) ?? null,
        absenceSummary:
          absenceSummaryByStudent.get(
            student.id
          ) ?? null
      }
    }
  )
}

function buildAssessmentEntries(
  rows:
    DailyStudentSaveDraft[]
): AssessmentResultDraft[] {
  return rows.flatMap<
    AssessmentResultDraft
  >(
    row => {
      if (
        row.assessmentStatus ===
        'not_evaluated'
      ) {
        return []
      }

      if (
        row.assessmentStatus ===
        'evaluated'
      ) {
        if (
          row.assessmentScore ===
            null ||
          !Number.isFinite(
            row.assessmentScore
          ) ||
          row.assessmentScore <
            0 ||
          row.assessmentScore >
            20
        ) {
          throw new Error(
            'Todas as classificações devem estar entre 0 e 20 valores.'
          )
        }

        return [
          {
            studentId:
              row.studentId,
            status:
              'evaluated',
            score:
              row.assessmentScore,
            note:
              row.assessmentNote
          }
        ]
      }

      return [
        {
          studentId:
            row.studentId,
          status:
            row.assessmentStatus,
          score: null,
          note:
            row.assessmentNote
        }
      ]
    }
  )
}

export class DailyWorkspaceRepository {
  async getDateWorkspace(
    academicYearId:
      EntityId,
    date: ISODate,
    requestedLessonId?:
      | EntityId
      | null,
    requestedAssessmentId?:
      | EntityId
      | null
  ): Promise<DailyDateWorkspace> {
    const calendar =
      await calendarWorkspaceRepository.getWorkspace(
        academicYearId,
        'week',
        date,
        {}
      )

    const weekDays:
      DailyWeekDay[] =
      calendar.days
        .filter(
          day =>
            getISOWeekday(
              day.date
            ) <= 5
        )
        .map(
          day => ({
            date:
              day.date,
            isToday:
              day.isToday,
            isWithinAcademicYear:
              day.isWithinAcademicYear,
            lessons:
              sortLessons(
                day.lessons
              )
          })
        )

    const requestedLessonDay =
      requestedLessonId
        ? weekDays.find(
            day =>
              day.lessons.some(
                row =>
                  row.lesson.id ===
                  requestedLessonId
              )
          ) ?? null
        : null

    const effectiveDate =
      requestedLessonDay?.date ??
      (calendar.days.some(
        day =>
          day.date === date
      )
        ? date
        : calendar.anchorDate)

    const lessons =
      sortLessons(
        calendar.days.find(
          day =>
            day.date ===
            effectiveDate
        )?.lessons ?? []
      )

    const selectedLessonId =
      resolveSelectedLessonId(
        effectiveDate,
        lessons,
        requestedLessonId
      )

    return {
      date:
        effectiveDate,
      weekStartDate:
        weekDays[0]?.date ??
        calendar.primaryStartDate,
      weekEndDate:
        weekDays[
          weekDays.length - 1
        ]?.date ??
        calendar.primaryEndDate,
      previousWeekDate:
        calendar.previousAnchorDate,
      nextWeekDate:
        calendar.nextAnchorDate,
      weekDays,
      lessons,
      selectedLessonId,
      selectedLesson:
        selectedLessonId
          ? await this.getLessonWorkspace(
              academicYearId,
              selectedLessonId,
              requestedAssessmentId
            )
          : null
    }
  }

  async getLessonWorkspace(
    academicYearId:
      EntityId,
    lessonId:
      EntityId,
    requestedAssessmentId?:
      | EntityId
      | null
  ): Promise<DailyLessonWorkspace> {
    const context =
      await calendarWorkspaceRepository.getLessonEditorContext(
        lessonId
      )

    const [
      attendance,
      assessmentWorkspace,
      absenceSummaries,
      assessmentOverview
    ] =
      await Promise.all([
        attendanceRepository.getLessonAttendanceRegister(
          lessonId
        ),
        assessmentRepository.getLessonAssessmentWorkspace(
          lessonId
        ),
        attendanceRepository.listModuleAbsenceSummaries(
          context.lessonRow
            .module.id
        ),
        assessmentWorkspaceRepository.getWorkspace(
          academicYearId,
          {
            teachingAssignmentId:
              context.lessonRow
                .assignment.id,
            moduleId:
              context.lessonRow
                .module.id
          }
        )
      ])

    const selectedAssessmentItem =
      requestedAssessmentId ===
      null
        ? null
        : assessmentWorkspace
              .assessments.find(
                item =>
                  item.assessment
                    .id ===
                  requestedAssessmentId
              ) ??
          assessmentWorkspace
            .assessments[0] ??
          null

    const assessmentRegister =
      selectedAssessmentItem
        ? await assessmentRepository.getAssessmentRegister(
            selectedAssessmentItem
              .assessment.id
          )
        : null

    const provisionalAverageByStudent =
      new Map(
        assessmentOverview
          .studentRows.map(
            row => [
              row.student.id,
              row.gradeSummary
                .provisionalAverage
            ]
          )
      )

    return {
      context,
      attendance,
      assessmentWorkspace,
      selectedAssessment:
        selectedAssessmentItem
          ?.assessment ??
        null,
      selectedCriterion:
        selectedAssessmentItem
          ?.criterion ??
        null,
      students:
        buildStudentRows(
          attendance,
          assessmentWorkspace,
          assessmentRegister,
          absenceSummaries,
          provisionalAverageByStudent
        )
    }
  }

  async saveLesson(
    input:
      DailyLessonSaveDraft
  ): Promise<{
    lesson: Lesson
    assessmentId:
      | EntityId
      | null
  }> {
    if (
      input.status ===
        'taught' &&
      !input.summary.trim()
    ) {
      throw new Error(
        'Indique o sumário antes de marcar a aula como dada.'
      )
    }

    if (
      !Number.isInteger(
        input.periodCount
      ) ||
      input.periodCount <=
        0
    ) {
      throw new Error(
        'O número de tempos deve ser um número inteiro superior a zero.'
      )
    }

    let assessmentEntries:
      | AssessmentResultDraft[]
      | null = null

    let assessmentTitle =
      ''

    const assessmentToDeleteId =
      input.assessment
        .mode === 'none'
        ? input.assessment
            .assessmentId
        : null

    if (
      input.assessment
        .mode ===
        'existing' ||
      assessmentToDeleteId
    ) {
      if (
        !input.assessment
          .assessmentId
      ) {
        throw new Error(
          'Não foi possível identificar a atividade de avaliação selecionada.'
        )
      }

      const assessmentWorkspace =
        await assessmentRepository.getLessonAssessmentWorkspace(
          input.lessonId
        )

      if (
        !assessmentWorkspace.assessments.some(
          item =>
            item.assessment.id ===
            input.assessment
              .assessmentId
        )
      ) {
        throw new Error(
          'A atividade de avaliação selecionada já não pertence a esta aula.'
        )
      }
    }

    if (
      input.assessment
        .mode !== 'none'
    ) {
      if (
        input.status !==
        'taught'
      ) {
        throw new Error(
          'A avaliação só pode ser guardada numa aula marcada como dada.'
        )
      }

      assessmentTitle =
        input.assessment.title.trim()

      if (
        !assessmentTitle
      ) {
        throw new Error(
          'Indique o nome da atividade de avaliação.'
        )
      }

      if (
        !input.assessment
          .criterionId
      ) {
        throw new Error(
          'Selecione o critério de avaliação.'
        )
      }

      assessmentEntries =
        buildAssessmentEntries(
          input.students
        )
    }

    if (
      input.status !==
      'taught'
    ) {
      const [
        attendance,
        assessments
      ] =
        await Promise.all([
          attendanceRepository.getLessonAttendanceRegister(
            input.lessonId
          ),
          assessmentRepository.getLessonAssessmentWorkspace(
            input.lessonId
          )
        ])

      const hasAttendance =
        attendance.rows.some(
          row =>
            row.attendance
        )

      const hasAssessments =
        assessments.assessments.some(
          item =>
            item.assessment.id !==
            assessmentToDeleteId
        )

      if (
        hasAttendance ||
        hasAssessments
      ) {
        throw new Error(
          'Esta aula já possui faltas ou avaliações. Mantenha-a marcada como dada para preservar esses registos.'
        )
      }
    }

    let updated =
      await lessonRepository.updateLesson(
        input.lessonId,
        {
          status:
            input.status,
          startTime:
            input.startTime,
          endTime:
            input.endTime,
          periodCount:
            input.periodCount,
          countTowardProgress:
            input.status ===
            'cancelled'
              ? false
              : input.countTowardProgress,
          plannedActivity:
            input.plannedActivity,
          summary:
            input.summary,
          summarySource:
            input.summarySource,
          planificationItemIds:
            input.planificationItemIds,
          notes:
            input.notes
        }
      )

    if (
      input.giaeStatus ===
        'submitted' &&
      updated.status ===
        'taught' &&
      updated.summary.trim()
    ) {
      updated =
        await lessonRepository.markGIAESubmitted(
          updated.id
        )
    } else if (
      updated.giaeStatus ===
      'submitted'
    ) {
      updated =
        await lessonRepository.markGIAEPending(
          updated.id
        )
    }

    if (
      updated.status !==
      'taught'
    ) {
      if (
        assessmentToDeleteId
      ) {
        await assessmentRepository.deleteLessonAssessment(
          assessmentToDeleteId
        )
      }

      return {
        lesson: updated,
        assessmentId: null
      }
    }

    const attendanceEntries:
      AttendanceEntryDraft[] =
      input.students.map(
        row => ({
          studentId:
            row.studentId,
          status:
            row.attendanceStatus,
          code:
            row.attendanceStatus ===
            'absent'
              ? row.attendanceCode ||
                'F'
              : '',
          note:
            row.attendanceNote
        })
      )

    await attendanceRepository.saveLessonAttendance(
      updated.id,
      attendanceEntries,
      {
        fillMissingAsPresent:
          true,
        synchronizeRecoveries:
          true
      }
    )

    if (
      input.assessment
        .mode === 'none'
    ) {
      if (
        assessmentToDeleteId
      ) {
        await assessmentRepository.deleteLessonAssessment(
          assessmentToDeleteId
        )
      }

      return {
        lesson: updated,
        assessmentId: null
      }
    }

    if (
      !assessmentEntries
    ) {
      throw new Error(
        'Não foi possível preparar as classificações desta aula.'
      )
    }

    if (
      input.assessment
        .mode === 'new'
    ) {
      const assessment =
        await assessmentRepository.createLessonAssessment(
          {
            lessonId:
              updated.id,
            criterionId:
              input.assessment
                .criterionId,
            title:
              assessmentTitle,
            activityType:
              input.assessment
                .activityType,
            description:
              input.assessment
                .description
          }
        )

      try {
        await assessmentRepository.saveAssessmentResults(
          assessment.id,
          assessmentEntries
        )
      } catch (error) {
        try {
          await assessmentRepository.deleteLessonAssessment(
            assessment.id
          )
        } catch {
          // A falha original é a mais importante.
        }

        throw error
      }

      return {
        lesson: updated,
        assessmentId:
          assessment.id
      }
    }

    if (
      !input.assessment
        .assessmentId
    ) {
      throw new Error(
        'Não foi possível identificar a atividade de avaliação selecionada.'
      )
    }

    await assessmentRepository.updateLessonAssessment(
      input.assessment
        .assessmentId,
      {
        criterionId:
          input.assessment
            .criterionId,
        title:
          assessmentTitle,
        activityType:
          input.assessment
            .activityType,
        description:
          input.assessment
            .description
      }
    )

    await assessmentRepository.saveAssessmentResults(
      input.assessment
        .assessmentId,
      assessmentEntries
    )

    return {
      lesson: updated,
      assessmentId:
        input.assessment
          .assessmentId
    }
  }

  describeError(
    error: unknown
  ) {
    return getErrorMessage(
      error
    )
  }
}

export const dailyWorkspaceRepository =
  new DailyWorkspaceRepository()
