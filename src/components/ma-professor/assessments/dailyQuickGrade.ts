export type QuickGradeStatus =
  | 'not_evaluated'
  | 'evaluated'
  | 'absent'
  | 'exempt'

export interface QuickGradeRowLike {
  status: QuickGradeStatus
}

export interface QuickGradeCriterionLike {
  id: string
  name?: string
}

export interface QuickGradeAssessmentLike {
  criterionId: string
}

export function resolveQuickGradeStatus(
  currentStatus: QuickGradeStatus,
  rawScore: string
): QuickGradeStatus {
  if (rawScore.trim()) {
    return 'evaluated'
  }

  if (
    currentStatus === 'absent' ||
    currentStatus === 'exempt'
  ) {
    return currentStatus
  }

  return 'not_evaluated'
}

export function hasQuickGradeData(
  rows: QuickGradeRowLike[]
) {
  return rows.some(
    row =>
      row.status !== 'not_evaluated'
  )
}

export function resolveQuickCriterionId(
  criteria: QuickGradeCriterionLike[],
  assessments: QuickGradeAssessmentLike[]
) {
  if (criteria.length === 1) {
    return criteria[0].id
  }

  if (criteria.length === 0) {
    return ''
  }

  const activeCriterionIds =
    new Set(
      criteria.map(
        criterion => criterion.id
      )
    )

  for (
    let index = assessments.length - 1;
    index >= 0;
    index -= 1
  ) {
    const criterionId =
      assessments[index]?.criterionId

    if (
      criterionId &&
      activeCriterionIds.has(
        criterionId
      )
    ) {
      return criterionId
    }
  }

  return ''
}

function formatISODate(
  value: string
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value
    )

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]}`
}

export function buildQuickAssessmentTitle(
  lessonDate: string,
  criterionName: string | undefined
) {
  const prefix =
    criterionName?.trim() ||
    'Avaliação'

  return `${prefix} · ${formatISODate(
    lessonDate
  )}`
}
