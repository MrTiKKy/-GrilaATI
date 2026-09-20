-- Rulează în Neon SQL Editor (o singură dată)
-- Post angajat: asistent | infirmier (pentru grile / PDF separate)

ALTER TABLE angajati
  ADD COLUMN IF NOT EXISTS post text NOT NULL DEFAULT 'asistent';

-- Normalizează valori vechi / goale
UPDATE angajati
SET post = 'asistent'
WHERE post IS NULL OR post = '' OR post NOT IN ('asistent', 'infirmier');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'angajati_post_check'
  ) THEN
    ALTER TABLE angajati
      ADD CONSTRAINT angajati_post_check
      CHECK (post IN ('asistent', 'infirmier'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS angajati_post_ordine_idx
  ON angajati (post, ordine);
