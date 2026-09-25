-- Multi-tenant workspaces (branch Neon `separare-conturi` ONLY)
-- Idempotent. Rulează: node --env-file=.env.local scripts/run-add-workspaces.mjs
-- NU rula pe baza principală.

BEGIN;

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nume text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('admin', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx
  ON workspace_members (user_id);

-- Seed ATI Brăila + admin membership (idempotent)
DO $$
DECLARE
  admin_id uuid;
  ws_id uuid;
BEGIN
  SELECT id INTO admin_id FROM users WHERE email = 'popanicol24@gmail.com' LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'users popanicol24@gmail.com lipsește';
  END IF;

  SELECT w.id INTO ws_id
  FROM workspaces w
  WHERE w.nume = 'ATI Brăila' AND w.created_by = admin_id
  LIMIT 1;

  IF ws_id IS NULL THEN
    INSERT INTO workspaces (nume, created_by)
    VALUES ('ATI Brăila', admin_id)
    RETURNING id INTO ws_id;
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, rol)
  VALUES (ws_id, admin_id, 'admin')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Attach existing rows (ONLY fills NULL workspace_id)
  ALTER TABLE angajati ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
  ALTER TABLE programari ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
  ALTER TABLE luna_foi ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
  ALTER TABLE grafice_finale ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
  ALTER TABLE ore_osd ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
  ALTER TABLE grafic_footer ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);

  UPDATE angajati SET workspace_id = ws_id WHERE workspace_id IS NULL;
  UPDATE programari SET workspace_id = ws_id WHERE workspace_id IS NULL;
  UPDATE luna_foi SET workspace_id = ws_id WHERE workspace_id IS NULL;
  UPDATE grafice_finale SET workspace_id = ws_id WHERE workspace_id IS NULL;
  UPDATE ore_osd SET workspace_id = ws_id WHERE workspace_id IS NULL;
  UPDATE grafic_footer SET workspace_id = ws_id WHERE workspace_id IS NULL;

  ALTER TABLE angajati ALTER COLUMN workspace_id SET NOT NULL;
  ALTER TABLE programari ALTER COLUMN workspace_id SET NOT NULL;
  ALTER TABLE luna_foi ALTER COLUMN workspace_id SET NOT NULL;
  ALTER TABLE grafice_finale ALTER COLUMN workspace_id SET NOT NULL;
  ALTER TABLE ore_osd ALTER COLUMN workspace_id SET NOT NULL;
  ALTER TABLE grafic_footer ALTER COLUMN workspace_id SET NOT NULL;
END $$;

-- angajati: composite unique + index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'angajati_id_workspace_key'
  ) THEN
    ALTER TABLE angajati
      ADD CONSTRAINT angajati_id_workspace_key UNIQUE (id, workspace_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS angajati_workspace_post_ordine_idx
  ON angajati (workspace_id, post, ordine);

-- programari: composite FK + index (păstrează FK-ul existent pe angajat_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'programari_angajat_workspace_fkey'
  ) THEN
    ALTER TABLE programari
      ADD CONSTRAINT programari_angajat_workspace_fkey
      FOREIGN KEY (angajat_id, workspace_id)
      REFERENCES angajati (id, workspace_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS programari_workspace_data_foaie_idx
  ON programari (workspace_id, data, foaie);

-- luna_foi: PK (workspace_id, an, luna, post, foaie)
DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT c.conname INTO pk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'luna_foi' AND c.contype = 'p';

  IF pk_name IS NOT NULL THEN
    -- Recreează doar dacă nu include deja workspace_id
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
      WHERE n.nspname = 'public' AND t.relname = 'luna_foi' AND c.contype = 'p'
        AND a.attname = 'workspace_id'
    ) THEN
      EXECUTE format('ALTER TABLE luna_foi DROP CONSTRAINT %I', pk_name);
      ALTER TABLE luna_foi
        ADD CONSTRAINT luna_foi_pkey PRIMARY KEY (workspace_id, an, luna, post, foaie);
    END IF;
  ELSE
    ALTER TABLE luna_foi
      ADD CONSTRAINT luna_foi_pkey PRIMARY KEY (workspace_id, an, luna, post, foaie);
  END IF;
END $$;

-- ore_osd: PK (workspace_id, post, zi, schimb)
DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT c.conname INTO pk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'ore_osd' AND c.contype = 'p';

  IF pk_name IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
    WHERE n.nspname = 'public' AND t.relname = 'ore_osd' AND c.contype = 'p'
      AND a.attname = 'workspace_id'
  ) THEN
    EXECUTE format('ALTER TABLE ore_osd DROP CONSTRAINT %I', pk_name);
    ALTER TABLE ore_osd
      ADD CONSTRAINT ore_osd_pkey PRIMARY KEY (workspace_id, post, zi, schimb);
  ELSIF pk_name IS NULL THEN
    ALTER TABLE ore_osd
      ADD CONSTRAINT ore_osd_pkey PRIMARY KEY (workspace_id, post, zi, schimb);
  END IF;
END $$;

-- grafic_footer: PK (workspace_id, key)
DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT c.conname INTO pk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'grafic_footer' AND c.contype = 'p';

  IF pk_name IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
    WHERE n.nspname = 'public' AND t.relname = 'grafic_footer' AND c.contype = 'p'
      AND a.attname = 'workspace_id'
  ) THEN
    EXECUTE format('ALTER TABLE grafic_footer DROP CONSTRAINT %I', pk_name);
    ALTER TABLE grafic_footer
      ADD CONSTRAINT grafic_footer_pkey PRIMARY KEY (workspace_id, key);
  ELSIF pk_name IS NULL THEN
    ALTER TABLE grafic_footer
      ADD CONSTRAINT grafic_footer_pkey PRIMARY KEY (workspace_id, key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS grafice_finale_workspace_an_luna_created_idx
  ON grafice_finale (workspace_id, an DESC, luna DESC, created_at DESC);

-- audit_log: coloane noi NULL, fără backfill
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audit_log_workspace_created_idx
  ON audit_log (workspace_id, created_at DESC);

COMMIT;
