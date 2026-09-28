-- Ore faza 4: ore pe cod pe V/S/D per categorie (înlocuiește citirea din ore_osd)
-- Idempotent. Rulează: node scripts/apply-ore-faza4.mjs --target=test|prod
-- ore_osd / programari / coduri rămân neschimbate (doar CREATE + INSERT în tabel nou).

BEGIN;

-- Pentru FK compus (cod_id, workspace_id) → coduri
DO $$
BEGIN
  ALTER TABLE coduri
    ADD CONSTRAINT coduri_id_workspace_id_key UNIQUE (id, workspace_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ore_coduri (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  categorie_id uuid NOT NULL,
  cod_id uuid NOT NULL,
  ore_vineri numeric(4,2) NOT NULL DEFAULT 0,
  ore_sambata numeric(4,2) NOT NULL DEFAULT 0,
  ore_duminica numeric(4,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, categorie_id, cod_id),
  CONSTRAINT ore_coduri_categorie_workspace_fkey
    FOREIGN KEY (categorie_id, workspace_id)
    REFERENCES categorii (id, workspace_id),
  CONSTRAINT ore_coduri_cod_workspace_fkey
    FOREIGN KEY (cod_id, workspace_id)
    REFERENCES coduri (id, workspace_id),
  CONSTRAINT ore_coduri_vineri_range CHECK (ore_vineri >= 0 AND ore_vineri <= 24),
  CONSTRAINT ore_coduri_sambata_range CHECK (ore_sambata >= 0 AND ore_sambata <= 24),
  CONSTRAINT ore_coduri_duminica_range CHECK (ore_duminica >= 0 AND ore_duminica <= 24)
);

CREATE INDEX IF NOT EXISTS ore_coduri_categorie_idx
  ON ore_coduri (workspace_id, categorie_id);

-- Seed: reproduce exact weekendOre + ore_osd
-- comportament = coalesce(comportament_vechi, cod)
-- V: doar dacă comportament = '1/3' → ore_osd(V,1/3); altfel 0
-- S/D: dacă comportament IN ('1','1/3','2') → ore_osd(zi, comportament); altfel 0
INSERT INTO ore_coduri (
  workspace_id, categorie_id, cod_id,
  ore_vineri, ore_sambata, ore_duminica, updated_at
)
SELECT
  cat.workspace_id,
  cat.id,
  c.id,
  CASE
    WHEN coalesce(c.comportament_vechi, c.cod) = '1/3' THEN coalesce((
      SELECT o.ore FROM ore_osd o
      WHERE o.workspace_id = cat.workspace_id
        AND o.categorie_id = cat.id
        AND o.zi = 'V' AND o.schimb = '1/3'
    ), 0)
    ELSE 0
  END,
  CASE
    WHEN coalesce(c.comportament_vechi, c.cod) IN ('1', '1/3', '2') THEN coalesce((
      SELECT o.ore FROM ore_osd o
      WHERE o.workspace_id = cat.workspace_id
        AND o.categorie_id = cat.id
        AND o.zi = 'S' AND o.schimb = coalesce(c.comportament_vechi, c.cod)
    ), 0)
    ELSE 0
  END,
  CASE
    WHEN coalesce(c.comportament_vechi, c.cod) IN ('1', '1/3', '2') THEN coalesce((
      SELECT o.ore FROM ore_osd o
      WHERE o.workspace_id = cat.workspace_id
        AND o.categorie_id = cat.id
        AND o.zi = 'D' AND o.schimb = coalesce(c.comportament_vechi, c.cod)
    ), 0)
    ELSE 0
  END,
  now()
FROM categorii cat
INNER JOIN coduri c
  ON c.workspace_id = cat.workspace_id
 AND (c.categorie_id IS NULL OR c.categorie_id = cat.id)
ON CONFLICT (workspace_id, categorie_id, cod_id) DO NOTHING;

COMMIT;
