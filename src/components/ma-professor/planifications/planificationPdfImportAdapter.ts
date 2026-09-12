import {
  planificationImportRepository,
  type PlanificationImportBatchResult,
  type PlanificationImportMode
} from '../planificationImportRepository'
import {
  maProfessorRepository
} from '../repository'
import type {
  ParsedPlanificationPdfSection
} from './planificationPdfParser'

export interface PlanificationPdfImportDestination {
  academicYearId: string
  teachingAssignmentId: string
  moduleId: string
  code: string
  name: string
  label: string
  existingPlanification: 'yes' | 'no'
  stateFingerprint: string
}

export interface PlanificationPdfImportConfirmedRow {
  section: ParsedPlanificationPdfSection
  sectionOrdinal: number
  destination: PlanificationPdfImportDestination
  mode: PlanificationImportMode
  content: string
  objectives: string
  activity: string
  resources: string
  evaluation: string
  expectedStateFingerprint: string
}

const BULLET_MARKER =
  /^[•●○▪◦·]\s*/
const BULLET_ANYWHERE =
  /[•●○▪◦·]/

function normalizeLineBreaks(
  value: string
) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line =>
      line
        .trim()
        .replace(/\s+/g, ' ')
    )
    .filter(Boolean)
    .join('\n')
}

function cleanPlanificationPoint(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function dedupePlanificationPoints(
  values: string[]
) {
  const seen =
    new Set<string>()

  return values.filter(
    value => {
      const key =
        cleanPlanificationPoint(
          value
        ).toLocaleLowerCase(
          'pt-PT'
        )

      if (
        !key ||
        seen.has(key)
      ) {
        return false
      }

      seen.add(key)
      return true
    }
  )
}

export function splitPlanificationContentBlocks(
  value: string
) {
  const normalized =
    value
      .replace(/\r\n/g, '\n')
      .trim()

  if (!normalized) {
    return []
  }

  if (
    !BULLET_ANYWHERE.test(
      normalized
    )
  ) {
    return dedupePlanificationPoints(
      normalized
        .split('\n')
        .map(
          cleanPlanificationPoint
        )
        .filter(Boolean)
    )
  }

  const lines =
    normalized
      .replace(
        /([•●○▪◦·])\s*/g,
        '\n$1 '
      )
      .split('\n')
      .map(line =>
        line.trim()
      )
      .filter(Boolean)

  const points: string[] = []
  let current = ''

  for (const line of lines) {
    if (
      BULLET_MARKER.test(
        line
      )
    ) {
      if (current) {
        points.push(
          cleanPlanificationPoint(
            current
          )
        )
      }

      current = line
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
      cleanPlanificationPoint(
        current
      )
    )
  }

  return dedupePlanificationPoints(
    points
  )
}

function moduleLabel(
  code: string,
  name: string
) {
  const normalizedCode =
    code.trim()

  return normalizedCode
    ? `${normalizedCode} · ${name}`
    : name
}

function moduleKindLabel(
  code: string
) {
  return /^\d{3,6}$/.test(
    code.trim()
  )
    ? 'UFCD'
    : 'Módulo'
}

function courseLabel(
  value: string | null | undefined
) {
  const course =
    (value ?? '').trim()

  return course
    ? `Curso ${course}`
    : 'Curso não indicado'
}

export async function loadPlanificationPdfImportDestinations(
  academicYearId: string
): Promise<PlanificationPdfImportDestination[]> {
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

  const assignments =
    setup.teachingAssignments
      .filter(
        assignment =>
          assignment.active &&
          assignment.academicYearId ===
            academicYearId
      )

  const assignmentById =
    new Map(
      assignments.map(
        assignment => [
          assignment.id,
          assignment
        ]
      )
    )

  const candidates =
    setup.modules
      .filter(
        module =>
          module.active &&
          module.academicYearId ===
            academicYearId &&
          assignmentById.has(
            module.teachingAssignmentId
          )
      )
      .flatMap(
        module => {
          const assignment =
            assignmentById.get(
              module.teachingAssignmentId
            )

          if (!assignment) {
            return []
          }

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
              academicYearId,
              teachingAssignmentId:
                assignment.id,
              moduleId:
                module.id,
              code:
                module.code,
              name:
                module.name,
              label:
                `${group.name} · ${courseLabel(
                  group.courseName
                )} · ${
                  subject.shortName.trim() ||
                  subject.name
                } · ${moduleLabel(
                  module.code,
                  module.name
                )}`
            }
          ]
        }
      )

  const withState =
    await Promise.all(
      candidates.map(
        async candidate => {
          const state =
            await planificationImportRepository
              .getPlanificationImportDestinationState({
                academicYearId:
                  candidate.academicYearId,
                teachingAssignmentId:
                  candidate.teachingAssignmentId,
                moduleId:
                  candidate.moduleId
              })

          return {
            ...candidate,
            existingPlanification:
              state.hasActivePlanification
                ? 'yes' as const
                : 'no' as const,
            stateFingerprint:
              state.stateFingerprint
          }
        }
      )
    )

  return withState.sort(
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
}

export async function sha256PlanificationPdf(
  file: File
) {
  const subtle =
    globalThis.crypto?.subtle

  if (!subtle) {
    throw new Error(
      'Este dispositivo não disponibiliza SHA-256 para validar a importação.'
    )
  }

  const digest =
    await subtle.digest(
      'SHA-256',
      await file.arrayBuffer()
    )

  return Array.from(
    new Uint8Array(
      digest
    )
  )
    .map(byte =>
      byte
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
}

function titleForSection(
  section: ParsedPlanificationPdfSection
) {
  const code =
    section.code.trim()
  const name =
    section.name.trim()
  const kind =
    moduleKindLabel(
      code
    )

  if (
    code &&
    name
  ) {
    return `Planificação — ${kind} ${code} · ${name}`
  }

  if (code) {
    return `Planificação — ${kind} ${code}`
  }

  return name
    ? `Planificação — ${name}`
    : 'Planificação importada'
}

function contextBlock(
  label: string,
  value: string
) {
  const text =
    normalizeLineBreaks(
      value
    )

  return text
    ? `${label}:\n${text}`
    : ''
}

function descriptionForRow(
  row: PlanificationPdfImportConfirmedRow
) {
  const periodLabel =
    normalizeLineBreaks(
      row.section.periodLabel
    )

  return [
    periodLabel,
    row.section.durationHours !== null
      ? `Duração no documento: ${row.section.durationHours} horas.`
      : '',
    row.section.plannedLessons !== null
      ? `Aulas previstas no documento: ${row.section.plannedLessons}.`
      : '',
    contextBlock(
      'Metodologia/estratégias',
      row.activity
    ),
    contextBlock(
      'Recursos',
      row.resources
    ),
    contextBlock(
      'Avaliação',
      row.evaluation
    )
  ]
    .filter(Boolean)
    .join('\n')
}

function semanticPlanificationPoints(
  content: string,
  objectives: string
) {
  const contents =
    splitPlanificationContentBlocks(
      content
    )
  const objectivePoints =
    splitPlanificationContentBlocks(
      objectives
    )

  if (!contents.length) {
    return objectivePoints.map(
      objective => ({
        content: objective,
        objectives: ''
      })
    )
  }

  return contents.map(
    (
      contentPoint,
      index
    ) => ({
      content:
        contentPoint,
      objectives:
        index ===
          contents.length - 1
          ? objectivePoints
              .slice(index)
              .join('\n')
          : objectivePoints[
              index
            ] ?? ''
    })
  )
}

function itemsForRow(
  row: PlanificationPdfImportConfirmedRow
) {
  if (row.mode === 'skip') {
    return []
  }

  return semanticPlanificationPoints(
    row.content,
    row.objectives
  ).map(
    point => ({
      content:
        point.content,
      objectives:
        point.objectives,
      activity: '',
      resources: '',
      evaluation: '',
      suggestedSummary: '',
      sourcePages: [
        ...row.section
          .sourcePages
      ]
    })
  )
}

export async function commitPlanificationPdfImport(
  file: File,
  rows: PlanificationPdfImportConfirmedRow[]
): Promise<PlanificationImportBatchResult> {
  if (!rows.length) {
    throw new Error(
      'Selecione pelo menos uma UFCD para importar.'
    )
  }

  const documentSha256 =
    await sha256PlanificationPdf(
      file
    )

  return planificationImportRepository
    .commitPlanificationImportBatch({
      confirmed: true,
      document: {
        name:
          file.name,
        sha256:
          documentSha256
      },
      entries:
        rows.map(
          row => ({
            academicYearId:
              row.destination
                .academicYearId,
            teachingAssignmentId:
              row.destination
                .teachingAssignmentId,
            moduleId:
              row.destination
                .moduleId,
            mode:
              row.mode,
            expectedStateFingerprint:
              row.expectedStateFingerprint,
            source: {
              pages: [
                ...row.section
                  .sourcePages
              ],
              sectionOrdinal:
                row.sectionOrdinal
            },
            planification: {
              title:
                titleForSection(
                  row.section
                ),
              description:
                descriptionForRow(
                  row
                )
            },
            items:
              itemsForRow(
                row
              )
          })
        )
    })
}
