-- Tabel ore O.SD (rulează în Neon dacă nu există deja)
-- post × zi × schimb → ore

CREATE TABLE IF NOT EXISTS ore_osd (
  post text NOT NULL CHECK (post IN ('asistent', 'infirmier')),
  zi text NOT NULL CHECK (zi IN ('V', 'S', 'D')),
  schimb text NOT NULL CHECK (schimb IN ('1', '1/3', '2')),
  ore numeric(5,1) NOT NULL CHECK (ore >= 0 AND ore <= 48),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post, zi, schimb)
);

-- Seed (valorile curente) — idempotent
INSERT INTO ore_osd (post, zi, schimb, ore) VALUES
  ('asistent', 'V', '1/3', 7),
  ('asistent', 'S', '1', 8),
  ('asistent', 'S', '1/3', 18),
  ('asistent', 'S', '2', 6),
  ('asistent', 'D', '1', 8),
  ('asistent', 'D', '1/3', 11),
  ('asistent', 'D', '2', 6),
  ('infirmier', 'V', '1/3', 6),
  ('infirmier', 'S', '1', 8),
  ('infirmier', 'S', '1/3', 17),
  ('infirmier', 'S', '2', 7),
  ('infirmier', 'D', '1', 8),
  ('infirmier', 'D', '1/3', 11),
  ('infirmier', 'D', '2', 7)
ON CONFLICT (post, zi, schimb) DO NOTHING;
