import type {
  ISODate,
  ISODateTime,
  LearningRecoveryOrigin,
  LearningRecoveryStatus
} from '../types'

export interface RecoveryLifecycleCandidate {
  origin?: LearningRecoveryOrigin
  status: LearningRecoveryStatus
  teacherTouchedAt?: ISODateTime | null
  contents: string
  activity: string
  plannedDate: ISODate | null
  result: string
}

export function canAutomaticallyRemoveRecovery(
  recovery: RecoveryLifecycleCandidate
) {
  return (
    recovery.origin ===
      'automatic_threshold' &&
    recovery.status ===
      'pending' &&
    !recovery.teacherTouchedAt &&
    !recovery.contents.trim() &&
    !recovery.activity.trim() &&
    recovery.plannedDate ===
      null &&
    !recovery.result.trim()
  )
}
