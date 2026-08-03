-- MA-Professor
-- Esquema inicial para sincronização cifrada.
--
-- Esta base não possui colunas para nomes de alunos, turmas,
-- sumários, faltas, classificações ou planificações.
--
-- Os conteúdos pedagógicos serão cifrados no dispositivo
-- antes de serem enviados para o Worker e para o D1.

CREATE TABLE IF NOT EXISTS ma_professor_sync_profiles (
  account_id TEXT PRIMARY KEY NOT NULL,

  server_revision INTEGER NOT NULL DEFAULT 0
    CHECK (server_revision >= 0),

  crypto_version INTEGER NOT NULL DEFAULT 1
    CHECK (crypto_version >= 1),

  recovery_kdf_algorithm TEXT NOT NULL,
  recovery_kdf_salt TEXT NOT NULL,
  recovery_kdf_parameters TEXT NOT NULL,

  recovery_key_wrap_algorithm TEXT NOT NULL,
  recovery_wrapped_master_key TEXT NOT NULL,
  recovery_wrapped_master_key_nonce TEXT NOT NULL,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS ma_professor_sync_devices (
  account_id TEXT NOT NULL,
  device_id_hash TEXT NOT NULL,

  device_public_key TEXT NOT NULL,

  key_wrap_algorithm TEXT NOT NULL,
  wrapped_master_key TEXT NOT NULL,
  wrapped_master_key_nonce TEXT NOT NULL,

  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,

  PRIMARY KEY (
    account_id,
    device_id_hash
  ),

  FOREIGN KEY (account_id)
    REFERENCES ma_professor_sync_profiles(account_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ma_professor_encrypted_records (
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
  deleted_at INTEGER,

  PRIMARY KEY (
    account_id,
    record_id
  ),

  FOREIGN KEY (account_id)
    REFERENCES ma_professor_sync_profiles(account_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ma_professor_records_sync
  ON ma_professor_encrypted_records (
    account_id,
    server_revision,
    record_id
  );

CREATE INDEX IF NOT EXISTS idx_ma_professor_records_updated
  ON ma_professor_encrypted_records (
    account_id,
    updated_at
  );

CREATE INDEX IF NOT EXISTS idx_ma_professor_devices_active
  ON ma_professor_sync_devices (
    account_id,
    revoked_at,
    last_seen_at
  );
