-- Propuneri faza 8: feedback către dezvoltator (doar CREATE)
-- Idempotent. Rulează: node scripts/apply-propuneri-faza8.mjs --target=test|prod
-- Fără seed; tabelele existente neschimbate.

BEGIN;

CREATE TABLE IF NOT EXISTS propuneri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NULL REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  email_autor text NOT NULL,
  nume_workspace text NULL,
  tip text NOT NULL CHECK (tip IN ('idee', 'problema', 'altceva')),
  titlu text NOT NULL CHECK (
    char_length(titlu) BETWEEN 3 AND 150
  ),
  mesaj text NOT NULL CHECK (
    char_length(mesaj) BETWEEN 10 AND 5000
  ),
  pagina text NULL CHECK (
    pagina IS NULL OR char_length(pagina) <= 300
  ),
  status text NOT NULL DEFAULT 'noua' CHECK (
    status IN ('noua', 'citita', 'rezolvata', 'respinsa')
  ),
  nota_dev text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS propuneri_status_created_idx
  ON propuneri (status, created_at DESC);

CREATE INDEX IF NOT EXISTS propuneri_user_created_idx
  ON propuneri (user_id, created_at DESC);

COMMIT;
