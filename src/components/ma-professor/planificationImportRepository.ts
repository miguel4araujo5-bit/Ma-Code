import {
  maProfessorDb,
  openMAProfessorDatabase
} from './db'
import {
  markDashboardDataDirty
} from './dashboard/dashboardRefreshSignal'

import type {
  EntityId,
  Planification,
  PlanificationItem
} from './types'

export type PlanificationImportMode =
  | 'create'
  | 'append'
  | 'skip'

export interface PlanificationImportDocument {
  name: string
  sha256: string
}

export interface PlanificationImportItemDraft {
  content: string
  activity?: string
  objectives?: string
  resources?: string
  evaluation?: string
  suggestedSummary?: string
  sourcePages?: number[]
}

export interface PlanificationImportEntry {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  mode: PlanificationImportMode
  expectedStateFingerprint: string
  source: {
    pages: number[]
    sectionOrdinal: number
  }
  planification: {
    title: string
    description?: string
  }
  items: PlanificationImportItemDraft[]
}

export interface PlanificationImportBatchInput {
  confirmed: true
  document: PlanificationImportDocument
  entries: PlanificationImportEntry[]
}

export interface PlanificationImportDestinationState {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  activePlanification: Planification | null
  activeItems: PlanificationItem[]
  hasActivePlanification: boolean
  stateFingerprint: string
}

export type PlanificationImportAction =
  | 'created'
  | 'appended'
  | 'skipped'
  | 'alreadyImported'

export interface PlanificationImportEntryResult {
  moduleId: EntityId
  action: PlanificationImportAction
  sourceImportKey?: string
  planificationId?: EntityId
  createdItemIds?: EntityId[]
}

export interface PlanificationImportBatchResult {
  results: PlanificationImportEntryResult[]
}

type NormalizedImportItem = {
  content: string
  activity: string
  objectives: string
  resources: string
  evaluation: string
  suggestedSummary: string
  sourcePages: number[]
}

type NormalizedImportEntry = Omit<
  PlanificationImportEntry,
  'planification' | 'items' | 'source'
> & {
  planification: {
    title: string
    description: string
  }
  source: {
    pages: number[]
    sectionOrdinal: number
  }
  items: NormalizedImportItem[]
  sourceImportKey: string
}

type LoadedDestination = {
  activePlanification: Planification | null
  activeItems: PlanificationItem[]
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

function requireText(
  value: string | undefined,
  label: string
) {
  const normalized =
    normalizeText(
      value
    )

  if (!normalized) {
    throw new Error(
      `${label} é obrigatório.`
    )
  }

  return normalized
}

function normalizePages(
  pages: number[] | undefined,
  requireAtLeastOne = false
) {
  const normalized =
    Array.from(
      new Set(
        pages ??
          []
      )
    )
      .filter(
        page =>
          Number.isInteger(
            page
          ) &&
          page >
            0
      )
      .sort(
        (
          left,
          right
        ) =>
          left -
          right
      )

  if (
    requireAtLeastOne &&
    normalized.length ===
      0
  ) {
    throw new Error(
      'A secção importada tem de indicar pelo menos uma página de origem válida.'
    )
  }

  return normalized
}

function normalizeDocumentHash(
  value: string
) {
  const normalized =
    value
      .trim()
      .toLowerCase()

  if (
    !/^[a-f0-9]{64}$/.test(
      normalized
    )
  ) {
    throw new Error(
      'O PDF não possui um SHA-256 válido para controlo de importação.'
    )
  }

  return normalized
}

function normalizeImportItem(
  item: PlanificationImportItemDraft,
  fallbackPages: number[]
): NormalizedImportItem {
  return {
    content:
      normalizeText(
        item.content
      ),
    activity:
      normalizeText(
        item.activity
      ),
    objectives:
      normalizeText(
        item.objectives
      ),
    resources:
      normalizeText(
        item.resources
      ),
    evaluation:
      normalizeText(
        item.evaluation
      ),
    suggestedSummary:
      normalizeText(
        item.suggestedSummary
      ),
    sourcePages:
      normalizePages(
        item.sourcePages?.length
          ? item.sourcePages
          : fallbackPages
      )
  }
}

function hasImportContent(
  item: NormalizedImportItem
) {
  return Boolean(
    item.content ||
    item.activity ||
    item.objectives ||
    item.resources ||
    item.evaluation ||
    item.suggestedSummary
  )
}

function sortedItems(
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
        right.order ||
      left.id.localeCompare(
        right.id
      )
  )
}

function optionalText(
  value: string
) {
  return value
    ? value
    : undefined
}

function stateItemShape(
  item: PlanificationItem
) {
  return {
    id:
      item.id,
    order:
      item.order,
    content:
      item.content,
    activity:
      item.activity,
    objectives:
      item.objectives,
    resources:
      item.resources ??
      null,
    evaluation:
      item.evaluation ??
      null,
    suggestedSummary:
      item.suggestedSummary,
    status:
      item.status,
    usedLessonId:
      item.usedLessonId,
    usedAt:
      item.usedAt,
    sourceDocumentName:
      item.sourceDocumentName ??
      null,
    sourcePages:
      normalizePages(
        item.sourcePages
      ),
    sourceImportKey:
      item.sourceImportKey ??
      null,
    updatedAt:
      item.updatedAt
  }
}

export function buildPlanificationImportStateFingerprint(
  academicYearId: EntityId,
  teachingAssignmentId: EntityId,
  moduleId: EntityId,
  activePlanification: Planification | null,
  activeItems: PlanificationItem[]
) {
  return JSON.stringify({
    version: 1,
    academicYearId,
    teachingAssignmentId,
    moduleId,
    planification:
      activePlanification
        ? {
            id:
              activePlanification.id,
            academicYearId:
              activePlanification.academicYearId,
            teachingAssignmentId:
              activePlanification.teachingAssignmentId,
            moduleId:
              activePlanification.moduleId,
            title:
              activePlanification.title,
            description:
              activePlanification.description,
            active:
              activePlanification.active,
            sourceDocumentName:
              activePlanification.sourceDocumentName ??
              null,
            sourcePages:
              normalizePages(
                activePlanification.sourcePages
              ),
            updatedAt:
              activePlanification.updatedAt
          }
        : null,
    items:
      sortedItems(
        activeItems
      ).map(
        stateItemShape
      )
  })
}

async function sha256Hex(
  value: string
) {
  const subtle =
    globalThis.crypto
      ?.subtle

  if (!subtle) {
    throw new Error(
      'Este dispositivo não disponibiliza SHA-256 para controlar importações de planificações.'
    )
  }

  const digest =
    await subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(
          value
        )
    )

  return Array.from(
    new Uint8Array(
      digest
    )
  )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(
            2,
            '0'
          )
    )
    .join('')
}

async function buildSourceImportKey(
  documentSha256: string,
  entry: Omit<
    NormalizedImportEntry,
    'sourceImportKey'
  >
) {
  const payload =
    JSON.stringify({
      version: 1,
      documentSha256,
      academicYearId:
        entry.academicYearId,
      teachingAssignmentId:
        entry.teachingAssignmentId,
      moduleId:
        entry.moduleId,
      sectionOrdinal:
        entry.source.sectionOrdinal,
      sourcePages:
        entry.source.pages,
      items:
        entry.items
    })

  return `plan-import-v1:${await sha256Hex(
    payload
  )}`
}

function canonicalImportedItem(
  item:
    | NormalizedImportItem
    | PlanificationItem
) {
  return JSON.stringify({
    content:
      normalizeText(
        item.content
      ),
    activity:
      normalizeText(
        item.activity
      ),
    objectives:
      normalizeText(
        item.objectives
      ),
    resources:
      normalizeText(
        item.resources
      ),
    evaluation:
      normalizeText(
        item.evaluation
      ),
    suggestedSummary:
      normalizeText(
        item.suggestedSummary
      ),
    sourcePages:
      normalizePages(
        item.sourcePages
      )
  })
}

function importedItemsMatch(
  existing: PlanificationItem[],
  intended: NormalizedImportItem[]
) {
  if (
    existing.length !==
    intended.length
  ) {
    return false
  }

  const existingShapes =
    existing
      .map(
        canonicalImportedItem
      )
      .sort()

  const intendedShapes =
    intended
      .map(
        canonicalImportedItem
      )
      .sort()

  return existingShapes.every(
    (
      value,
      index
    ) =>
      value ===
      intendedShapes[
        index
      ]
  )
}

async function normalizeEntry(
  documentSha256: string,
  entry: PlanificationImportEntry
): Promise<NormalizedImportEntry> {
  if (
    entry.mode ===
    'skip'
  ) {
    return {
      ...entry,
      planification: {
        title:
          normalizeText(
            entry.planification.title
          ),
        description:
          normalizeText(
            entry.planification.description
          )
      },
      source: {
        pages:
          normalizePages(
            entry.source.pages
          ),
        sectionOrdinal:
          entry.source.sectionOrdinal
      },
      items: [],
      sourceImportKey: ''
    }
  }

  if (
    !Number.isInteger(
      entry.source.sectionOrdinal
    ) ||
    entry.source.sectionOrdinal <=
      0
  ) {
    throw new Error(
      'A secção importada tem um número de ordem inválido.'
    )
  }

  const sourcePages =
    normalizePages(
      entry.source.pages,
      true
    )

  const items =
    entry.items
      .map(
        item =>
          normalizeImportItem(
            item,
            sourcePages
          )
      )
      .filter(
        hasImportContent
      )

  if (
    items.length ===
    0
  ) {
    throw new Error(
      'A UFCD selecionada não contém itens de planificação válidos para importar.'
    )
  }

  const normalizedWithoutKey = {
    ...entry,
    planification: {
      title:
        requireText(
          entry.planification.title,
          'O título da planificação'
        ),
      description:
        normalizeText(
          entry.planification.description
        )
    },
    source: {
      pages:
        sourcePages,
      sectionOrdinal:
        entry.source.sectionOrdinal
    },
    items
  }

  return {
    ...normalizedWithoutKey,
    sourceImportKey:
      await buildSourceImportKey(
        documentSha256,
        normalizedWithoutKey
      )
  }
}

async function loadDestination(
  academicYearId: EntityId,
  teachingAssignmentId: EntityId,
  moduleId: EntityId
): Promise<LoadedDestination> {
  const [
    academicYear,
    assignment,
    module,
    modulePlanifications
  ] =
    await Promise.all([
      maProfessorDb.academicYears.get(
        academicYearId
      ),
      maProfessorDb.teachingAssignments.get(
        teachingAssignmentId
      ),
      maProfessorDb.modules.get(
        moduleId
      ),
      maProfessorDb.planifications
        .where(
          'moduleId'
        )
        .equals(
          moduleId
        )
        .toArray()
    ])

  if (!academicYear) {
    throw new Error(
      'O ano letivo indicado não existe.'
    )
  }

  if (
    !assignment ||
    !assignment.active ||
    assignment.academicYearId !==
      academicYearId
  ) {
    throw new Error(
      'A turma e disciplina selecionadas não pertencem ao ano letivo.'
    )
  }

  if (
    !module ||
    !module.active ||
    module.academicYearId !==
      academicYearId ||
    module.teachingAssignmentId !==
      teachingAssignmentId
  ) {
    throw new Error(
      'A UFCD indicada não pertence à turma e disciplina selecionadas.'
    )
  }

  const activePlanifications =
    modulePlanifications.filter(
      planification =>
        planification.active
    )

  if (
    activePlanifications.length >
      1
  ) {
    throw new Error(
      'Existem várias planificações ativas para a mesma UFCD.'
    )
  }

  const activePlanification =
    activePlanifications[
      0
    ] ??
    null

  if (
    activePlanification &&
    (
      activePlanification.academicYearId !==
        academicYearId ||
      activePlanification.teachingAssignmentId !==
        teachingAssignmentId ||
      activePlanification.moduleId !==
        moduleId
    )
  ) {
    throw new Error(
      'A planificação ativa da UFCD possui uma associação inconsistente.'
    )
  }

  const activeItems =
    activePlanification
      ? sortedItems(
          await maProfessorDb.planificationItems
            .where(
              'planificationId'
            )
            .equals(
              activePlanification.id
            )
            .toArray()
        )
      : []

  return {
    activePlanification,
    activeItems
  }
}

function createPlanificationRecord(
  entry: NormalizedImportEntry,
  documentName: string,
  timestamp: string
): Planification {
  return {
    id:
      createEntityId(
        'plan'
      ),
    academicYearId:
      entry.academicYearId,
    teachingAssignmentId:
      entry.teachingAssignmentId,
    moduleId:
      entry.moduleId,
    title:
      entry.planification.title,
    description:
      entry.planification.description,
    active:
      true,
    sourceDocumentName:
      documentName,
    sourcePages:
      entry.source.pages,
    createdAt:
      timestamp,
    updatedAt:
      timestamp
  }
}

function createItemRecords(
  entry: NormalizedImportEntry,
  planificationId: EntityId,
  startOrder: number,
  documentName: string,
  timestamp: string
): PlanificationItem[] {
  return entry.items.map(
    (
      item,
      index
    ) => ({
      id:
        createEntityId(
          'plan-item'
        ),
      planificationId,
      order:
        startOrder +
        index,
      content:
        item.content,
      activity:
        item.activity,
      objectives:
        item.objectives,
      ...(optionalText(
        item.resources
      )
        ? {
            resources:
              item.resources
          }
        : {}),
      ...(optionalText(
        item.evaluation
      )
        ? {
            evaluation:
              item.evaluation
          }
        : {}),
      suggestedSummary:
        item.suggestedSummary,
      status:
        'planned' as const,
      usedLessonId:
        null,
      usedAt:
        null,
      sourceDocumentName:
        documentName,
      sourcePages:
        item.sourcePages,
      sourceImportKey:
        entry.sourceImportKey,
      createdAt:
        timestamp,
      updatedAt:
        timestamp
    })
  )
}

function assertUniqueWriteDestinations(
  entries: NormalizedImportEntry[]
) {
  const seen =
    new Set<string>()

  entries.forEach(
    entry => {
      if (
        entry.mode ===
        'skip'
      ) {
        return
      }

      const key =
        `${entry.academicYearId}|${entry.teachingAssignmentId}|${entry.moduleId}`

      if (
        seen.has(
          key
        )
      ) {
        throw new Error(
          'O mesmo destino de planificação aparece mais do que uma vez no lote confirmado.'
        )
      }

      seen.add(
        key
      )
    }
  )
}

export class PlanificationImportRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getPlanificationImportDestinationState(
    input: {
      academicYearId: EntityId
      teachingAssignmentId: EntityId
      moduleId: EntityId
    }
  ): Promise<PlanificationImportDestinationState> {
    await this.initialize()

    return maProfessorDb.transaction(
      'r',
      maProfessorDb.academicYears,
      maProfessorDb.teachingAssignments,
      maProfessorDb.modules,
      maProfessorDb.planifications,
      maProfessorDb.planificationItems,
      async () => {
        const destination =
          await loadDestination(
            input.academicYearId,
            input.teachingAssignmentId,
            input.moduleId
          )

        return {
          academicYearId:
            input.academicYearId,
          teachingAssignmentId:
            input.teachingAssignmentId,
          moduleId:
            input.moduleId,
          activePlanification:
            destination.activePlanification,
          activeItems:
            destination.activeItems,
          hasActivePlanification:
            Boolean(
              destination.activePlanification
            ),
          stateFingerprint:
            buildPlanificationImportStateFingerprint(
              input.academicYearId,
              input.teachingAssignmentId,
              input.moduleId,
              destination.activePlanification,
              destination.activeItems
            )
        }
      }
    )
  }

  async commitPlanificationImportBatch(
    input: PlanificationImportBatchInput
  ): Promise<PlanificationImportBatchResult> {
    await this.initialize()

    if (
      input.confirmed !==
      true
    ) {
      throw new Error(
        'A importação só pode ser gravada depois de confirmação explícita do professor.'
      )
    }

    const documentName =
      requireText(
        input.document.name,
        'O nome do PDF'
      )

    const documentSha256 =
      normalizeDocumentHash(
        input.document.sha256
      )

    const normalizedEntries =
      await Promise.all(
        input.entries.map(
          entry =>
            normalizeEntry(
              documentSha256,
              entry
            )
        )
      )

    assertUniqueWriteDestinations(
      normalizedEntries
    )

    const result = await maProfessorDb.transaction(
      'rw',
      maProfessorDb.academicYears,
      maProfessorDb.teachingAssignments,
      maProfessorDb.modules,
      maProfessorDb.planifications,
      maProfessorDb.planificationItems,
      async () => {
        const results:
          PlanificationImportEntryResult[] =
          []

        for (
          const entry of
          normalizedEntries
        ) {
          if (
            entry.mode ===
            'skip'
          ) {
            results.push({
              moduleId:
                entry.moduleId,
              action:
                'skipped'
            })
            continue
          }

          const destination =
            await loadDestination(
              entry.academicYearId,
              entry.teachingAssignmentId,
              entry.moduleId
            )

          const alreadyImported =
            destination.activeItems.filter(
              item =>
                item.sourceImportKey ===
                entry.sourceImportKey
            )

          if (
            alreadyImported.length >
              0
          ) {
            if (
              !importedItemsMatch(
                alreadyImported,
                entry.items
              )
            ) {
              throw new Error(
                'Esta secção do PDF já foi importada, mas os itens associados foram alterados. Reveja a planificação antes de voltar a importar.'
              )
            }

            if (
              !destination.activePlanification
            ) {
              throw new Error(
                'Foi detetada uma importação anterior sem planificação ativa correspondente.'
              )
            }

            results.push({
              moduleId:
                entry.moduleId,
              action:
                'alreadyImported',
              sourceImportKey:
                entry.sourceImportKey,
              planificationId:
                destination.activePlanification.id,
              createdItemIds:
                alreadyImported.map(
                  item =>
                    item.id
                )
            })
            continue
          }

          const currentFingerprint =
            buildPlanificationImportStateFingerprint(
              entry.academicYearId,
              entry.teachingAssignmentId,
              entry.moduleId,
              destination.activePlanification,
              destination.activeItems
            )

          if (
            currentFingerprint !==
            entry.expectedStateFingerprint
          ) {
            throw new Error(
              'A planificação foi alterada depois da pré-visualização. Atualize os destinos e confirme novamente antes de importar.'
            )
          }

          if (
            entry.mode ===
            'create'
          ) {
            if (
              destination.activePlanification
            ) {
              throw new Error(
                'Esta UFCD já possui uma planificação ativa. Escolha explicitamente acrescentar ou ignorar.'
              )
            }

            const timestamp =
              now()

            const planification =
              createPlanificationRecord(
                entry,
                documentName,
                timestamp
              )

            const itemRecords =
              createItemRecords(
                entry,
                planification.id,
                1,
                documentName,
                timestamp
              )

            await maProfessorDb.planifications.add(
              planification
            )

            await maProfessorDb.planificationItems.bulkAdd(
              itemRecords
            )

            results.push({
              moduleId:
                entry.moduleId,
              action:
                'created',
              sourceImportKey:
                entry.sourceImportKey,
              planificationId:
                planification.id,
              createdItemIds:
                itemRecords.map(
                  item =>
                    item.id
                )
            })

            continue
          }

          if (
            entry.mode ===
            'append'
          ) {
            if (
              !destination.activePlanification
            ) {
              throw new Error(
                'Esta UFCD ainda não possui uma planificação ativa. Escolha criar em vez de acrescentar.'
              )
            }

            const timestamp =
              now()

            const startOrder =
              Math.max(
                0,
                ...destination.activeItems.map(
                  item =>
                    item.order
                )
              ) +
              1

            const itemRecords =
              createItemRecords(
                entry,
                destination.activePlanification.id,
                startOrder,
                documentName,
                timestamp
              )

            await maProfessorDb.planificationItems.bulkAdd(
              itemRecords
            )

            results.push({
              moduleId:
                entry.moduleId,
              action:
                'appended',
              sourceImportKey:
                entry.sourceImportKey,
              planificationId:
                destination.activePlanification.id,
              createdItemIds:
                itemRecords.map(
                  item =>
                    item.id
                )
            })
          }
        }

        return {
          results
        }
      }
    )

    if (
      result.results.some(
        item =>
          item.action ===
            'created' ||
          item.action ===
            'appended'
      )
    ) {
      markDashboardDataDirty()
    }

    return result
  }
}

export const planificationImportRepository =
  new PlanificationImportRepository()
