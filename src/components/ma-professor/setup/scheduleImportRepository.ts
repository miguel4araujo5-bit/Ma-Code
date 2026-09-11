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
  WeeklyScheduleSlot
} from '../types'

import {
  cleanScheduleText,
  normalizeScheduleText,
  type ScheduleDutyDraft,
  type ScheduleLessonDraft
} from './schedulePdfParser'

import {
  getDutyDatesForSchool
} from './schoolDutyDatePolicy'

const TEACHER_PROFILE_ID =
  'local-profile'

const tables = () => [
  maProfessorDb.teacherProfiles,
  maProfessorDb.academicYears,
  maProfessorDb.groups,
  maProfessorDb.subjects,
  maProfessorDb.teachingAssignments,
  maProfessorDb.weeklyScheduleSlots,
  maProfessorDb.schoolCalendarEvents
]

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

function timestamp() {
  return new Date()
    .toISOString()
}

function shortName(
  name: string
) {
  const words =
    cleanScheduleText(name)
      .split(/\s+/)

  if (words.length <= 2) {
    return name.slice(0, 24)
  }

  const initials = words
    .filter(word => word.length > 2)
    .map(word =>
      word[0]?.toLocaleUpperCase(
        'pt-PT'
      ) ?? ''
    )
    .join('')

  return (
    initials || name
  ).slice(0, 24)
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
  weekday: number
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

function lessonLabel(
  lesson: ScheduleLessonDraft
) {
  return `${lesson.subjectName.trim()} · ${lesson.groupName.trim()}`
}

function validateRequestRows(
  lessons: ScheduleLessonDraft[],
  duties: ScheduleDutyDraft[]
) {
  if (
    lessons.length === 0 &&
    duties.length === 0
  ) {
    throw new Error(
      'Selecione pelo menos um bloco para importar.'
    )
  }

  for (const lesson of lessons) {
    if (
      !lesson.groupName.trim() ||
      !lesson.subjectName.trim() ||
      !lesson.subjectConfirmed ||
      !lesson.startTime ||
      !lesson.endTime ||
      lesson.startTime >= lesson.endTime ||
      !Number.isInteger(
        lesson.periodCount
      ) ||
      lesson.periodCount <= 0
    ) {
      throw new Error(
        'Reveja as aulas: existem dados em falta, uma disciplina por confirmar ou horas inválidas.'
      )
    }
  }

  for (const duty of duties) {
    if (
      !duty.name.trim() ||
      !duty.startTime ||
      !duty.endTime ||
      duty.startTime >= duty.endTime
    ) {
      throw new Error(
        'Reveja os cargos: existem dados em falta ou horas inválidas.'
      )
    }
  }

  const courseByGroup =
    new Map<string, string>()

  for (const lesson of lessons) {
    const groupName =
      cleanScheduleText(
        lesson.groupName
      )
    const courseName =
      cleanScheduleText(
        lesson.courseName
      )

    if (!courseName) {
      continue
    }

    const groupKey =
      normalizeScheduleText(
        groupName
      )
    const previous =
      courseByGroup.get(groupKey)

    if (
      previous &&
      normalizeScheduleText(previous) !==
        normalizeScheduleText(courseName)
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

  const rows = [
    ...lessons.map(lesson => ({
      weekday:
        lesson.weekday,
      startTime:
        lesson.startTime,
      endTime:
        lesson.endTime,
      label:
        lessonLabel(lesson)
    })),
    ...duties.map(duty => ({
      weekday:
        duty.weekday,
      startTime:
        duty.startTime,
      endTime:
        duty.endTime,
      label:
        duty.name
    }))
  ]

  for (
    let firstIndex = 0;
    firstIndex < rows.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < rows.length;
      secondIndex += 1
    ) {
      const first =
        rows[firstIndex]
      const second =
        rows[secondIndex]

      if (
        first.weekday === second.weekday &&
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

async function state() {
  const values =
    await Promise.all(
      tables().map(
        table => table.toArray()
      )
    )

  return JSON.stringify(
    values.map(rows =>
      rows.sort(
        (left, right) =>
          String(left.id)
            .localeCompare(
              String(right.id)
            )
      )
    )
  )
}

export async function readScheduleImportState() {
  await openMAProfessorDatabase()

  return maProfessorDb.transaction(
    'r',
    tables(),
    async () => ({
      fingerprint:
        await state()
    })
  )
}

function isSameExistingLesson(
  lesson: ScheduleLessonDraft,
  slot: WeeklyScheduleSlot,
  assignments: Map<string, TeachingAssignment>,
  groups: Map<string, ClassGroup>,
  subjects: Map<string, Subject>
) {
  if (
    slot.weekday !== lesson.weekday ||
    slot.startTime !== lesson.startTime ||
    slot.endTime !== lesson.endTime
  ) {
    return false
  }

  const assignment =
    assignments.get(
      slot.teachingAssignmentId
    )
  const group =
    assignment
      ? groups.get(
          assignment.groupId
        )
      : null
  const subject =
    assignment
      ? subjects.get(
          assignment.subjectId
        )
      : null

  return Boolean(
    group &&
    subject &&
    normalizeScheduleText(group.name) ===
      normalizeScheduleText(
        lesson.groupName
      ) &&
    normalizeScheduleText(subject.name) ===
      normalizeScheduleText(
        lesson.subjectName
      )
  )
}

function dutyEventTitle(
  duty: ScheduleDutyDraft
) {
  return `Cargo · ${cleanScheduleText(duty.name)} · ${duty.startTime}–${duty.endTime}`
}

function dutyEventKey(
  title: string,
  date: string
) {
  return `${normalizeScheduleText(title)}|${date}`
}

export async function commitScheduleImport(
  input: {
    confirmed: true
    academicYearId: string
    expectedFingerprint: string
    lessons: ScheduleLessonDraft[]
    duties: ScheduleDutyDraft[]
  }
) {
  if (input.confirmed !== true) {
    throw new Error(
      'Confirme a importação antes de guardar.'
    )
  }

  const request =
    structuredClone(input)

  request.lessons =
    request.lessons.filter(
      lesson => lesson.included
    )
  request.duties =
    request.duties.filter(
      duty => duty.included
    )

  validateRequestRows(
    request.lessons,
    request.duties
  )

  await openMAProfessorDatabase()

  const result =
    await maProfessorDb.transaction(
      'rw',
      tables(),
      async () => {
        if (
          await state() !==
            request.expectedFingerprint
        ) {
          throw new Error(
            'Os dados foram alterados após a revisão do horário. Atualize a proposta antes de confirmar novamente.'
          )
        }

        const academicYear =
          await maProfessorDb
            .academicYears
            .get(
              request.academicYearId
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
          profile?.schoolName?.trim() ??
          ''

        if (
          request.duties.length > 0 &&
          !schoolName
        ) {
          throw new Error(
            'Não foi possível identificar a escola do professor. Confirme a escola antes de programar os cargos no calendário.'
          )
        }

        const groupRows =
          await maProfessorDb.groups
            .where(
              'academicYearId'
            )
            .equals(
              request.academicYearId
            )
            .toArray()
        const subjectRows =
          await maProfessorDb.subjects
            .where(
              'academicYearId'
            )
            .equals(
              request.academicYearId
            )
            .toArray()
        const assignmentRows =
          await maProfessorDb
            .teachingAssignments
            .where(
              'academicYearId'
            )
            .equals(
              request.academicYearId
            )
            .toArray()
        const slotRows =
          await maProfessorDb
            .weeklyScheduleSlots
            .where(
              'academicYearId'
            )
            .equals(
              request.academicYearId
            )
            .toArray()
        const eventRows =
          await maProfessorDb
            .schoolCalendarEvents
            .where(
              'academicYearId'
            )
            .equals(
              request.academicYearId
            )
            .toArray()

        const groupByName =
          new Map<string, ClassGroup>()
        const groupById =
          new Map<string, ClassGroup>()

        for (const group of groupRows) {
          const key =
            normalizeScheduleText(
              group.name
            )

          if (
            groupByName.has(key)
          ) {
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
            normalizeScheduleText(
              subject.name
            )

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
          new Map<string, TeachingAssignment>()
        const assignmentById =
          new Map<string, TeachingAssignment>()

        for (const assignment of assignmentRows) {
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

        for (const lesson of request.lessons) {
          for (const slot of activeSlots) {
            if (
              slot.weekday !== lesson.weekday ||
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
              `O bloco ${lessonLabel(lesson)} sobrepõe-se a ${assignment?.displayName ?? 'uma aula já existente'}, à ${weekdayLabel(lesson.weekday)}, das ${slot.startTime} às ${slot.endTime}. Corrija o horário antes de importar.`
            )
          }
        }

        for (const duty of request.duties) {
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

        let preservedCourses = 0
        let createdSlots = 0
        let reusedSlots = 0

        const resolved: Array<{
          lesson: ScheduleLessonDraft
          assignmentId: string
        }> = []

        for (const lesson of request.lessons) {
          const groupName =
            cleanScheduleText(
              lesson.groupName
            )
          const courseName =
            cleanScheduleText(
              lesson.courseName
            )
          const subjectName =
            cleanScheduleText(
              lesson.subjectName
            )

          const groupKey =
            normalizeScheduleText(
              groupName
            )
          const subjectKey =
            normalizeScheduleText(
              subjectName
            )

          let group =
            groupByName.get(
              groupKey
            )

          if (!group) {
            const now =
              timestamp()
            const grade =
              groupName.match(
                /^\s*(10|11|12|[1-9])/
              )?.[1]

            group = {
              id:
                createId('group'),
              academicYearId:
                request.academicYearId,
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
                now,
              updatedAt:
                now
            } satisfies ClassGroup

            await maProfessorDb.groups.add(
              group
            )

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
              cleanScheduleText(
                group.courseName ?? ''
              )

            if (
              existingCourse &&
              normalizeScheduleText(
                existingCourse
              ) !==
                normalizeScheduleText(
                  courseName
                )
            ) {
              // Dados já confirmados no MA-Professor têm precedência sobre
              // uma inferência do PDF. Sem uma ação explícita de substituição,
              // o importador nunca altera silenciosamente o curso existente.
              preservedCourses += 1
            } else if (!existingCourse) {
              const updatedGroup = {
                ...group,
                courseName,
                updatedAt:
                  timestamp()
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
            const now =
              timestamp()

            subject = {
              id:
                createId('subject'),
              academicYearId:
                request.academicYearId,
              name:
                subjectName,
              shortName:
                shortName(subjectName),
              code:
                '',
              active:
                true,
              createdAt:
                now,
              updatedAt:
                now
            } satisfies Subject

            await maProfessorDb.subjects.add(
              subject
            )

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
            assignmentByPair.get(pair)

          if (!assignment) {
            const now =
              timestamp()

            assignment = {
              id:
                createId('assignment'),
              academicYearId:
                request.academicYearId,
              groupId:
                group.id,
              subjectId:
                subject.id,
              displayName:
                `${subject.shortName || subject.name} · ${group.name}`,
              active:
                true,
              createdAt:
                now,
              updatedAt:
                now
            } satisfies TeachingAssignment

            await maProfessorDb
              .teachingAssignments
              .add(
                assignment
              )

            assignmentByPair.set(
              pair,
              assignment
            )
            assignmentById.set(
              assignment.id,
              assignment
            )
          }

          resolved.push({
            lesson,
            assignmentId:
              assignment.id
          })
        }

        const existingSlotKeys =
          new Set(
            slotRows.map(slot => [
              slot.teachingAssignmentId,
              slot.weekday,
              slot.startTime,
              slot.endTime
            ].join('|'))
          )

        for (const {
          lesson,
          assignmentId
        } of resolved) {
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

          const now =
            timestamp()
          const slot = {
            id:
              createId('schedule-slot'),
            academicYearId:
              request.academicYearId,
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
              now,
            updatedAt:
              now
          } satisfies WeeklyScheduleSlot

          await maProfessorDb
            .weeklyScheduleSlots
            .add(
              slot
            )

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

        for (const duty of request.duties) {
          const title =
            dutyEventTitle(duty)

          for (
            const date of getDutyDatesForSchool(
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

            const now =
              timestamp()
            const event = {
              id:
                createId('calendar-event'),
              academicYearId:
                request.academicYearId,
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
                now,
              updatedAt:
                now
            } satisfies SchoolCalendarEvent

            await maProfessorDb
              .schoolCalendarEvents
              .add(
                event
              )

            existingEventKeys.add(key)
            createdDutyOccurrences += 1
          }
        }

        return {
          createdSlots,
          reusedSlots,
          createdDutyOccurrences,
          preservedCourses
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
