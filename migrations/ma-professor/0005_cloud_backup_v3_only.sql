-- MA-Professor: cópias online V3 apenas.
-- Bloquear primeiro as escritas antigas, incluindo Workers ainda não atualizados.
-- Não converter perfis nem alterar a cifra/chaves dos perfis V3 existentes.

CREATE TRIGGER IF NOT EXISTS trg_ma_professor_profile_v3_insert
BEFORE INSERT ON ma_professor_sync_profiles
FOR EACH ROW
WHEN NEW.crypto_version <> 3
  OR NEW.recovery_kdf_algorithm <> 'OPAQUE-RFC9807-EXPORT-HKDF-SHA256'
  OR NEW.recovery_key_wrap_algorithm <> 'AES-256-GCM'
BEGIN
  SELECT RAISE(ABORT, 'MA-Professor cloud profiles must use V3');
END;

CREATE TRIGGER IF NOT EXISTS trg_ma_professor_profile_v3_update
BEFORE UPDATE ON ma_professor_sync_profiles
FOR EACH ROW
WHEN NEW.crypto_version <> 3
  OR NEW.recovery_kdf_algorithm <> 'OPAQUE-RFC9807-EXPORT-HKDF-SHA256'
  OR NEW.recovery_key_wrap_algorithm <> 'AES-256-GCM'
BEGIN
  SELECT RAISE(ABORT, 'MA-Professor cloud profiles must use V3');
END;

CREATE TRIGGER IF NOT EXISTS trg_ma_professor_record_v3_insert
BEFORE INSERT ON ma_professor_encrypted_records
FOR EACH ROW
WHEN NEW.encryption_version <> 3 OR NEW.encryption_algorithm <> 'AES-256-GCM'
BEGIN
  SELECT RAISE(ABORT, 'MA-Professor cloud records must use V3');
END;

CREATE TRIGGER IF NOT EXISTS trg_ma_professor_record_v3_update
BEFORE UPDATE ON ma_professor_encrypted_records
FOR EACH ROW
WHEN NEW.encryption_version <> 3 OR NEW.encryption_algorithm <> 'AES-256-GCM'
BEGIN
  SELECT RAISE(ABORT, 'MA-Professor cloud records must use V3');
END;

CREATE TRIGGER IF NOT EXISTS trg_ma_professor_history_v3_insert
BEFORE INSERT ON ma_professor_encrypted_record_history
FOR EACH ROW
WHEN NEW.encryption_version <> 3 OR NEW.encryption_algorithm <> 'AES-256-GCM'
BEGIN
  SELECT RAISE(ABORT, 'MA-Professor cloud history must use V3');
END;

CREATE TRIGGER IF NOT EXISTS trg_ma_professor_history_v3_update
BEFORE UPDATE ON ma_professor_encrypted_record_history
FOR EACH ROW
WHEN NEW.encryption_version <> 3 OR NEW.encryption_algorithm <> 'AES-256-GCM'
BEGIN
  SELECT RAISE(ABORT, 'MA-Professor cloud history must use V3');
END;

-- A cópia V3 usa a exportKey OPAQUE e não utiliza dispositivos de sync RSA.
CREATE TRIGGER IF NOT EXISTS trg_ma_professor_legacy_device_insert_disabled
BEFORE INSERT ON ma_professor_sync_devices
BEGIN
  SELECT RAISE(ABORT, 'Legacy MA-Professor sync devices are disabled');
END;

CREATE TRIGGER IF NOT EXISTS trg_ma_professor_legacy_device_update_disabled
BEFORE UPDATE ON ma_professor_sync_devices
BEGIN
  SELECT RAISE(ABORT, 'Legacy MA-Professor sync devices are disabled');
END;

-- Limpeza seletiva dos dados de teste antigos, filhos antes dos perfis.
-- Nenhum perfil crypto_version = 3 é apagado, mesmo se estiver marcado como eliminado.
DELETE FROM ma_professor_encrypted_record_history
WHERE encryption_version <> 3
  OR account_id IN (SELECT account_id FROM ma_professor_sync_profiles WHERE crypto_version <> 3);

DELETE FROM ma_professor_encrypted_records
WHERE encryption_version <> 3
  OR account_id IN (SELECT account_id FROM ma_professor_sync_profiles WHERE crypto_version <> 3);

DELETE FROM ma_professor_sync_devices;

DELETE FROM ma_professor_sync_profiles WHERE crypto_version <> 3;
