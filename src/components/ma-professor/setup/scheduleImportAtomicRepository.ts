import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import {
  markDashboardDataDirty
} from '../dashboard/dashboardRefreshSignal'

import type {
  ClassGroup,
  SchoolCalendarEvent,
  Subject,
  TeachingAssignment,
  Weekday,
  WeeklyScheduleSlot
} from '../types'

import {
  getDutyDatesForSchool
} from './schoolDutyDatePolicy'

export type ScheduleImportLesson = {
  included: boolean
  weekday: Weekday
  startTime: string
  endTime: string
  periodCount: number
  groupName: string
  courseName: string
  subjectName: string
  subjectConfirmed: boolean
}

export type ScheduleImportDuty = {
  included: boolean
  weekday: Weekday
  startTime: string
  endTime: string
  name: string
}

const TEACHER_PROFILE_ID =
  'local-profile'

function normalize(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/\s+/g, ' ')
    .trim()
}

function clean(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function createId(
  prefix: string
) {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 12)}`
}

function now() {
  return new Date()
    .toISOString()
}

function shortName(
  name: string
) {
  const words =
    clean(name)
      .split(/\s+/)

  if (words.length <= 2) {
    return name.slice(0, 24)
  }

  const initials =
    words
      .filter(
        word => word.length > 2
      )
      .map(
        word =>
          word[0]
            ?.toLocaleUpperCase(
              'pt-PT'
            ) ?? ''
      )
      .join('')

  return (
    initials || name
  ).slice(0, 24)
}

function relevantTables() {
  return [
    maProfessorDb.teacherProfiles,
    maProfessorDb.academicYears,
    maProfessorDb.groups,
    maProfessorDb.subjects,
    maProfessorDb.teachingAssignments,
    maProfessorDb.weeklyScheduleSlots,
    maProfessorDb.schoolCalendarEvents
  ]
}

async function buildFingerprint(
  academicYearId: string
) {
  const [
    profile,
    academicYear,
    groups,
    subjects,
    assignments,
    slots,
    events
  ] = await Promise.all([
    maProfessorDb.teacherProfiles.get(
      TEACHER_PROFILE_ID
    ),
    maProfessorDb.academicYears.get(
      academicYearId
    ),
    maProfessorDb.groups
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.subjects
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.teachingAssignments
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.weeklyScheduleSlots
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.schoolCalendarEvents
      .where('academicYearId')
      .equals(academicYearId)
      .toArray()
  ])

  const sorted = <
    T extends {
      id: string
    }
  >(
    rows: T[]
  ) => [
    ...rows
  ].sort(
    (left, right) =>
      left.id.localeCompare(
        right.id
      )
  )

  return JSON.stringify({
    profile:
      profile
        ? {
            id: profile.id,
            schoolName:
              profile.schoolName,
            updatedAt:
              profile.updatedAt
          }
        : null,
    academicYear:
      academicYear
        ? {
            id: academicYear.id,
            startDate:
              academicYear.startDate,
            endDate:
              academicYear.endDate,
            updatedAt:
              academicYear.updatedAt
          }
        : null,
    groups:
      sorted(groups),
    subjects:
      sorted(subjects),
    assignments:
      sorted(assignments),
    slots:
      sorted(slots),
    events:
      sorted(events)
  })
}

export async function readScheduleImportFingerprint(
  academicYearId: string
) {
  await openMAProfessorDatabase()

  return maProfessorDb.transaction(
    'r',
    relevantTables(),
    () =>
      buildFingerprint(
        academicYearId
      )
  )
}

function timeRangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string
) {
  return (
    firstStart < secondEnd &&
    secondStart < firstEnd
  )
}

function weekdayLabel(
  weekday: Weekday
) {
  return [
    '',
    'Seg',
    'Ter',
    'Qua',
    'Qui',
    'Sex',
    'Sáb',
    'Dom'
  ][weekday] ?? 'Dia'
}

function validateProposal(
  lessons: ScheduleImportLesson[],
  duties: ScheduleImportDuty[]
) {
  if (
    lessons.length === 0 &&
    duties.length === 0
  ) {
    throw new Error(
      'Mantenha pelo menos um bloco para importar.'
    )
  }

  const courseByGroup =
    new Map<string, string>()

  for (const lesson of lessons) {
    const groupName =
      clean(lesson.groupName)
    const courseName =
      clean(lesson.courseName)

    if (
      !groupName ||
      !clean(lesson.subjectName) ||
      !lesson.subjectConfirmed ||
      !lesson.startTime ||
      !lesson.endTime ||
      lesson.startTime >=
        lesson.endTime ||
      !Number.isInteger(
        lesson.periodCount
      ) ||
      lesson.periodCount <= 0
    ) {
      throw new Error(
        'Reveja as aulas: existem dados em falta, uma disciplina por confirmar ou horas inválidas.'
      )
    }

    if (courseName) {
      const groupKey =
        normalize(groupName)
      const previous =
        courseByGroup.get(
          groupKey
        )

      if (
        previous &&
        normalize(previous) !==
          normalize(courseName)
      ) {
        throw new Error(
          `A turma ${groupName} aparece associada a dois cursos diferentes: “${previous}” e “${courseName}”. Corrija o curso antes de importar.`
        )
      }

      courseByGroup.set(
        groupKey,
        courseName
      )
    }
  }

  for (const duty of duties) {
    if (
      !clean(duty.name) ||
      !duty.startTime ||
      !duty.endTime ||
      duty.startTime >=
        duty.endTime
    ) {
      throw new Error(
        'Reveja os cargos: existem dados em falta ou horas inválidas.'
      )
    }
  }

  const rows = [
    ...lessons.map(
      lesson => ({
        weekday:
          lesson.weekday,
        startTime:
          lesson.startTime,
        endTime:
          lesson.endTime,
        label:
          `${lesson.subjectName.trim()} · ${lesson.groupName.trim()}`
      })
    ),
    ...duties.map(
      duty => ({
        weekday:
          duty.weekday,
        startTime:
          duty.startTime,
        endTime:
          duty.endTime,
        label:
          duty.name
      })
    )
  ]

  for (
    let firstIndex = 0;
    firstIndex < rows.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex =
        firstIndex + 1;
      secondIndex < rows.length;
      secondIndex += 1
    ) {
      const first =
        rows[firstIndex]
      const second =
        rows[secondIndex]

      if (
        first.weekday ===
          second.weekday &&
        timeRangesOverlap(
          first.startTime,
          first.endTime,
          second.startTime,
          second.endTime
        )
      ) {
        throw new Error(
          `Há dois blocos sobrepostos na proposta: ${first.label} e ${second.label}, à ${weekdayLabel(first.weekday)}, entre ${first.startTime} e ${first.endTime}. Corrija ou desmarque um deles antes de importar.`
        )
      }
    }
  }
}

function isSameExistingLesson(
  lesson: ScheduleImportLesson,
  slot: WeeklyScheduleSlot,
  assignmentById:
    Map<string, TeachingAssignment>,
  groupById:
    Map<string, ClassGroup>,
  subjectById:
    Map<string, Subject>
) {
  if (
    slot.weekday !==
      lesson.weekday ||
    slot.startTime !==
      lesson.startTime ||
    slot.endTime !==
      lesson.endTime
  ) {
    return false
  }

  const assignment =
    assignmentById.get(
      slot.teachingAssignmentId
    )
  const group =
    assignment
      ? groupById.get(
          assignment.groupId
        )
      : null
  const subject =
    assignment
      ? subjectById.get(
          assignment.subjectId
        )
      : null

  return Boolean(
    group &&
    subject &&
    normalize(group.name) ===
      normalize(
        lesson.groupName
      ) &&
    normalize(subject.name) ===
      normalize(
        lesson.subjectName
      )
  )
}

function dutyEventTitle(
  duty: ScheduleImportDuty
) {
  return `Cargo · ${clean(duty.name)} · ${duty.startTime}–${duty.endTime}`
}

function dutyEventKey(
  title: string,
  date: string
) {
  return `${normalize(title)}|${date}`
}

export async function commitScheduleImportAtomically(
  input: {
    academicYearId: string
    expectedFingerprint: string
    lessons: ScheduleImportLesson[]
    duties: ScheduleImportDuty[]
  }
) {
  const lessons =
    input.lessons.filter(
      lesson => lesson.included
    )
  const duties =
    input.duties.filter(
      duty => duty.included
    )

  validateProposal(
    lessons,
    duties
  )

  await openMAProfessorDatabase()

  const result =
    await maProfessorDb.transaction(
      'rw',
      relevantTables(),
      async () => {
        const currentFingerprint =
          await buildFingerprint(
            input.academicYearId
          )

        if (
          currentFingerprint !==
            input.expectedFingerprint
        ) {
          throw new Error(
            'Os dados foram alterados depois de rever o horário. Volte a importar ou atualizar a proposta antes de confirmar, para evitar substituir alterações mais recentes.'
          )
        }

        const academicYear =
          await maProfessorDb
            .academicYears
            .get(
              input.academicYearId
            )

        if (!academicYear) {
          throw new Error(
            'O ano letivo já não existe.'
          )
        }

        const profile =
          await maProfessorDb
            .teacherProfiles
            .get(
              TEACHER_PROFILE_ID
            )

        const schoolName =
          profile?.schoolName
            ?.trim() ?? ''

        if (
          duties.length > 0 &&
          !schoolName
        ) {
          throw new Error(
            'Não foi possível identificar a escola do professor. Confirme a escola antes de programar os cargos no calendário.'
          )
        }

        const [
          groupRows,
          subjectRows,
          assignmentRows,
          slotRows,
          eventRows
        ] = await Promise.all([
          maProfessorDb.groups
            .where('academicYearId')
            .equals(
              input.academicYearId
            )
            .toArray(),
          maProfessorDb.subjects
            .where('academicYearId')
            .equals(
              input.academicYearId
            )
            .toArray(),
          maProfessorDb
            .teachingAssignments
            .where('academicYearId')
            .equals(
              input.academicYearId
            )
            .toArray(),
          maProfessorDb
            .weeklyScheduleSlots
            .where('academicYearId')
            .equals(
              input.academicYearId
            )
            .toArray(),
          maProfessorDb
            .schoolCalendarEvents
            .where('academicYearId')
            .equals(
              input.academicYearId
            )
            .toArray()
        ])

        const groupByName =
          new Map<string, ClassGroup>()
        const groupById =
          new Map<string, ClassGroup>()

        for (const group of groupRows) {
          const key =
            normalize(group.name)

          if (groupByName.has(key)) {
            throw new Error(
              `Existem várias turmas chamadas “${group.name}”. Corrija a duplicação antes de importar o horário.`
            )
          }

          groupByName.set(
            key,
            group
          )
          groupById.set(
            group.id,
            group
          )
        }

        const subjectByName =
          new Map<string, Subject>()
        const subjectById =
          new Map<string, Subject>()

        for (const subject of subjectRows) {
          const key =
            normalize(subject.name)

          if (
            subjectByName.has(key)
          ) {
            throw new Error(
              `Existem várias disciplinas chamadas “${subject.name}”. Corrija a duplicação antes de importar o horário.`
            )
          }

          subjectByName.set(
            key,
            subject
          )
          subjectById.set(
            subject.id,
            subject
          )
        }

        const assignmentByPair =
          new Map<
            string,
            TeachingAssignment
          >()
        const assignmentById =
          new Map<
            string,
            TeachingAssignment
          >()

        for (
          const assignment of
          assignmentRows
        ) {
          const pair =
            `${assignment.groupId}|${assignment.subjectId}`

          if (
            assignment.active &&
            assignmentByPair.has(pair)
          ) {
            throw new Error(
              'Existem associações repetidas entre uma turma e uma disciplina. Corrija a duplicação antes de importar o horário.'
            )
          }

          if (assignment.active) {
            assignmentByPair.set(
              pair,
              assignment
            )
          }

          assignmentById.set(
            assignment.id,
            assignment
          )
        }

        const activeSlots =
          slotRows.filter(
            slot => slot.active
          )

        for (const lesson of lessons) {
          for (const slot of activeSlots) {
            if (
              slot.weekday !==
                lesson.weekday ||
              !timeRangesOverlap(
                slot.startTime,
                slot.endTime,
                lesson.startTime,
                lesson.endTime
              )
            ) {
              continue
            }

            if (
              isSameExistingLesson(
                lesson,
                slot,
                assignmentById,
                groupById,
                subjectById
              )
            ) {
              continue
            }

            const assignment =
              assignmentById.get(
                slot.teachingAssignmentId
              )

            throw new Error(
              `O bloco ${lesson.subjectName.trim()} · ${lesson.groupName.trim()} sobrepõe-se a ${assignment?.displayName ?? 'uma aula já existente'}, à ${weekdayLabel(lesson.weekday)}, das ${slot.startTime} às ${slot.endTime}. Corrija o horário antes de importar.`
            )
          }
        }

        for (const duty of duties) {
          const conflict =
            activeSlots.find(
              slot =>
                slot.weekday ===
                  duty.weekday &&
                timeRangesOverlap(
                  slot.startTime,
                  slot.endTime,
                  duty.startTime,
                  duty.endTime
                )
            )

          if (conflict) {
            throw new Error(
              `O cargo ${duty.name} sobrepõe-se a uma aula já existente, à ${weekdayLabel(duty.weekday)}, das ${duty.startTime} às ${duty.endTime}. Corrija o horário antes de importar.`
            )
          }
        }

        let preservedCourseConflicts =
          0
        const preservedGroupIds =
          new Set<string>()
        const resolvedLessons: Array<{
          lesson: ScheduleImportLesson
          assignmentId: string
        }> = []

        for (const lesson of lessons) {
          const groupName =
            clean(lesson.groupName)
          const courseName =
            clean(lesson.courseName)
          const subjectName =
            clean(lesson.subjectName)
          const groupKey =
            normalize(groupName)
          const subjectKey =
            normalize(subjectName)

          let group =
            groupByName.get(
              groupKey
            )

          if (!group) {
            const grade =
              groupName.match(
                /^\s*(10|11|12|[1-9])/
              )?.[1]
            const timestamp =
              now()

            group = {
              id:
                createId('group'),
              academicYearId:
                input.academicYearId,
              name:
                groupName,
              courseName,
              gradeLevel:
                grade
                  ? `${grade}.º ano`
                  : '',
              active:
                true,
              createdAt:
                timestamp,
              updatedAt:
                timestamp
            }

            await maProfessorDb
              .groups
              .add(group)

            groupByName.set(
              groupKey,
              group
            )
            groupById.set(
              group.id,
              group
            )
          } else if (courseName) {
            const existingCourse =
              clean(
                group.courseName ?? ''
              )

            if (
              existingCourse &&
              normalize(existingCourse) !==
                normalize(courseName)
            ) {
              if (
                !preservedGroupIds.has(
                  group.id
                )
              ) {
                preservedGroupIds.add(
                  group.id
                )
                preservedCourseConflicts +=
                  1
              }
            } else if (!existingCourse) {
              const updatedGroup = {
                ...group,
                courseName,
                updatedAt:
                  now()
              }

              await maProfessorDb
                .groups
                .put(
                  updatedGroup
                )

              group =
                updatedGroup
              groupByName.set(
                groupKey,
                group
              )
              groupById.set(
                group.id,
                group
              )
            }
          }

          let subject =
            subjectByName.get(
              subjectKey
            )

          if (!subject) {
            const timestamp =
              now()

            subject = {
              id:
                createId('subject'),
              academicYearId:
                input.academicYearId,
              name:
                subjectName,
              shortName:
                shortName(subjectName),
              code:
                '',
              active:
                true,
              createdAt:
                timestamp,
              updatedAt:
                timestamp
            }

            await maProfessorDb
              .subjects
              .add(subject)

            subjectByName.set(
              subjectKey,
              subject
            )
            subjectById.set(
              subject.id,
              subject
            )
          }

          const pair =
            `${group.id}|${subject.id}`

          let assignment =
            assignmentByPair.get(
              pair
            )

          if (!assignment) {
            const timestamp =
              now()

            assignment = {
              id:
                createId('assignment'),
              academicYearId:
                input.academicYearId,
              groupId:
                group.id,
              subjectId:
                subject.id,
              displayName:
                `${subject.shortName || subject.name} · ${group.name}`,
              active:
                true,
              createdAt:
                timestamp,
              updatedAt:
                timestamp
            }

            await maProfessorDb
              .teachingAssignments
              .add(assignment)

            assignmentByPair.set(
              pair,
              assignment
            )
            assignmentById.set(
              assignment.id,
              assignment
            )
          }

          resolvedLessons.push({
            lesson,
            assignmentId:
              assignment.id
          })
        }

        const existingSlotKeys =
          new Set(
            slotRows.map(
              slot => [
                slot.teachingAssignmentId,
                slot.weekday,
                slot.startTime,
                slot.endTime
              ].join('|')
            )
          )

        let createdSlots = 0
        let reusedSlots = 0

        for (
          const {
            lesson,
            assignmentId
          } of resolvedLessons
        ) {
          const key = [
            assignmentId,
            lesson.weekday,
            lesson.startTime,
            lesson.endTime
          ].join('|')

          if (
            existingSlotKeys.has(key)
          ) {
            reusedSlots += 1
            continue
          }

          const timestamp =
            now()
          const slot: WeeklyScheduleSlot = {
            id:
              createId('schedule-slot'),
            academicYearId:
              input.academicYearId,
            teachingAssignmentId:
              assignmentId,
            weekday:
              lesson.weekday,
            startTime:
              lesson.startTime,
            endTime:
              lesson.endTime,
            periodCount:
              lesson.periodCount,
            validFrom:
              academicYear.startDate,
            validUntil:
              academicYear.endDate,
            active:
              true,
            createdAt:
              timestamp,
            updatedAt:
              timestamp
          }

          await maProfessorDb
            .weeklyScheduleSlots
            .add(slot)

          existingSlotKeys.add(key)
          createdSlots += 1
        }

        const existingEventKeys =
          new Set(
            eventRows
              .filter(
                event =>
                  event.type ===
                    'school_activity' &&
                  event.scope ===
                    'all'
              )
              .map(
                event =>
                  dutyEventKey(
                    event.title,
                    event.startDate
                  )
              )
          )

        let createdDutyOccurrences = 0

        for (const duty of duties) {
          const title =
            dutyEventTitle(duty)

          for (
            const date of
            getDutyDatesForSchool(
              academicYear,
              duty.weekday,
              schoolName
            )
          ) {
            const key =
              dutyEventKey(
                title,
                date
              )

            if (
              existingEventKeys.has(key)
            ) {
              continue
            }

            const timestamp =
              now()
            const event: SchoolCalendarEvent = {
              id:
                createId('calendar-event'),
              academicYearId:
                input.academicYearId,
              type:
                'school_activity',
              scope:
                'all',
              groupId:
                null,
              teachingAssignmentId:
                null,
              title,
              description:
                '',
              startDate:
                date,
              endDate:
                date,
              blocksLessons:
                false,
              createdAt:
                timestamp,
              updatedAt:
                timestamp
            }

            await maProfessorDb
              .schoolCalendarEvents
              .add(event)

            existingEventKeys.add(key)
            createdDutyOccurrences += 1
          }
        }

        return {
          createdSlots,
          reusedSlots,
          createdDutyOccurrences,
          preservedCourseConflicts
        }
      }
    )

  if (
    result.createdSlots > 0 ||
    result.createdDutyOccurrences > 0
  ) {
    markDashboardDataDirty()
  }

  return result
}
