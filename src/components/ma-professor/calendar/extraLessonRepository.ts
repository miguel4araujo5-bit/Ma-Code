import { maProfessorDb, openMAProfessorDatabase } from '../db'
import {
  lessonRepository,
  type PreviousLessonTemplate
} from '../lessons/lessonRepository'
import {
  lessonCountsTowardUfcdProgress
} from '../lessons/ufcdProgress'
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
    ) ?? null
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

function lessonOccursAfterPosition(lesson: Lesson, date: ISODate, startTime: LocalTime) {
  return lesson.date > date || (lesson.date === date && lesson.startTime > startTime)
}

function sortLessonsLatestFirst(left: Lesson, right: Lesson) {
  return right.date.localeCompare(left.date) ||
    right.startTime.localeCompare(left.startTime) ||
    right.createdAt.localeCompare(left.createdAt) ||
    right.id.localeCompare(left.id)
}

function sortLessonsEarliestFirst(left: Lesson, right: Lesson) {
  return left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
}

function lessonHasPreparedContent(lesson: Lesson) {
  return Boolean(
    lesson.summary.trim() ||
    lesson.plannedActivity.trim() ||
    lesson.notes.trim() ||
    lesson.planificationItemIds.length > 0
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
      .filter(lesson =>
        lessonCountsTowardUfcdProgress(
          lesson,
          todayISO()
        )
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

  async getModulePlanificationItems(moduleId: EntityId) {
    await this.initialize()
    const module = await maProfessorDb.modules.get(moduleId)
    if (!module || !module.active) {
      throw new Error('A UFCD ou módulo selecionado já não está disponível.')
    }
    return lessonRepository.getAvailablePlanificationItems(module.id)
  }

  async getModulePlanificationItem(moduleId: EntityId) {
    const items = await this.getModulePlanificationItems(moduleId)
    return items[0] ?? null
  }

  async createExtraLesson(input: ExtraLessonDraft): Promise<Lesson> {
    await this.initialize()
    const status = input.status ?? 'planned'

    if (status === 'cancelled') {
      throw new Error('Uma antecipação nova não pode ser criada como cancelada.')
    }
    if (status === 'taught' && !input.summary?.trim()) {
      throw new Error('Indique o sumário antes de marcar a aula como dada.')
    }
    if (input.giaeStatus === 'submitted' && (status !== 'taught' || !input.summary?.trim())) {
      throw new Error('Apenas uma aula dada com sumário pode ser marcada como submetida no programa oficial.')
    }

    return maProfessorDb.transaction('rw', maProfessorDb.tables, async () => {
      const [modules, lessons] = await Promise.all([
        maProfessorDb.modules.where('teachingAssignmentId').equals(input.teachingAssignmentId).toArray(),
        maProfessorDb.lessons.where('teachingAssignmentId').equals(input.teachingAssignmentId).toArray()
      ])

      const orderedModules = sortModules(modules.filter(module => module.active))
      const targetModuleIndex = orderedModules.findIndex(module => module.id === input.moduleId)
      if (targetModuleIndex < 0) throw new Error('A UFCD ou módulo selecionado já não está disponível.')

      const sourceLesson = lessons
        .filter(lesson =>
          lesson.origin === 'scheduled' &&
          lesson.status === 'planned' &&
          lesson.giaeStatus === 'pending' &&
          lesson.countTowardProgress &&
          lessonOccursAfterPosition(lesson, input.date, input.startTime)
        )
        .sort(sortLessonsLatestFirst)[0] ?? null

      if (!sourceLesson) {
        throw new Error('Não existe uma última aula futura disponível para antecipar nesta disciplina.')
      }
      if (sourceLesson.periodCount !== input.periodCount) {
        throw new Error(`A última aula disponível tem ${sourceLesson.periodCount} ${sourceLesson.periodCount === 1 ? 'tempo' : 'tempos'}. Para a antecipar sem alterar a carga da disciplina, use o mesmo número de tempos.`)
      }
      if (lessonHasPreparedContent(sourceLesson)) {
        throw new Error('A última aula disponível já possui informação preparada. Retire essa preparação antes de a antecipar.')
      }

      const [sourceAttendanceCount, sourceAssessmentCount, sourceSuggestionCount] = await Promise.all([
        maProfessorDb.lessonAttendance.where('lessonId').equals(sourceLesson.id).count(),
        maProfessorDb.lessonAssessments.where('lessonId').equals(sourceLesson.id).count(),
        maProfessorDb.summarySuggestions.where('lessonId').equals(sourceLesson.id).count()
      ])
      if (sourceAttendanceCount > 0 || sourceAssessmentCount > 0 || sourceSuggestionCount > 0) {
        throw new Error('A última aula disponível já possui dados associados e não pode ser antecipada automaticamente.')
      }

      const sourceModuleIndex = orderedModules.findIndex(module => module.id === sourceLesson.moduleId)
      if (sourceModuleIndex < 0) {
        throw new Error('A última aula disponível pertence a uma UFCD que já não está ativa.')
      }

      const eligibleBoundaryLessons = lessons.filter(lesson =>
        lesson.id !== sourceLesson.id &&
        lesson.origin === 'scheduled' &&
        lesson.status === 'planned' &&
        lesson.giaeStatus === 'pending' &&
        lesson.countTowardProgress &&
        lesson.periodCount === input.periodCount &&
        lessonOccursAfterPosition(lesson, input.date, input.startTime)
      )

      async function assertBoundaryLessonIsClean(lesson: Lesson) {
        if (lessonHasPreparedContent(lesson)) {
          throw new Error('Não foi possível ajustar automaticamente o limite entre UFCDs porque uma aula futura já possui informação preparada.')
        }
        const [attendanceCount, assessmentCount, suggestionCount] = await Promise.all([
          maProfessorDb.lessonAttendance.where('lessonId').equals(lesson.id).count(),
          maProfessorDb.lessonAssessments.where('lessonId').equals(lesson.id).count(),
          maProfessorDb.summarySuggestions.where('lessonId').equals(lesson.id).count()
        ])
        if (attendanceCount > 0 || assessmentCount > 0 || suggestionCount > 0) {
          throw new Error('Não foi possível ajustar automaticamente o limite entre UFCDs porque uma aula futura já possui dados associados.')
        }
      }

      if (targetModuleIndex < sourceModuleIndex) {
        for (let moduleIndex = targetModuleIndex; moduleIndex < sourceModuleIndex; moduleIndex += 1) {
          const boundaryLesson = eligibleBoundaryLessons
            .filter(lesson => lesson.moduleId === orderedModules[moduleIndex].id)
            .sort(sortLessonsLatestFirst)[0]
          if (!boundaryLesson) {
            throw new Error('Não existe uma aula futura disponível para ajustar o limite entre UFCDs sem alterar a carga planificada.')
          }
          await assertBoundaryLessonIsClean(boundaryLesson)
          await lessonRepository.updateLesson(
            boundaryLesson.id,
            { moduleId: orderedModules[moduleIndex + 1].id },
            { expectedUpdatedAt: boundaryLesson.updatedAt }
          )
        }
      } else if (targetModuleIndex > sourceModuleIndex) {
        for (let moduleIndex = targetModuleIndex; moduleIndex > sourceModuleIndex; moduleIndex -= 1) {
          const boundaryLesson = eligibleBoundaryLessons
            .filter(lesson => lesson.moduleId === orderedModules[moduleIndex].id)
            .sort(sortLessonsEarliestFirst)[0]
          if (!boundaryLesson) {
            throw new Error('Não existe uma aula futura disponível para ajustar o limite entre UFCDs sem alterar a carga planificada.')
          }
          await assertBoundaryLessonIsClean(boundaryLesson)
          await lessonRepository.updateLesson(
            boundaryLesson.id,
            { moduleId: orderedModules[moduleIndex - 1].id },
            { expectedUpdatedAt: boundaryLesson.updatedAt }
          )
        }
      }

      let lesson = await lessonRepository.updateLesson(
        sourceLesson.id,
        {
          moduleId: input.moduleId,
          scheduleSlotId: null,
          scheduleOriginalPosition: sourceLesson.scheduleOriginalPosition ?? {
            date: sourceLesson.date,
            startTime: sourceLesson.startTime
          },
          origin: 'extra',
          status,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          periodCount: input.periodCount,
          countTowardProgress: true,
          plannedActivity: input.plannedActivity,
          summary: input.summary,
          summarySource: input.summarySource,
          planificationItemIds: input.planificationItemIds,
          notes: input.notes
        },
        { expectedUpdatedAt: sourceLesson.updatedAt }
      )

      if (input.giaeStatus === 'submitted') {
        lesson = await lessonRepository.markGIAESubmitted(lesson.id)
      }
      return lesson
    })
  }
}

export const extraLessonRepository =
  new ExtraLessonRepository()
