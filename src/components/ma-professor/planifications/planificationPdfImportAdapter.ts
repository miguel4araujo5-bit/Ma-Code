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
                `${group.name} · ${
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

  if (
    code &&
    name
  ) {
    return `Planificação — UFCD ${code} · ${name}`
  }

  if (code) {
    return `Planificação — UFCD ${code}`
  }

  return name
    ? `Planificação — ${name}`
    : 'Planificação importada'
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
              description: ''
            },
            items:
              row.mode === 'skip'
                ? []
                : [
                    {
                      content:
                        normalizeLineBreaks(
                          row.content
                        ),
                      objectives:
                        normalizeLineBreaks(
                          row.objectives
                        ),
                      activity:
                        normalizeLineBreaks(
                          row.activity
                        ),
                      resources:
                        normalizeLineBreaks(
                          row.resources
                        ),
                      evaluation:
                        normalizeLineBreaks(
                          row.evaluation
                        ),
                      suggestedSummary: '',
                      sourcePages: [
                        ...row.section
                          .sourcePages
                      ]
                    }
                  ]
          })
        )
    })
}
