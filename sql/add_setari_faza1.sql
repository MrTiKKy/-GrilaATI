-- Setări faza 1: permisiune poate_modifica_setari pe workspace_members
-- Idempotent. Owner = workspaces.created_by (fără coloană nouă).
-- Rulează: node scripts/apply-setari-faza1.mjs --target=test|prod

BEGIN;

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS poate_modifica_setari boolean NOT NULL DEFAULT false;

COMMIT;
