-- Rulează în Neon SQL Editor (o singură dată)
-- Jurnal acțiuni sensibile (login, CRUD, export arhivă)

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  resource text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON audit_log (action);
