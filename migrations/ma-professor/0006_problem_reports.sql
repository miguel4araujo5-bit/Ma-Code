-- Relatórios técnicos: sem conteúdo escolar, credenciais ou cópias de segurança.
CREATE TABLE IF NOT EXISTS ma_professor_problem_reports (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  contact_email TEXT,
  error_type TEXT NOT NULL,
  app_version TEXT NOT NULL,
  screen TEXT NOT NULL,
  browser TEXT NOT NULL,
  device TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'resolved')),
  internal_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ma_professor_problem_report_queue
  ON ma_professor_problem_reports(
    CASE status WHEN 'new' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
    created_at DESC
  );
CREATE INDEX IF NOT EXISTS idx_ma_professor_problem_report_account
  ON ma_professor_problem_reports(account_id);
