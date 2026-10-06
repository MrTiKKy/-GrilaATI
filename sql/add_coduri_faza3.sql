-- Coduri faza 3: coduri de celulă editabile per workspace
-- Idempotent. Rulează: node scripts/apply-coduri-faza3.mjs --target=test|prod
-- Valorile din programari.valoare rămân; doar DROP pe CHECK + CREATE TABLE + ADD COLUMN.

BEGIN;

CREATE TABLE IF NOT EXISTS coduri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  categorie_id uuid NULL,
  cod text NOT NULL,
  eticheta text NOT NULL,
  culoare text NOT NULL,
  ordine int NOT NULL,
  activ boolean NOT NULL DEFAULT true,
  sistem text NULL CHECK (sistem IS NULL OR sistem IN ('CO', 'CM', 'CIC')),
  comportament_vechi text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coduri_cod_len CHECK (char_length(cod) >= 1 AND char_length(cod) <= 20),
  CONSTRAINT coduri_categorie_workspace_fkey
    FOREIGN KEY (categorie_id, workspace_id)
    REFERENCES categorii (id, workspace_id)
);

-- Unicitate: același cod nu se repetă în workspace pentru aceeași categorie
-- (NULL categorie = comun → uuid zero în index)
CREATE UNIQUE INDEX IF NOT EXISTS coduri_workspace_categorie_cod_uidx
  ON coduri (
    workspace_id,
    (COALESCE(categorie_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    cod
  );

CREATE INDEX IF NOT EXISTS coduri_workspace_ordine_idx
  ON coduri (workspace_id, ordine);

-- Seed cele 9 coduri comune (ordine = pop-up actual, fără „Gol”)
INSERT INTO coduri (
  workspace_id, categorie_id, cod, eticheta, culoare, ordine, activ, sistem, comportament_vechi
)
SELECT
  w.id,
  NULL,
  v.cod,
  v.eticheta,
  v.culoare,
  v.ordine,
  true,
  v.sistem,
  v.comportament_vechi
FROM workspaces w
CROSS JOIN (
  VALUES
    (1, '-', '-', '#111111', NULL::text, '-'),
    (2, '1', '1', '#111111', NULL, '1'),
    (3, '2', '2', '#111111', NULL, '2'),
    (4, '1/3', '1/3', '#111111', NULL, '1/3'),
    (5, '2*', '2*', '#111111', NULL, '2*'),
    (6, 'L', 'L', '#111111', NULL, 'L'),
    (7, 'CO', 'CO', '#111111', 'CO', 'CO'),
    (8, 'CM', 'CM', '#111111', 'CM', 'CM'),
    (9, 'CIC', 'CIC', '#111111', 'CIC', 'CIC')
) AS v(ordine, cod, eticheta, culoare, sistem, comportament_vechi)
WHERE NOT EXISTS (
  SELECT 1 FROM coduri c
  WHERE c.workspace_id = w.id
    AND c.categorie_id IS NULL
    AND c.cod = v.cod
);

ALTER TABLE categorii
  ADD COLUMN IF NOT EXISTS permite_text_liber boolean NOT NULL DEFAULT false;

-- Scoate CHECK-ul pe valoare (valorile existente rămân)
ALTER TABLE programari DROP CONSTRAINT IF EXISTS programari_valoare_check;

COMMIT;
