import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import {
  markDashboardDataDirty
} from '../dashboard/dashboardRefreshSignal'
import type {
  Planification,
  PlanificationItem
} from '../types'
import type {
  ModuleDocument
} from './planificationModuleDocument'
import type {
  ModuleImportSelection
} from './modulePlanificationImportRepository'

const normalize = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-PT')

const clean = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')

const tables = () => [
  maProfessorDb.academicYears,
  maProfessorDb.groups,
  maProfessorDb.subjects,
  maProfessorDb.teachingAssignments,
  maProfessorDb.modules,
  maProfessorDb.planifications,
  maProfessorDb.planificationItems,
  maProfessorDb.settings
]

const BULLET_MARKER =
  /^[•●○▪◦·]\s*/
const BULLET_ANYWHERE =
  /[•●○▪◦·]/

function dedupePoints(
  values: string[]
) {
  const seen =
    new Set<string>()

  return values.filter(value => {
    const key =
      normalize(value)

    if (
      !key ||
      seen.has(key)
    ) {
      return false
    }

    seen.add(key)
    return true
  })
}

function splitPlanificationPoints(
  value: string
) {
  const normalized =
    value
      .replace(/\r\n/g, '\n')
      .trim()

  if (!normalized) {
    return []
  }

  if (!BULLET_ANYWHERE.test(normalized)) {
    return dedupePoints(
      normalized
        .split('\n')
        .map(clean)
        .filter(Boolean)
    )
  }

  const lines = normalized
    .replace(
      /([•●○▪◦·])\s*/g,
      '\n$1 '
    )
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const points: string[] = []
  let current = ''

  for (const line of lines) {
    if (BULLET_MARKER.test(line)) {
      if (current) {
        points.push(
          clean(current)
        )
      }

      current =
        line
          .replace(
            BULLET_MARKER,
            ''
          )
          .trim()
      continue
    }

    current = current
      ? `${current} ${line}`
      : line
  }

  if (current) {
    points.push(
      clean(current)
    )
  }

  return dedupePoints(points)
}

function buildSemanticPoints(
  contentsText: string,
  objectivesText: string
) {
  const contents =
    splitPlanificationPoints(
      contentsText
    )
  const objectives =
    splitPlanificationPoints(
      objectivesText
    )

  if (!contents.length) {
    return objectives.map(objective => ({
      content: objective,
      objectives: ''
    }))
  }

  return contents.map(
    (content, index) => ({
      content,
      objectives:
        index === contents.length - 1
          ? objectives
              .slice(index)
              .join('\n')
          : objectives[index] ?? ''
    })
  )
}

function contextBlock(
  label: string,
  value: string
) {
  const text = value.trim()
  return text
    ? `${label}:\n${text}`
    : ''
}

function buildDescription(input: {
  source: ModuleDocument['sections'][number]
  plannedPeriods: number
}) {
  return [
    input.source.periodLabel,
    input.source.plannedLessons !== null
      ? `Aulas/tempos previstos no documento: ${input.source.plannedLessons}.`
      : '',
    `Tempos letivos da componente anual: ${input.plannedPeriods}.`,
    contextBlock(
      'Metodologia/estratégias',
      input.source.methodologyText
    ),
    contextBlock(
      'Recursos',
      input.source.resourcesText
    ),
    contextBlock(
      'Avaliação',
      input.source.evaluationText
    )
  ]
    .filter(Boolean)
    .join('\n')
}

function buildItems(input: {
  planificationId: string
  source: ModuleDocument['sections'][number]
  documentName: string
  documentSha256: string
  sectionIndex: number
  assignmentId: string
  timestamp: string
}): PlanificationItem[] {
  return buildSemanticPoints(
    input.source.contentsText,
    input.source.objectivesText
  ).map((point, index) => {
    const order = index + 1

    return {
      id:
        `${input.planificationId}-annual-${String(order).padStart(4, '0')}-${crypto.randomUUID()}`,
      planificationId:
        input.planificationId,
      order,
      content: point.content,
      objectives:
        point.objectives,
      activity: '',
      resources: '',
      evaluation: '',
      suggestedSummary:
        point.content,
      status: 'planned',
      usedLessonId: null,
      usedAt: null,
      sourceDocumentName:
        input.documentName,
      sourcePages:
        input.source.sourcePages,
      sourceImportKey:
        `regular-plan-v1:${input.documentSha256}:${input.sectionIndex}:${input.assignmentId}:${order}`,
      createdAt:
        input.timestamp,
      updatedAt:
        input.timestamp
    }
  })
}

async function state() {
  const values =
    await Promise.all(
      tables().map(table =>
        table.toArray()
      )
    )

  return JSON.stringify(
    values.map(rows =>
      rows.sort(
        (left, right) =>
          String(left.id).localeCompare(
            String(right.id)
          )
      )
    )
  )
}

export async function readRegularAnnualPlanificationImportState() {
  await openMAProfessorDatabase()

  return maProfessorDb.transaction(
    'r',
    tables(),
    async () => ({
      fingerprint:
        await state(),
      periodMinutes:
        (
          await maProfessorDb.settings.get(
            'default'
          )
        )?.defaultPeriodMinutes ?? 50
    })
  )
}

export async function commitRegularAnnualPlanificationImport(input: {
  confirmed: true
  academicYearId: string
  assignmentIds: string[]
  expectedFingerprint: string
  document: ModuleDocument
  selections: ModuleImportSelection[]
}) {
  if (input.confirmed !== true) {
    throw new Error(
      'Confirme a importação antes de guardar.'
    )
  }

  const request =
    structuredClone(input)

  if (
    request.document.importKind !==
      'regular_annual' ||
    !/^[a-f0-9]{64}$/.test(
      request.document.sha256
    ) ||
    !request.document.name.trim()
  ) {
    throw new Error(
      'A planificação anual de origem não é válida.'
    )
  }

  const assignmentIds =
    [...new Set(
      request.assignmentIds
    )]

  if (!assignmentIds.length) {
    throw new Error(
      'Selecione pelo menos uma disciplina e turma de ensino regular.'
    )
  }

  if (
    request.selections.length !== 1
  ) {
    throw new Error(
      'A importação anual aceita uma única grelha de planificação de cada vez.'
    )
  }

  const selection =
    request.selections[0]
  const source =
    request.document.sections[
      selection.sectionIndex
    ]

  if (
    !Number.isInteger(
      selection.sectionIndex
    ) ||
    !source ||
    !selection.reviewed ||
    (
      !source.contentsText.trim() &&
      !source.objectivesText.trim()
    )
  ) {
    throw new Error(
      'Reveja os conteúdos e objetivos da planificação anual antes de importar.'
    )
  }

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
            'Os dados foram alterados após a revisão. Atualize a revisão antes de confirmar novamente.'
          )
        }

        if (
          !await maProfessorDb.academicYears.get(
            request.academicYearId
          )
        ) {
          throw new Error(
            'O ano letivo já não existe.'
          )
        }

        let attached = 0
        let skipped = 0

        for (const assignmentId of assignmentIds) {
          const assignment =
            await maProfessorDb.teachingAssignments.get(
              assignmentId
            )
          const group =
            assignment
              ? await maProfessorDb.groups.get(
                  assignment.groupId
                )
              : null
          const subject =
            assignment
              ? await maProfessorDb.subjects.get(
                  assignment.subjectId
                )
              : null

          if (
            !assignment?.active ||
            assignment.academicYearId !==
              request.academicYearId ||
            !group?.active ||
            group.academicYearId !==
              request.academicYearId ||
            group.educationType !==
              'regular' ||
            !subject?.active ||
            subject.academicYearId !==
              request.academicYearId
          ) {
            throw new Error(
              'A planificação anual só pode ser associada a uma disciplina ativa do ensino regular.'
            )
          }

          const annualModules = (
            await maProfessorDb.modules
              .where(
                'teachingAssignmentId'
              )
              .equals(
                assignmentId
              )
              .toArray()
          ).filter(module =>
            module.active &&
            module.academicYearId ===
              request.academicYearId &&
            module.regularAnnual ===
              true
          )

          if (
            annualModules.length !== 1
          ) {
            throw new Error(
              annualModules.length > 1
                ? 'Existem várias componentes anuais no destino. Corrija a duplicação antes de importar.'
                : 'A disciplina de ensino regular ainda não tem uma Componente anual preparada. Atualize o horário antes de importar.'
            )
          }

          const annualModule =
            annualModules[0]
          const activePlanifications = (
            await maProfessorDb.planifications
              .where('moduleId')
              .equals(
                annualModule.id
              )
              .toArray()
          ).filter(planification =>
            planification.active
          )

          if (
            activePlanifications.length > 0
          ) {
            skipped += 1
            continue
          }

          const timestamp =
            new Date().toISOString()
          const planification: Planification = {
            id:
              crypto.randomUUID(),
            academicYearId:
              request.academicYearId,
            teachingAssignmentId:
              assignmentId,
            moduleId:
              annualModule.id,
            title:
              `Planificação — ${annualModule.name}`,
            description:
              buildDescription({
                source,
                plannedPeriods:
                  annualModule.plannedPeriods
              }),
            active: true,
            sourceDocumentName:
              request.document.name,
            sourcePages:
              source.sourcePages,
            createdAt:
              timestamp,
            updatedAt:
              timestamp
          }

          const items =
            buildItems({
              planificationId:
                planification.id,
              source,
              documentName:
                request.document.name,
              documentSha256:
                request.document.sha256,
              sectionIndex:
                selection.sectionIndex,
              assignmentId,
              timestamp
            })

          if (!items.length) {
            throw new Error(
              'A planificação anual não contém pontos de planificação válidos.'
            )
          }

          await maProfessorDb.planifications.add(
            planification
          )
          await maProfessorDb.planificationItems.bulkAdd(
            items
          )
          attached += 1
        }

        return {
          attached,
          skipped
        }
      }
    )

  if (result.attached) {
    markDashboardDataDirty()
  }

  return result
}
