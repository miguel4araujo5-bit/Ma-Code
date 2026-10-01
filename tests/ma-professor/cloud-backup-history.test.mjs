import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

test('encrypted history retains exactly two preceding generations and cascades on account deletion', async () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec('PRAGMA foreign_keys = ON')
    for (const file of ['0001_encrypted_sync.sql', '0002_encrypted_snapshot_history.sql']) {
      db.exec(await readFile(new URL(`../../migrations/ma-professor/${file}`, import.meta.url), 'utf8'))
    }
    db.exec(`INSERT INTO ma_professor_sync_profiles
      (account_id, recovery_kdf_algorithm, recovery_kdf_salt, recovery_kdf_parameters,
       recovery_key_wrap_algorithm, recovery_wrapped_master_key, recovery_wrapped_master_key_nonce,
       created_at, updated_at)
      VALUES ('test-account', 'fixture', 'salt', '{}', 'AES-GCM', 'wrapped', 'nonce', 1, 1)`)
    db.exec(`INSERT INTO ma_professor_encrypted_records
      (account_id, record_id, server_revision, record_revision, source_device_id_hash,
       encryption_version, encryption_algorithm, nonce, ciphertext, ciphertext_hash, created_at, updated_at)
      VALUES ('test-account', 'database-v1', 1, 1, 'device', 3, 'AES-GCM', 'nonce-1', 'cipher-1', 'hash-1', 1, 1)`)
    const update = db.prepare(`UPDATE ma_professor_encrypted_records
      SET server_revision=?, record_revision=?, nonce=?, ciphertext=?, ciphertext_hash=?, updated_at=?
      WHERE account_id='test-account'`)
    for (let revision = 2; revision <= 5; revision++) {
      update.run(revision, revision, `nonce-${revision}`, `cipher-${revision}`, `hash-${revision}`, revision)
    }
    const rows = db.prepare(`SELECT server_revision, ciphertext, nonce FROM ma_professor_encrypted_record_history
      ORDER BY server_revision`).all()
    assert.deepEqual(rows.map(row => ({ ...row })), [
      { server_revision: 3, ciphertext: 'cipher-3', nonce: 'nonce-3' },
      { server_revision: 4, ciphertext: 'cipher-4', nonce: 'nonce-4' }
    ])
    assert.equal(db.prepare('SELECT server_revision FROM ma_professor_encrypted_records').get().server_revision, 5)
    db.exec("DELETE FROM ma_professor_sync_profiles WHERE account_id='test-account'")
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ma_professor_encrypted_record_history').get().n, 0)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ma_professor_encrypted_records').get().n, 0)
  } finally {
    db.close()
  }
})
