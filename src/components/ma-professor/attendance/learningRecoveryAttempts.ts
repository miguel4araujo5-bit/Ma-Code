import type {
  ISODateTime,
  LearningRecovery
} from '../types'

export const MAX_LEARNING_RECOVERY_ATTEMPTS = 3

export type LearningRecoveryOutcome =
  | 'successful'
  | 'unsuccessful'

export type LearningRecoveryAttemptRecord =
  LearningRecovery & {
    outcome?: LearningRecoveryOutcome | null
    referredToExamAt?: ISODateTime | null
  }

export interface LearningRecoveryAttemptSummary {
  attempts: LearningRecoveryAttemptRecord[]
  attemptCount: number
  hasActiveAttempt: boolean
  hasSuccessfulAttempt: boolean
  referredToExamAt: ISODateTime | null
  canCreateNextAttempt: boolean
  canReferToExam: boolean
  nextAttemptNumber: number | null
}

export function sortLearningRecoveryAttempts(
  recoveries: LearningRecovery[]
) {
  return recoveries
    .map(
      recovery =>
        recovery as LearningRecoveryAttemptRecord
    )
    .sort(
      (left, right) =>
        left.triggeredAt.localeCompare(
          right.triggeredAt
        ) ||
        left.createdAt.localeCompare(
          right.createdAt
        ) ||
        left.id.localeCompare(right.id)
    )
}

export function summarizeLearningRecoveryAttempts(
  recoveries: LearningRecovery[]
): LearningRecoveryAttemptSummary {
  const attempts =
    sortLearningRecoveryAttempts(
      recoveries
    )

  const attemptCount =
    attempts.length

  const hasActiveAttempt =
    attempts.some(
      attempt =>
        attempt.status !== 'completed'
    )

  const hasSuccessfulAttempt =
    attempts.some(
      attempt =>
        attempt.status === 'completed' &&
        attempt.outcome === 'successful'
    )

  const referredToExamAt =
    attempts
      .map(
        attempt =>
          attempt.referredToExamAt ?? null
      )
      .find(Boolean) ??
    null

  const latestAttempt =
    attempts.at(-1) ?? null

  const latestAllowsAnotherAttempt =
    latestAttempt !== null &&
    latestAttempt.status === 'completed' &&
    latestAttempt.outcome === 'unsuccessful'

  const canCreateNextAttempt =
    attemptCount > 0 &&
    attemptCount <
      MAX_LEARNING_RECOVERY_ATTEMPTS &&
    !hasActiveAttempt &&
    !hasSuccessfulAttempt &&
    !referredToExamAt &&
    latestAllowsAnotherAttempt

  const firstThree =
    attempts.slice(
      0,
      MAX_LEARNING_RECOVERY_ATTEMPTS
    )

  const canReferToExam =
    attemptCount >=
      MAX_LEARNING_RECOVERY_ATTEMPTS &&
    firstThree.length ===
      MAX_LEARNING_RECOVERY_ATTEMPTS &&
    firstThree.every(
      attempt =>
        attempt.status === 'completed' &&
        attempt.outcome === 'unsuccessful'
    ) &&
    !hasSuccessfulAttempt &&
    !referredToExamAt

  return {
    attempts,
    attemptCount,
    hasActiveAttempt,
    hasSuccessfulAttempt,
    referredToExamAt,
    canCreateNextAttempt,
    canReferToExam,
    nextAttemptNumber:
      canCreateNextAttempt
        ? attemptCount + 1
        : null
  }
}

export function getLearningRecoveryOutcomeLabel(
  outcome:
    LearningRecoveryOutcome | null | undefined
) {
  if (outcome === 'successful') {
    return 'Com sucesso'
  }

  if (outcome === 'unsuccessful') {
    return 'Sem sucesso'
  }

  return 'Resultado por classificar'
}
