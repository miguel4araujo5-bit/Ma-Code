import type {
  ISODate,
  Student,
  StudentMembershipPeriod
} from '../types'

function sortPeriods(
  periods: StudentMembershipPeriod[]
) {
  return [
    ...periods
  ].sort(
    (
      left,
      right
    ) =>
      left.startDate.localeCompare(
        right.startDate
      )
  )
}

export function isStudentMemberOnDate(
  student: Student,
  date: ISODate
) {
  const periods =
    student.membershipPeriods

  if (
    !periods ||
    periods.length ===
      0
  ) {
    return student.active
  }

  return periods.some(
    (
      period
    ) =>
      period.startDate <=
        date &&
      (
        period.endDate ===
          null ||
        date <=
          period.endDate
      )
  )
}

export function createInitialStudentMembership(
  startDate: ISODate
): StudentMembershipPeriod[] {
  return [
    {
      startDate,
      endDate:
        null
    }
  ]
}

export function closeStudentMembership(
  periods: StudentMembershipPeriod[] | undefined,
  endDate: ISODate
) {
  if (
    !periods ||
    periods.length ===
      0
  ) {
    return periods
  }

  const sorted =
    sortPeriods(
      periods
    )

  const openIndex =
    sorted.findIndex(
      period =>
        period.endDate ===
        null
    )

  if (
    openIndex ===
    -1
  ) {
    return sorted
  }

  const openPeriod =
    sorted[
      openIndex
    ]

  sorted[
    openIndex
  ] = {
    ...openPeriod,
    endDate:
      endDate <
      openPeriod.startDate
        ? openPeriod.startDate
        : endDate
  }

  return sorted
}

export function reopenStudentMembership(
  periods: StudentMembershipPeriod[] | undefined,
  startDate: ISODate
) {
  if (
    !periods ||
    periods.length ===
      0
  ) {
    return periods
  }

  const sorted =
    sortPeriods(
      periods
    )

  if (
    sorted.some(
      period =>
        period.endDate ===
        null
    )
  ) {
    return sorted
  }

  return [
    ...sorted,
    {
      startDate,
      endDate:
        null
    }
  ]
}

export function getLocalISODate(
  value =
    new Date()
): ISODate {
  return [
    String(
      value.getFullYear()
    ).padStart(
      4,
      '0'
    ),
    String(
      value.getMonth() +
        1
    ).padStart(
      2,
      '0'
    ),
    String(
      value.getDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-')
}
