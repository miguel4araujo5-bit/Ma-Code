import { calendarRepository } from './calendarRepository'
import { lessonRepository } from '../lessons/lessonRepository'
import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'
import {
  isMAProfessorOperationallyReady
} from '../setup/setupReadiness'
import { scheduleWorkspaceRepository } from '../schedule/scheduleWorkspaceRepository'
import type {
  ClassGroup,
  EntityId,
  ISODate,
  SchoolCalendarEventType
} from '../types'

type ProfessionalGrade = 10 | 11 | 12

type PresetEvent = {
  type: SchoolCalendarEventType
  title: string
  startDate: ISODate
  endDate: ISODate
  blocksLessons: boolean
}

export type InitialSchoolCalendarPreparationResult = {
  applied: boolean
  createdEvents: number
  updatedScheduleSlots: number
  createdLessons: number
  skippedExistingLessons: number
}

const PRESET_ACADEMIC_YEAR = '2026/2027'
const SECONDARY_START_DATE: ISODate = '2026-09-21'
const TENTH_GRADE_END_DATE: ISODate = '2027-06-11'
const ELEVENTH_TWELFTH_END_DATE: ISODate = '2027-06-04'
const PRESET_DESCRIPTION =
  'Calendário Escolar 2026/2027 — Agrupamento de Escolas de S. Bento, Vizela.'

const PRESET_EVENTS: PresetEvent[] = [
  {
    type: 'school_activity',
    title: 'Integração',
    startDate: '2026-09-11',
    endDate: '2026-09-11',
    blocksLessons: false
  },
  {
    type: 'holiday',
    title: 'Implantação da República',
    startDate: '2026-10-05',
    endDate: '2026-10-05',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Todos os Santos',
    startDate: '2026-11-01',
    endDate: '2026-11-01',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Restauração da Independência',
    startDate: '2026-12-01',
    endDate: '2026-12-01',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Nossa Senhora da Conceição',
    startDate: '2026-12-08',
    endDate: '2026-12-08',
    blocksLessons: true
  },
  {
    type: 'school_break',
    title: 'Interrupção de Natal',
    startDate: '2026-12-16',
    endDate: '2026-12-31',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Natal',
    startDate: '2026-12-25',
    endDate: '2026-12-25',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Ano Novo',
    startDate: '2027-01-01',
    endDate: '2027-01-01',
    blocksLessons: true
  },
  {
    type: 'school_break',
    title: 'Interrupção de Carnaval',
    startDate: '2027-02-08',
    endDate: '2027-02-10',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Feriado municipal de Vizela',
    startDate: '2027-03-19',
    endDate: '2027-03-19',
    blocksLessons: true
  },
  {
    type: 'school_break',
    title: 'Interrupção da Páscoa',
    startDate: '2027-03-22',
    endDate: '2027-04-02',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Sexta-Feira Santa',
    startDate: '2027-03-26',
    endDate: '2027-03-26',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Páscoa',
    startDate: '2027-03-28',
    endDate: '2027-03-28',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Dia da Liberdade',
    startDate: '2027-04-25',
    endDate: '2027-04-25',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Dia do Trabalhador',
    startDate: '2027-05-01',
    endDate: '2027-05-01',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Corpo de Deus',
    startDate: '2027-05-27',
    endDate: '2027-05-27',
    blocksLessons: true
  },
  {
    type: 'holiday',
    title: 'Dia de Portugal',
    startDate: '2027-06-10',
    endDate: '2027-06-10',
    blocksLessons: true
  }
]

const preparationPromises = new Map<
  EntityId,
  Promise<InitialSchoolCalendarPreparationResult>
>()

function normalizeAcademicYearName(value: string) {
  return value.trim().replace(/\s+/g, '')
}

function getProfessionalGrade(group: ClassGroup): ProfessionalGrade | null {
  for (const candidate of [group.gradeLevel, group.name]) {
    const match = candidate.match(/(?:^|\D)(10|11|12)(?:\D|$)/)
    const grade = match ? Number(match[1]) : 0

    if (grade === 10 || grade === 11 || grade === 12) {
      return grade
    }
  }

  return null
}

function getGroupEndDate(group: ClassGroup): ISODate {
  const grade = getProfessionalGrade(group)

  if (!grade) {
    throw new Error(
      `Não foi possível determinar se a turma “${group.name}” é do 10.º, 11.º ou 12.º ano. Reveja o ano da turma antes de gerar o calendário.`
    )
  }

  return grade === 10
    ? TENTH_GRADE_END_DATE
    : ELEVENTH_TWELFTH_END_DATE
}

function validatePresetContext(snapshot: SetupSnapshot) {
  if (
    SECONDARY_START_DATE < snapshot.academicYear.startDate ||
    TENTH_GRADE_END_DATE > snapshot.academicYear.endDate
  ) {
    throw new Error(
      'As datas do calendário escolar 2026/2027 não cabem dentro do ano letivo ativo.'
    )
  }

  const activeGroupById = new Map(
    snapshot.groups
      .filter(group => group.active)
      .map(group => [group.id, group])
  )

  const endDateByAssignment = new Map<EntityId, ISODate>()

  for (const assignment of snapshot.teachingAssignments) {
    if (!assignment.active) continue

    const group = activeGroupById.get(assignment.groupId)
    if (!group) {
      throw new Error(
        `A associação “${assignment.displayName}” não possui uma turma ativa válida.`
      )
    }

    endDateByAssignment.set(assignment.id, getGroupEndDate(group))
  }

  return endDateByAssignment
}

function eventKey(event: {
  type: SchoolCalendarEventType
  title: string
  startDate: ISODate
  endDate: ISODate
}) {
  return [
    event.type,
    event.title.trim().toLocaleLowerCase('pt-PT'),
    event.startDate,
    event.endDate
  ].join('|')
}

async function ensurePresetEvents(academicYearId: EntityId) {
  const existingEvents = await calendarRepository.listEvents({ academicYearId })
  const existingKeys = new Set(
    existingEvents
      .filter(event => event.scope === 'all')
      .map(event => eventKey(event))
  )

  let createdEvents = 0

  for (const preset of PRESET_EVENTS) {
    const key = eventKey(preset)
    if (existingKeys.has(key)) continue

    await calendarRepository.createEvent({
      academicYearId,
      type: preset.type,
      scope: 'all',
      title: preset.title,
      description: PRESET_DESCRIPTION,
      startDate: preset.startDate,
      endDate: preset.endDate,
      blocksLessons: preset.blocksLessons
    })

    existingKeys.add(key)
    createdEvents += 1
  }

  return createdEvents
}

async function ensureScheduleValidity(
  snapshot: SetupSnapshot,
  endDateByAssignment: Map<EntityId, ISODate>
) {
  let updatedScheduleSlots = 0

  for (const slot of snapshot.weeklyScheduleSlots) {
    if (!slot.active) continue

    const expectedEndDate = endDateByAssignment.get(slot.teachingAssignmentId)
    if (!expectedEndDate) continue

    if (
      slot.validFrom === SECONDARY_START_DATE &&
      slot.validUntil === expectedEndDate
    ) {
      continue
    }

    const stillUsesGenericYearBounds =
      slot.validFrom === snapshot.academicYear.startDate &&
      slot.validUntil === snapshot.academicYear.endDate

    if (!stillUsesGenericYearBounds) {
      // Uma vigência já personalizada pelo professor nunca é substituída.
      continue
    }

    await scheduleWorkspaceRepository.updateScheduleSlot(slot.id, {
      validFrom: SECONDARY_START_DATE,
      validUntil: expectedEndDate
    })

    updatedScheduleSlots += 1
  }

  return updatedScheduleSlots
}

async function prepare(
  academicYearId: EntityId
): Promise<InitialSchoolCalendarPreparationResult> {
  const snapshot = await maProfessorRepository.getSetupSnapshot(academicYearId)

  if (
    normalizeAcademicYearName(snapshot.academicYear.name) !==
    PRESET_ACADEMIC_YEAR
  ) {
    return {
      applied: false,
      createdEvents: 0,
      updatedScheduleSlots: 0,
      createdLessons: 0,
      skippedExistingLessons: 0
    }
  }

  if (
    !isMAProfessorOperationallyReady(
      snapshot
    )
  ) {
    return {
      applied: false,
      createdEvents: 0,
      updatedScheduleSlots: 0,
      createdLessons: 0,
      skippedExistingLessons: 0
    }
  }

  const endDateByAssignment = validatePresetContext(snapshot)
  const createdEvents = await ensurePresetEvents(academicYearId)
  const updatedScheduleSlots = await ensureScheduleValidity(
    snapshot,
    endDateByAssignment
  )

  const generation = await lessonRepository.generateScheduledLessons({
    academicYearId,
    dateFrom: SECONDARY_START_DATE,
    dateTo: TENTH_GRADE_END_DATE,
    createCancelledForBlockedDates: false
  })

  return {
    applied: true,
    createdEvents,
    updatedScheduleSlots,
    createdLessons: generation.created.length,
    skippedExistingLessons: generation.skippedExisting
  }
}

export async function ensureInitialSchoolCalendar2026_2027(
  academicYearId: EntityId
) {
  const existing = preparationPromises.get(academicYearId)
  if (existing) return existing

  const current = prepare(academicYearId)
  preparationPromises.set(academicYearId, current)

  try {
    return await current
  } finally {
    if (preparationPromises.get(academicYearId) === current) {
      preparationPromises.delete(academicYearId)
    }
  }
}
