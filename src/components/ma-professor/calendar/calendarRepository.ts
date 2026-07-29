import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  EntityId,
  ISODate,
  Lesson,
  SchoolCalendarEvent,
  SchoolCalendarEventScope,
  SchoolCalendarEventType,
  TeachingAssignment
} from '../types'

export interface SchoolCalendarEventDraft {
  academicYearId: EntityId
  type: SchoolCalendarEventType
  scope: SchoolCalendarEventScope
  groupId?: EntityId | null
  teachingAssignmentId?: EntityId | null
  title: string
  description?: string
  startDate: ISODate
  endDate: ISODate
  blocksLessons: boolean
}

export interface SchoolCalendarEventChanges {
  type?: SchoolCalendarEventType
  scope?: SchoolCalendarEventScope
  groupId?: EntityId | null
  teachingAssignmentId?: EntityId | null
  title?: string
  description?: string
  startDate?: ISODate
  endDate?: ISODate
  blocksLessons?: boolean
}

export interface SchoolCalendarEventFilters {
  academicYearId: EntityId
  dateFrom?: ISODate | null
  dateTo?: ISODate | null
  type?: SchoolCalendarEventType | null
  scope?: SchoolCalendarEventScope | null
  groupId?: EntityId | null
  teachingAssignmentId?: EntityId | null
  appliesToTeachingAssignmentId?: EntityId | null
  blocksLessons?: boolean | null
  searchText?: string
}

export interface CalendarEventImpact {
  event: SchoolCalendarEvent
  matchingLessons: Lesson[]
  scheduledLessons: Lesson[]
  extraLessons: Lesson[]
  plannedLessons: Lesson[]
  taughtLessons: Lesson[]
  cancelledLessons: Lesson[]
}

export interface CalendarDayStatus {
  date: ISODate
  events: SchoolCalendarEvent[]
  blockingEvents: SchoolCalendarEvent[]
  isBlocked: boolean
}

const EVENT_TYPES: SchoolCalendarEventType[] = [
  'holiday',
  'school_break',
  'strike',
  'field_trip',
  'teacher_absence',
  'meeting',
  'school_activity',
  'other'
]

const EVENT_SCOPES: SchoolCalendarEventScope[] = [
  'all',
  'group',
  'teaching_assignment'
]

function now() {
  return new Date().toISOString()
}

function createEntityId(
  prefix: string
): EntityId {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  if (uuid) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}

function normalizeText(
  value: string | undefined
) {
  return (
    value ??
    ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
}

function normalizeMultilineText(
  value: string | undefined
) {
  return (
    value ??
    ''
  )
    .replace(
      /\r\n/g,
      '\n'
    )
    .split('\n')
    .map(
      (
        line
      ) =>
        line
          .trim()
          .replace(
            /\s+/g,
            ' '
          )
    )
    .filter(Boolean)
    .join('\n')
}

function normalizeForComparison(
  value: string
) {
  return normalizeText(
    value
  ).toLocaleLowerCase(
    'pt-PT'
  )
}

function parseISODate(
  value: ISODate
) {
  const [
    year,
    month,
    day
  ] =
    value
      .split('-')
      .map(Number)

  return new Date(
    Date.UTC(
      year,
      month -
        1,
      day
    )
  )
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

  const parsed =
    parseISODate(
      value
    )

  if (
    formatISODate(
      parsed
    ) !==
    value
  ) {
    throw new Error(
      `${label} não é uma data válida.`
    )
  }
}

function assertDateRange(
  startDate: ISODate,
  endDate: ISODate,
  label: string
) {
  assertISODate(
    startDate,
    `A data inicial de ${label}`
  )

  assertISODate(
    endDate,
    `A data final de ${label}`
  )

  if (
    startDate >
    endDate
  ) {
    throw new Error(
      `A data inicial de ${label} não pode ser posterior à data final.`
    )
  }
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

function sortCalendarEvents(
  events: SchoolCalendarEvent[]
) {
  return events.sort(
    (
      left,
      right
    ) => {
      const startComparison =
        left.startDate.localeCompare(
          right.startDate
        )

      if (
        startComparison !==
        0
      ) {
        return startComparison
      }

      const endComparison =
        left.endDate.localeCompare(
          right.endDate
        )

      if (
        endComparison !==
        0
      ) {
        return endComparison
      }

      return left.title.localeCompare(
        right.title,
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

function sortLessons(
  lessons: Lesson[]
) {
  return lessons.sort(
    (
      left,
      right
    ) => {
      const dateComparison =
        left.date.localeCompare(
          right.date
        )

      if (
        dateComparison !==
        0
      ) {
        return dateComparison
      }

      const timeComparison =
        left.startTime.localeCompare(
          right.startTime
        )

      if (
        timeComparison !==
        0
      ) {
        return timeComparison
      }

      return left.createdAt.localeCompare(
        right.createdAt
      )
    }
  )
}

function assertEventType(
  type: SchoolCalendarEventType
) {
  if (
    !EVENT_TYPES.includes(
      type
    )
  ) {
    throw new Error(
      'O tipo de evento do calendário não é válido.'
    )
  }
}

function assertEventScope(
  scope: SchoolCalendarEventScope
) {
  if (
    !EVENT_SCOPES.includes(
      scope
    )
  ) {
    throw new Error(
      'O âmbito do evento do calendário não é válido.'
    )
  }
}

function normalizeTargetIds(
  scope: SchoolCalendarEventScope,
  groupId:
    | EntityId
    | null
    | undefined,
  teachingAssignmentId:
    | EntityId
    | null
    | undefined
) {
  if (
    scope ===
    'all'
  ) {
    return {
      groupId:
        null,
      teachingAssignmentId:
        null
    }
  }

  if (
    scope ===
    'group'
  ) {
    return {
      groupId:
        groupId ??
        null,
      teachingAssignmentId:
        null
    }
  }

  return {
    groupId:
      null,
    teachingAssignmentId:
      teachingAssignmentId ??
      null
  }
}

function eventIdentityKey(
  event: {
    type:
      SchoolCalendarEventType
    scope:
      SchoolCalendarEventScope
    groupId:
      EntityId | null
    teachingAssignmentId:
      EntityId | null
    title:
      string
    startDate:
      ISODate
    endDate:
      ISODate
  }
) {
  return [
    event.type,
    event.scope,
    event.groupId ??
      '',
    event.teachingAssignmentId ??
      '',
    normalizeForComparison(
      event.title
    ),
    event.startDate,
    event.endDate
  ].join('|')
}

export function calendarEventAppliesToAssignment(
  event:
    SchoolCalendarEvent,
  assignment:
    TeachingAssignment
) {
  if (
    event.academicYearId !==
    assignment.academicYearId
  ) {
    return false
  }

  if (
    event.scope ===
    'all'
  ) {
    return true
  }

  if (
    event.scope ===
    'group'
  ) {
    return (
      event.groupId ===
      assignment.groupId
    )
  }

  return (
    event.teachingAssignmentId ===
    assignment.id
  )
}

export function calendarEventContainsDate(
  event:
    SchoolCalendarEvent,
  date:
    ISODate
) {
  return (
    date >=
      event.startDate &&
    date <=
      event.endDate
  )
}

export function calendarEventBlocksAssignmentOnDate(
  event:
    SchoolCalendarEvent,
  assignment:
    TeachingAssignment,
  date:
    ISODate
) {
  return (
    event.blocksLessons &&
    calendarEventContainsDate(
      event,
      date
    ) &&
    calendarEventAppliesToAssignment(
      event,
      assignment
    )
  )
}

export function getSchoolCalendarEventTypeLabel(
  type:
    SchoolCalendarEventType
) {
  const labels:
    Record<
      SchoolCalendarEventType,
      string
    > = {
      holiday:
        'Feriado',
      school_break:
        'Interrupção letiva',
      strike:
        'Greve',
      field_trip:
        'Visita de estudo',
      teacher_absence:
        'Falta do professor',
      meeting:
        'Reunião',
      school_activity:
        'Atividade escolar',
      other:
        'Outro'
    }

  return labels[
    type
  ]
}

export function getSchoolCalendarEventScopeLabel(
  scope:
    SchoolCalendarEventScope
) {
  const labels:
    Record<
      SchoolCalendarEventScope,
      string
    > = {
      all:
        'Todas as turmas',
      group:
        'Uma turma',
      teaching_assignment:
        'Uma turma e disciplina'
    }

  return labels[
    scope
  ]
}

async function validateEventContext(
  event:
    Omit<
      SchoolCalendarEvent,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
    >
) {
  assertEventType(
    event.type
  )

  assertEventScope(
    event.scope
  )

  assertDateRange(
    event.startDate,
    event.endDate,
    'o evento'
  )

  if (
    !event.title
  ) {
    throw new Error(
      'O título do evento é obrigatório.'
    )
  }

  const academicYear =
    await maProfessorDb.academicYears.get(
      event.academicYearId
    )

  if (
    !academicYear
  ) {
    throw new Error(
      'O ano letivo indicado não existe.'
    )
  }

  if (
    event.startDate <
      academicYear.startDate ||
    event.endDate >
      academicYear.endDate
  ) {
    throw new Error(
      'O evento deve ficar inteiramente dentro das datas do ano letivo.'
    )
  }

  if (
    event.scope ===
    'all'
  ) {
    if (
      event.groupId ||
      event.teachingAssignmentId
    ) {
      throw new Error(
        'Um evento para todas as turmas não pode ficar associado a uma turma específica.'
      )
    }

    return {
      academicYear,
      group:
        null,
      teachingAssignment:
        null
    }
  }

  if (
    event.scope ===
    'group'
  ) {
    if (
      !event.groupId
    ) {
      throw new Error(
        'Selecione a turma abrangida pelo evento.'
      )
    }

    if (
      event.teachingAssignmentId
    ) {
      throw new Error(
        'Um evento de turma não pode ficar associado simultaneamente a uma disciplina.'
      )
    }

    const group =
      await maProfessorDb.groups.get(
        event.groupId
      )

    if (
      !group ||
      group.academicYearId !==
        event.academicYearId
    ) {
      throw new Error(
        'A turma indicada não pertence ao ano letivo.'
      )
    }

    return {
      academicYear,
      group,
      teachingAssignment:
        null
    }
  }

  if (
    !event.teachingAssignmentId
  ) {
    throw new Error(
      'Selecione a turma e disciplina abrangidas pelo evento.'
    )
  }

  if (
    event.groupId
  ) {
    throw new Error(
      'Um evento de turma e disciplina não deve guardar uma segunda referência de turma.'
    )
  }

  const teachingAssignment =
    await maProfessorDb.teachingAssignments.get(
      event.teachingAssignmentId
    )

  if (
    !teachingAssignment ||
    teachingAssignment.academicYearId !==
      event.academicYearId
  ) {
    throw new Error(
      'A turma e disciplina indicadas não pertencem ao ano letivo.'
    )
  }

  return {
    academicYear,
    group:
      null,
    teachingAssignment
  }
}

async function assertNoExactDuplicate(
  event:
    Omit<
      SchoolCalendarEvent,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
    >,
  ignoredEventId?:
    EntityId
) {
  const existingEvents:
    SchoolCalendarEvent[] =
    await maProfessorDb
      .schoolCalendarEvents
      .where(
        'academicYearId'
      )
      .equals(
        event.academicYearId
      )
      .toArray()

  const identity =
    eventIdentityKey(
      event
    )

  const duplicate =
    existingEvents.find(
      (
        current:
          SchoolCalendarEvent
      ) =>
        current.id !==
          ignoredEventId &&
        eventIdentityKey(
          current
        ) ===
          identity
    )

  if (
    duplicate
  ) {
    throw new Error(
      'Já existe um evento igual, com o mesmo âmbito e intervalo de datas.'
    )
  }
}

function createEventRecord(
  input:
    SchoolCalendarEventDraft
): SchoolCalendarEvent {
  const timestamp =
    now()

  const targets =
    normalizeTargetIds(
      input.scope,
      input.groupId,
      input.teachingAssignmentId
    )

  return {
    id:
      createEntityId(
        'calendar-event'
      ),
    academicYearId:
      input.academicYearId,
    type:
      input.type,
    scope:
      input.scope,
    groupId:
      targets.groupId,
    teachingAssignmentId:
      targets.teachingAssignmentId,
    title:
      normalizeText(
        input.title
      ),
    description:
      normalizeMultilineText(
        input.description
      ),
    startDate:
      input.startDate,
    endDate:
      input.endDate,
    blocksLessons:
      input.blocksLessons,
    createdAt:
      timestamp,
    updatedAt:
      timestamp
  }
}

function applyEventChanges(
  current:
    SchoolCalendarEvent,
  changes:
    SchoolCalendarEventChanges
): SchoolCalendarEvent {
  const scope =
    changes.scope ??
    current.scope

  const targets =
    normalizeTargetIds(
      scope,
      changes.groupId ===
      undefined
        ? current.groupId
        : changes.groupId,
      changes.teachingAssignmentId ===
      undefined
        ? current.teachingAssignmentId
        : changes.teachingAssignmentId
    )

  return {
    ...current,
    type:
      changes.type ??
      current.type,
    scope,
    groupId:
      targets.groupId,
    teachingAssignmentId:
      targets.teachingAssignmentId,
    title:
      changes.title ===
      undefined
        ? current.title
        : normalizeText(
            changes.title
          ),
    description:
      changes.description ===
      undefined
        ? current.description
        : normalizeMultilineText(
            changes.description
          ),
    startDate:
      changes.startDate ??
      current.startDate,
    endDate:
      changes.endDate ??
      current.endDate,
    blocksLessons:
      changes.blocksLessons ??
      current.blocksLessons,
    id:
      current.id,
    academicYearId:
      current.academicYearId,
    createdAt:
      current.createdAt,
    updatedAt:
      now()
  }
}

async function getAssignmentForFilter(
  academicYearId:
    EntityId,
  teachingAssignmentId:
    EntityId
): Promise<TeachingAssignment> {
  const assignment =
    await maProfessorDb
      .teachingAssignments
      .get(
        teachingAssignmentId
      )

  if (
    !assignment ||
    assignment.academicYearId !==
      academicYearId
  ) {
    throw new Error(
      'A turma e disciplina utilizadas no filtro não pertencem ao ano letivo.'
    )
  }

  return assignment
}

function eventMatchesSearch(
  event:
    SchoolCalendarEvent,
  searchText:
    string
) {
  const search =
    normalizeForComparison(
      searchText
    )

  if (
    !search
  ) {
    return true
  }

  return [
    event.title,
    event.description,
    getSchoolCalendarEventTypeLabel(
      event.type
    )
  ]
    .map(
      normalizeForComparison
    )
    .some(
      (
        value
      ) =>
        value.includes(
          search
        )
    )
}

export class CalendarRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getEvent(
    id:
      EntityId
  ) {
    await this.initialize()

    return maProfessorDb
      .schoolCalendarEvents
      .get(
        id
      )
  }

  async listEvents(
    filters:
      SchoolCalendarEventFilters
  ) {
    await this.initialize()

    if (
      filters.dateFrom
    ) {
      assertISODate(
        filters.dateFrom,
        'A data inicial do filtro'
      )
    }

    if (
      filters.dateTo
    ) {
      assertISODate(
        filters.dateTo,
        'A data final do filtro'
      )
    }

    if (
      filters.dateFrom &&
      filters.dateTo &&
      filters.dateFrom >
        filters.dateTo
    ) {
      throw new Error(
        'A data inicial do filtro não pode ser posterior à data final.'
      )
    }

    let assignmentForApplication:
      TeachingAssignment | null =
      null

    if (
      filters.appliesToTeachingAssignmentId
    ) {
      assignmentForApplication =
        await getAssignmentForFilter(
          filters.academicYearId,
          filters.appliesToTeachingAssignmentId
        )
    }

    let events:
      SchoolCalendarEvent[] =
      await maProfessorDb
        .schoolCalendarEvents
        .where(
          'academicYearId'
        )
        .equals(
          filters.academicYearId
        )
        .toArray()

    if (
      filters.dateFrom ||
      filters.dateTo
    ) {
      const dateFrom =
        filters.dateFrom ??
        '0000-01-01'

      const dateTo =
        filters.dateTo ??
        '9999-12-31'

      events =
        events.filter(
          (
            event:
              SchoolCalendarEvent
          ) =>
            dateRangesOverlap(
              event.startDate,
              event.endDate,
              dateFrom,
              dateTo
            )
        )
    }

    if (
      filters.type
    ) {
      events =
        events.filter(
          (
            event:
              SchoolCalendarEvent
          ) =>
            event.type ===
            filters.type
        )
    }

    if (
      filters.scope
    ) {
      events =
        events.filter(
          (
            event:
              SchoolCalendarEvent
          ) =>
            event.scope ===
            filters.scope
        )
    }

    if (
      filters.groupId
    ) {
      events =
        events.filter(
          (
            event:
              SchoolCalendarEvent
          ) =>
            event.groupId ===
            filters.groupId
        )
    }

    if (
      filters.teachingAssignmentId
    ) {
      events =
        events.filter(
          (
            event:
              SchoolCalendarEvent
          ) =>
            event.teachingAssignmentId ===
            filters.teachingAssignmentId
        )
    }

    if (
      assignmentForApplication
    ) {
      events =
        events.filter(
          (
            event:
              SchoolCalendarEvent
          ) =>
            calendarEventAppliesToAssignment(
              event,
              assignmentForApplication!
            )
        )
    }

    if (
      filters.blocksLessons !==
        null &&
      filters.blocksLessons !==
        undefined
    ) {
      events =
        events.filter(
          (
            event:
              SchoolCalendarEvent
          ) =>
            event.blocksLessons ===
            filters.blocksLessons
        )
    }

    if (
      filters.searchText
    ) {
      events =
        events.filter(
          (
            event:
              SchoolCalendarEvent
          ) =>
            eventMatchesSearch(
              event,
              filters.searchText!
            )
        )
    }

    return sortCalendarEvents(
      events
    )
  }

  async listEventsForDate(
    academicYearId:
      EntityId,
    date:
      ISODate
  ): Promise<CalendarDayStatus> {
    assertISODate(
      date,
      'A data'
    )

    const events =
      await this.listEvents({
        academicYearId,
        dateFrom:
          date,
        dateTo:
          date
      })

    const blockingEvents =
      events.filter(
        (
          event:
            SchoolCalendarEvent
        ) =>
          event.blocksLessons
      )

    return {
      date,
      events,
      blockingEvents,
      isBlocked:
        blockingEvents.length >
        0
    }
  }

  async listEventsForAssignment(
    academicYearId:
      EntityId,
    teachingAssignmentId:
      EntityId,
    dateFrom?:
      ISODate | null,
    dateTo?:
      ISODate | null,
    onlyBlocking =
      false
  ) {
    return this.listEvents({
      academicYearId,
      dateFrom,
      dateTo,
      appliesToTeachingAssignmentId:
        teachingAssignmentId,
      blocksLessons:
        onlyBlocking
          ? true
          : null
    })
  }

  async listBlockingEventsForAssignmentOnDate(
    academicYearId:
      EntityId,
    teachingAssignmentId:
      EntityId,
    date:
      ISODate
  ) {
    assertISODate(
      date,
      'A data'
    )

    const assignment =
      await getAssignmentForFilter(
        academicYearId,
        teachingAssignmentId
      )

    const events =
      await this.listEvents({
        academicYearId,
        dateFrom:
          date,
        dateTo:
          date,
        blocksLessons:
          true
      })

    return events.filter(
      (
        event:
          SchoolCalendarEvent
      ) =>
        calendarEventBlocksAssignmentOnDate(
          event,
          assignment,
          date
        )
    )
  }

  async createEvent(
    input:
      SchoolCalendarEventDraft
  ) {
    await this.initialize()

    const event =
      createEventRecord(
        input
      )

    await validateEventContext(
      event
    )

    await assertNoExactDuplicate(
      event
    )

    await maProfessorDb
      .schoolCalendarEvents
      .add(
        event
      )

    return event
  }

  async updateEvent(
    id:
      EntityId,
    changes:
      SchoolCalendarEventChanges
  ) {
    await this.initialize()

    const current =
      await maProfessorDb
        .schoolCalendarEvents
        .get(
          id
        )

    if (
      !current
    ) {
      throw new Error(
        'O evento indicado não existe.'
      )
    }

    const updated =
      applyEventChanges(
        current,
        changes
      )

    await validateEventContext(
      updated
    )

    await assertNoExactDuplicate(
      updated,
      current.id
    )

    await maProfessorDb
      .schoolCalendarEvents
      .put(
        updated
      )

    return updated
  }

  async deleteEvent(
    id:
      EntityId
  ) {
    await this.initialize()

    const event:
      | SchoolCalendarEvent
      | undefined =
      await maProfessorDb
        .schoolCalendarEvents
        .get(
          id
        )

    if (
      !event
    ) {
      return false
    }

    await maProfessorDb
      .schoolCalendarEvents
      .delete(
        id
      )

    return true
  }

  async duplicateEvent(
    id:
      EntityId,
    changes:
      Partial<
        Pick<
          SchoolCalendarEventDraft,
          | 'type'
          | 'scope'
          | 'groupId'
          | 'teachingAssignmentId'
          | 'title'
          | 'description'
          | 'startDate'
          | 'endDate'
          | 'blocksLessons'
        >
      > = {}
  ) {
    await this.initialize()

    const current =
      await maProfessorDb
        .schoolCalendarEvents
        .get(
          id
        )

    if (
      !current
    ) {
      throw new Error(
        'O evento que pretende duplicar não existe.'
      )
    }

    return this.createEvent({
      academicYearId:
        current.academicYearId,
      type:
        changes.type ??
        current.type,
      scope:
        changes.scope ??
        current.scope,
      groupId:
        changes.groupId ===
        undefined
          ? current.groupId
          : changes.groupId,
      teachingAssignmentId:
        changes.teachingAssignmentId ===
        undefined
          ? current.teachingAssignmentId
          : changes.teachingAssignmentId,
      title:
        changes.title ??
        `${current.title} — cópia`,
      description:
        changes.description ??
        current.description,
      startDate:
        changes.startDate ??
        current.startDate,
      endDate:
        changes.endDate ??
        current.endDate,
      blocksLessons:
        changes.blocksLessons ??
        current.blocksLessons
    })
  }

  async getEventImpact(
    id:
      EntityId
  ): Promise<CalendarEventImpact> {
    await this.initialize()

    const event:
      | SchoolCalendarEvent
      | undefined =
      await maProfessorDb
        .schoolCalendarEvents
        .get(
          id
        )

    if (
      !event
    ) {
      throw new Error(
        'O evento indicado não existe.'
      )
    }

    const [
      assignments,
      lessons
    ]: [
      TeachingAssignment[],
      Lesson[]
    ] =
      await Promise.all([
        maProfessorDb
          .teachingAssignments
          .where(
            'academicYearId'
          )
          .equals(
            event.academicYearId
          )
          .toArray(),
        maProfessorDb
          .lessons
          .where(
            'academicYearId'
          )
          .equals(
            event.academicYearId
          )
          .toArray()
      ])

    const assignmentById =
      new Map(
        assignments.map(
          (
            assignment:
              TeachingAssignment
          ) => [
            assignment.id,
            assignment
          ]
        )
      )

    const matchingLessons =
      sortLessons(
        lessons.filter(
          (
            lesson:
              Lesson
          ) => {
            if (
              !calendarEventContainsDate(
                event,
                lesson.date
              )
            ) {
              return false
            }

            const assignment =
              assignmentById.get(
                lesson.teachingAssignmentId
              )

            return Boolean(
              assignment &&
                calendarEventAppliesToAssignment(
                  event,
                  assignment
                )
            )
          }
        )
      )

    return {
      event,
      matchingLessons,
      scheduledLessons:
        matchingLessons.filter(
          (
            lesson
          ) =>
            lesson.origin ===
            'scheduled'
        ),
      extraLessons:
        matchingLessons.filter(
          (
            lesson
          ) =>
            lesson.origin ===
            'extra'
        ),
      plannedLessons:
        matchingLessons.filter(
          (
            lesson
          ) =>
            lesson.status ===
            'planned'
        ),
      taughtLessons:
        matchingLessons.filter(
          (
            lesson
          ) =>
            lesson.status ===
            'taught'
        ),
      cancelledLessons:
        matchingLessons.filter(
          (
            lesson
          ) =>
            lesson.status ===
            'cancelled'
        )
    }
  }
}

export const calendarRepository =
  new CalendarRepository()
