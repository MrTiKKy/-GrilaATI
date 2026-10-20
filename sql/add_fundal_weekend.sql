-- Fundal casuță: alb (default) | weekend (portocaliu ca sâmbătă/duminică)
ALTER TABLE programari
  ADD COLUMN IF NOT EXISTS fundal_weekend boolean NOT NULL DEFAULT false;
