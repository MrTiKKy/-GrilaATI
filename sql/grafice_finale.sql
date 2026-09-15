-- Rulează în Neon SQL Editor (o singură dată)
-- Arhivă salvări grafice (snapshot JSON pe lună)

CREATE TABLE IF NOT EXISTS grafice_finale (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  an int NOT NULL,
  luna int NOT NULL,
  titlu text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grafice_finale_an_luna_idx
  ON grafice_finale (an DESC, luna DESC, created_at DESC);
