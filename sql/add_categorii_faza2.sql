-- Categorii faza 2: taburi editabile per workspace
-- Idempotent. Rulează: node scripts/apply-categorii-faza2.mjs --target=test|prod
-- Valorile vechi pe post rămân; doar ADD COLUMN / UPDATE pe coloane noi / PK / DROP CHECK|NOT NULL pe post.

BEGIN;

CREATE TABLE IF NOT EXISTS categorii (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  nume text NOT NULL,
  titlu_grafic text NOT NULL,
  ordine int NOT NULL,
  activ boolean NOT NULL DEFAULT true,
  post_vechi text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, workspace_id),
  UNIQUE (workspace_id, post_vechi)
);

-- Seed Asistenți / Infirmiere pentru fiecare workspace (idempotent pe post_vechi)
INSERT INTO categorii (workspace_id, nume, titlu_grafic, ordine, activ, post_vechi)
SELECT
  w.id,
  'Asistenți',
  'S.C.J.U. BRAILA - GRAFIC ASISTENTI ATI II',
  1,
  true,
  'asistent'
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM categorii c
  WHERE c.workspace_id = w.id AND c.post_vechi = 'asistent'
);

INSERT INTO categorii (workspace_id, nume, titlu_grafic, ordine, activ, post_vechi)
SELECT
  w.id,
  'Infirmiere',
  'S.C.J.U. BRAILA - GRAFIC INFIRMIERE ATI',
  2,
  true,
  'infirmier'
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM categorii c
  WHERE c.workspace_id = w.id AND c.post_vechi = 'infirmier'
);

ALTER TABLE angajati ADD COLUMN IF NOT EXISTS categorie_id uuid;
ALTER TABLE luna_foi ADD COLUMN IF NOT EXISTS categorie_id uuid;
ALTER TABLE ore_osd ADD COLUMN IF NOT EXISTS categorie_id uuid;

-- Completează doar coloanele noi din post_vechi (același workspace)
UPDATE angajati a
SET categorie_id = c.id
FROM categorii c
WHERE a.categorie_id IS NULL
  AND c.workspace_id = a.workspace_id
  AND c.post_vechi = a.post;

UPDATE luna_foi lf
SET categorie_id = c.id
FROM categorii c
WHERE lf.categorie_id IS NULL
  AND c.workspace_id = lf.workspace_id
  AND c.post_vechi = lf.post;

UPDATE ore_osd o
SET categorie_id = c.id
FROM categorii c
WHERE o.categorie_id IS NULL
  AND c.workspace_id = o.workspace_id
  AND c.post_vechi = o.post;

-- NOT NULL pe tabelele migrate
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'angajati'
      AND column_name = 'categorie_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE angajati ALTER COLUMN categorie_id SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'luna_foi'
      AND column_name = 'categorie_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE luna_foi ALTER COLUMN categorie_id SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ore_osd'
      AND column_name = 'categorie_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE ore_osd ALTER COLUMN categorie_id SET NOT NULL;
  END IF;
END $$;

-- FK compus (categorie_id, workspace_id) → categorii(id, workspace_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'angajati_categorie_workspace_fkey'
  ) THEN
    ALTER TABLE angajati
      ADD CONSTRAINT angajati_categorie_workspace_fkey
      FOREIGN KEY (categorie_id, workspace_id)
      REFERENCES categorii (id, workspace_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'luna_foi_categorie_workspace_fkey'
  ) THEN
    ALTER TABLE luna_foi
      ADD CONSTRAINT luna_foi_categorie_workspace_fkey
      FOREIGN KEY (categorie_id, workspace_id)
      REFERENCES categorii (id, workspace_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ore_osd_categorie_workspace_fkey'
  ) THEN
    ALTER TABLE ore_osd
      ADD CONSTRAINT ore_osd_categorie_workspace_fkey
      FOREIGN KEY (categorie_id, workspace_id)
      REFERENCES categorii (id, workspace_id);
  END IF;
END $$;

-- PK noi pe luna_foi / ore_osd
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'luna_foi_pkey' AND conrelid = 'public.luna_foi'::regclass
  ) THEN
    ALTER TABLE luna_foi DROP CONSTRAINT luna_foi_pkey;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'luna_foi_pkey' AND conrelid = 'public.luna_foi'::regclass
  ) THEN
    ALTER TABLE luna_foi
      ADD CONSTRAINT luna_foi_pkey
      PRIMARY KEY (workspace_id, categorie_id, an, luna, foaie);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ore_osd_pkey' AND conrelid = 'public.ore_osd'::regclass
  ) THEN
    ALTER TABLE ore_osd DROP CONSTRAINT ore_osd_pkey;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ore_osd_pkey' AND conrelid = 'public.ore_osd'::regclass
  ) THEN
    ALTER TABLE ore_osd
      ADD CONSTRAINT ore_osd_pkey
      PRIMARY KEY (workspace_id, categorie_id, zi, schimb);
  END IF;
END $$;

-- post: scoate CHECK + NOT NULL + DEFAULT (valorile existente rămân; rânduri noi pot avea NULL)
ALTER TABLE angajati DROP CONSTRAINT IF EXISTS angajati_post_check;
ALTER TABLE angajati ALTER COLUMN post DROP DEFAULT;
ALTER TABLE angajati ALTER COLUMN post DROP NOT NULL;
ALTER TABLE luna_foi DROP CONSTRAINT IF EXISTS luna_foi_post_check;
ALTER TABLE luna_foi ALTER COLUMN post DROP NOT NULL;
ALTER TABLE ore_osd DROP CONSTRAINT IF EXISTS ore_osd_post_check;
ALTER TABLE ore_osd ALTER COLUMN post DROP NOT NULL;

CREATE INDEX IF NOT EXISTS angajati_workspace_categorie_ordine_idx
  ON angajati (workspace_id, categorie_id, ordine);

CREATE INDEX IF NOT EXISTS categorii_workspace_ordine_idx
  ON categorii (workspace_id, ordine);

COMMIT;
