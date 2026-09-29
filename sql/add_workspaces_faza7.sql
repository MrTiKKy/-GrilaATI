-- Workspaces faza 7: invitații + nume pe users
-- Idempotent. Rulează: node scripts/apply-workspaces-faza7.mjs --target=test|prod
-- Fără seed; valorile existente neschimbate.

BEGIN;

-- Nume afișat pe cont (nullable — conturile vechi rămân fără)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nume text NULL;

DO $$
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_nume_len
    CHECK (
      nume IS NULL
      OR (
        char_length(btrim(nume)) >= 1
        AND char_length(btrim(nume)) <= 80
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Index unic pe lower(email) — redundant cu UNIQUE(email)+CHECK lower, dar cerut
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx
  ON users (lower(email));

CREATE TABLE IF NOT EXISTS invitatii (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  email text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin', 'editor', 'viewer')),
  poate_modifica_setari boolean NOT NULL DEFAULT false,
  invitat_de uuid NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK (
    status IN ('in_asteptare', 'acceptata', 'refuzata', 'anulata')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  raspuns_la timestamptz NULL,
  CONSTRAINT invitatii_email_lower CHECK (email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS invitatii_pending_unique
  ON invitatii (workspace_id, email)
  WHERE status = 'in_asteptare';

CREATE INDEX IF NOT EXISTS invitatii_email_status_idx
  ON invitatii (email, status);

CREATE INDEX IF NOT EXISTS invitatii_workspace_idx
  ON invitatii (workspace_id, status);

-- Rate limit persistent pentru login / register (curățat în app la >1h)
CREATE TABLE IF NOT EXISTS login_incercari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cheie text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_incercari_cheie_created_idx
  ON login_incercari (cheie, created_at);

CREATE INDEX IF NOT EXISTS login_incercari_created_idx
  ON login_incercari (created_at);

COMMIT;
