import type {
  AcademicYear,
  ISODate,
  Weekday
} from '../types'

const S_BENTO_2026_2027_DUTY_RANGES: Array<{
  startDate: ISODate
  endDate: ISODate
}> = [
  {
    startDate: '2026-09-21',
    endDate: '2026-12-15'
  },
  {
    startDate: '2027-01-04',
    endDate: '2027-03-19'
  },
  {
    startDate: '2027-04-05',
    endDate: '2027-06-11'
  }
]

const S_BENTO_2026_2027_CLOSED_DATES =
  new Set<ISODate>([
    '2026-10-05',
    '2026-12-01',
    '2026-12-08',
    '2027-02-08',
    '2027-02-09',
    '2027-02-10',
    '2027-03-19',
    '2027-04-25',
    '2027-05-01',
    '2027-05-27',
    '2027-06-10'
  ])

function normalizeAcademicYearName(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSchoolName(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function isSBentoSchoolName(
  value: string
) {
  const normalized =
    normalizeSchoolName(value)

  if (!normalized) {
    return false
  }

  const mentionsSBento =
    normalized.includes('s bento') ||
    normalized.includes('sao bento')

  if (!mentionsSBento) {
    return false
  }

  return (
    normalized.includes('vizela') ||
    normalized.startsWith('agrupamento de escolas') ||
    normalized.startsWith('escola basica e secundaria') ||
    normalized.startsWith('ebs ')
  )
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

function toISODate(
  value: Date
): ISODate {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function getWeekday(
  value: Date
): Weekday {
  const day =
    value.getUTCDay()

  return (
    day === 0
      ? 7
      : day
  ) as Weekday
}

function usesSBento2026_2027Preset(
  academicYear: AcademicYear,
  schoolName: string
) {
  return (
    isSBentoSchoolName(
      schoolName
    ) &&
    normalizeAcademicYearName(
      academicYear.name
    ) === '2026/2027'
  )
}

export function getDutyDatesForSchool(
  academicYear: AcademicYear,
  weekday: Weekday,
  schoolName: string
) {
  const useSBentoPreset =
    usesSBento2026_2027Preset(
      academicYear,
      schoolName
    )

  const ranges =
    useSBentoPreset
      ? S_BENTO_2026_2027_DUTY_RANGES
      : [
          {
            startDate:
              academicYear.startDate,
            endDate:
              academicYear.endDate
          }
        ]

  const result: ISODate[] = []

  for (const range of ranges) {
    const current =
      parseISODate(
        range.startDate
      )

    const end =
      parseISODate(
        range.endDate
      )

    while (current <= end) {
      const isoDate =
        toISODate(current)

      if (
        getWeekday(current) ===
          weekday &&
        !(
          useSBentoPreset &&
          S_BENTO_2026_2027_CLOSED_DATES.has(
            isoDate
          )
        )
      ) {
        result.push(
          isoDate
        )
      }

      current.setUTCDate(
        current.getUTCDate() + 1
      )
    }
  }

  return result
}
