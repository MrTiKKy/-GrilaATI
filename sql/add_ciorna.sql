-- Rulează în Neon SQL Editor (o singură dată)
-- Secție pe casuță: A sau R (stocat în `ciorna`, exclusiv una)

ALTER TABLE programari
  ADD COLUMN IF NOT EXISTS ciorna text;

ALTER TABLE programari
  ALTER COLUMN valoare DROP NOT NULL;

-- Opțional: curăță valori vechi "A/R"
UPDATE programari SET ciorna = NULL WHERE ciorna = 'A/R';
