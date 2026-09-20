-- Rulează în Neon SQL Editor (o singură dată)
-- Permite valorile noi pe casuță: '-' și 'CIC'

ALTER TABLE programari
  DROP CONSTRAINT IF EXISTS programari_valoare_check;

ALTER TABLE programari
  ADD CONSTRAINT programari_valoare_check
  CHECK (
    valoare IS NULL
    OR valoare IN ('1', '2', '1/3', '2*', 'L', 'CO', 'CM', '-', 'CIC')
  );
