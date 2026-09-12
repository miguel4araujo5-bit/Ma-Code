import type {
  SchoolCalendarEvent
} from '../types'

const DUTY_TITLE_PREFIX =
  'Cargo · '

const DUTY_TIME_RANGE =
  /^(\d{2}:\d{2})[–-](\d{2}:\d{2})$/

export interface DutyEventDetails {
  name: string
  startTime: string
  endTime: string
  timeLabel: string
}

export function getDutyEventDetails(
  event: SchoolCalendarEvent
): DutyEventDetails | null {
  if (
    event.type !==
      'school_activity' ||
    event.scope !== 'all' ||
    !event.title.startsWith(
      DUTY_TITLE_PREFIX
    )
  ) {
    return null
  }

  const payload =
    event.title
      .slice(
        DUTY_TITLE_PREFIX.length
      )
      .trim()

  const separatorIndex =
    payload.lastIndexOf(
      ' · '
    )

  if (separatorIndex < 0) {
    return {
      name:
        payload || 'Cargo',
      startTime: '',
      endTime: '',
      timeLabel: ''
    }
  }

  const name =
    payload
      .slice(
        0,
        separatorIndex
      )
      .trim() || 'Cargo'

  const timeLabel =
    payload
      .slice(
        separatorIndex + 3
      )
      .trim()

  const match =
    timeLabel.match(
      DUTY_TIME_RANGE
    )

  return {
    name,
    startTime:
      match?.[1] ?? '',
    endTime:
      match?.[2] ?? '',
    timeLabel:
      match
        ? `${match[1]}–${match[2]}`
        : timeLabel
  }
}

export function isDutyEvent(
  event: SchoolCalendarEvent
) {
  return Boolean(
    getDutyEventDetails(
      event
    )
  )
}
