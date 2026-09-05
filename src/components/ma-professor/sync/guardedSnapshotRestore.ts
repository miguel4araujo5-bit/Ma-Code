import {
  openMAProfessorDatabase
} from '../db'

import {
  createMAProfessorDatabaseSnapshot,
  restoreMAProfessorDatabaseSnapshot,
  type MAProfessorDatabaseSnapshot,
  type MAProfessorRestoreSnapshotResult
} from './databaseSnapshotService'

function snapshotContentSignature(
  snapshot:
    MAProfessorDatabaseSnapshot
) {
  return JSON.stringify({
    format:
      snapshot.format,

    formatVersion:
      snapshot.formatVersion,

    databaseName:
      snapshot.databaseName,

    databaseVersion:
      snapshot.databaseVersion,

    tables:
      snapshot.tables,

    recordCounts:
      snapshot.recordCounts
  })
}

export function hasMAProfessorSnapshotContentChanged(
  expected:
    MAProfessorDatabaseSnapshot,
  current:
    MAProfessorDatabaseSnapshot
) {
  return (
    snapshotContentSignature(
      expected
    ) !==
    snapshotContentSignature(
      current
    )
  )
}

export class MAProfessorLocalSnapshotChangedError
  extends Error {
  constructor() {
    super(
      'Os dados deste dispositivo foram alterados depois da comparação. Por segurança, nada foi substituído. Compare novamente com a cópia online antes de restaurar.'
    )

    this.name =
      'MAProfessorLocalSnapshotChangedError'
  }
}

export async function restoreMAProfessorDatabaseSnapshotIfLocalUnchanged(
  remoteSnapshot:
    MAProfessorDatabaseSnapshot,
  expectedLocalSnapshot:
    MAProfessorDatabaseSnapshot
): Promise<MAProfessorRestoreSnapshotResult> {
  const database =
    await openMAProfessorDatabase()

  /*
   * A comparação e o restauro decorrem dentro da mesma transação
   * readwrite sobre todas as tabelas.
   *
   * As transações internas usadas por create/restore são compatíveis
   * e reutilizam esta transação Dexie principal. Assim, outra aba não
   * pode introduzir uma escrita entre a verificação e a substituição.
   */
  return database.transaction(
    'rw',

    database.tables,

    async () => {
      const currentLocalSnapshot =
        await createMAProfessorDatabaseSnapshot()

      if (
        hasMAProfessorSnapshotContentChanged(
          expectedLocalSnapshot,
          currentLocalSnapshot
        )
      ) {
        throw new MAProfessorLocalSnapshotChangedError()
      }

      return restoreMAProfessorDatabaseSnapshot(
        remoteSnapshot
      )
    }
  )
}
