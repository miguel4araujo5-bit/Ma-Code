-- Diagnóstico de leitura — MA-Professor cloud backup
-- Não altera dados.
-- Objetivo: confirmar se existem perfis legados v2 ainda ativos.

SELECT
  crypto_version,
  COUNT(*) AS total
FROM ma_professor_sync_profiles
WHERE deleted_at IS NULL
GROUP BY crypto_version
ORDER BY crypto_version;
