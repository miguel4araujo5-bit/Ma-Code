-- MA-Professor
-- Metadados mínimos para limitar abuso do endpoint de reporte técnico.
--
-- Esta tabela NÃO guarda relatórios, dados escolares, emails, IPs em claro,
-- conteúdos do IndexedDB, ficheiros ou passwords.
-- O Worker guarda apenas um hash de origem com rotação diária e o instante
-- de cada relatório aceite para aplicar limites de frequência.

CREATE TABLE IF NOT EXISTS ma_professor_problem_report_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  origin_hash TEXT NOT NULL,

  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ma_professor_problem_report_origin_time
  ON ma_professor_problem_report_rate_limits (
    origin_hash,
    created_at
  );

CREATE INDEX IF NOT EXISTS idx_ma_professor_problem_report_time
  ON ma_professor_problem_report_rate_limits (
    created_at
  );
