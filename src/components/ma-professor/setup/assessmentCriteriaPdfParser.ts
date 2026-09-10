import type {
  PlanificationPdfDocument
} from '../planifications/planificationPdfParser'
import {
  parseAssessmentCriteriaPdfDocument as parseGenericAssessmentCriteriaPdfDocument
} from './assessmentCriteriaPdfParserCore'
import {
  parseProfessionalAssessmentCriteriaMatrix
} from './assessmentCriteriaProfessionalMatrixParser'
import type {
  ParsedAssessmentCriteriaPdfDocument
} from './assessmentCriteriaPdfParserCore'

export type {
  AssessmentCriteriaPdfCandidate,
  AssessmentCriteriaPdfMetadata,
  CriteriaImportConfidence,
  CriteriaImportMetadataField,
  ParsedAssessmentCriteriaPdfDocument
} from './assessmentCriteriaPdfParserCore'

export function parseAssessmentCriteriaPdfDocument(
  document: PlanificationPdfDocument,
  sourceDocumentName: string
): ParsedAssessmentCriteriaPdfDocument {
  const matrix =
    parseProfessionalAssessmentCriteriaMatrix(
      document
    )

  if (matrix) {
    return {
      sourceDocumentName,
      pageCount: document.pageCount,
      metadata: matrix.metadata,
      candidates: matrix.candidates,
      warnings: matrix.warnings
    }
  }

  return parseGenericAssessmentCriteriaPdfDocument(
    document,
    sourceDocumentName
  )
}
