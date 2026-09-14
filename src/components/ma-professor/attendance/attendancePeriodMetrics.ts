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
