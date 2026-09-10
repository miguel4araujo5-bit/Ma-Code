-- MA-Professor
-- Mantém duas gerações cifradas anteriores para cada registo online.
--
-- A cópia atual continua em ma_professor_encrypted_records.
-- O histórico guarda apenas os mesmos dados já cifrados no dispositivo;
-- nenhum conteúdo pedagógico é desencriptado ou duplicado em claro no D1.
--
-- A rotação é feita pelo próprio SQLite/D1 quando uma atualização válida
-- avança simultaneamente server_revision e record_revision. Assim, o fluxo
-- atual do Worker, incluindo o controlo otimista por revisão/409, não precisa
-- de ser alterado nesta fase.

CREATE TABLE IF NOT EXISTS ma_professor_encrypted_record_history (
  account_id TEXT NOT NULL,
  record_id TEXT NOT NULL,

  server_revision INTEGER NOT NULL
    CHECK (server_revision >= 1),

  record_revision INTEGER NOT NULL
    CHECK (record_revision >= 1),

  source_device_id_hash TEXT NOT NULL,

  encryption_version INTEGER NOT NULL DEFAULT 1
    CHECK (encryption_version >= 1),

  encryption_algorithm TEXT NOT NULL,
  nonce TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  ciphertext_hash TEXT NOT NULL,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER NOT NULL,

  PRIMARY KEY (
    account_id,
    record_id,
    server_revision
  ),

  FOREIGN KEY (account_id)
    REFERENCES ma_professor_sync_profiles(account_id)
    ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS trg_ma_professor_archive_encrypted_record
BEFORE UPDATE ON ma_professor_encrypted_records
FOR EACH ROW
WHEN
  OLD.deleted_at IS NULL
  AND NEW.server_revision > OLD.server_revision
  AND NEW.record_revision > OLD.record_revision
BEGIN
  INSERT INTO ma_professor_encrypted_record_history (
    account_id,
    record_id,
    server_revision,
    record_revision,
    source_device_id_hash,
    encryption_version,
    encryption_algorithm,
    nonce,
    ciphertext,
    ciphertext_hash,
    created_at,
    updated_at,
    archived_at
  )
  VALUES (
    OLD.account_id,
    OLD.record_id,
    OLD.server_revision,
    OLD.record_revision,
    OLD.source_device_id_hash,
    OLD.encryption_version,
    OLD.encryption_algorithm,
    OLD.nonce,
    OLD.ciphertext,
    OLD.ciphertext_hash,
    OLD.created_at,
    OLD.updated_at,
    NEW.updated_at
  );

  DELETE FROM ma_professor_encrypted_record_history
  WHERE account_id = OLD.account_id
    AND record_id = OLD.record_id
    AND server_revision NOT IN (
      SELECT server_revision
      FROM ma_professor_encrypted_record_history
      WHERE account_id = OLD.account_id
        AND record_id = OLD.record_id
      ORDER BY server_revision DESC
      LIMIT 2
    );
END;
