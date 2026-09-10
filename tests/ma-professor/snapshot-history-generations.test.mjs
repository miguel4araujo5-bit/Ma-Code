import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationSource = await readFile(
  new URL(
    '../../migrations/ma-professor/0002_encrypted_snapshot_history.sql',
    import.meta.url
  ),
  'utf8'
)

const snapshotWorkerSource = await readFile(
  new URL(
    '../../worker/maProfessorSnapshot.ts',
    import.meta.url
  ),
  'utf8'
)

const accountAdminSource = await readFile(
  new URL(
    '../../worker/maProfessorAccountAdmin.ts',
    import.meta.url
  ),
  'utf8'
)

function compactSql(
  source
) {
  return source
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const compactMigration =
  compactSql(
    migrationSource
  )

const compactSnapshotWorker =
  compactSql(
    snapshotWorkerSource
  )

const compactAccountAdmin =
  compactSql(
    accountAdminSource
  )

test(
  'snapshot history migration is additive and preserves the current encrypted-record table',
  () => {
    assert.match(
      compactMigration,
      /CREATE TABLE IF NOT EXISTS ma_professor_encrypted_record_history/i
    )

    assert.doesNotMatch(
      compactMigration,
      /ALTER TABLE ma_professor_encrypted_records/i
    )

    assert.doesNotMatch(
      compactMigration,
      /DROP TABLE/i
    )

    assert.doesNotMatch(
      compactMigration,
      /DELETE FROM ma_professor_encrypted_records/i
    )
  }
)

test(
  'history rows keep the original encrypted payload and are deleted with the account profile',
  () => {
    assert.match(
      compactMigration,
      /PRIMARY KEY \( account_id, record_id, server_revision \)/i
    )

    assert.match(
      compactMigration,
      /FOREIGN KEY \(account_id\) REFERENCES ma_professor_sync_profiles\(account_id\) ON DELETE CASCADE/i
    )

    for (
      const field of [
        'record_id',
        'server_revision',
        'record_revision',
        'source_device_id_hash',
        'encryption_version',
        'encryption_algorithm',
        'nonce',
        'ciphertext',
        'ciphertext_hash',
        'created_at',
        'updated_at'
      ]
    ) {
      assert.match(
        compactMigration,
        new RegExp(
          `OLD\\.${field}`,
          'i'
        ),
        `O histórico deve preservar OLD.${field}.`
      )
    }
  }
)

test(
  'a generation is archived only when both server and record revisions advance',
  () => {
    assert.match(
      compactMigration,
      /CREATE TRIGGER IF NOT EXISTS trg_ma_professor_archive_encrypted_record BEFORE UPDATE ON ma_professor_encrypted_records/i
    )

    assert.match(
      compactMigration,
      /OLD\.deleted_at IS NULL/i
    )

    assert.match(
      compactMigration,
      /NEW\.server_revision > OLD\.server_revision/i
    )

    assert.match(
      compactMigration,
      /NEW\.record_revision > OLD\.record_revision/i
    )
  }
)

test(
  'rotation retains exactly the two newest historical generations for each encrypted record',
  () => {
    assert.match(
      compactMigration,
      /DELETE FROM ma_professor_encrypted_record_history WHERE account_id = OLD\.account_id AND record_id = OLD\.record_id/i
    )

    assert.match(
      compactMigration,
      /ORDER BY server_revision DESC LIMIT 2/i
    )
  }
)

test(
  'the existing worker remains the owner of optimistic concurrency and the current snapshot',
  () => {
    assert.match(
      compactSnapshotWorker,
      /INSERT INTO ma_professor_encrypted_records/i
    )

    assert.match(
      compactSnapshotWorker,
      /FROM ma_professor_sync_profiles WHERE account_id = \? AND server_revision = \? AND deleted_at IS NULL/i
    )

    assert.match(
      compactSnapshotWorker,
      /ON CONFLICT\(account_id, record_id\) DO UPDATE SET/i
    )

    assert.match(
      compactSnapshotWorker,
      /server_revision = excluded\.server_revision/i
    )

    assert.match(
      compactSnapshotWorker,
      /record_revision = excluded\.record_revision/i
    )

    assert.doesNotMatch(
      compactSnapshotWorker,
      /ma_professor_encrypted_record_history/i
    )
  }
)

test(
  'permanent account deletion still removes the profile inside the existing D1 batch so history cascades with it',
  () => {
    assert.match(
      compactAccountAdmin,
      /MA_PROFESSOR_DB \.batch\(\[/i
    )

    assert.match(
      compactAccountAdmin,
      /DELETE FROM ma_professor_sync_profiles WHERE account_id IN/i
    )

    assert.match(
      compactMigration,
      /REFERENCES ma_professor_sync_profiles\(account_id\) ON DELETE CASCADE/i
    )
  }
)

test(
  'D1 trigger body uses the migration-safe uppercase BEGIN token and LF line endings',
  () => {
    assert.match(
      migrationSource,
      /\nBEGIN\n/
    )

    assert.doesNotMatch(
      migrationSource,
      /\r/
    )
  }
)
