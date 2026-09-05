import type {
  BackupValidationIssue,
  MAProfessorBackupData
} from '../types'

import {
  validateMAProfessorBackupDataIntegrity
} from '../settings/backupValidation'

export class MAProfessorSnapshotIntegrityError
  extends Error {
  readonly issues:
    BackupValidationIssue[]

  constructor(
    issues:
      BackupValidationIssue[]
  ) {
    const first =
      issues[0]

    super(
      first
        ? `A cópia online contém dados incoerentes em “${first.path}”: ${first.message}`
        : 'A cópia online contém dados incoerentes.'
    )

    this.name =
      'MAProfessorSnapshotIntegrityError'

    this.issues =
      issues
  }
}

export function assertMAProfessorSnapshotDataIntegrity(
  tables:
    MAProfessorBackupData
) {
  const blockingIssues =
    validateMAProfessorBackupDataIntegrity(
      tables
    ).filter(
      issue =>
        issue.severity ===
          'error'
    )

  if (
    blockingIssues.length >
      0
  ) {
    throw new MAProfessorSnapshotIntegrityError(
      blockingIssues
    )
  }
}
