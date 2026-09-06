import type {
  ParsedPlanificationPdfDocument,
  ParsedPlanificationPdfSection
} from './planificationPdfParser'

export type PlanificationPdfExistingPlanificationState =
  | 'yes'
  | 'no'
  | 'unknown'

export interface PlanificationPdfPreviewDestination {
  moduleId: string
  teachingAssignmentId: string
  code: string
  name: string
  label: string
  existingPlanification:
    PlanificationPdfExistingPlanificationState
}

export interface PlanificationPdfPreviewRow {
  key: string
  section: ParsedPlanificationPdfSection
  candidates: PlanificationPdfPreviewDestination[]
  suggestedDestinationId: string | null
  warnings: string[]
}

export interface PlanificationPdfPreview {
  sourceDocumentName: string
  warnings: string[]
  rows: PlanificationPdfPreviewRow[]
}

function unique(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(value => value.trim())
        .filter(Boolean)
    )
  )
}

export function buildPlanificationPdfPreview(
  parsed: ParsedPlanificationPdfDocument,
  destinations: PlanificationPdfPreviewDestination[]
): PlanificationPdfPreview {
  const rows =
    parsed.sections.map(
      (section, index) => {
        const candidates =
          section.code
            ? destinations.filter(
                destination =>
                  destination.code.trim() ===
                  section.code
              )
            : []

        const warnings = [
          ...section.warnings
        ]

        if (
          section.code &&
          candidates.length === 0
        ) {
          warnings.push(
            `Não existe uma UFCD com o código exato ${section.code} na turma e disciplina atualmente selecionadas.`
          )
        }

        if (
          candidates.length > 1
        ) {
          warnings.push(
            'Existem vários destinos possíveis. A escolha tem de ser feita manualmente.'
          )
        }

        if (
          candidates.some(
            candidate =>
              candidate.existingPlanification ===
              'yes'
          )
        ) {
          warnings.push(
            'O destino já possui uma planificação ativa. Nunca poderá ser substituída sem confirmação explícita.'
          )
        }

        if (
          candidates.some(
            candidate =>
              candidate.existingPlanification ===
              'unknown'
          )
        ) {
          warnings.push(
            'O estado de planificação existente deste destino ainda não foi confirmado pelo contrato de persistência. A gravação permanece bloqueada.'
          )
        }

        const safeCandidates =
          candidates.filter(
            candidate =>
              candidate.existingPlanification ===
              'no'
          )

        return {
          key:
            `${section.code || 'sem-codigo'}-${index}`,
          section,
          candidates,
          suggestedDestinationId:
            candidates.length === 1 &&
            safeCandidates.length === 1
              ? candidates[0].moduleId
              : null,
          warnings:
            unique(warnings)
        }
      }
    )

  return {
    sourceDocumentName:
      parsed.sourceDocumentName,
    warnings:
      unique(parsed.warnings),
    rows
  }
}
