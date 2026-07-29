import { maProfessorDb, openMAProfessorDatabase } from '../db'
import {
  lessonRepository,
  type PreviousLessonTemplate
} from '../lessons/lessonRepository'
import type {
  AcademicYear,
  ClassGroup,
  EntityId,
  GIAEStatus,
  ISODate,
  Lesson,
  LessonStatus,
  LocalTime,
  ModuleUnit,
  PlanificationItem,
  Subject,
  SummarySource,
  TeachingAssignment,
  WeeklyScheduleSlot
} from '../types'

export interface ExtraLessonAssignmentOption {
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  modules: ModuleUnit[]
  label: string
}

export interface ExtraLessonCreateContext {
  academicYear: AcademicYear
  date: ISODate
  assignmentOptions: ExtraLessonAssignmentOption[]
  defaultTeachingAssignmentId: EntityId | null
  defaultModuleId: EntityId | null
  generatedAt: string
}

export interface ExtraLessonSelectionContext {
  assignmentOption: ExtraLessonAssignmentOption
  modules: ModuleUnit[]
  suggestedModule: ModuleUnit | null
  previousLessonTemplate: PreviousLessonTemplate | null
  nextPlanificationItem: PlanificationItem | null
  matchingScheduleSlots: WeeklyScheduleSlot[]
}

export interface ExtraLessonDraft {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  date: ISODate
  startTime: LocalTime
  endTime: LocalTime
  periodCount: number
  status?: LessonStatus
  countTowardProgress?: boolean
  plannedActivity?: string
  summary?: string
  summarySource?: SummarySource
  planificationItemIds?: EntityId[]
  notes?: string
  giaeStatus?: GIAEStatus
}

function now() {
  return new Date().toISOString()
}

function formatISODate(value: Date): ISODate {
  return [
    String(value.getUTCFullYear()).padStart(4, '0'),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function parseISODate(value: ISODate) {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )
}

function assertISODate(
  value: ISODate,
  label: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    formatISODate(
      parseISODate(value)
    ) !== value
  ) {
    throw new Error(
      `${label} não é uma data válida.`
    )
  }
}

function todayISO(): ISODate {
  const current = new Date()

  return formatISODate(
    new Date(
      Date.UTC(
        current.getFullYear(),
        current.getMonth(),
        current.getDate()
      )
    )
  )
}

function clampDate(
  value: ISODate,
  minimum: ISODate,
  maximum: ISODate
) {
  if (value < minimum) {
    return minimum
  }

  if (value > maximum) {
    return maximum
  }

  return value
}

function getWeekday(
  value: ISODate
): WeeklyScheduleSlot['weekday'] {
  const weekday =
    parseISODate(value).getUTCDay()

  return (
    weekday === 0
      ? 7
      : weekday
  ) as WeeklyScheduleSlot['weekday']
}

function sortModules(
  modules: ModuleUnit[]
) {
  return modules.sort(
    (left, right) => {
      const orderComparison =
        left.order -
        right.order

      return orderComparison !== 0
        ? orderComparison
        : left.name.localeCompare(
            right.name,
            'pt-PT',
            {
              sensitivity: 'base'
            }
          )
    }
  )
}

function sortAssignmentOptions(
  options: ExtraLessonAssignmentOption[]
) {
  return options.sort(
    (left, right) => {
      const groupComparison =
        left.group.name.localeCompare(
          right.group.name,
          'pt-PT',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )

      return groupComparison !== 0
        ? groupComparison
        : left.subject.name.localeCompare(
            right.subject.name,
            'pt-PT',
            {
              sensitivity: 'base'
            }
          )
    }
  )
}

function buildAssignmentLabel(
  group: ClassGroup,
  subject: Subject
) {
  const subjectLabel =
    subject.shortName.trim() ||
    subject.name

  return `${group.name} · ${subjectLabel}`
}

function selectSuggestedModule(
  modules: ModuleUnit[],
  periodsTaughtByModuleId: Map<
    EntityId,
    number
  >
) {
  const orderedModules =
    sortModules([...modules])

  const startedIncomplete =
    orderedModules.find(
      (module) => {
        const periodsTaught =
          periodsTaughtByModuleId.get(
            module.id
          ) ?? 0

        return (
          periodsTaught > 0 &&
          periodsTaught <
            module.plannedPeriods
        )
      }
    )

  if (startedIncomplete) {
    return startedIncomplete
  }

  return (
    orderedModules.find(
      (module) =>
        (
          periodsTaughtByModuleId.get(
            module.id
          ) ?? 0
        ) <
        module.plannedPeriods
    ) ??
    orderedModules[
      orderedModules.length - 1
    ] ??
    null
  )
}

async function getAcademicYear(
  academicYearId?: EntityId
) {
  if (academicYearId) {
    const academicYear =
      await maProfessorDb
        .academicYears
        .get(academicYearId)

    if (!academicYear) {
      throw new Error(
        'O ano letivo indicado não existe.'
      )
    }

    return academicYear
  }

  const academicYears =
    (
      await maProfessorDb
        .academicYears
        .toArray()
    ) as AcademicYear[]

  const activeAcademicYear =
    academicYears.find(
      (academicYear) =>
        academicYear.active
    )

  if (!activeAcademicYear) {
    throw new Error(
      'Não existe um ano letivo ativo.'
    )
  }

  return activeAcademicYear
}

async function loadAssignmentOptions(
  academicYearId: EntityId
) {
  const [
    groups,
    subjects,
    assignments,
    modules
  ] = await Promise.all([
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

    maProfessorDb.modules
      .where('academicYearId')
      .equals(academicYearId)
      .toArray()
  ])

  const groupById =
    new Map(
      groups
        .filter(
          (group) =>
            group.active
        )
        .map(
          (group) => [
            group.id,
            group
          ]
        )
    )

  const subjectById =
    new Map(
      subjects
        .filter(
          (subject) =>
            subject.active
        )
        .map(
          (subject) => [
            subject.id,
            subject
          ]
        )
    )

  const modulesByAssignmentId =
    new Map<
      EntityId,
      ModuleUnit[]
    >()

  modules
    .filter(
      (module) =>
        module.active
    )
    .forEach(
      (module) => {
        const assignmentModules =
          modulesByAssignmentId.get(
            module.teachingAssignmentId
          ) ?? []

        assignmentModules.push(
          module
        )

        modulesByAssignmentId.set(
          module.teachingAssignmentId,
          assignmentModules
        )
      }
    )

  const options =
    assignments
      .filter(
        (assignment) =>
          assignment.active
      )
      .map(
        (
          assignment
        ): ExtraLessonAssignmentOption | null => {
          const group =
            groupById.get(
              assignment.groupId
            )

          const subject =
            subjectById.get(
              assignment.subjectId
            )

          const assignmentModules =
            sortModules(
              modulesByAssignmentId.get(
                assignment.id
              ) ?? []
            )

          if (
            !group ||
            !subject ||
            assignmentModules.length === 0
          ) {
            return null
          }

          return {
            assignment,
            group,
            subject,
            modules:
              assignmentModules,
            label:
              buildAssignmentLabel(
                group,
                subject
              )
          }
        }
      )
      .filter(
        (
          option
        ): option is ExtraLessonAssignmentOption =>
          Boolean(option)
      )

  return sortAssignmentOptions(
    options
  )
}

export class ExtraLessonRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getCreateContext(
    academicYearId?: EntityId,
    requestedDate?: ISODate,
    preferredTeachingAssignmentId?: EntityId | null
  ): Promise<ExtraLessonCreateContext> {
    await this.initialize()

    const academicYear =
      await getAcademicYear(
        academicYearId
      )

    if (requestedDate) {
      assertISODate(
        requestedDate,
        'A data selecionada'
      )
    }

    const date =
      clampDate(
        requestedDate ??
          todayISO(),
        academicYear.startDate,
        academicYear.endDate
      )

    const assignmentOptions =
      await loadAssignmentOptions(
        academicYear.id
      )

    const preferredOption =
      preferredTeachingAssignmentId
        ? assignmentOptions.find(
            (option) =>
              option.assignment.id ===
              preferredTeachingAssignmentId
          ) ?? null
        : null

    const defaultOption =
      preferredOption ??
      assignmentOptions[0] ??
      null

    let defaultModuleId:
      EntityId | null =
      null

    if (defaultOption) {
      const selectionContext =
        await this.getSelectionContext(
          defaultOption.assignment.id,
          date,
          '09:00'
        )

      defaultModuleId =
        selectionContext
          .suggestedModule
          ?.id ?? null
    }

    return {
      academicYear,
      date,
      assignmentOptions,

      defaultTeachingAssignmentId:
        defaultOption
          ?.assignment
          .id ?? null,

      defaultModuleId,

      generatedAt:
        now()
    }
  }

  async getSelectionContext(
    teachingAssignmentId: EntityId,
    date: ISODate,
    startTime: LocalTime
  ): Promise<ExtraLessonSelectionContext> {
    await this.initialize()

    assertISODate(
      date,
      'A data da aula'
    )

    const assignment =
      await maProfessorDb
        .teachingAssignments
        .get(
          teachingAssignmentId
        )

    if (
      !assignment ||
      !assignment.active
    ) {
      throw new Error(
        'A turma e disciplina selecionadas já não estão disponíveis.'
      )
    }

    const academicYear =
      await maProfessorDb
        .academicYears
        .get(
          assignment.academicYearId
        )

    if (!academicYear) {
      throw new Error(
        'O ano letivo associado já não existe.'
      )
    }

    if (
      date <
        academicYear.startDate ||
      date >
        academicYear.endDate
    ) {
      throw new Error(
        'A data da aula deve ficar dentro do ano letivo.'
      )
    }

    const [
      group,
      subject,
      modules,
      lessons,
      scheduleSlots,
      previousLessonTemplate
    ] = await Promise.all([
      maProfessorDb.groups.get(
        assignment.groupId
      ),

      maProfessorDb.subjects.get(
        assignment.subjectId
      ),

      maProfessorDb.modules
        .where(
          'teachingAssignmentId'
        )
        .equals(
          assignment.id
        )
        .toArray(),

      lessonRepository.listLessons({
        academicYearId:
          academicYear.id,

        teachingAssignmentId:
          assignment.id
      }),

      maProfessorDb.weeklyScheduleSlots
        .where(
          'teachingAssignmentId'
        )
        .equals(
          assignment.id
        )
        .toArray(),

      lessonRepository.getPreviousLessonTemplate(
        assignment.id,
        date,
        startTime
      )
    ])

    if (
      !group ||
      !group.active
    ) {
      throw new Error(
        'A turma selecionada já não está disponível.'
      )
    }

    if (
      !subject ||
      !subject.active
    ) {
      throw new Error(
        'A disciplina selecionada já não está disponível.'
      )
    }

    const activeModules =
      sortModules(
        modules.filter(
          (module) =>
            module.active
        )
      )

    if (
      activeModules.length === 0
    ) {
      throw new Error(
        'A turma e disciplina selecionadas não possuem UFCD ou módulos ativos.'
      )
    }

    const periodsTaughtByModuleId =
      new Map<
        EntityId,
        number
      >()

    lessons
      .filter(
        (lesson) =>
          lesson.status ===
            'taught' &&
          lesson.countTowardProgress
      )
      .forEach(
        (lesson) => {
          periodsTaughtByModuleId.set(
            lesson.moduleId,
            (
              periodsTaughtByModuleId.get(
                lesson.moduleId
              ) ?? 0
            ) +
              lesson.periodCount
          )
        }
      )

    const suggestedModule =
      selectSuggestedModule(
        activeModules,
        periodsTaughtByModuleId
      )

    const nextPlanificationItem =
      suggestedModule
        ? await lessonRepository.getNextPlanificationItem(
            suggestedModule.id
          )
        : null

    const weekday =
      getWeekday(date)

    const matchingScheduleSlots =
      scheduleSlots
        .filter(
          (slot) =>
            slot.active &&
            slot.weekday ===
              weekday &&
            slot.validFrom <=
              date &&
            slot.validUntil >=
              date
        )
        .sort(
          (left, right) =>
            left.startTime.localeCompare(
              right.startTime
            )
        )

    return {
      assignmentOption: {
        assignment,
        group,
        subject,
        modules:
          activeModules,
        label:
          buildAssignmentLabel(
            group,
            subject
          )
      },

      modules:
        activeModules,

      suggestedModule,
      previousLessonTemplate,
      nextPlanificationItem,
      matchingScheduleSlots
    }
  }

  async getModulePlanificationItem(
    moduleId: EntityId
  ) {
    await this.initialize()

    const module =
      await maProfessorDb
        .modules
        .get(moduleId)

    if (
      !module ||
      !module.active
    ) {
      throw new Error(
        'A UFCD ou módulo selecionado já não está disponível.'
      )
    }

    return lessonRepository.getNextPlanificationItem(
      module.id
    )
  }

  async createExtraLesson(
    input: ExtraLessonDraft
  ): Promise<Lesson> {
    await this.initialize()

    const status =
      input.status ??
      'planned'

    if (
      status === 'taught' &&
      !input.summary?.trim()
    ) {
      throw new Error(
        'Indique o sumário antes de marcar a aula como dada.'
      )
    }

    if (
      input.giaeStatus ===
        'submitted' &&
      (
        status !== 'taught' ||
        !input.summary?.trim()
      )
    ) {
      throw new Error(
        'Apenas uma aula dada com sumário pode ser marcada como submetida no GIAE.'
      )
    }

    let lesson =
      await lessonRepository.createLesson({
        academicYearId:
          input.academicYearId,

        teachingAssignmentId:
          input.teachingAssignmentId,

        moduleId:
          input.moduleId,

        scheduleSlotId:
          null,

        origin:
          'extra',

        status,

        date:
          input.date,

        startTime:
          input.startTime,

        endTime:
          input.endTime,

        periodCount:
          input.periodCount,

        countTowardProgress:
          status ===
          'cancelled'
            ? false
            : input.countTowardProgress ??
              true,

        plannedActivity:
          input.plannedActivity,

        summary:
          input.summary,

        summarySource:
          input.summarySource,

        planificationItemIds:
          input.planificationItemIds,

        notes:
          input.notes
      })

    if (
      input.giaeStatus ===
      'submitted'
    ) {
      lesson =
        await lessonRepository.markGIAESubmitted(
          lesson.id
        )
    }

    return lesson
  }
}

export const extraLessonRepository =
  new ExtraLessonRepository()
