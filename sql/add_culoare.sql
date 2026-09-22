-- Culoare text pe casuță (programare)
ALTER TABLE programari
  ADD COLUMN IF NOT EXISTS culoare text;

ALTER TABLE programari
  DROP CONSTRAINT IF EXISTS programari_culoare_check;

ALTER TABLE programari
  ADD CONSTRAINT programari_culoare_check
  CHECK (
    culoare IS NULL
    OR culoare IN ('black', 'red', 'blue', 'green', 'yellow')
  );

-- null / black = negru (default)
UPDATE programari SET culoare = NULL WHERE culoare = 'black';
