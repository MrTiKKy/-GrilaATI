-- Foi multiple pe lună (Sheet 1, Sheet 2, …) — ca în Excel
-- 1) Coloană foaie pe programări
ALTER TABLE programari
  ADD COLUMN IF NOT EXISTS foaie integer NOT NULL DEFAULT 1;

ALTER TABLE programari
  DROP CONSTRAINT IF EXISTS programari_foaie_check;

ALTER TABLE programari
  ADD CONSTRAINT programari_foaie_check
  CHECK (foaie >= 1 AND foaie <= 50);

-- Unique pe (angajat, zi, foaie)
ALTER TABLE programari
  DROP CONSTRAINT IF EXISTS programari_angajat_id_data_key;

ALTER TABLE programari
  DROP CONSTRAINT IF EXISTS programari_angajat_data_foaie_key;

ALTER TABLE programari
  ADD CONSTRAINT programari_angajat_data_foaie_key
  UNIQUE (angajat_id, data, foaie);

CREATE INDEX IF NOT EXISTS programari_foaie_data_idx
  ON programari (data, foaie);

-- 2) Metadate: ce foi există pe lună × post
CREATE TABLE IF NOT EXISTS luna_foi (
  an integer NOT NULL CHECK (an >= 2000 AND an <= 2100),
  luna integer NOT NULL CHECK (luna >= 1 AND luna <= 12),
  post text NOT NULL CHECK (post IN ('asistent', 'infirmier')),
  foaie integer NOT NULL CHECK (foaie >= 1 AND foaie <= 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (an, luna, post, foaie)
);

-- Seed Sheet 1 pentru combinații deja folosite (opțional / idempotent la runtime)
