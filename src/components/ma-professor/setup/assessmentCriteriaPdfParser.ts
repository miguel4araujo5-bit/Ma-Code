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
  AssessmentCriteriaPdfMetadata,
  CriteriaImportMetadataField,
  ParsedAssessmentCriteriaPdfDocument
} from './assessmentCriteriaPdfParserCore'

export type {
  AssessmentCriteriaPdfCandidate,
  AssessmentCriteriaPdfMetadata,
  CriteriaImportConfidence,
  CriteriaImportMetadataField,
  ParsedAssessmentCriteriaPdfDocument
} from './assessmentCriteriaPdfParserCore'

function clean(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferredField(
  document: PlanificationPdfDocument,
  patterns: RegExp[]
): CriteriaImportMetadataField | null {
  for (const page of document.pages) {
    for (const line of page.lines) {
      const sourceText = clean(line.text)

      for (const pattern of patterns) {
        const match = sourceText.match(pattern)
        const value = clean(match?.[1] ?? '')
          .replace(/^[:–—-]+\s*/, '')
          .replace(/\s*[-–—]\s*(?:profissionais?|ensino profissional)\s*$/i, '')
          .trim()

        if (value) {
          return {
            value,
            sourceText,
            sourcePage: page.pageNumber,
            confidence: 'high'
          }
        }
      }
    }
  }

  return null
}

function enrichMetadata(
  document: PlanificationPdfDocument,
  metadata: AssessmentCriteriaPdfMetadata
): AssessmentCriteriaPdfMetadata {
  return {
    subject:
      metadata.subject ??
      inferredField(
        document,
        [
          /\bcrit[eé]rios?\s+de\s+avalia[çc][ãa]o\s+da\s+disciplina\s+de\s+(.+?)(?=\s*[-–—]\s*(?:profissionais?|ensino)|$)/i,
          /\bcrit[eé]rios?\s+de\s+avalia[çc][ãa]o\s*[:–—-]\s*(.+)$/i,
          /\bdisciplina\s*:\s*(.+?)(?=\s+(?:m[oó]dulo|curso|n[.ºo]*\s*(?:aulas|horas)|professor(?:a)?)\b|$)/i
        ]
      ),
    course:
      metadata.course ??
      inferredField(
        document,
        [
          /\bcurso profissional(?:\s+de)?\s*[:–—-]?\s*(.+?)(?=\s+(?:disciplina|m[oó]dulo|ano\/turma|professor(?:a)?)\s*:|$)/i,
          /\bcurso\s*:\s*(.+)$/i
        ]
      ),
    grade:
      metadata.grade ??
      inferredField(
        document,
        [
          /\b((?:10|11|12)\s*(?:\.?\s*[ºo°])?\s*ano)\b/i,
          /\bano\s*\/\s*turma\s*:\s*((?:10|11|12)\s*(?:\.?\s*[ºo°])?)/i
        ]
      ),
    group:
      metadata.group ??
      inferredField(
        document,
        [
          /\bturma\s*:\s*((?:10|11|12)\s*(?:\.?\s*[ºo°])?\s*[A-Za-z])\b/i,
          /\bano\s*\/\s*turma\s*:\s*((?:10|11|12)\s*(?:\.?\s*[ºo°])?\s*[A-Za-z])\b/i
        ]
      )
  }
}

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
      metadata: enrichMetadata(
        document,
        matrix.metadata
      ),
      candidates: matrix.candidates,
      warnings: matrix.warnings
    }
  }

  const generic =
    parseGenericAssessmentCriteriaPdfDocument(
      document,
      sourceDocumentName
    )

  return {
    ...generic,
    metadata: enrichMetadata(
      document,
      generic.metadata
    )
  }
}
