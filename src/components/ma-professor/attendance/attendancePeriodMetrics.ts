export interface AttendancePeriodMetricLesson {
  periodCount: number
  absent: boolean
}

export interface AttendancePeriodMetrics {
  periodsTaught: number
  absencePeriods: number
  absencePercent: number
}

export interface AnnualAttendancePeriodMetrics
  extends AttendancePeriodMetrics {
  plannedPeriods: number
}

export type AttendanceWarningLevel =
  | 'regular'
  | 'warning'
  | 'limit_reached'
  | 'recovery_required'

export interface AttendanceWarningLevelInput {
  plannedPeriods: number
  absencePeriods: number
  nextLessonPeriods: number
  warningPercent: number
  recoveryThresholdPercent: number
}

function roundPercentage(
  value: number
) {
  return (
    Math.round(
      value * 100
    ) / 100
  )
}

export function calculateAttendancePeriodMetrics(
  lessons: AttendancePeriodMetricLesson[]
): AttendancePeriodMetrics {
  const periodsTaught =
    lessons.reduce(
      (
        total,
        lesson
      ) =>
        total +
        lesson.periodCount,
      0
    )

  const absencePeriods =
    lessons.reduce(
      (
        total,
        lesson
      ) =>
        total +
        (
          lesson.absent
            ? lesson.periodCount
            : 0
        ),
      0
    )

  return {
    periodsTaught,
    absencePeriods,
    absencePercent:
      periodsTaught === 0
        ? 0
        : roundPercentage(
            (
              absencePeriods /
              periodsTaught
            ) * 100
          )
  }
}

export function calculateAnnualAttendancePeriodMetrics(
  plannedPeriods: number,
  lessons: AttendancePeriodMetricLesson[]
): AnnualAttendancePeriodMetrics {
  const taughtMetrics =
    calculateAttendancePeriodMetrics(
      lessons
    )

  const annualPlannedPeriods =
    Number.isFinite(plannedPeriods) &&
    plannedPeriods > 0
      ? plannedPeriods
      : 0

  return {
    ...taughtMetrics,
    plannedPeriods:
      annualPlannedPeriods,
    absencePercent:
      annualPlannedPeriods === 0
        ? 0
        : roundPercentage(
            (
              taughtMetrics.absencePeriods /
              annualPlannedPeriods
            ) * 100
          )
  }
}


export function getAttendanceWarningLevel({
  plannedPeriods,
  absencePeriods,
  nextLessonPeriods: _nextLessonPeriods,
  warningPercent: _warningPercent,
  recoveryThresholdPercent
}: AttendanceWarningLevelInput): AttendanceWarningLevel {
  if (
    !Number.isFinite(plannedPeriods) ||
    plannedPeriods <= 0
  ) {
    return 'regular'
  }

  const normalizedAbsencePeriods =
    Number.isFinite(absencePeriods)
      ? Math.max(0, absencePeriods)
      : 0

  const threshold = plannedPeriods * recoveryThresholdPercent / 100
  if (normalizedAbsencePeriods > threshold + 1e-9) return 'recovery_required'
  if (Math.abs(normalizedAbsencePeriods - threshold) < 1e-9) return 'limit_reached'
  if (normalizedAbsencePeriods > 0 && threshold - normalizedAbsencePeriods <= 2 + 1e-9) return 'warning'
  return 'regular'
}
