-- Texte faza 6: valori editabile per workspace (lipsa rândului = implicit din cod)
-- Idempotent. Rulează: node scripts/apply-texte-faza6.mjs --target=test|prod
-- Nu modifică tabele existente; fără seed.

BEGIN;

CREATE TABLE IF NOT EXISTS texte (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  cheie text NOT NULL,
  valoare text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES users(id),
  PRIMARY KEY (workspace_id, cheie),
  CONSTRAINT texte_valoare_len CHECK (char_length(valoare) <= 500)
);

CREATE INDEX IF NOT EXISTS texte_workspace_idx
  ON texte (workspace_id);

COMMIT;
