import type {
  ClassGroup,
  FirstCycleQualitativeGrade,
  Score
} from '../types'

export type SummativeAssessmentScaleKind =
  | 'qualitative'
  | 'level_1_5'
  | 'score_0_20'
  | 'unsupported'

export interface SummativeAssessmentScale {
  kind: SummativeAssessmentScaleKind
  min: number | null
  max: number | null
  inputLabel: string
  placeholder: string
  description: string
}

export const FIRST_CYCLE_QUALITATIVE_GRADES:
  readonly FirstCycleQualitativeGrade[] = [
    'Muito Bom',
    'Bom',
    'Suficiente',
    'Insuficiente'
  ]

const PROFESSIONAL_SCALE: SummativeAssessmentScale = {
  kind: 'score_0_20',
  min: 0,
  max: 20,
  inputLabel: 'Classificação final',
  placeholder: '0–20',
  description: 'Escala numérica de 0 a 20 valores.'
}

const REGULAR_BASIC_SCALE: SummativeAssessmentScale = {
  kind: 'level_1_5',
  min: 1,
  max: 5,
  inputLabel: 'Nível final',
  placeholder: '1–5',
  description: 'Escala numérica de 1 a 5.'
}

const REGULAR_FIRST_CYCLE_SCALE: SummativeAssessmentScale = {
  kind: 'qualitative',
  min: null,
  max: null,
  inputLabel: 'Menção qualitativa',
  placeholder: '',
  description:
    'No 1.º ciclo, a avaliação sumativa é qualitativa e acompanhada de apreciação descritiva. O MA-Professor não converte automaticamente médias numéricas em menções.'
}

const UNSUPPORTED_SCALE: SummativeAssessmentScale = {
  kind: 'unsupported',
  min: null,
  max: null,
  inputLabel: 'Classificação final',
  placeholder: '',
  description:
    'Não foi possível determinar com segurança a escala de avaliação desta turma.'
}

export function parseGroupGradeLevel(
  group: ClassGroup | null | undefined
) {
  if (!group) {
    return null
  }

  const value =
    Number.parseInt(
      group.gradeLevel.trim(),
      10
    )

  return Number.isInteger(value) &&
    value >= 1 &&
    value <= 12
    ? value
    : null
}

export function getSummativeAssessmentScale(
  group: ClassGroup | null | undefined
): SummativeAssessmentScale {
  if (
    !group ||
    group.educationType !== 'regular'
  ) {
    return PROFESSIONAL_SCALE
  }

  const gradeLevel =
    parseGroupGradeLevel(group)

  if (gradeLevel === null) {
    return UNSUPPORTED_SCALE
  }

  if (gradeLevel <= 4) {
    return REGULAR_FIRST_CYCLE_SCALE
  }

  if (gradeLevel <= 9) {
    return REGULAR_BASIC_SCALE
  }

  return PROFESSIONAL_SCALE
}

export function isFirstCycleQualitativeGrade(
  value: unknown
): value is FirstCycleQualitativeGrade {
  return (
    typeof value === 'string' &&
    FIRST_CYCLE_QUALITATIVE_GRADES.includes(
      value as FirstCycleQualitativeGrade
    )
  )
}

export function validateSummativeNumericValue(
  group: ClassGroup | null | undefined,
  value: Score,
  label: 'classificação final' | 'autoavaliação'
) {
  const scale =
    getSummativeAssessmentScale(group)

  if (
    scale.kind === 'qualitative'
  ) {
    throw new Error(
      `A ${label} do 1.º ciclo não pode ser guardada como nota numérica. Use uma menção qualitativa.`
    )
  }

  if (
    scale.kind === 'unsupported' ||
    scale.min === null ||
    scale.max === null
  ) {
    throw new Error(
      'Não foi possível determinar com segurança a escala de avaliação desta turma.'
    )
  }

  if (
    !Number.isInteger(value) ||
    value < scale.min ||
    value > scale.max
  ) {
    throw new Error(
      scale.kind === 'level_1_5'
        ? `A ${label} deve ser um número inteiro entre 1 e 5.`
        : `A ${label} deve ser um número inteiro entre 0 e 20 valores.`
    )
  }

  return value
}

export function usesNumericSuggestion(
  group: ClassGroup | null | undefined
) {
  return getSummativeAssessmentScale(group)
    .kind === 'score_0_20'
}
