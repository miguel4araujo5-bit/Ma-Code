import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  AcademicYear,
  ClassGroup,
  EntityId,
  SchoolCalendarEvent,
  SchoolCalendarEventScope,
  SchoolCalendarEventType,
  Subject,
  TeachingAssignment,
  Weekday,
  WeeklyScheduleSlot
} from '../types'

export interface ScheduleWorkspaceFilters {
  teachingAssignmentId?: EntityId | null
  includeInactive?: boolean
}

export interface ScheduleAssignmentOption {
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  label: string
}

export interface ScheduleSlotRow {
  slot: WeeklyScheduleSlot
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  label: string
}

export interface SchoolCalendarEventRow {
  event: SchoolCalendarEvent
  scopeLabel: string
}

export interface ScheduleWorkspaceSnapshot {
  academicYear: AcademicYear

  filters: {
    teachingAssignmentId: EntityId | null
    includeInactive: boolean
  }

  assignmentOptions: ScheduleAssignmentOption[]
  slotRows: ScheduleSlotRow[]
  eventRows: SchoolCalendarEventRow[]

  totals: {
    activeSlotCount: number
    inactiveSlotCount: number
    weeklyPeriodCount: number
    eventCount: number
    blockingEventCount: number
  }

  generatedAt: string
}

export interface ScheduleSlotDraft {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  weekday: Weekday
  startTime: string
  endTime: string
  periodCount: number
  validFrom: string
  validUntil: string
  active?: boolean
}

export interface ScheduleSlotChanges {
  teachingAssignmentId?: EntityId
  weekday?: Weekday
  startTime?: string
  endTime?: string
  periodCount?: number
  validFrom?: string
  validUntil?: string
  active?: boolean
}

export interface SchoolCalendarEventDraft {
  academicYearId: EntityId
  type: SchoolCalendarEventType
  scope: SchoolCalendarEventScope
  groupId?: EntityId | null
  teachingAssignmentId?: EntityId | null
  title: string
  description?: string
  startDate: string
  endDate: string
  blocksLessons?: boolean
}

export interface SchoolCalendarEventChanges {
  type?: SchoolCalendarEventType
  scope?: SchoolCalendarEventScope
  groupId?: EntityId | null
  teachingAssignmentId?: EntityId | null
  title?: string
  description?: string
  startDate?: string
  endDate?: string
  blocksLessons?: boolean
}

function now() {
  return new Date().toISOString()
}

function createEntityId(
  prefix: string
): EntityId {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random()
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

function normalizeMultiline(
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
      line =>
        normalizeText(
          line
        )
    )
    .filter(Boolean)
    .join('\n')
}

function requireText(
  value: string,
  label: string
) {
  const normalized =
    normalizeText(
      value
    )

  if (
    !normalized
  ) {
    throw new Error(
      `${label} é obrigatório.`
    )
  }

  return normalized
}

function assertDate(
  value: string,
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
}

function assertDateRange(
  startDate: string,
  endDate: string,
  label: string
) {
  assertDate(
    startDate,
    `${label}: data inicial`
  )

  assertDate(
    endDate,
    `${label}: data final`
  )

  if (
    startDate >
    endDate
  ) {
    throw new Error(
      `${label}: a data inicial não pode ser posterior à data final.`
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

function assertTimeRange(
  startTime: string,
  endTime: string
) {
  assertTime(
    startTime,
    'A hora de início'
  )

  assertTime(
    endTime,
    'A hora de fim'
  )

  if (
    startTime >=
    endTime
  ) {
    throw new Error(
      'A hora de início deve ser anterior à hora de fim.'
    )
  }
}

function assertPeriodCount(
  value: number
) {
  if (
    !Number.isInteger(
      value
    ) ||
    value <= 0
  ) {
    throw new Error(
      'O número de tempos deve ser um número inteiro superior a zero.'
    )
  }
}

function assertWeekday(
  weekday: Weekday
) {
  if (
    ![
      1,
      2,
      3,
      4,
      5,
      6,
      7
    ].includes(
      weekday
    )
  ) {
    throw new Error(
      'O dia da semana indicado não é válido.'
    )
  }
}

function datesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
) {
  return (
    leftStart <=
      rightEnd &&
    rightStart <=
      leftEnd
  )
}

function timesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
) {
  return (
    leftStart <
      rightEnd &&
    rightStart <
      leftEnd
  )
}

function subjectLabel(
  subject: Subject
) {
  return (
    subject.shortName.trim() ||
    subject.name
  )
}

function sortSlots(
  rows: ScheduleSlotRow[]
) {
  return [
    ...rows
  ].sort(
    (
      left,
      right
    ) =>
      left.slot.weekday -
        right.slot.weekday ||
      left.slot.startTime.localeCompare(
        right.slot.startTime
      ) ||
      left.label.localeCompare(
        right.label,
        'pt-PT',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  )
}

function sortEvents(
  rows: SchoolCalendarEventRow[]
) {
  return [
    ...rows
  ].sort(
    (
      left,
      right
    ) =>
      left.event.startDate.localeCompare(
        right.event.startDate
      ) ||
      left.event.endDate.localeCompare(
        right.event.endDate
      ) ||
      left.event.title.localeCompare(
        right.event.title,
        'pt-PT',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  )
}

export class ScheduleWorkspaceRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  private async getAcademicYear(
    academicYearId: EntityId
  ) {
    const academicYear =
      await maProfessorDb.academicYears.get(
        academicYearId
      )

    if (
      !academicYear
    ) {
      throw new Error(
        'O ano letivo indicado não existe.'
      )
    }

    return academicYear
  }

  private async getAssignment(
    academicYearId: EntityId,
    teachingAssignmentId: EntityId
  ) {
    const assignment =
      await maProfessorDb.teachingAssignments.get(
        teachingAssignmentId
      )

    if (
      !assignment ||
      assignment.academicYearId !==
        academicYearId
    ) {
      throw new Error(
        'A turma e disciplina indicadas não pertencem ao ano letivo.'
      )
    }

    return assignment
  }

  private async validateSlot(
    draft: ScheduleSlotDraft,
    excludeSlotId?: EntityId
  ) {
    const [
      academicYear
    ] = await Promise.all([
      this.getAcademicYear(
        draft.academicYearId
      ),
      this.getAssignment(
        draft.academicYearId,
        draft.teachingAssignmentId
      )
    ])

    assertWeekday(
      draft.weekday
    )

    assertTimeRange(
      draft.startTime,
      draft.endTime
    )

    assertDateRange(
      draft.validFrom,
      draft.validUntil,
      'Vigência do horário'
    )

    assertPeriodCount(
      draft.periodCount
    )

    if (
      draft.validFrom <
        academicYear.startDate ||
      draft.validUntil >
        academicYear.endDate
    ) {
      throw new Error(
        'A vigência do horário deve ficar dentro do ano letivo.'
      )
    }

    if (
      draft.active ===
      false
    ) {
      return
    }

    const slots =
      await maProfessorDb.weeklyScheduleSlots
        .where(
          '[academicYearId+weekday]'
        )
        .equals([
          draft.academicYearId,
          draft.weekday
        ])
        .toArray()

    const conflict =
      slots.find(
        slot =>
          slot.id !==
            excludeSlotId &&
          slot.active &&
          datesOverlap(
            draft.validFrom,
            draft.validUntil,
            slot.validFrom,
            slot.validUntil
          ) &&
          timesOverlap(
            draft.startTime,
            draft.endTime,
            slot.startTime,
            slot.endTime
          )
      )

    if (
      conflict
    ) {
      throw new Error(
        'Este horário entra em conflito com outro bloco ativo no mesmo dia e período de vigência.'
      )
    }
  }

  private async normalizeEvent(
    academicYearId: EntityId,
    input: {
      type: SchoolCalendarEventType
      scope: SchoolCalendarEventScope
      groupId?: EntityId | null
      teachingAssignmentId?: EntityId | null
      title: string
      description?: string
      startDate: string
      endDate: string
      blocksLessons?: boolean
    }
  ) {
    const academicYear =
      await this.getAcademicYear(
        academicYearId
      )

    assertDateRange(
      input.startDate,
      input.endDate,
      'Período do evento'
    )

    if (
      input.startDate <
        academicYear.startDate ||
      input.endDate >
        academicYear.endDate
    ) {
      throw new Error(
        'O evento deve ficar dentro do ano letivo.'
      )
    }

    let groupId: EntityId | null =
      null

    let teachingAssignmentId:
      EntityId | null = null

    if (
      input.scope ===
      'group'
    ) {
      if (
        !input.groupId
      ) {
        throw new Error(
          'Selecione a turma abrangida pelo evento.'
        )
      }

      const group =
        await maProfessorDb.groups.get(
          input.groupId
        )

      if (
        !group ||
        group.academicYearId !==
          academicYearId
      ) {
        throw new Error(
          'A turma selecionada não pertence ao ano letivo.'
        )
      }

      groupId = group.id
    }

    if (
      input.scope ===
      'teaching_assignment'
    ) {
      if (
        !input.teachingAssignmentId
      ) {
        throw new Error(
          'Selecione a turma e disciplina abrangidas pelo evento.'
        )
      }

      const assignment =
        await this.getAssignment(
          academicYearId,
          input.teachingAssignmentId
        )

      teachingAssignmentId =
        assignment.id
    }

    return {
      type: input.type,
      scope: input.scope,
      groupId,
      teachingAssignmentId,
      title: requireText(
        input.title,
        'O título do evento'
      ),
      description:
        normalizeMultiline(
          input.description
        ),
      startDate:
        input.startDate,
      endDate:
        input.endDate,
      blocksLessons:
        input.blocksLessons ??
        true
    }
  }

  async getWorkspace(
    academicYearId: EntityId,
    filters: ScheduleWorkspaceFilters = {}
  ): Promise<ScheduleWorkspaceSnapshot> {
    await this.initialize()

    const [
      academicYear,
      groups,
      subjects,
      assignments,
      slots,
      events
    ] = await Promise.all([
      this.getAcademicYear(
        academicYearId
      ),
      maProfessorDb.groups
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),
      maProfessorDb.subjects
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),
      maProfessorDb.teachingAssignments
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),
      maProfessorDb.weeklyScheduleSlots
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),
      maProfessorDb.schoolCalendarEvents
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray()
    ])

    const groupById = new Map(
      groups.map(
        group => [
          group.id,
          group
        ]
      )
    )

    const subjectById = new Map(
      subjects.map(
        subject => [
          subject.id,
          subject
        ]
      )
    )

    const assignmentById = new Map(
      assignments.map(
        assignment => [
          assignment.id,
          assignment
        ]
      )
    )

    const assignmentOptions =
      assignments
        .filter(
          assignment =>
            assignment.active
        )
        .flatMap(
          assignment => {
            const group = groupById.get(
              assignment.groupId
            )

            const subject = subjectById.get(
              assignment.subjectId
            )

            if (
              !group?.active ||
              !subject?.active
            ) {
              return []
            }

            return [
              {
                assignment,
                group,
                subject,
                label:
                  `${group.name} · ${subjectLabel(
                    subject
                  )}`
              }
            ]
          }
        )
        .sort(
          (
            left,
            right
          ) =>
            left.label.localeCompare(
              right.label,
              'pt-PT',
              {
                numeric: true,
                sensitivity: 'base'
              }
            )
        )

    if (
      filters.teachingAssignmentId &&
      !assignmentOptions.some(
        option =>
          option.assignment.id ===
          filters.teachingAssignmentId
      )
    ) {
      throw new Error(
        'A turma e disciplina selecionadas não pertencem ao ano letivo.'
      )
    }

    const includeInactive =
      filters.includeInactive ??
      false

    const slotRows = sortSlots(
      slots.flatMap(
        slot => {
          if (
            !includeInactive &&
            !slot.active
          ) {
            return []
          }

          if (
            filters.teachingAssignmentId &&
            slot.teachingAssignmentId !==
              filters.teachingAssignmentId
          ) {
            return []
          }

          const assignment =
            assignmentById.get(
              slot.teachingAssignmentId
            )

          const group = assignment
            ? groupById.get(
                assignment.groupId
              )
            : undefined

          const subject = assignment
            ? subjectById.get(
                assignment.subjectId
              )
            : undefined

          if (
            !assignment ||
            !group ||
            !subject
          ) {
            return []
          }

          return [
            {
              slot,
              assignment,
              group,
              subject,
              label:
                `${group.name} · ${subjectLabel(
                  subject
                )}`
            }
          ]
        }
      )
    )

    const eventRows = sortEvents(
      events.map(
        event => {
          let scopeLabel =
            'Todo o ano letivo'

          if (
            event.scope ===
            'group'
          ) {
            scopeLabel =
              event.groupId
                ? groupById.get(
                    event.groupId
                  )?.name ??
                  'Turma indisponível'
                : 'Turma indisponível'
          }

          if (
            event.scope ===
            'teaching_assignment'
          ) {
            const option =
              assignmentOptions.find(
                item =>
                  item.assignment.id ===
                  event.teachingAssignmentId
              )

            scopeLabel =
              option?.label ??
              'Turma e disciplina indisponíveis'
          }

          return {
            event,
            scopeLabel
          }
        }
      )
    )

    return {
      academicYear,
      filters: {
        teachingAssignmentId:
          filters.teachingAssignmentId ??
          null,
        includeInactive
      },
      assignmentOptions,
      slotRows,
      eventRows,
      totals: {
        activeSlotCount:
          slots.filter(
            slot =>
              slot.active
          ).length,
        inactiveSlotCount:
          slots.filter(
            slot =>
              !slot.active
          ).length,
        weeklyPeriodCount:
          slots
            .filter(
              slot =>
                slot.active
            )
            .reduce(
              (
                total,
                slot
              ) =>
                total +
                slot.periodCount,
              0
            ),
        eventCount:
          events.length,
        blockingEventCount:
          events.filter(
            event =>
              event.blocksLessons
          ).length
      },
      generatedAt: now()
    }
  }

  async createScheduleSlot(
    input: ScheduleSlotDraft
  ) {
    await this.initialize()

    const draft = {
      ...input,
      active:
        input.active ??
        true
    }

    await this.validateSlot(
      draft
    )

    const timestamp = now()

    const slot: WeeklyScheduleSlot = {
      id: createEntityId(
        'schedule'
      ),
      academicYearId:
        draft.academicYearId,
      teachingAssignmentId:
        draft.teachingAssignmentId,
      weekday:
        draft.weekday,
      startTime:
        draft.startTime,
      endTime:
        draft.endTime,
      periodCount:
        draft.periodCount,
      validFrom:
        draft.validFrom,
      validUntil:
        draft.validUntil,
      active:
        draft.active,
      createdAt:
        timestamp,
      updatedAt:
        timestamp
    }

    await maProfessorDb.weeklyScheduleSlots.add(
      slot
    )

    return slot
  }

  async updateScheduleSlot(
    slotId: EntityId,
    changes: ScheduleSlotChanges
  ) {
    await this.initialize()

    const current =
      await maProfessorDb.weeklyScheduleSlots.get(
        slotId
      )

    if (
      !current
    ) {
      throw new Error(
        'O bloco de horário indicado não existe.'
      )
    }

    const draft: ScheduleSlotDraft = {
      academicYearId:
        current.academicYearId,
      teachingAssignmentId:
        changes.teachingAssignmentId ??
        current.teachingAssignmentId,
      weekday:
        changes.weekday ??
        current.weekday,
      startTime:
        changes.startTime ??
        current.startTime,
      endTime:
        changes.endTime ??
        current.endTime,
      periodCount:
        changes.periodCount ??
        current.periodCount,
      validFrom:
        changes.validFrom ??
        current.validFrom,
      validUntil:
        changes.validUntil ??
        current.validUntil,
      active:
        changes.active ??
        current.active
    }

    await this.validateSlot(
      draft,
      current.id
    )

    const updated: WeeklyScheduleSlot = {
      ...current,
      ...draft,
      updatedAt: now()
    }

    await maProfessorDb.weeklyScheduleSlots.put(
      updated
    )

    return updated
  }

  async deleteScheduleSlot(
    slotId: EntityId
  ) {
    await this.initialize()

    const slot =
      await maProfessorDb.weeklyScheduleSlots.get(
        slotId
      )

    if (
      !slot
    ) {
      return false
    }

    const linkedLessons =
      await maProfessorDb.lessons
        .where(
          'scheduleSlotId'
        )
        .equals(
          slot.id
        )
        .count()

    if (
      linkedLessons > 0
    ) {
      throw new Error(
        'Este bloco já possui aulas associadas. Desative-o para preservar o histórico.'
      )
    }

    await maProfessorDb.weeklyScheduleSlots.delete(
      slot.id
    )

    return true
  }

  async createSchoolCalendarEvent(
    input: SchoolCalendarEventDraft
  ) {
    await this.initialize()

    const normalized =
      await this.normalizeEvent(
        input.academicYearId,
        input
      )

    const timestamp = now()

    const event: SchoolCalendarEvent = {
      id: createEntityId(
        'school-event'
      ),
      academicYearId:
        input.academicYearId,
      ...normalized,
      createdAt:
        timestamp,
      updatedAt:
        timestamp
    }

    await maProfessorDb.schoolCalendarEvents.add(
      event
    )

    return event
  }

  async updateSchoolCalendarEvent(
    eventId: EntityId,
    changes: SchoolCalendarEventChanges
  ) {
    await this.initialize()

    const current =
      await maProfessorDb.schoolCalendarEvents.get(
        eventId
      )

    if (
      !current
    ) {
      throw new Error(
        'O evento escolar indicado não existe.'
      )
    }

    const normalized =
      await this.normalizeEvent(
        current.academicYearId,
        {
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
            current.title,
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
        }
      )

    const updated: SchoolCalendarEvent = {
      ...current,
      ...normalized,
      updatedAt: now()
    }

    await maProfessorDb.schoolCalendarEvents.put(
      updated
    )

    return updated
  }

  async deleteSchoolCalendarEvent(
    eventId: EntityId
  ) {
    await this.initialize()

    const event =
      await maProfessorDb.schoolCalendarEvents.get(
        eventId
      )

    if (
      !event
    ) {
      return false
    }

    await maProfessorDb.schoolCalendarEvents.delete(
      event.id
    )

    return true
  }
}

export function getWeekdayLabel(
  weekday: Weekday
) {
  const labels: Record<
    Weekday,
    string
  > = {
    1: 'Segunda-feira',
    2: 'Terça-feira',
    3: 'Quarta-feira',
    4: 'Quinta-feira',
    5: 'Sexta-feira',
    6: 'Sábado',
    7: 'Domingo'
  }

  return labels[weekday]
}

export function getSchoolCalendarEventTypeLabel(
  type: SchoolCalendarEventType
) {
  const labels: Record<
    SchoolCalendarEventType,
    string
  > = {
    holiday: 'Feriado',
    school_break: 'Interrupção letiva',
    strike: 'Greve',
    field_trip: 'Visita de estudo',
    teacher_absence: 'Falta do professor',
    meeting: 'Reunião',
    school_activity: 'Atividade escolar',
    other: 'Outro evento'
  }

  return labels[type]
}

export function getSchoolCalendarEventScopeLabel(
  scope: SchoolCalendarEventScope
) {
  const labels: Record<
    SchoolCalendarEventScope,
    string
  > = {
    all: 'Todo o ano letivo',
    group: 'Uma turma',
    teaching_assignment: 'Uma turma e disciplina'
  }

  return labels[scope]
}

export const scheduleWorkspaceRepository =
  new ScheduleWorkspaceRepository()
