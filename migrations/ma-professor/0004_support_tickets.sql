-- MA-Professor
-- Pedidos de apoio autenticados e respetiva conversa.
--
-- Privacidade por desenho:
-- - não guarda dados escolares automaticamente;
-- - não guarda IndexedDB, cópias, passwords, exportKey ou credenciais OPAQUE;
-- - a conta é identificada por account_id derivado no Worker após validação da sessão;
-- - não existem anexos nesta versão.

CREATE TABLE IF NOT EXISTS ma_professor_support_tickets (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  app_version TEXT,
  screen TEXT,
  browser TEXT,
  os TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER
);

CREATE TABLE IF NOT EXISTS ma_professor_support_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  author_role TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (ticket_id)
    REFERENCES ma_professor_support_tickets(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ma_professor_support_account_updated
  ON ma_professor_support_tickets (
    account_id,
    updated_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_ma_professor_support_status_updated
  ON ma_professor_support_tickets (
    status,
    updated_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_ma_professor_support_messages_ticket_time
  ON ma_professor_support_messages (
    ticket_id,
    created_at ASC
  );
