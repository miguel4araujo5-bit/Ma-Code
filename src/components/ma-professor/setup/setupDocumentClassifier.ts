import {
  parsePlanificationPdfDocument,
  type PlanificationPdfDocument
} from '../planifications/planificationPdfParser'
import {
  parseAssessmentCriteriaPdfDocument
} from './assessmentCriteriaPdfParser'

export type SetupImportDocumentKind =
  | 'schedule'
  | 'planification'
  | 'criteria'
  | 'unknown'

export type SetupImportConfidence =
  | 'high'
  | 'medium'
  | 'low'

export interface SetupDocumentClassification {
  kind: SetupImportDocumentKind
  confidence: SetupImportConfidence
  evidence: string[]
  warnings: string[]
  scores: {
    schedule: number
    planification: number
    criteria: number
  }
  summary: {
    pageCount: number
    scheduleTimeRanges: number
    scheduleWeekdays: number
    detectedGroups: string[]
    planificationSections: number
    criteriaCandidates: number
    criteriaWeightTotal: number | null
    subjectLabel: string
    courseLabel: string
  }
}

type CandidateKind = Exclude<
  SetupImportDocumentKind,
  'unknown'
>

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function unique(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const key = normalize(value)

    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(value.trim().replace(/\s+/g, ' '))
  }

  return result
}

function documentText(document: PlanificationPdfDocument) {
  return document.pages
    .flatMap(page => page.lines.map(line => line.text))
    .join('\n')
}

function countMatches(value: string, pattern: RegExp) {
  return Array.from(value.matchAll(pattern)).length
}

function countWeekdays(value: string) {
  const normalized = normalize(value)
  const weekdays = [
    /\bsegunda(?:-feira)?\b/g,
    /\bterca(?:-feira)?\b/g,
    /\bquarta(?:-feira)?\b/g,
    /\bquinta(?:-feira)?\b/g,
    /\bsexta(?:-feira)?\b/g,
    /\bsabado\b/g,
    /\bdomingo\b/g
  ]

  return weekdays.reduce(
    (total, pattern) =>
      total + (pattern.test(normalized) ? 1 : 0),
    0
  )
}

function detectGroups(value: string) {
  const results = Array.from(
    value.matchAll(
      /\b(10|11|12)\s*(?:\.?\s*[ºo°])?\s*[-–—.]?\s*([A-Za-z])\b/gi
    ),
    match =>
      `${match[1]}.º ${match[2].toLocaleUpperCase('pt-PT')}`
  )

  return unique(results)
}

function criteriaWeightTotal(
  candidates: ReturnType<
    typeof parseAssessmentCriteriaPdfDocument
  >['candidates']
) {
  if (
    candidates.length === 0 ||
    candidates.some(candidate =>
      candidate.weightPercent === null
    )
  ) {
    return null
  }

  return candidates.reduce(
    (total, candidate) =>
      total + (candidate.weightPercent ?? 0),
    0
  )
}

function filenameEvidence(
  fileName: string,
  scores: Record<CandidateKind, number>,
  evidence: Record<CandidateKind, string[]>
) {
  const name = normalize(fileName)

  if (/\bhorario\b/.test(name)) {
    scores.schedule += 6
    evidence.schedule.push('O nome do ficheiro indica um horário.')
  }

  if (/\bplanificac(?:ao|oes)\b/.test(name)) {
    scores.planification += 6
    evidence.planification.push('O nome do ficheiro indica uma planificação.')
  }

  if (/\bcriterios?\b/.test(name)) {
    scores.criteria += 6
    evidence.criteria.push('O nome do ficheiro indica critérios de avaliação.')
  }
}

function chooseKind(
  scores: Record<CandidateKind, number>
) {
  const ranked = (
    Object.entries(scores) as Array<
      [CandidateKind, number]
    >
  ).sort((left, right) => right[1] - left[1])

  const [bestKind, bestScore] = ranked[0]
  const secondScore = ranked[1]?.[1] ?? 0
  const margin = bestScore - secondScore

  if (bestScore < 6) {
    return {
      kind: 'unknown' as const,
      confidence: 'low' as const
    }
  }

  if (bestScore >= 12 && margin >= 4) {
    return {
      kind: bestKind,
      confidence: 'high' as const
    }
  }

  if (bestScore >= 8 && margin >= 2) {
    return {
      kind: bestKind,
      confidence: 'medium' as const
    }
  }

  return {
    kind: 'unknown' as const,
    confidence: 'low' as const
  }
}

export function classifySetupPdfDocument(
  document: PlanificationPdfDocument,
  fileName: string
): SetupDocumentClassification {
  const text = documentText(document)
  const normalizedText = normalize(text)
  const planification =
    parsePlanificationPdfDocument(
      document,
      fileName
    )
  const criteria =
    parseAssessmentCriteriaPdfDocument(
      document,
      fileName
    )

  const scores: Record<CandidateKind, number> = {
    schedule: 0,
    planification: 0,
    criteria: 0
  }
  const evidence: Record<CandidateKind, string[]> = {
    schedule: [],
    planification: [],
    criteria: []
  }

  filenameEvidence(
    fileName,
    scores,
    evidence
  )

  const scheduleTimeRanges =
    countMatches(
      text,
      /\b(?:[01]?\d|2[0-3])[:hH.]\s*[0-5]\d\s*(?:-|–|—|a|as|às?)\s*(?:[01]?\d|2[0-3])[:hH.]\s*[0-5]\d\b/gi
    )
  const scheduleWeekdays =
    countWeekdays(text)
  const groups =
    detectGroups(text)

  if (scheduleWeekdays >= 3) {
    scores.schedule += 6
    evidence.schedule.push(
      `Foram identificados ${scheduleWeekdays} dias da semana.`
    )
  } else if (scheduleWeekdays >= 2) {
    scores.schedule += 3
  }

  if (scheduleTimeRanges >= 3) {
    scores.schedule += 7
    evidence.schedule.push(
      `Foram identificados ${scheduleTimeRanges} intervalos horários.`
    )
  } else if (scheduleTimeRanges >= 1) {
    scores.schedule += 2
  }

  if (groups.length > 0) {
    scores.schedule += 2
    evidence.schedule.push(
      `Foram identificadas referências a turma: ${groups.join(', ')}.`
    )
  }

  if (/\bhorario\b/.test(normalizedText)) {
    scores.schedule += 4
  }

  if (/\bplanificac(?:ao|oes)\b/.test(normalizedText)) {
    scores.planification += 7
    evidence.planification.push(
      'O conteúdo identifica explicitamente uma planificação.'
    )
  }

  if (planification.sections.length > 0) {
    scores.planification += 7
    evidence.planification.push(
      `${planification.sections.length} UFCD/módulo${planification.sections.length === 1 ? '' : 's'} foram reconhecido${planification.sections.length === 1 ? '' : 's'} pelo parser de planificações.`
    )
  }

  if (
    /\b(?:temas?|conteudos?)\b/.test(normalizedText) &&
    /\b(?:objetivos?|competencias?)\b/.test(normalizedText)
  ) {
    scores.planification += 3
  }

  if (/\b(?:ufcd|modulo)\b/.test(normalizedText)) {
    scores.planification += 2
  }

  const knownWeightTotal =
    criteriaWeightTotal(criteria.candidates)

  if (/\bcriterios?\s+de\s+avaliacao\b/.test(normalizedText)) {
    scores.criteria += 8
    evidence.criteria.push(
      'O conteúdo identifica explicitamente critérios de avaliação.'
    )
  }

  if (criteria.candidates.length > 0) {
    scores.criteria += 5
    evidence.criteria.push(
      `${criteria.candidates.length} critério${criteria.candidates.length === 1 ? '' : 's'} ponderado${criteria.candidates.length === 1 ? '' : 's'} foi/foram reconhecido${criteria.candidates.length === 1 ? '' : 's'} pelo parser de critérios.`
    )
  }

  if (
    knownWeightTotal !== null &&
    Math.abs(knownWeightTotal - 100) <= 0.001
  ) {
    scores.criteria += 5
    evidence.criteria.push(
      'As ponderações reconhecidas totalizam 100%.'
    )
  }

  if (/\bponderacao\b/.test(normalizedText)) {
    scores.criteria += 2
  }

  if (/\bdominios?\b/.test(normalizedText)) {
    scores.criteria += 2
  }

  const selected = chooseKind(scores)
  const selectedEvidence =
    selected.kind === 'unknown'
      ? [
          'Os sinais encontrados não permitem escolher um importador com segurança.'
        ]
      : evidence[selected.kind]

  const warnings = selected.kind === 'unknown'
    ? [
        'Escolha manualmente o tipo de documento antes de o usar na configuração.'
      ]
    : []

  if (
    selected.kind === 'criteria' &&
    knownWeightTotal !== null &&
    Math.abs(knownWeightTotal - 100) > 0.001
  ) {
    warnings.push(
      `Os critérios reconhecidos totalizam ${knownWeightTotal}%; a proposta deve ser revista antes de guardar.`
    )
  }

  return {
    kind: selected.kind,
    confidence: selected.confidence,
    evidence: selectedEvidence,
    warnings,
    scores: {
      schedule: scores.schedule,
      planification: scores.planification,
      criteria: scores.criteria
    },
    summary: {
      pageCount: document.pageCount,
      scheduleTimeRanges,
      scheduleWeekdays,
      detectedGroups: groups,
      planificationSections:
        planification.sections.length,
      criteriaCandidates:
        criteria.candidates.length,
      criteriaWeightTotal:
        knownWeightTotal,
      subjectLabel:
        criteria.metadata.subject?.value ?? '',
      courseLabel:
        criteria.metadata.course?.value ?? ''
    }
  }
}
