import {
  calendarRepository
} from '../calendar/calendarRepository'
import {
  getDutyDatesForSchool
} from '../setup/schoolDutyDatePolicy'
import type {
  AcademicYear,
  Weekday
} from '../types'

export interface RecurringDutyDraft {
  name: string
  weekday: Weekday
  startTime: string
  endTime: string
  schoolName: string
}

export interface RecurringDutyResult {
  title: string
  eligibleCount: number
  createdCount: number
}

function clean(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function normalize(value: string) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
}

function assertWeekday(
  weekday: Weekday
) {
  if (
    ![1, 2, 3, 4, 5, 6, 7].includes(
      weekday
    )
  ) {
    throw new Error(
      'Selecione um dia da semana válido.'
    )
  }
}

function assertTime(
  value: string,
  label: string
) {
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      value
    )
  ) {
    throw new Error(
      `${label} não é uma hora válida.`
    )
  }
}

export function recurringDutyTitle(
  name: string,
  startTime: string,
  endTime: string
) {
  return `Cargo · ${clean(name)} · ${startTime}–${endTime}`
}

function recurringDutyKey(
  title: string,
  date: string
) {
  return `${normalize(title)}|${date}`
}

export async function createRecurringDutySchedule(
  academicYear: AcademicYear,
  draft: RecurringDutyDraft
): Promise<RecurringDutyResult> {
  const name = clean(draft.name)
  const schoolName = clean(draft.schoolName)

  if (!name) {
    throw new Error(
      'Indique o cargo ou atividade.'
    )
  }

  if (!schoolName) {
    throw new Error(
      'Não foi possível identificar a escola do professor. Confirme a escola antes de programar o cargo.'
    )
  }

  assertWeekday(
    draft.weekday
  )
  assertTime(
    draft.startTime,
    'A hora de início'
  )
  assertTime(
    draft.endTime,
    'A hora de fim'
  )

  if (
    draft.startTime >=
    draft.endTime
  ) {
    throw new Error(
      'A hora de início deve ser anterior à hora de fim.'
    )
  }

  const title =
    recurringDutyTitle(
      name,
      draft.startTime,
      draft.endTime
    )

  const dates =
    getDutyDatesForSchool(
      academicYear,
      draft.weekday,
      schoolName
    )

  if (dates.length === 0) {
    throw new Error(
      'Não existem datas aplicáveis para este cargo no ano letivo.'
    )
  }

  const existingEvents =
    await calendarRepository.listEvents({
      academicYearId:
        academicYear.id
    })

  const existingKeys =
    new Set(
      existingEvents
        .filter(
          event =>
            event.type ===
              'school_activity' &&
            event.scope ===
              'all'
        )
        .map(
          event =>
            recurringDutyKey(
              event.title,
              event.startDate
            )
        )
    )

  let createdCount = 0

  for (const date of dates) {
    const key =
      recurringDutyKey(
        title,
        date
      )

    if (
      existingKeys.has(key)
    ) {
      continue
    }

    await calendarRepository.createEvent({
      academicYearId:
        academicYear.id,
      type:
        'school_activity',
      scope:
        'all',
      title,
      description: '',
      startDate: date,
      endDate: date,
      blocksLessons: false
    })

    existingKeys.add(key)
    createdCount += 1
  }

  return {
    title,
    eligibleCount:
      dates.length,
    createdCount
  }
}
