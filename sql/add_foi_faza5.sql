-- Foi faza 5: nume opțional pe luna_foi
-- Idempotent. Rulează: node scripts/apply-foi-faza5.mjs --target=test|prod
-- Valorile existente rămân; doar ADD COLUMN nullable + CHECK pe nume.

BEGIN;

ALTER TABLE luna_foi
  ADD COLUMN IF NOT EXISTS nume text NULL;

DO $$
BEGIN
  ALTER TABLE luna_foi
    ADD CONSTRAINT luna_foi_nume_len
    CHECK (
      nume IS NULL
      OR (
        char_length(btrim(nume)) >= 1
        AND char_length(btrim(nume)) <= 40
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
