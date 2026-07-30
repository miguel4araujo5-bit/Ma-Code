import { maProfessorDb, openMAProfessorDatabase } from '../db'
import {
  maProfessorRepository,
  type PlanificationItemDraft
} from '../repository'
import type {
  ClassGroup,
  EntityId,
  Lesson,
  ModuleUnit,
  Planification,
  PlanificationItem,
  PlanificationItemStatus,
  Subject,
  TeachingAssignment
} from '../types'

export interface PlanificationWorkspaceFilters {
  teachingAssignmentId?: EntityId | null
  moduleId?: EntityId | null
}

export interface PlanificationAssignmentOption {
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  label: string
}

export interface PlanificationModuleOption {
  module: ModuleUnit
  label: string
}

export interface PlanificationWorkspaceItem {
  item: PlanificationItem
  usedLesson: Lesson | null
}

export interface PlanificationWorkspaceSnapshot {
  academicYear: Awaited<
    ReturnType<
      typeof maProfessorRepository.getSetupSnapshot
    >
  >['academicYear']

  filters: {
    teachingAssignmentId: EntityId | null
    moduleId: EntityId | null
  }

  assignmentOptions: PlanificationAssignmentOption[]
  moduleOptions: PlanificationModuleOption[]

  selectedAssignment: TeachingAssignment | null
  selectedGroup: ClassGroup | null
  selectedSubject: Subject | null
  selectedModule: ModuleUnit | null

  planification: Planification | null
  items: PlanificationWorkspaceItem[]

  totals: {
    itemCount: number
    plannedCount: number
    usedCount: number
    skippedCount: number
    completionPercent: number
  }

  generatedAt: string
}

export interface CreatePlanificationWorkspaceInput {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  title: string
  description?: string
  items: PlanificationItemDraft[]
}

export interface UpdatePlanificationWorkspaceInput {
  title?: string
  description?: string
}

export interface UpdatePlanificationItemInput {
  content?: string
  activity?: string
  objectives?: string
  suggestedSummary?: string
}

const now = () =>
  new Date().toISOString()

function createEntityId(
  prefix: string
): EntityId {
  return globalThis.crypto
    ?.randomUUID?.()
    ? `${prefix}-${globalThis.crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`
}

function normalizeText(
  value?: string
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
  value?: string
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

function hasContent(
  item:
    | PlanificationItemDraft
    | UpdatePlanificationItemInput
) {
  return Boolean(
    normalizeText(
      item.content
    ) ||
      normalizeText(
        item.activity
      ) ||
      normalizeText(
        item.objectives
      ) ||
      normalizeText(
        item.suggestedSummary
      )
  )
}

function moduleLabel(
  module: ModuleUnit
) {
  return module.code.trim()
    ? `${module.code.trim()} · ${module.name}`
    : module.name
}

function sortModules(
  modules: ModuleUnit[]
) {
  return [
    ...modules
  ].sort(
    (
      left,
      right
    ) =>
      left.order -
        right.order ||
      moduleLabel(
        left
      ).localeCompare(
        moduleLabel(
          right
        ),
        'pt-PT'
      )
  )
}

function sortItems(
  items: PlanificationItem[]
) {
  return [
    ...items
  ].sort(
    (
      left,
      right
    ) =>
      left.order -
      right.order
  )
}

function calculateTotals(
  items: PlanificationItem[]
) {
  const plannedCount =
    items.filter(
      item =>
        item.status ===
        'planned'
    ).length

  const usedCount =
    items.filter(
      item =>
        item.status ===
        'used'
    ).length

  const skippedCount =
    items.filter(
      item =>
        item.status ===
        'skipped'
    ).length

  return {
    itemCount:
      items.length,

    plannedCount,
    usedCount,
    skippedCount,

    completionPercent:
      items.length
        ? Math.round(
            (
              (
                usedCount +
                skippedCount
              ) /
              items.length
            ) *
              100
          )
        : 0
  }
}

async function getPlanification(
  planificationId: EntityId
) {
  const planification =
    await maProfessorDb
      .planifications
      .get(
        planificationId
      )

  if (
    !planification
  ) {
    throw new Error(
      'A planificação indicada não existe.'
    )
  }

  return planification
}

async function getItem(
  itemId: EntityId
) {
  const item =
    await maProfessorDb
      .planificationItems
      .get(
        itemId
      )

  if (
    !item
  ) {
    throw new Error(
      'O item da planificação indicado não existe.'
    )
  }

  return item
}

async function resequence(
  planificationId: EntityId
) {
  const timestamp =
    now()

  const items =
    sortItems(
      await maProfessorDb
        .planificationItems
        .where(
          'planificationId'
        )
        .equals(
          planificationId
        )
        .toArray()
    ).map(
      (
        item,
        index
      ) => ({
        ...item,

        order:
          index +
          1,

        updatedAt:
          timestamp
      })
    )

  if (
    items.length
  ) {
    await maProfessorDb
      .planificationItems
      .bulkPut(
        items
      )
  }

  return items
}

export class PlanificationWorkspaceRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getWorkspace(
    academicYearId:
      EntityId,

    filters:
      PlanificationWorkspaceFilters = {}
  ): Promise<PlanificationWorkspaceSnapshot> {
    await this.initialize()

    const setup =
      await maProfessorRepository
        .getSetupSnapshot(
          academicYearId
        )

    const groupById =
      new Map(
        setup.groups.map(
          group => [
            group.id,
            group
          ]
        )
      )

    const subjectById =
      new Map(
        setup.subjects.map(
          subject => [
            subject.id,
            subject
          ]
        )
      )

    const assignmentOptions =
      setup.teachingAssignments
        .filter(
          assignment =>
            assignment.active
        )
        .flatMap(
          assignment => {
            const group =
              groupById.get(
                assignment.groupId
              )

            const subject =
              subjectById.get(
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
                  `${group.name} · ${
                    subject.shortName.trim() ||
                    subject.name
                  }`
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
                numeric: true
              }
            )
        )

    const selectedOption =
      filters.teachingAssignmentId
        ? assignmentOptions.find(
            option =>
              option.assignment.id ===
              filters.teachingAssignmentId
          ) ??
          null
        : assignmentOptions[0] ??
          null

    if (
      filters.teachingAssignmentId &&
      !selectedOption
    ) {
      throw new Error(
        'A turma e disciplina selecionadas não pertencem ao ano letivo.'
      )
    }

    const selectedAssignment =
      selectedOption
        ?.assignment ??
      null

    const selectedGroup =
      selectedOption
        ?.group ??
      null

    const selectedSubject =
      selectedOption
        ?.subject ??
      null

    const modules =
      selectedAssignment
        ? sortModules(
            setup.modules.filter(
              module =>
                module.active &&
                module.teachingAssignmentId ===
                  selectedAssignment.id
            )
          )
        : []

    const moduleOptions =
      modules.map(
        module => ({
          module,

          label:
            moduleLabel(
              module
            )
        })
      )

    const selectedModule =
      filters.moduleId
        ? modules.find(
            module =>
              module.id ===
              filters.moduleId
          ) ??
          null
        : modules[0] ??
          null

    if (
      filters.moduleId &&
      !selectedModule
    ) {
      throw new Error(
        'A UFCD selecionada não pertence à turma e disciplina indicadas.'
      )
    }

    const emptySnapshot =
      (): PlanificationWorkspaceSnapshot => ({
        academicYear:
          setup.academicYear,

        filters: {
          teachingAssignmentId:
            selectedAssignment
              ?.id ??
            null,

          moduleId:
            selectedModule
              ?.id ??
            null
        },

        assignmentOptions,
        moduleOptions,

        selectedAssignment,
        selectedGroup,
        selectedSubject,
        selectedModule,

        planification:
          null,

        items:
          [],

        totals:
          calculateTotals(
            []
          ),

        generatedAt:
          now()
      })

    if (
      !selectedAssignment ||
      !selectedModule
    ) {
      return emptySnapshot()
    }

    const matches =
      setup.planifications.filter(
        planification =>
          planification.active &&
          planification.teachingAssignmentId ===
            selectedAssignment.id &&
          planification.moduleId ===
            selectedModule.id
      )

    if (
      matches.length >
      1
    ) {
      throw new Error(
        'Existem várias planificações ativas para a mesma UFCD.'
      )
    }

    const planification =
      matches[0] ??
      null

    if (
      !planification
    ) {
      return emptySnapshot()
    }

    const items =
      sortItems(
        setup.planificationItems.filter(
          item =>
            item.planificationId ===
            planification.id
        )
      )

    const lessonIds =
      items.flatMap(
        item =>
          item.usedLessonId
            ? [
                item.usedLessonId
              ]
            : []
      )

    const lessons =
      lessonIds.length
        ? await maProfessorDb
            .lessons
            .bulkGet(
              lessonIds
            )
        : []

    const lessonById =
      new Map<
        EntityId,
        Lesson
      >(
        lessons.flatMap(
          (
            lesson:
              | Lesson
              | undefined
          ) =>
            lesson
              ? [
                  [
                    lesson.id,
                    lesson
                  ] as const
                ]
              : []
        )
      )

    return {
      ...emptySnapshot(),

      planification,

      items:
        items.map(
          item => ({
            item,

            usedLesson:
              item.usedLessonId
                ? lessonById.get(
                    item.usedLessonId
                  ) ??
                  null
                : null
          })
        ),

      totals:
        calculateTotals(
          items
        )
    }
  }

  async createPlanification(
    input:
      CreatePlanificationWorkspaceInput
  ) {
    await this.initialize()

    const setup =
      await maProfessorRepository
        .getSetupSnapshot(
          input.academicYearId
        )

    const assignment =
      setup.teachingAssignments.find(
        item =>
          item.id ===
          input.teachingAssignmentId
      )

    const module =
      setup.modules.find(
        item =>
          item.id ===
          input.moduleId
      )

    if (
      !assignment?.active ||
      assignment.academicYearId !==
        input.academicYearId
    ) {
      throw new Error(
        'A turma e disciplina selecionadas não pertencem ao ano letivo.'
      )
    }

    if (
      !module?.active ||
      module.academicYearId !==
        input.academicYearId ||
      module.teachingAssignmentId !==
        assignment.id
    ) {
      throw new Error(
        'A UFCD indicada não pertence à turma e disciplina selecionadas.'
      )
    }

    if (
      setup.planifications.some(
        item =>
          item.active &&
          item.moduleId ===
            module.id
      )
    ) {
      throw new Error(
        'Esta UFCD já possui uma planificação ativa.'
      )
    }

    const items =
      input.items.filter(
        hasContent
      )

    if (
      !items.length
    ) {
      throw new Error(
        'Adicione pelo menos um item à planificação.'
      )
    }

    return maProfessorRepository
      .createPlanification(
        {
          academicYearId:
            input.academicYearId,

          teachingAssignmentId:
            assignment.id,

          moduleId:
            module.id,

          title:
            requireText(
              input.title,
              'O título da planificação'
            ),

          description:
            normalizeMultiline(
              input.description
            ),

          active:
            true
        },
        items
      )
  }

  async updatePlanification(
    planificationId:
      EntityId,

    changes:
      UpdatePlanificationWorkspaceInput
  ) {
    await this.initialize()

    const current =
      await getPlanification(
        planificationId
      )

    const updated:
      Planification = {
      ...current,

      title:
        changes.title ===
        undefined
          ? current.title
          : requireText(
              changes.title,
              'O título da planificação'
            ),

      description:
        changes.description ===
        undefined
          ? current.description
          : normalizeMultiline(
              changes.description
            ),

      updatedAt:
        now()
    }

    await maProfessorDb
      .planifications
      .put(
        updated
      )

    return updated
  }

  async addPlanificationItem(
    planificationId:
      EntityId,

    draft:
      PlanificationItemDraft
  ) {
    await this.initialize()

    const planification =
      await getPlanification(
        planificationId
      )

    if (
      !planification.active
    ) {
      throw new Error(
        'A planificação está inativa.'
      )
    }

    if (
      !hasContent(
        draft
      )
    ) {
      throw new Error(
        'Preencha pelo menos um campo do novo item.'
      )
    }

    const existing =
      await maProfessorDb
        .planificationItems
        .where(
          'planificationId'
        )
        .equals(
          planificationId
        )
        .toArray()

    const timestamp =
      now()

    const item:
      PlanificationItem = {
      id:
        createEntityId(
          'plan-item'
        ),

      planificationId,

      order:
        Math.max(
          0,
          ...existing.map(
            value =>
              value.order
          )
        ) +
        1,

      content:
        normalizeText(
          draft.content
        ),

      activity:
        normalizeText(
          draft.activity
        ),

      objectives:
        normalizeText(
          draft.objectives
        ),

      suggestedSummary:
        normalizeText(
          draft.suggestedSummary
        ),

      status:
        'planned',

      usedLessonId:
        null,

      usedAt:
        null,

      createdAt:
        timestamp,

      updatedAt:
        timestamp
    }

    await maProfessorDb
      .planificationItems
      .add(
        item
      )

    return item
  }

  async updatePlanificationItem(
    itemId:
      EntityId,

    changes:
      UpdatePlanificationItemInput
  ) {
    await this.initialize()

    const current =
      await getItem(
        itemId
      )

    const updated:
      PlanificationItem = {
      ...current,

      content:
        changes.content ===
        undefined
          ? current.content
          : normalizeText(
              changes.content
            ),

      activity:
        changes.activity ===
        undefined
          ? current.activity
          : normalizeText(
              changes.activity
            ),

      objectives:
        changes.objectives ===
        undefined
          ? current.objectives
          : normalizeText(
              changes.objectives
            ),

      suggestedSummary:
        changes.suggestedSummary ===
        undefined
          ? current.suggestedSummary
          : normalizeText(
              changes.suggestedSummary
            ),

      updatedAt:
        now()
    }

    if (
      !hasContent(
        updated
      )
    ) {
      throw new Error(
        'O item não pode ficar totalmente vazio.'
      )
    }

    await maProfessorDb
      .planificationItems
      .put(
        updated
      )

    return updated
  }

  async setPlanificationItemStatus(
    itemId:
      EntityId,

    status:
      Extract<
        PlanificationItemStatus,
        'planned' | 'skipped'
      >
  ) {
    await this.initialize()

    const item =
      await getItem(
        itemId
      )

    if (
      item.status ===
        'used' ||
      item.usedLessonId
    ) {
      throw new Error(
        'Este item já foi utilizado numa aula.'
      )
    }

    const updated:
      PlanificationItem = {
      ...item,

      status,

      usedLessonId:
        null,

      usedAt:
        null,

      updatedAt:
        now()
    }

    await maProfessorDb
      .planificationItems
      .put(
        updated
      )

    return updated
  }

  async deletePlanificationItem(
    itemId:
      EntityId
  ) {
    await this.initialize()

    const item =
      await getItem(
        itemId
      )

    if (
      item.status ===
        'used' ||
      item.usedLessonId
    ) {
      throw new Error(
        'Este item já foi utilizado numa aula e não pode ser eliminado.'
      )
    }

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.planificationItems,
      async () => {
        await maProfessorDb
          .planificationItems
          .delete(
            item.id
          )

        await resequence(
          item.planificationId
        )
      }
    )
  }

  async reorderPlanificationItems(
    planificationId:
      EntityId,

    orderedIds:
      EntityId[]
  ) {
    await this.initialize()

    await getPlanification(
      planificationId
    )

    return maProfessorRepository
      .reorderPlanificationItems(
        planificationId,
        orderedIds
      )
  }

  async importPlanificationLines(
    planificationId:
      EntityId,

    text:
      string
  ) {
    await this.initialize()

    await getPlanification(
      planificationId
    )

    const existing =
      sortItems(
        await maProfessorDb
          .planificationItems
          .where(
            'planificationId'
          )
          .equals(
            planificationId
          )
          .toArray()
      )

    const known =
      new Set(
        existing
          .flatMap(
            item => [
              item.content,
              item.suggestedSummary
            ]
          )
          .map(
            value =>
              normalizeText(
                value
              ).toLocaleLowerCase(
                'pt-PT'
              )
          )
          .filter(Boolean)
      )

    const lines =
      text
        .split(
          /\r?\n/
        )
        .map(
          normalizeText
        )
        .filter(Boolean)
        .filter(
          line => {
            const key =
              line.toLocaleLowerCase(
                'pt-PT'
              )

            if (
              known.has(
                key
              )
            ) {
              return false
            }

            known.add(
              key
            )

            return true
          }
        )

    if (
      !lines.length
    ) {
      throw new Error(
        'Não existem linhas novas para importar.'
      )
    }

    const timestamp =
      now()

    const records:
      PlanificationItem[] =
      lines.map(
        (
          line,
          index
        ) => ({
          id:
            createEntityId(
              'plan-item'
            ),

          planificationId,

          order:
            existing.length +
            index +
            1,

          content:
            line,

          activity:
            '',

          objectives:
            '',

          suggestedSummary:
            line,

          status:
            'planned',

          usedLessonId:
            null,

          usedAt:
            null,

          createdAt:
            timestamp,

          updatedAt:
            timestamp
        })
      )

    await maProfessorDb
      .planificationItems
      .bulkAdd(
        records
      )

    return records
  }
}

export function getPlanificationItemStatusLabel(
  status:
    PlanificationItemStatus
) {
  return {
    planned:
      'Planeado',

    used:
      'Utilizado',

    skipped:
      'Ignorado'
  }[status]
}

export const planificationWorkspaceRepository =
  new PlanificationWorkspaceRepository()
